import { Router } from 'express';
import { upload, cleanupUploadedFile } from '../utils/audioUpload.js';
import { transcribeAudioFromFile, validateGnaniLanguageSelection } from '../services/gnaniService.js';

const router = Router();

router.post('/', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No audio file was uploaded.',
          statusCode: 400
        }
      });
    }

    const language = typeof req.body.language === 'string' && req.body.language.trim()
      ? validateGnaniLanguageSelection(req.body.language)
      : undefined;

    const transcript = await transcribeAudioFromFile(req.file.path, {
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
      languageCode: language,
      preferredLanguage: language
    });

    return res.json({
      success: true,
      data: {
        transcript,
        file: {
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
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
