import path from 'path';
import sharp from 'sharp';

export type PlacementInput = {
  catalogItemId: string;
  category: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  /** degrees — e.g. 70 for side-way cupboard */
  rotation?: number;
  /** laminate / finish colour hex */
  colorHex?: string | null;
};

const KNOWN = new Set([
  'cabinet',
  'cabinet_side',
  'upper_cabinet',
  'tv_unit',
  'wardrobe',
  'chimney',
  'plant',
  'fan',
  'backsplash',
  'lighting',
  'vanity',
  'seating',
  'floor_mat',
  'floor_mat_rect',
  'curtain',
]);

const ALIASES: Record<string, string> = {
  false_ceiling: 'lighting',
  bed_panel: 'wardrobe',
  mirror: 'vanity',
  shoe_rack: 'cabinet',
  cladding: 'backsplash',
  pergola: 'seating',
};

function elementPath(category: string): string {
  const dir = path.resolve(process.cwd(), 'assets/elements');
  const key = KNOWN.has(category) ? category : ALIASES[category] || 'default';
  return path.join(dir, `${key}.png`);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

async function buildElementBuffer(
  p: PlacementInput,
  canvasW: number,
  canvasH: number
): Promise<{ buf: Buffer; w: number; h: number }> {
  const elPath = elementPath(p.category);
  const targetW = Math.round(
    Math.min(canvasW, canvasH) * 0.3 * (p.scale || 1)
  );

  let pipeline = sharp(elPath).resize({
    width: Math.max(48, targetW),
    withoutEnlargement: false,
  });

  const rgb = p.colorHex ? hexToRgb(p.colorHex) : null;
  if (rgb) {
    // Soft colour wash so laminate choice is visible but wood grain remains
    const meta = await pipeline.ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    const { data, info } = meta;
    for (let i = 0; i < data.length; i += info.channels) {
      const a = info.channels === 4 ? data[i + 3] / 255 : 1;
      if (a < 0.05) continue;
      data[i] = Math.round(data[i] * 0.45 + rgb.r * 0.55);
      data[i + 1] = Math.round(data[i + 1] * 0.45 + rgb.g * 0.55);
      data[i + 2] = Math.round(data[i + 2] * 0.45 + rgb.b * 0.55);
    }
    pipeline = sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels,
      },
    });
  }

  const rotation = p.rotation || 0;
  if (rotation !== 0) {
    pipeline = pipeline.rotate(rotation, {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  const buf = await pipeline.png().toBuffer();
  const outMeta = await sharp(buf).metadata();
  return {
    buf,
    w: outMeta.width || targetW,
    h: outMeta.height || Math.round(targetW * 0.7),
  };
}

export async function composePlacements(options: {
  originalPath: string;
  resultPath: string;
  placements: PlacementInput[];
}): Promise<void> {
  const base = sharp(options.originalPath).rotate();
  const meta = await base.metadata();
  const width = meta.width || 1280;
  const height = meta.height || 960;

  const overlays: sharp.OverlayOptions[] = [];

  for (const p of options.placements) {
    const { buf, w, h } = await buildElementBuffer(p, width, height);
    const left = Math.round(p.x * width - w / 2);
    const top = Math.round(p.y * height - h / 2);

    overlays.push({
      input: buf,
      left: Math.min(width - 10, Math.max(0, left)),
      top: Math.min(height - 10, Math.max(0, top)),
    });
  }

  await sharp(options.originalPath)
    .rotate()
    .composite(overlays)
    .jpeg({ quality: 92 })
    .toFile(options.resultPath);
}
