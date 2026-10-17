import { Router } from 'express';
import { pool } from '../db/pool';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, name, description, preview_color FROM styles ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch styles' });
  }
});

export default router;
