import fs from 'node:fs/promises';
import { env } from '../config/env.js';

const supportedLanguages = new Set(['hi-IN', 'mr-IN', 'en-IN']);

const normalizeLanguage = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return '';
  }

  const lowerCaseValue = trimmedValue.toLowerCase();
  if (lowerCaseValue === 'hi-in' || lowerCaseValue === 'hi') {
    return 'hi-IN';
  }
  if (lowerCaseValue === 'mr-in' || lowerCaseValue === 'mr') {
    return 'mr-IN';
  }
  if (lowerCaseValue === 'en-in' || lowerCaseValue === 'en') {
    return 'en-IN';
  }

  return trimmedValue;
};

export const validateGnaniLanguageSelection = (value, fallback = env.gnani.languageCode) => {
  const requestedValue = normalizeLanguage(value ?? fallback);

  if (!supportedLanguages.has(requestedValue)) {
    const error = new Error(
      `Unsupported Gnani language: ${requestedValue || String(value ?? fallback)}. Supported values: hi-IN, mr-IN, en-IN.`
    );
    error.statusCode = 400;
    throw error;
  }

  return requestedValue;
};

const resolveLanguage = (value, fallback) => validateGnaniLanguageSelection(value, fallback);

const getRequestUrl = () => new URL(env.gnani.sttPath, env.gnani.apiBaseUrl).toString();

export async function transcribeAudioWithMetadata(filePath, options = {}) {
  if (!env.gnani.apiKeyId) {
    throw new Error('GNANI_API_KEY_ID is not configured.');
  }

  if (!env.gnani.apiBaseUrl || !env.gnani.sttPath) {
    throw new Error('Gnani API base URL or transcription path is not configured.');
  }

  const languageCode = resolveLanguage(options.languageCode, env.gnani.languageCode);
  const preferredLanguage = resolveLanguage(options.preferredLanguage, env.gnani.preferredLanguage || languageCode);

  const fileBuffer = await fs.readFile(filePath);
  const form = new FormData();
  const blob = new Blob([fileBuffer], {
    type: options.contentType || 'application/octet-stream'
  });

  form.append(env.gnani.audioFieldName, blob, options.originalName || 'audio-upload');
  form.append('language_code', languageCode);
  form.append('preferred_language', preferredLanguage);
  form.append('format', env.gnani.format);
  form.append('itn_native_numerals', String(env.gnani.itnNativeNumerals));

  const url = getRequestUrl();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-Key-ID': env.gnani.apiKeyId
    },
    body: form,
    signal: AbortSignal.timeout(env.gnani.timeoutMs)
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Gnani API request failed (${response.status}): ${rawText}`);
  }

  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new Error('Gnani API returned an invalid JSON response.');
  }

  if (payload?.success !== true) {
    throw new Error(`Gnani API returned an unsuccessful response: ${rawText}`);
  }

  if (typeof payload.transcript !== 'string') {
    throw new Error('Gnani API response did not include a transcript string.');
  }

  return {
    transcript: payload.transcript,
    metadata: {
      requestId: payload.request_id ?? null,
      model: payload.model ?? null,
      processingTime: payload.processing_time ?? null,
      endToEndLatency: payload.end_to_end_latency ?? null,
      output: payload.output ?? null,
      locale: {
        languageCode,
        preferredLanguage,
        format: env.gnani.format,
        itnNativeNumerals: env.gnani.itnNativeNumerals
      }
    }
  };
}

export async function transcribeAudioFromFile(filePath, options = {}) {
  const result = await transcribeAudioWithMetadata(filePath, options);
  return result.transcript;
}

export default { transcribeAudioFromFile, transcribeAudioWithMetadata };
