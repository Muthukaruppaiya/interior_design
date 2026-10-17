import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { pool } from '../db/pool';
import { composePlacements, type PlacementInput } from '../services/compose';
import { generateVisualization } from '../services/visualize';

const router = Router();

const uploadDir = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR || 'uploads'
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are allowed'));
      return;
    }
    cb(null, true);
  },
});

const uploadCompose = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'result', maxCount: 1 },
]);

/**
 * Drag-and-drop compose.
 * multipart: image (original), optional result (client canvas with perspective),
 * roomId, placements JSON, optional customerName
 */
router.post('/compose', (req, res, next) => {
  uploadCompose(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      res.status(400).json({ error: err.message || 'Image upload failed' });
      return;
    }
    next();
  });
}, async (req, res) => {
  const client = await pool.connect();
  try {
    const files = req.files as
      | { [field: string]: Express.Multer.File[] }
      | undefined;
    const original = files?.image?.[0];
    const baked = files?.result?.[0];
    if (!original) {
      res.status(400).json({ error: 'Image is required' });
      return;
    }
    const { roomId, customerName, placements: placementsRaw } = req.body;
    if (!roomId) {
      res.status(400).json({ error: 'roomId is required' });
      return;
    }

    let placements: PlacementInput[] = [];
    if (placementsRaw) {
      placements =
        typeof placementsRaw === 'string'
          ? JSON.parse(placementsRaw)
          : placementsRaw;
    }
    if (!Array.isArray(placements) || placements.length === 0) {
      res.status(400).json({ error: 'Place at least one element on the photo' });
      return;
    }

    await client.query('BEGIN');

    const projectInsert = await client.query(
      `INSERT INTO projects
         (customer_name, room_id, original_image_path, status, notes)
       VALUES ($1, $2, $3, 'processing', $4)
       RETURNING *`,
      [
        customerName || null,
        roomId,
        original.filename,
        `compose:${placements.length} items`,
      ]
    );
    const project = projectInsert.rows[0];

    for (const p of placements) {
      if (p.catalogItemId) {
        await client.query(
          `INSERT INTO project_items (project_id, catalog_item_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [project.id, p.catalogItemId]
        );
      }
    }

    const resultFile = `${project.id}-result.jpg`;
    const resultPath = path.join(uploadDir, resultFile);

    if (baked) {
      // Client already baked perspective + glow — use that
      fs.copyFileSync(baked.path, resultPath);
      try {
        fs.unlinkSync(baked.path);
      } catch {
        /* ignore */
      }
    } else {
      await composePlacements({
        originalPath: path.join(uploadDir, original.filename),
        resultPath,
        placements,
      });
    }

    const updated = await client.query(
      `UPDATE projects
       SET result_image_path = $1, status = 'ready', updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [resultFile, project.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      ...updated.rows[0],
      mode: 'compose',
      items: placements.map((p) => ({ name: p.name, category: p.category })),
      originalUrl: `/uploads/${original.filename}`,
      resultUrl: `/uploads/${resultFile}?t=${Date.now()}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    const message =
      err instanceof Error ? err.message : 'Failed to compose project';
    res.status(500).json({ error: message });
  } finally {
    client.release();
  }
});

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.customer_name, p.status, p.created_at,
              p.original_image_path, p.result_image_path,
              r.name AS room_name, s.name AS style_name, c.name AS color_name, c.hex_code
       FROM projects p
       JOIN rooms r ON r.id = p.room_id
       LEFT JOIN styles s ON s.id = p.style_id
       LEFT JOIN colors c ON c.id = p.color_id
       ORDER BY p.created_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, r.name AS room_name, r.slug AS room_slug,
              s.name AS style_name, c.name AS color_name, c.hex_code
       FROM projects p
       JOIN rooms r ON r.id = p.room_id
       LEFT JOIN styles s ON s.id = p.style_id
       LEFT JOIN colors c ON c.id = p.color_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const items = await pool.query(
      `SELECT ci.id, ci.name, ci.category, ci.base_price
       FROM project_items pi
       JOIN catalog_items ci ON ci.id = pi.catalog_item_id
       WHERE pi.project_id = $1`,
      [req.params.id]
    );

    res.json({ ...rows[0], items: items.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.post('/', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      res.status(400).json({ error: err.message || 'Image upload failed' });
      return;
    }
    next();
  });
}, async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Image is required' });
      return;
    }

    const {
      roomId,
      styleId,
      colorId,
      customerName,
      catalogItemIds,
      notes,
    } = req.body;

    if (!roomId) {
      res.status(400).json({ error: 'roomId is required' });
      return;
    }

    let itemIds: string[] = [];
    if (catalogItemIds) {
      itemIds =
        typeof catalogItemIds === 'string'
          ? JSON.parse(catalogItemIds)
          : catalogItemIds;
    }

    await client.query('BEGIN');

    const projectInsert = await client.query(
      `INSERT INTO projects
         (customer_name, room_id, style_id, color_id, original_image_path, status, notes)
       VALUES ($1, $2, $3, $4, $5, 'processing', $6)
       RETURNING *`,
      [
        customerName || null,
        roomId,
        styleId || null,
        colorId || null,
        req.file.filename,
        notes || null,
      ]
    );

    const project = projectInsert.rows[0];

    for (const itemId of itemIds) {
      await client.query(
        `INSERT INTO project_items (project_id, catalog_item_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [project.id, itemId]
      );
    }

    const detail = await client.query(
      `SELECT r.name AS room_name, s.name AS style_name,
              c.hex_code, c.name AS color_name
       FROM rooms r
       LEFT JOIN styles s ON s.id = $2
       LEFT JOIN colors c ON c.id = $3
       WHERE r.id = $1`,
      [roomId, styleId || null, colorId || null]
    );

    const itemNamesResult = itemIds.length
      ? await client.query(
          `SELECT name FROM catalog_items WHERE id = ANY($1::uuid[])`,
          [itemIds]
        )
      : { rows: [] as { name: string }[] };

    const originalAbs = path.join(uploadDir, req.file.filename);
    const { resultPath, mode } = await generateVisualization({
      originalPath: originalAbs,
      uploadDir,
      projectId: project.id,
      roomName: detail.rows[0]?.room_name || 'Room',
      styleName: detail.rows[0]?.style_name,
      colorHex: detail.rows[0]?.hex_code,
      colorName: detail.rows[0]?.color_name,
      itemNames: itemNamesResult.rows.map((r) => r.name),
    });

    const resultFile = path.basename(resultPath);
    const updated = await client.query(
      `UPDATE projects
       SET result_image_path = $1, status = 'ready', updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [resultFile, project.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      ...updated.rows[0],
      items: itemNamesResult.rows,
      mode,
      originalUrl: `/uploads/${req.file.filename}`,
      resultUrl: `/uploads/${resultFile}?t=${Date.now()}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    const message =
      err instanceof Error ? err.message : 'Failed to create project';
    res.status(500).json({ error: message });
  } finally {
    client.release();
  }
});

export default router;
