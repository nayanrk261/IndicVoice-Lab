import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'IndicVoice Lab API',
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

export default router;
