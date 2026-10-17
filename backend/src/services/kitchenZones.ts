import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

const MODEL_DIR = path.resolve(
  process.cwd(),
  process.env.MODEL_DIR || 'models'
);
const MODEL_PATH = path.join(MODEL_DIR, 'kitchen_seg.onnx');
const META_PATH = path.join(MODEL_DIR, 'kitchen_seg.json');

const CONF = 0.25;
const IOU = 0.5;
const MAX_DETS = 60;
const GRID = 96;

type ModelMeta = { classes: string[]; paintOrder: string[]; imgsz: number };

type Detection = {
  cls: number;
  score: number;
  /** box in model-input pixels: x1 y1 x2 y2 */
  box: [number, number, number, number];
  coeffs: Float32Array;
};

export type ZoneMap = {
  classes: string[];
  cols: number;
  rows: number;
  /** row-major class index per cell, -1 = unknown */
  cells: number[];
  /** row-major index into `detections` per cell, -1 = none */
  instances: number[];
  imageWidth: number;
  imageHeight: number;
  detections: {
    label: string;
    score: number;
    /** normalized to the original image, x1 y1 x2 y2 */
    box: [number, number, number, number];
  }[];
};

let loaded: Promise<{ session: ort.InferenceSession; meta: ModelMeta }> | null =
  null;

export function kitchenModelAvailable(): boolean {
  return fs.existsSync(MODEL_PATH) && fs.existsSync(META_PATH);
}

function loadModel() {
  if (!loaded) {
    loaded = (async () => {
      const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8')) as ModelMeta;
      const session = await ort.InferenceSession.create(MODEL_PATH);
      return { session, meta };
    })();
    loaded.catch(() => {
      loaded = null;
    });
  }
  return loaded;
}

function iou(a: Detection['box'], b: Detection['box']): number {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  const union =
    (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return union > 0 ? inter / union : 0;
}

function decode(
  out: Float32Array,
  numClasses: number,
  numAnchors: number,
  numCoeffs: number
): Detection[] {
  const at = (row: number, i: number) => out[row * numAnchors + i];
  const candidates: Detection[] = [];
  for (let i = 0; i < numAnchors; i++) {
    let best = -1;
    let score = CONF;
    for (let c = 0; c < numClasses; c++) {
      const s = at(4 + c, i);
      if (s > score) {
        score = s;
        best = c;
      }
    }
    if (best < 0) continue;
    const cx = at(0, i);
    const cy = at(1, i);
    const w = at(2, i);
    const h = at(3, i);
    const coeffs = new Float32Array(numCoeffs);
    for (let k = 0; k < numCoeffs; k++) coeffs[k] = at(4 + numClasses + k, i);
    candidates.push({
      cls: best,
      score,
      box: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2],
      coeffs,
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const d of candidates) {
    if (kept.length >= MAX_DETS) break;
    if (kept.some((k) => k.cls === d.cls && iou(k.box, d.box) > IOU)) continue;
    kept.push(d);
  }
  return kept;
}

/** Segment a kitchen photo into a coarse zone grid (wall, floor, cabinet ...). */
export async function analyzeKitchen(image: string | Buffer): Promise<ZoneMap> {
  const { session, meta } = await loadModel();
  const size = meta.imgsz;

  const img = sharp(image).rotate();
  const info = await img.metadata();
  const oriented = (info.orientation ?? 1) >= 5;
  const iw = (oriented ? info.height : info.width) ?? size;
  const ih = (oriented ? info.width : info.height) ?? size;

  const scale = Math.min(size / iw, size / ih);
  const nw = Math.round(iw * scale);
  const nh = Math.round(ih * scale);
  const padX = Math.floor((size - nw) / 2);
  const padY = Math.floor((size - nh) / 2);

  const rgb = await img
    .resize(nw, nh)
    .extend({
      top: padY,
      bottom: size - nh - padY,
      left: padX,
      right: size - nw - padX,
      background: { r: 114, g: 114, b: 114 },
    })
    .removeAlpha()
    .raw()
    .toBuffer();

  const plane = size * size;
  const input = new Float32Array(3 * plane);
  for (let p = 0; p < plane; p++) {
    input[p] = rgb[p * 3] / 255;
    input[plane + p] = rgb[p * 3 + 1] / 255;
    input[2 * plane + p] = rgb[p * 3 + 2] / 255;
  }

  const feeds = {
    [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, size, size]),
  };
  const results = await session.run(feeds);
  const det = results[session.outputNames[0]];
  const proto = results[session.outputNames[1]];
  const [, rowsOut, numAnchors] = det.dims as number[];
  const [, numCoeffs, mh, mw] = proto.dims as number[];
  const numClasses = rowsOut - 4 - numCoeffs;
  const protos = proto.data as Float32Array;

  const dets = decode(det.data as Float32Array, numClasses, numAnchors, numCoeffs);
  const rank = (cls: number) => {
    const i = meta.paintOrder.indexOf(meta.classes[cls]);
    return i < 0 ? meta.paintOrder.length : i;
  };
  dets.sort((a, b) => rank(a.cls) - rank(b.cls) || a.score - b.score);

  // Paint instance masks onto the prototype grid; later (smaller) classes win.
  const protoMap = new Int16Array(mh * mw).fill(-1);
  const sx = mw / size;
  const sy = mh / size;
  for (let di = 0; di < dets.length; di++) {
    const d = dets[di];
    const x0 = Math.max(0, Math.floor(d.box[0] * sx));
    const y0 = Math.max(0, Math.floor(d.box[1] * sy));
    const x1 = Math.min(mw - 1, Math.ceil(d.box[2] * sx));
    const y1 = Math.min(mh - 1, Math.ceil(d.box[3] * sy));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = y * mw + x;
        let v = 0;
        for (let k = 0; k < numCoeffs; k++) v += d.coeffs[k] * protos[k * mh * mw + idx];
        if (v > 0) protoMap[idx] = di;
      }
    }
  }

  const rows = GRID;
  const cols = GRID;
  const cells = new Array<number>(rows * cols);
  const instances = new Array<number>(rows * cols);
  for (let gy = 0; gy < rows; gy++) {
    const py = ((padY + ((gy + 0.5) / rows) * nh) * mh) / size;
    for (let gx = 0; gx < cols; gx++) {
      const px = ((padX + ((gx + 0.5) / cols) * nw) * mw) / size;
      const ix = Math.min(mw - 1, Math.floor(px));
      const iy = Math.min(mh - 1, Math.floor(py));
      const di = protoMap[iy * mw + ix];
      instances[gy * cols + gx] = di;
      cells[gy * cols + gx] = di >= 0 ? dets[di].cls : -1;
    }
  }

  const toImg = (x: number, y: number): [number, number] => [
    Math.min(1, Math.max(0, (x - padX) / nw)),
    Math.min(1, Math.max(0, (y - padY) / nh)),
  ];

  return {
    classes: meta.classes,
    cols,
    rows,
    cells,
    instances,
    imageWidth: iw,
    imageHeight: ih,
    detections: dets.map((d) => {
      const [ax, ay] = toImg(d.box[0], d.box[1]);
      const [bx, by] = toImg(d.box[2], d.box[3]);
      return {
        label: meta.classes[d.cls],
        score: Math.round(d.score * 1000) / 1000,
        box: [ax, ay, bx, by] as [number, number, number, number],
      };
    }),
  };
}
