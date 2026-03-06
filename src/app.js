import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Backend CMS Công tác CSHS đang hoạt động' });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
