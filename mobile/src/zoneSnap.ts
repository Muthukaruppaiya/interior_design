import { applyHomography, getHomography, type Pt, type Quad } from './perspective';

export type ZoneMap = {
  classes: string[];
  cols: number;
  rows: number;
  /** row-major class index per cell, -1 = unknown */
  cells: number[];
  /** row-major detection index per cell, -1 = none (separates e.g. two walls) */
  instances?: number[];
  imageWidth: number;
  imageHeight: number;
};

/** [s0, t0, s1, t1] inside a zone plane, 0-1 = zone edges. */
type PlaneBox = [number, number, number, number];

type Rule = {
  /** zone classes in priority order */
  classes: string[];
  /** classes where the element covers the whole zone plane */
  fill?: Partial<Record<string, PlaneBox>>;
  /** element width / height as a fraction of the image */
  w?: number;
  h?: number;
  /** fixed vertical band in the zone plane (e.g. upper cabinets near the top) */
  band?: [number, number];
};

const FULL: PlaneBox = [0, 0, 1, 1];

/** Where each catalog category goes, using the zones the AI found. */
const RULES: Record<string, Rule> = {
  cabinet: { classes: ['under_counter', 'cabinet'], fill: { under_counter: FULL, cabinet: FULL } },
  cabinet_side: { classes: ['under_counter', 'cabinet'], fill: { under_counter: FULL, cabinet: FULL } },
  upper_cabinet: { classes: ['wall'], w: 0.34, band: [0.1, 0.48] },
  chimney: { classes: ['hood', 'wall'], fill: { hood: FULL }, w: 0.16, band: [0.22, 0.58] },
  backsplash: { classes: ['wall'], w: 0.45, band: [0.8, 1] },
  floor_mat: { classes: ['floor'], w: 0.24, h: 0.12 },
  floor_mat_rect: { classes: ['floor'], w: 0.34, h: 0.1 },
  curtain: { classes: ['window'], fill: { window: [-0.12, -0.08, 1.12, 1.04] } },
};

const SEARCH_RADIUS = 8;
const MIN_ZONE_CELLS = 12;

type Cell = { x: number; y: number };

/** Canvas shows the photo with resizeMode="cover"; map between the two spaces. */
function coverTransform(zones: ZoneMap, canvasW: number, canvasH: number) {
  const scale = Math.max(canvasW / zones.imageWidth, canvasH / zones.imageHeight);
  const dw = zones.imageWidth * scale;
  const dh = zones.imageHeight * scale;
  const ox = (canvasW - dw) / 2;
  const oy = (canvasH - dh) / 2;
  return {
    toImage: (x: number, y: number): Pt => ({
      x: (x * canvasW - ox) / dw,
      y: (y * canvasH - oy) / dh,
    }),
    toCanvas: (p: Pt): Pt => ({
      x: (p.x * dw + ox) / canvasW,
      y: (p.y * dh + oy) / canvasH,
    }),
  };
}

