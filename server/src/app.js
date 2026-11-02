import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.js';
import transcriptionRoutes from './routes/transcription.js';
import evaluationRoutes from './routes/evaluation.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { env } from './config/env.js';

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'healthy' } });
});

app.use('/api/healthz', healthRoutes);
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/evaluations', evaluationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
