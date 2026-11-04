import { Router } from 'express';

import { evaluateTranscript } from '../lib/evaluationEngine.js';
import { transcribeAudioFromFile, validateGnaniLanguageSelection } from '../services/gnaniService.js';
import { env } from '../config/env.js';
import { upload, cleanupUploadedFile } from '../utils/audioUpload.js';

const router = Router();

const parseExpectedEntities = (rawValue) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { expected: {}, actual: {} };
  }

  if (typeof rawValue === 'object') {
    return {
      expected: rawValue.expected ?? rawValue,
      actual: rawValue.actual ?? (rawValue.expected ?? rawValue)
    };
  }

  if (typeof rawValue !== 'string') {
    throw Object.assign(new Error('expectedEntities must be a JSON object or JSON string.'), {
      statusCode: 400
    });
  }

  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return { expected: {}, actual: {} };
  }

  let parsedValue;
  try {
    parsedValue = JSON.parse(trimmedValue);
  } catch {
    throw Object.assign(new Error('expectedEntities is not valid JSON.'), {
      statusCode: 400
    });
  }

  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    throw Object.assign(new Error('expectedEntities must resolve to a JSON object.'), {
      statusCode: 400
    });
  }

  return {
    expected: parsedValue.expected ?? parsedValue,
    actual: parsedValue.actual ?? (parsedValue.expected ?? parsedValue)
  };
};

const createEvaluationError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

router.post('/', upload.single('audio'), async (req, res, next) => {
  const file = req.file;

  try {
    if (!file) {
      throw createEvaluationError('No audio file was uploaded.', 400);
    }

    const expectedTranscript = typeof req.body.expectedTranscript === 'string'
      ? req.body.expectedTranscript.trim()
      : '';

    if (!expectedTranscript) {
      throw createEvaluationError('Expected transcript is required.', 400);
    }

    const language = typeof req.body.language === 'string' && req.body.language.trim()
      ? validateGnaniLanguageSelection(req.body.language, env.gnani.languageCode)
      : env.gnani.languageCode;

    const expectedEntities = parseExpectedEntities(req.body.expectedEntities);

    const actualTranscript = await transcribeAudioFromFile(file.path, {
      originalName: file.originalname,
      contentType: file.mimetype,
      languageCode: language,
      preferredLanguage: language
    });

    if (!actualTranscript || !String(actualTranscript).trim()) {
      throw createEvaluationError('Actual transcript is empty.', 400);
    }

    const evaluationResult = evaluateTranscript(expectedTranscript, actualTranscript, {
      expected: expectedEntities.expected,
      actual: expectedEntities.actual
    });

    return res.json({
      success: true,
      data: {
        expectedTranscript,
        actualTranscript: String(actualTranscript).trim(),
        wordErrorRate: Number(evaluationResult.wordErrorRate),
        characterErrorRate: Number(evaluationResult.characterErrorRate),
        wer: Number(evaluationResult.wordErrorRate),
        cer: Number(evaluationResult.characterErrorRate),
        substitutions: evaluationResult.substitutions,
        deletions: evaluationResult.deletions,
        insertions: evaluationResult.insertions,
        criticalEntities: evaluationResult.criticalEntities,
        status: evaluationResult.status,
        evaluationStatus: evaluationResult.status,
        processing: {
          language,
          fileName: file.originalname,
          mimeType: file.mimetype,
          receivedAt: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    return next(error);
  } finally {
    if (req.file) {
      await cleanupUploadedFile(req.file.path);
    }
  }
});

export default router;
