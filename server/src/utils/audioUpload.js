import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';

const tempDirectory = path.resolve(process.cwd(), env.tempUploadDir);

if (!fs.existsSync(tempDirectory)) {
  fs.mkdirSync(tempDirectory, { recursive: true });
}

const sanitizeFilename = (originalName) => {
  const safeBase = path.basename(originalName || 'upload').replace(/[^a-zA-Z0-9._-]+/g, '-');
  const uniqueSuffix = crypto.randomUUID();
  return `${safeBase}-${uniqueSuffix}`;
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tempDirectory),
  filename: (_req, file, cb) => cb(null, sanitizeFilename(file.originalname))
});

const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = new Set(env.gnani.allowedMimeTypes);
  const isAllowedMime = allowedMimeTypes.has(file.mimetype);

  if (!isAllowedMime) {
    return cb(new Error(`Unsupported audio file type: ${file.mimetype}.`));
  }

  if (file.size > env.gnani.maxAudioSizeBytes) {
    return cb(new Error(`Audio file exceeds the maximum supported size of ${env.gnani.maxAudioSizeBytes} bytes.`));
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.gnani.maxAudioSizeBytes,
    files: 1
  }
});

export const cleanupUploadedFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (_error) {
    // Ignore cleanup failures so the request still returns a useful response.
  }
};
