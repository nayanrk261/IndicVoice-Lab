import fs from 'node:fs/promises';
import { env } from '../config/env.js';

const getRequestUrl = () => new URL(env.gnani.sttPath, env.gnani.apiBaseUrl).toString();

export async function transcribeAudioFromFile(filePath, options = {}) {
  if (!env.gnani.apiKeyId) {
    throw new Error('GNANI_API_KEY_ID is not configured.');
  }

  if (!env.gnani.apiBaseUrl || !env.gnani.sttPath) {
    throw new Error('Gnani API base URL or transcription path is not configured.');
  }

  const fileBuffer = await fs.readFile(filePath);
  const form = new FormData();
  const blob = new Blob([fileBuffer], {
    type: options.contentType || 'application/octet-stream'
  });

  form.append(env.gnani.audioFieldName, blob, options.originalName || 'audio-upload');
  form.append('language_code', env.gnani.languageCode);
  form.append('preferred_language', env.gnani.preferredLanguage);
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

  return payload.transcript;
}

export default { transcribeAudioFromFile };
