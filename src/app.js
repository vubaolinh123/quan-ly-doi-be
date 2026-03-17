import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import './services/ai-orchestrator.service.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use('/api/webhooks/facebook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Backend CMS Đội 3 - Phòng Công Nghệ Cao Khánh Hòa đang hoạt động' });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
