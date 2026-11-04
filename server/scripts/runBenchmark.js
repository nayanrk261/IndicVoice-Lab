import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { evaluateTranscript } from '../src/lib/evaluationEngine.js';
import { transcribeAudioWithMetadata } from '../src/services/gnaniService.js';

const defaultManifestPath = path.resolve(process.cwd(), 'benchmarks/manifest.json');
const defaultReportPath = path.resolve(process.cwd(), 'benchmarks/reports/latest-report.json');

const mimeTypes = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg'
};

const resolveRelativePath = (rootDir, candidate) => {
  if (!candidate) {
    return null;
  }

  return path.isAbsolute(candidate) ? candidate : path.resolve(rootDir, candidate);
};

const readReferenceTranscript = async (rootDir, caseEntry) => {
  if (typeof caseEntry.referenceTranscript === 'string') {
    return caseEntry.referenceTranscript.trim();
  }

  const referenceTranscriptFile = caseEntry.referenceTranscriptFile
    ? resolveRelativePath(rootDir, caseEntry.referenceTranscriptFile)
    : null;

  if (!referenceTranscriptFile) {
    throw new Error(`Benchmark case ${caseEntry.id || 'unknown'} is missing a reference transcript.`);
  }

  return (await fs.readFile(referenceTranscriptFile, 'utf8')).trim();
};

const createSummaryBucket = () => ({
  total: 0,
  passed: 0,
  failed: 0,
  apiErrors: 0,
  runtimeErrors: 0,
  validationErrors: 0,
  skipped: 0
});

const normalizeLocaleConfig = (caseEntry, manifest) => {
  const languageConfig =
    caseEntry && typeof caseEntry.languageConfig === 'object' && !Array.isArray(caseEntry.languageConfig)
      ? caseEntry.languageConfig
      : {};

  const fallbackLanguageCode = caseEntry.language || manifest.defaultLanguage || 'unknown';
  return {
    languageCode: languageConfig.languageCode || fallbackLanguageCode,
    preferredLanguage: languageConfig.preferredLanguage || languageConfig.languageCode || fallbackLanguageCode,
    format: languageConfig.format || 'transcribe',
    itnNativeNumerals:
      typeof languageConfig.itnNativeNumerals === 'boolean' ? languageConfig.itnNativeNumerals : true
  };
};

const validateManifestCaseEntry = (caseEntry) => {
  const errors = [];

  if (!caseEntry || typeof caseEntry !== 'object' || Array.isArray(caseEntry)) {
    errors.push('Case entry must be a JSON object.');
    return errors;
  }

  if (typeof caseEntry.id !== 'string' || !caseEntry.id.trim()) {
    errors.push('Case entry is missing a non-empty id.');
  }

  if (typeof caseEntry.language !== 'string' || !caseEntry.language.trim()) {
    errors.push('Case entry is missing a non-empty language.');
  }

  if (typeof caseEntry.audioFile !== 'string' || !caseEntry.audioFile.trim()) {
    errors.push('Case entry is missing a non-empty audioFile path.');
  }

  const hasInlineReferenceTranscript = typeof caseEntry.referenceTranscript === 'string';
  const hasReferenceTranscriptFile =
    typeof caseEntry.referenceTranscriptFile === 'string' && caseEntry.referenceTranscriptFile.trim().length > 0;

  if (!hasInlineReferenceTranscript && !hasReferenceTranscriptFile) {
    errors.push('Case entry must define referenceTranscript or referenceTranscriptFile.');
  }

  return errors;
};

const coerceEntities = (value) => {
  if (!value) {
    return { expected: {}, actual: {} };
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return {
      expected: value.expected ?? value,
      actual: value.actual ?? (value.expected ?? value)
    };
  }

  return { expected: {}, actual: {} };
};

const detectMimeType = (audioPath) => mimeTypes[path.extname(audioPath).toLowerCase()] || 'application/octet-stream';

const classifyErrorType = (error) => {
  const message = String(error?.message || '');

  if (/^Gnani API request failed/i.test(message) || /^Gnani API returned/i.test(message)) {
    return 'api';
  }

  if (/missing a reference transcript|no such file|not found/i.test(message)) {
    return 'validation';
  }

  return 'runtime';
};

