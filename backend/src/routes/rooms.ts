import { Router } from 'express';
import { pool } from '../db/pool';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, name, description, icon, sort_order
       FROM rooms
       ORDER BY sort_order ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

router.get('/:idOrSlug/catalog', async (req, res) => {
  try {
    const key = req.params.idOrSlug;
    const { rows } = await pool.query(
      `SELECT c.id, c.category, c.name, c.description, c.thumbnail_url,
              c.base_price, s.slug AS style_slug, s.name AS style_name
       FROM catalog_items c
       JOIN rooms r ON r.id = c.room_id
       LEFT JOIN styles s ON s.id = c.style_id
       WHERE c.is_active = TRUE
         AND (r.id::text = $1 OR r.slug = $1)
       ORDER BY c.category, c.name`,
      [key]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

export default router;
