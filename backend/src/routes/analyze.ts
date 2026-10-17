import { Router } from 'express';
import multer from 'multer';
import { analyzeKitchen, kitchenModelAvailable } from '../services/kitchenZones';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

router.get('/kitchen/status', (_req, res) => {
  res.json({ available: kitchenModelAvailable() });
});

/** multipart: image -> coarse zone map of the kitchen photo */
router.post('/kitchen', upload.single('image'), async (req, res) => {
  if (!kitchenModelAvailable()) {
    res.status(503).json({ error: 'Kitchen model not installed in backend/models' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'Image is required' });
    return;
  }
  try {
    const started = Date.now();
    const zones = await analyzeKitchen(req.file.buffer);
    res.json({ ...zones, ms: Date.now() - started });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Analyze failed' });
  }
});

export default router;