const createTimestampSuffix = (value = new Date()) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  const hour = String(value.getUTCHours()).padStart(2, '0');
  const minute = String(value.getUTCMinutes()).padStart(2, '0');
  const second = String(value.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}Z`;
};

const resolveReportOutputPath = async (requestedPath, options = {}) => {
  if (options.overwrite === true) {
    return requestedPath;
  }

  const alreadyExists = await fs
    .stat(requestedPath)
    .then(() => true)
    .catch(() => false);

  if (!alreadyExists) {
    return requestedPath;
  }

  const extension = path.extname(requestedPath);
  const baseName = path.basename(requestedPath, extension);
  const parent = path.dirname(requestedPath);
  const candidate = path.join(parent, `${baseName}-${createTimestampSuffix()}${extension || '.json'}`);
  return candidate;
};

const defaultTranscribeFn = async ({ audioPath, localeConfig }) => {
  const result = await transcribeAudioWithMetadata(audioPath, {
    originalName: path.basename(audioPath),
    contentType: detectMimeType(audioPath),
    languageCode: localeConfig.languageCode,
    preferredLanguage: localeConfig.preferredLanguage
  });

  return {
    transcript: result.transcript,
    metadata: result.metadata
  };
};

export async function executeBenchmark(manifestPath, options = {}) {
  const logger = options.logger ?? console;
  const rootDir = path.dirname(manifestPath);
  const manifestText = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  const cases = Array.isArray(manifest) ? manifest : Array.isArray(manifest.cases) ? manifest.cases : [];

  const summary = {};
  const results = [];
  const transcribeFn = options.transcribeFn ?? defaultTranscribeFn;

  for (const caseEntry of cases) {
    const caseValidationErrors = validateManifestCaseEntry(caseEntry);
    const language =
      typeof caseEntry?.language === 'string' && caseEntry.language.trim()
        ? caseEntry.language.trim()
        : manifest.defaultLanguage || 'unknown';
    const localeConfig = normalizeLocaleConfig(caseEntry, manifest);
    if (!summary[language]) {
      summary[language] = createSummaryBucket();
    }

    const result = {
      id: caseEntry.id || 'unnamed-case',
      language,
      category: caseEntry.category || language,
      audioFile: caseEntry.audioFile || null,
      placeholder: caseEntry.placeholder === true,
      notes: caseEntry.notes || '',
      expectedTranscript: '',
      actualTranscript: '',
      wordErrorRate: null,
      characterErrorRate: null,
      substitutions: 0,
      deletions: 0,
      insertions: 0,
      criticalEntities: {
        total: 0,
        matches: 0,
        mismatches: 0,
        items: []
      },
      apiSuccess: false,
      apiError: null,
      model: null,
      locale: localeConfig,
      processingMetadata: null,
      status: 'not-run'
    };

    summary[language].total += 1;

    if (caseValidationErrors.length > 0) {
      result.apiError = {
        message: caseValidationErrors.join(' '),
        type: 'validation'
      };
      result.status = 'failed';
      summary[language].validationErrors += 1;
      summary[language].failed += 1;
      results.push(result);
      continue;
    }

    if (caseEntry.placeholder === true) {
      result.status = 'skipped';
      result.apiError = {
        message: 'Placeholder benchmark case. Replace with real recording and transcript before live runs.',
        type: 'validation'
      };
      summary[language].skipped += 1;
      results.push(result);
      continue;
    }

    const resolvedAudioPath = resolveRelativePath(rootDir, caseEntry.audioFile);
    if (!resolvedAudioPath || !(await fs.stat(resolvedAudioPath).then(() => true).catch(() => false))) {
      result.apiError = {
        message: `Audio file not found: ${caseEntry.audioFile || 'missing file path'}`,
        type: 'validation'
      };
      result.status = 'failed';
      summary[language].validationErrors += 1;
      summary[language].failed += 1;
      results.push(result);
      continue;
    }

    try {
      result.expectedTranscript = await readReferenceTranscript(rootDir, caseEntry);
      const transcription = await transcribeFn({
        audioPath: resolvedAudioPath,
        language,
        localeConfig,
        caseEntry,
        rootDir
      });

      result.actualTranscript = transcription?.transcript ?? '';
      result.model = transcription?.metadata?.model ?? null;
      result.processingMetadata = transcription?.metadata ?? null;
      result.locale = {
        languageCode: transcription?.metadata?.locale?.languageCode ?? localeConfig.languageCode,
        preferredLanguage: transcription?.metadata?.locale?.preferredLanguage ?? localeConfig.preferredLanguage,
        format: transcription?.metadata?.locale?.format ?? localeConfig.format,
        itnNativeNumerals: transcription?.metadata?.locale?.itnNativeNumerals ?? localeConfig.itnNativeNumerals
      };
      result.apiSuccess = true;

      const entityData = coerceEntities(caseEntry.expectedEntities);
      const evaluation = evaluateTranscript(result.expectedTranscript, result.actualTranscript, entityData);
      result.wordErrorRate = Number(evaluation.wordErrorRate);
      result.characterErrorRate = Number(evaluation.characterErrorRate);
      result.substitutions = evaluation.substitutions;
      result.deletions = evaluation.deletions;
      result.insertions = evaluation.insertions;
      result.criticalEntities = evaluation.criticalEntities;
      result.status = evaluation.status;

      if (evaluation.status === 'pass') {
        summary[language].passed += 1;
      } else {
        summary[language].failed += 1;
      }
    } catch (error) {
      const errorType = classifyErrorType(error);
      result.apiError = {
        message: error?.message || 'Unknown benchmark error',
        type: errorType
      };
      result.status = 'failed';
      result.apiSuccess = false;
      if (errorType === 'api') {
        summary[language].apiErrors += 1;
      } else if (errorType === 'validation') {
        summary[language].validationErrors += 1;
      } else {
        summary[language].runtimeErrors += 1;
      }
      summary[language].failed += 1;
      logger.error(`Benchmark case ${result.id} failed: ${result.apiError.message}`);
    }

    results.push(result);
  }

  const report = {
    benchmarkName: manifest.benchmarkName || path.basename(manifestPath),
    generatedAt: new Date().toISOString(),
    summary,
    cases: results
  };

  return report;
}

const parseArgs = (argv) => {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const nextToken = argv[index + 1];

    if (nextToken && !nextToken.startsWith('--')) {
      args[key] = nextToken;
      index += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
};

const printSummary = (report, logger) => {
  logger.log(`Benchmark: ${report.benchmarkName}`);
  logger.log('Language summary:');

  for (const [language, summary] of Object.entries(report.summary)) {
    logger.log(
      `  ${language}: total=${summary.total}, passed=${summary.passed}, failed=${summary.failed}, apiErrors=${summary.apiErrors}, validationErrors=${summary.validationErrors}, runtimeErrors=${summary.runtimeErrors}, skipped=${summary.skipped}`
    );
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = resolveRelativePath(process.cwd(), args.manifest || defaultManifestPath);
  const reportPath = resolveRelativePath(process.cwd(), args.report || defaultReportPath);
  const liveMode = args.live === true;

  if (!liveMode) {
    console.warn('Benchmark dry-run enabled. No live Gnani calls were made. Add --live to send recordings to the configured Gnani API.');
  }

  const report = await executeBenchmark(manifestPath, {
    live: liveMode,
    logger: console,
    transcribeFn: liveMode
      ? undefined
      : async ({ audioPath, language, caseEntry }) => {
          throw new Error(`Dry-run benchmark skipped live call for ${caseEntry.id}. Use --live to send audio to Gnani.`);
        }
  });

  const outputReportPath = await resolveReportOutputPath(reportPath, {
    overwrite: args.overwrite === true
  });

  await fs.mkdir(path.dirname(outputReportPath), { recursive: true });
  await fs.writeFile(outputReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  printSummary(report, console);
  console.log(`Report saved to ${outputReportPath}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export { defaultTranscribeFn, parseArgs, printSummary, resolveReportOutputPath };