/** Nearest cell of the first listed class (e.g. hood before wall) near the tap. */
function findSeed(zones: ZoneMap, classes: string[], gx: number, gy: number): Cell | null {
  const { cols, rows, cells } = zones;
  for (const cls of classes) {
    const id = zones.classes.indexOf(cls);
    if (id < 0) continue;
    let best: Cell | null = null;
    let bestD = Infinity;
    for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
      for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
        const x = gx + dx;
        const y = gy + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        if (cells[y * cols + x] !== id) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Connected cells of the same detected instance (or class) as the seed. */
function zoneCells(zones: ZoneMap, seed: Cell): Cell[] {
  const { cols, rows, cells, instances } = zones;
  const key = (i: number) => (instances ? instances[i] : cells[i]);
  const target = key(seed.y * cols + seed.x);
  const seen = new Uint8Array(cols * rows);
  const out: Cell[] = [];
  const stack: Cell[] = [seed];
  seen[seed.y * cols + seed.x] = 1;
  while (stack.length) {
    const c = stack.pop()!;
    out.push(c);
    for (const [nx, ny] of [
      [c.x + 1, c.y],
      [c.x - 1, c.y],
      [c.x, c.y + 1],
      [c.x, c.y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const i = ny * cols + nx;
      if (seen[i] || key(i) !== target) continue;
      seen[i] = 1;
      stack.push({ x: nx, y: ny });
    }
  }
  return out;
}

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * Fit the zone outline with 4 corners (TL TR BR BL, image-normalized): drop the
 * hull vertex that loses the least area until four are left.
 */
function fitPlane(zone: Cell[], cols: number, rows: number): Quad | null {
  const corners: Pt[] = [];
  for (const c of zone) {
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]) {
      corners.push({ x: (c.x + dx) / cols, y: (c.y + dy) / rows });
    }
  }
  const hull = convexHull(corners);
  if (hull.length < 4) return null;
  while (hull.length > 4) {
    let drop = 0;
    let least = Infinity;
    for (let i = 0; i < hull.length; i++) {
      const prev = hull[(i - 1 + hull.length) % hull.length];
      const next = hull[(i + 1) % hull.length];
      const area = Math.abs(cross(prev, hull[i], next));
      if (area < least) {
        least = area;
        drop = i;
      }
    }
    hull.splice(drop, 1);
  }
  // Monotone chain walks the top edge first, i.e. clockwise on screen (y down).
  let start = 0;
  for (let i = 1; i < 4; i++) {
    if (hull[i].x + hull[i].y < hull[start].x + hull[start].y) start = i;
  }
  return [0, 1, 2, 3].map((k) => hull[(start + k) % 4]) as Quad;
}

/** Least-squares y = a*x + b, refit once without points > 2 cells off. */
function fitLine(pts: Pt[]): { a: number; b: number } {
  const solve = (p: Pt[]) => {
    const n = p.length;
    const mx = p.reduce((s, q) => s + q.x, 0) / n;
    const my = p.reduce((s, q) => s + q.y, 0) / n;
    let sxx = 0;
    let sxy = 0;
    for (const q of p) {
      sxx += (q.x - mx) ** 2;
      sxy += (q.x - mx) * (q.y - my);
    }
    const a = sxx > 0 ? sxy / sxx : 0;
    return { a, b: my - a * mx };
  };
  const first = solve(pts);
  const kept = pts.filter((q) => Math.abs(q.y - (first.a * q.x + first.b)) <= 2);
  return kept.length >= 3 ? solve(kept) : first;
}

/**
 * Upright surfaces (walls, cabinet fronts, windows): sides stay vertical, top
 * and bottom edges are fitted only where the zone is not cut by the photo
 * border, so a wall leaving the frame keeps its true slope.
 */
function fitUprightPlane(zone: Cell[], cols: number, rows: number): Quad | null {
  const cols2 = new Map<number, { top: number; bottom: number }>();
  for (const c of zone) {
    const col = cols2.get(c.x);
    if (!col) cols2.set(c.x, { top: c.y, bottom: c.y + 1 });
    else {
      col.top = Math.min(col.top, c.y);
      col.bottom = Math.max(col.bottom, c.y + 1);
    }
  }
  const xs = [...cols2.keys()];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) + 1;
  if (maxX - minX < 2) return null;
  const tops: Pt[] = [];
  const bottoms: Pt[] = [];
  let minTop = rows;
  let maxBottom = 0;
  for (const [x, col] of cols2) {
    minTop = Math.min(minTop, col.top);
    maxBottom = Math.max(maxBottom, col.bottom);
    if (col.top > 0) tops.push({ x: x + 0.5, y: col.top });
    if (col.bottom < rows) bottoms.push({ x: x + 0.5, y: col.bottom });
  }
  const top = tops.length >= 3 ? fitLine(tops) : { a: 0, b: minTop };
  const bottom = bottoms.length >= 3 ? fitLine(bottoms) : { a: 0, b: maxBottom };
  const at = (l: { a: number; b: number }, x: number) => l.a * x + l.b;
  const quad: Quad = [
    { x: minX / cols, y: at(top, minX) / rows },
    { x: maxX / cols, y: at(top, maxX) / rows },
    { x: maxX / cols, y: at(bottom, maxX) / rows },
    { x: minX / cols, y: at(bottom, minX) / rows },
  ];
  return quad[3].y > quad[0].y && quad[2].y > quad[1].y ? quad : null;
}

/** Ground / ceiling planes recede in depth; keep the outline's own shape. */
const FLAT_CLASSES = new Set(['floor', 'ceiling']);
/** Wall elements slide sideways off these instead of covering them. */
const OBSTACLE_CLASSES = ['window', 'door'];

const UNIT: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Horizontal span [s0, s1] of width ds near s that does not cover a window or
 * door inside the band; shrinks to the free gap when it has to.
 */
function avoidObstacles(
  zones: ZoneMap,
  toPlane: number[],
  s: number,
  ds: number,
  t0: number,
  t1: number
): [number, number] {
  const ids = OBSTACLE_CLASSES.map((c) => zones.classes.indexOf(c)).filter((i) => i >= 0);
  const blocked: [number, number][] = [];
  for (let i = 0; i < zones.cells.length; i++) {
    if (!ids.includes(zones.cells[i])) continue;
    const x = i % zones.cols;
    const y = Math.floor(i / zones.cols);
    const p = applyHomography(toPlane, (x + 0.5) / zones.cols, (y + 0.5) / zones.rows);
    if (p.y < t0 || p.y > t1 || p.x < -0.05 || p.x > 1.05) continue;
    const half = 0.5 / zones.cols;
    blocked.push([p.x - half * 3, p.x + half * 3]);
  }
  const place = (lo: number, hi: number): [number, number] => {
    const w = Math.min(ds, hi - lo);
    const start = Math.min(Math.max(lo, s - w / 2), hi - w);
    return [start, start + w];
  };
  if (blocked.length === 0) return place(0, 1);

  blocked.sort((a, b) => a[0] - b[0]);
  const free: [number, number][] = [];
  let cursor = 0;
  for (const [a, b] of blocked) {
    if (a > cursor) free.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < 1) free.push([cursor, 1]);
  const usable = free.filter(([a, b]) => b - a >= Math.min(ds, 0.12));
  if (usable.length === 0) return place(0, 1);
  const gapDist = ([a, b]: [number, number]) => (s < a ? a - s : s > b ? s - b : 0);
  const best = usable.reduce((x, y) => (gapDist(y) < gapDist(x) ? y : x));
  return place(best[0], best[1]);
}

function placeInZone(
  zones: ZoneMap,
  category: string,
  seed: Cell,
  tap: Pt
): Quad | null {
  const rule = RULES[category];
  const zone = zoneCells(zones, seed);
  if (!rule || zone.length < MIN_ZONE_CELLS) return null;
  const cls = zones.classes[zones.cells[seed.y * zones.cols + seed.x]];
  const filled = rule.fill?.[cls];
  // Filled zones are wholly visible, so their outline is the best quad; wall
  // planes often leave the frame and need the slope-preserving fit.
  const plane =
    filled || FLAT_CLASSES.has(cls)
      ? fitPlane(zone, zones.cols, zones.rows)
      : fitUprightPlane(zone, zones.cols, zones.rows);
  if (!plane) return null;

  const toPlane = getHomography(plane, UNIT);
  const fromPlane = getHomography(UNIT, plane);

  let box = filled;
  if (!box) {
    const st = applyHomography(toPlane, tap.x, tap.y);
    const s = Math.min(1, Math.max(0, st.x));
    const t = Math.min(1, Math.max(0, st.y));
    let band = rule.band;
    if (!band) {
      // Image height of one plane unit at the tap, so far floor gets thinner mats.
      const a = Math.max(0, t - 0.005);
      const b = Math.min(1, t + 0.005);
      const perT = dist(applyHomography(fromPlane, s, a), applyHomography(fromPlane, s, b)) / (b - a);
      const dt = Math.min(1, (rule.h ?? 0.12) / Math.max(1e-4, perT));
      const top = Math.min(Math.max(0, t - dt / 2), 1 - dt);
      band = [top, top + dt];
    }
    const [t0, t1] = band;
    const tm = (t0 + t1) / 2;
    const width = dist(applyHomography(fromPlane, 0, tm), applyHomography(fromPlane, 1, tm));
    const ds = Math.min(1, (rule.w ?? 0.2) / Math.max(1e-4, width));
    const [s0, s1] = avoidObstacles(zones, toPlane, s, ds, t0, t1);
    box = [s0, t0, s1, t1];
  }
  const [s0, t0, s1, t1] = box;
  return [
    applyHomography(fromPlane, s0, t0),
    applyHomography(fromPlane, s1, t0),
    applyHomography(fromPlane, s1, t1),
    applyHomography(fromPlane, s0, t1),
  ];
}

/**
 * Snap a dropped element into the detected zone under the tap, with the zone's
 * own perspective. Returns null when no matching zone is near, so callers can
 * fall back to the generic auto-fit.
 */
export function snapQuadToZone(
  zones: ZoneMap,
  category: string,
  cx: number,
  cy: number,
  canvasW: number,
  canvasH: number
): Quad | null {
  const rule = RULES[category];
  if (!rule) return null;
  const { toImage, toCanvas } = coverTransform(zones, canvasW, canvasH);
  const tap = toImage(cx, cy);
  const gx = Math.min(zones.cols - 1, Math.max(0, Math.floor(tap.x * zones.cols)));
  const gy = Math.min(zones.rows - 1, Math.max(0, Math.floor(tap.y * zones.rows)));
  const seed = findSeed(zones, rule.classes, gx, gy);
  if (!seed) return null;
  const quad = placeInZone(zones, category, seed, tap);
  return quad ? (quad.map(toCanvas) as Quad) : null;
}

export type AutoSlot = { category: string; corners: Quad };

/**
 * Whole-kitchen suggestion from the detected zones: base cabinets fill every
 * under-counter bay, upper cabinets and chimney sit on the wall above the main
 * run, a runner on the floor, curtains on windows.
 */
export function autoSlotsFromZones(
  zones: ZoneMap,
  canvasW: number,
  canvasH: number
): AutoSlot[] {
  const { cols, rows, cells, classes } = zones;
  const { toCanvas } = coverTransform(zones, canvasW, canvasH);
  const id = (c: string) => classes.indexOf(c);
  const slots: AutoSlot[] = [];
  const claimed = new Uint8Array(cols * rows);

  const zonesOf = (cls: string): Cell[][] => {
    const target = id(cls);
    const found: Cell[][] = [];
    if (target < 0) return found;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== target || claimed[i]) continue;
      const zone = zoneCells(zones, { x: i % cols, y: Math.floor(i / cols) });
      for (const c of zone) claimed[c.y * cols + c.x] = 1;
      if (zone.length >= MIN_ZONE_CELLS) found.push(zone);
    }
    return found.sort((a, b) => b.length - a.length);
  };
  const add = (category: string, seed: Cell, tap: Pt) => {
    const quad = placeInZone(zones, category, seed, tap);
    if (quad) slots.push({ category, corners: quad.map(toCanvas) as Quad });
  };
  const cellCenter = (c: Cell): Pt => ({ x: (c.x + 0.5) / cols, y: (c.y + 0.5) / rows });

  const bases = [...zonesOf('under_counter'), ...zonesOf('cabinet')].slice(0, 3);
  bases.forEach((zone, i) => add(i === 0 ? 'cabinet' : 'cabinet_side', zone[0], cellCenter(zone[0])));

  // Wall cell straight above a point on the main base run.
  const wallAbove = (zone: Cell[], frac: number): Cell | null => {
    const minX = Math.min(...zone.map((c) => c.x));
    const maxX = Math.max(...zone.map((c) => c.x));
    const x = Math.round(minX + (maxX - minX) * frac);
    const top = Math.min(...zone.filter((c) => c.x === x).map((c) => c.y));
    for (let y = top - 1; y >= 0; y--) {
      if (cells[y * cols + x] === id('wall')) return { x, y };
    }
    return null;
  };
  if (bases[0]) {
    const upper = wallAbove(bases[0], 0.28);
    if (upper) add('upper_cabinet', upper, cellCenter(upper));
    const chimney = wallAbove(bases[0], 0.75);
    if (chimney) add('chimney', chimney, cellCenter(chimney));
  }
  if (bases[1]) {
    const upper = wallAbove(bases[1], 0.5);
    if (upper) add('upper_cabinet', upper, cellCenter(upper));
  }

  const floor = zonesOf('floor')[0];
  if (floor) {
    const cx = floor.reduce((s, c) => s + c.x, 0) / floor.length;
    const cy = floor.reduce((s, c) => s + c.y, 0) / floor.length;
    const near = floor.reduce((b, c) =>
      Math.hypot(c.x - cx, c.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? c : b
    );
    add('floor_mat_rect', near, cellCenter(near));
  }
  for (const win of zonesOf('window').slice(0, 2)) add('curtain', win[0], cellCenter(win[0]));

  return slots;
}
