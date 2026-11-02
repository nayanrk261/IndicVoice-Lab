import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toArray = (value, fallback = []) => {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  gnani: {
    apiKeyId: process.env.GNANI_API_KEY_ID || process.env.GNANI_API_KEY || '',
    apiBaseUrl: process.env.GNANI_API_BASE_URL || 'https://api.vachana.ai',
    sttPath: process.env.GNANI_STT_PATH || '/stt/v3',
    audioFieldName: process.env.GNANI_AUDIO_FIELD_NAME || 'audio_file',
    languageCode: process.env.GNANI_LANGUAGE_CODE || 'hi-IN',
    preferredLanguage: process.env.GNANI_PREFERRED_LANGUAGE || 'hi-IN',
    format: process.env.GNANI_FORMAT || 'transcribe',
    itnNativeNumerals: String(process.env.GNANI_ITN_NATIVE_NUMERALS ?? 'true').toLowerCase() === 'true',
    timeoutMs: toNumber(process.env.GNANI_API_TIMEOUT_MS, 120000),
    maxAudioSizeBytes: toNumber(process.env.GNANI_MAX_AUDIO_SIZE_BYTES, 25 * 1024 * 1024),
    allowedMimeTypes: toArray(process.env.GNANI_ALLOWED_MIME_TYPES, [
      'audio/wav',
      'audio/mpeg',
      'audio/mp4',
      'audio/x-wav',
      'audio/flac',
      'audio/ogg'
    ])
  },
  tempUploadDir: process.env.TEMP_UPLOAD_DIR || './tmp'
};
