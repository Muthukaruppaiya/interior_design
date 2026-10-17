import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import roomsRouter from './routes/rooms';
import stylesRouter from './routes/styles';
import colorsRouter from './routes/colors';
import projectsRouter from './routes/projects';
import analyzeRouter from './routes/analyze';
import { pool } from './db/pool';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4001;
const uploadDir = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR || 'uploads'
);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));
app.use(
  '/elements',
  express.static(path.resolve(process.cwd(), 'assets/elements'))
);

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch {
    res.status(500).json({ ok: false, db: false });
  }
});

app.use('/api/rooms', roomsRouter);
app.use('/api/styles', stylesRouter);
app.use('/api/colors', colorsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/analyze', analyzeRouter);

app.listen(port, '0.0.0.0', () => {
  console.log(`Interior API listening on http://0.0.0.0:${port}`);
});
