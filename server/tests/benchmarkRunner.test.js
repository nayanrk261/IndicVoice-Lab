import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { executeBenchmark, resolveReportOutputPath } from '../scripts/runBenchmark.js';

test('benchmark runner evaluates a mocked Gnani transcript using the existing evaluation engine', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'benchmark-runner-'));
  const audioPath = path.join(tempDir, 'sample.wav');
  await fs.writeFile(audioPath, Buffer.from('RIFF....WAVE', 'ascii'));

  const manifestPath = path.join(tempDir, 'manifest.json');
  await fs.writeFile(
    manifestPath,
    JSON.stringify({
      benchmarkName: 'mocked benchmark',
      cases: [
        {
          id: 'hi-001',
          language: 'hi-IN',
          audioFile: 'sample.wav',
          referenceTranscript: 'नमस्ते दुनिया',
          expectedEntities: {
            expected: { city: 'दिल्ली' },
            actual: { city: 'दिल्ली' }
          },
          notes: 'mocked Hindi sample'
        }
      ]
    })
  );

  const report = await executeBenchmark(manifestPath, {
    logger: { log() {}, error() {} },
    transcribeFn: async ({ language, audioPath: actualFilePath }) => ({
      transcript: 'नमस्ते दुनिया',
      metadata: {
        model: 'prisma-v2.5',
        locale: {
          languageCode: language,
          preferredLanguage: language,
          format: 'transcribe',
          itnNativeNumerals: true
        },
        requestId: 'req-123',
        output: { literal: 'नमस्ते दुनिया' }
      },
      filePath: actualFilePath
    })
  });

  assert.equal(report.summary['hi-IN'].passed, 1);
  assert.equal(report.cases[0].apiSuccess, true);
  assert.equal(report.cases[0].model, 'prisma-v2.5');
  assert.equal(report.cases[0].wordErrorRate, 0);
  assert.equal(report.cases[0].criticalEntities.mismatches, 0);
});

test('benchmark runner records API failures separately from recognition errors', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'benchmark-api-error-'));
  const audioPath = path.join(tempDir, 'sample.wav');
  await fs.writeFile(audioPath, Buffer.from('RIFF....WAVE', 'ascii'));

  const manifestPath = path.join(tempDir, 'manifest.json');
  await fs.writeFile(
    manifestPath,
    JSON.stringify({
      benchmarkName: 'mocked api error',
      cases: [
        {
          id: 'mr-001',
          language: 'mr-IN',
          audioFile: 'sample.wav',
          referenceTranscript: 'नमस्कार',
          expectedEntities: { expected: {}, actual: {} },
          notes: 'mocked Marathi API failure'
        }
      ]
    })
  );

  const report = await executeBenchmark(manifestPath, {
    logger: { log() {}, error() {} },
    transcribeFn: async () => {
      throw new Error('Gnani API request failed (mocked)');
    }
  });

  assert.equal(report.cases[0].apiSuccess, false);
  assert.match(report.cases[0].apiError.message, /Gnani API request failed/i);
  assert.equal(report.summary['mr-IN'].apiErrors, 1);
});

test('benchmark runner accepts an empty inline reference transcript and still evaluates', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'benchmark-empty-ref-'));
  const audioPath = path.join(tempDir, 'sample.wav');
  await fs.writeFile(audioPath, Buffer.from('RIFF....WAVE', 'ascii'));

  const manifestPath = path.join(tempDir, 'manifest.json');
  await fs.writeFile(
    manifestPath,
    JSON.stringify({
      benchmarkName: 'empty transcript benchmark',
      cases: [
        {
          id: 'en-001',
          language: 'en-IN',
          audioFile: 'sample.wav',
          referenceTranscript: '',
          expectedEntities: { expected: {}, actual: {} },
          notes: 'empty reference transcript should be valid'
        }
      ]
    })
  );

  const report = await executeBenchmark(manifestPath, {
    logger: { log() {}, error() {} },
    transcribeFn: async ({ language }) => ({
      transcript: 'hello',
      metadata: {
        model: 'prisma-v2.5',
        locale: {
          languageCode: language,
          preferredLanguage: language,
          format: 'transcribe',
          itnNativeNumerals: true
        }
      }
    })
  });

  assert.equal(report.cases[0].apiSuccess, true);
  assert.equal(report.cases[0].expectedTranscript, '');
  assert.equal(typeof report.cases[0].wordErrorRate, 'number');
  assert.equal(report.summary['en-IN'].apiErrors, 0);
});

test('resolveReportOutputPath avoids overwriting an existing report unless overwrite is enabled', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'benchmark-report-path-'));
  const reportPath = path.join(tempDir, 'latest-report.json');
  await fs.writeFile(reportPath, '{"ok":true}\n', 'utf8');

  const safePath = await resolveReportOutputPath(reportPath, { overwrite: false });
  const overwritePath = await resolveReportOutputPath(reportPath, { overwrite: true });

  assert.notEqual(safePath, reportPath);
  assert.match(path.basename(safePath), /^latest-report-\d{8}-\d{6}Z\.json$/);
  assert.equal(overwritePath, reportPath);
});

test('benchmark runner skips placeholder cases without making transcription calls', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'benchmark-placeholder-skip-'));
  const manifestPath = path.join(tempDir, 'manifest.json');

  await fs.writeFile(
    manifestPath,
    JSON.stringify({
      benchmarkName: 'placeholder skip benchmark',
      cases: [
        {
          id: 'HI-01',
          language: 'hi-IN',
          category: 'Hindi conversation',
          audioFile: 'audio/HI-01.wav',
          referenceTranscriptFile: 'ground-truth/HI-01.txt',
          languageConfig: { languageCode: 'hi-IN', preferredLanguage: 'hi-IN' },
          placeholder: true,
          expectedEntities: { expected: {}, actual: {} },
          notes: 'placeholder case'
        }
      ]
    })
  );

  let transcribeCalls = 0;
  const report = await executeBenchmark(manifestPath, {
    logger: { log() {}, error() {} },
    transcribeFn: async () => {
      transcribeCalls += 1;
      throw new Error('transcribeFn should not be called for placeholder cases');
    }
  });

  assert.equal(transcribeCalls, 0);
  assert.equal(report.cases[0].status, 'skipped');
  assert.equal(report.summary['hi-IN'].skipped, 1);
});

test('benchmark runner reports incomplete manifest entries as validation failures', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'benchmark-manifest-validation-'));
  const manifestPath = path.join(tempDir, 'manifest.json');

  await fs.writeFile(
    manifestPath,
    JSON.stringify({
      benchmarkName: 'incomplete manifest validation',
      cases: [
        {
          language: 'hi-IN',
          notes: 'missing id, audioFile and transcript fields'
        }
      ]
    })
  );

  const report = await executeBenchmark(manifestPath, {
    logger: { log() {}, error() {} },
    transcribeFn: async () => {
      throw new Error('transcribeFn should not run for invalid entries');
    }
  });

  assert.equal(report.cases[0].apiSuccess, false);
  assert.equal(report.cases[0].apiError.type, 'validation');
  assert.match(report.cases[0].apiError.message, /missing a non-empty id/i);
  assert.equal(report.summary['hi-IN'].validationErrors, 1);
});
