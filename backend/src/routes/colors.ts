import { Router } from 'express';
import { pool } from '../db/pool';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, hex_code, category FROM colors ORDER BY category, name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch colors' });
  }
});

export default router;
