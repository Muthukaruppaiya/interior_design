/** Point in normalized 0–1 canvas space or pixels */
export type Pt = { x: number; y: number };

export type Quad = [Pt, Pt, Pt, Pt]; // TL, TR, BR, BL

/** Default axis-aligned quad around a centre (normalized). */
export function defaultQuad(
  cx: number,
  cy: number,
  w = 0.24,
  h = 0.17
): Quad {
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}

/** Start skewed for right-wall side cupboard (perspective). */
export function sideWallQuad(
  cx: number,
  cy: number,
  w = 0.2,
  h = 0.22,
  side: 'right' | 'left' = 'right'
): Quad {
  const s = side === 'right' ? 1 : -1;
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 + 0.04 * s },
    { x: cx + w / 2 + 0.02 * s, y: cy + h / 2 + 0.06 * s },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}

export function quadCenter(q: Quad): Pt {
  return {
    x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4,
    y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4,
  };
}

export function moveQuad(q: Quad, dx: number, dy: number): Quad {
  return q.map((p) => ({
    x: Math.min(0.98, Math.max(0.02, p.x + dx)),
    y: Math.min(0.98, Math.max(0.02, p.y + dy)),
  })) as Quad;
}

export function scaleQuad(q: Quad, factor: number): Quad {
  const c = quadCenter(q);
  return q.map((p) => ({
    x: c.x + (p.x - c.x) * factor,
    y: c.y + (p.y - c.y) * factor,
  })) as Quad;
}

/**
 * CSS matrix3d that maps a source rectangle (0,0)-(w,h) onto dest quad (pixel space).
 * Based on solving the homography for 4 point pairs.
 */
export function matrix3dForQuad(
  srcW: number,
  srcH: number,
  dest: Quad
): string {
  const from: Quad = [
    { x: 0, y: 0 },
    { x: srcW, y: 0 },
    { x: srcW, y: srcH },
    { x: 0, y: srcH },
  ];
  const m = getHomography(from, dest);
  // column-major matrix3d
  const [
    a11,
    a12,
    a13,
    a21,
    a22,
    a23,
    a31,
    a32,
    a33,
  ] = m;
  return `matrix3d(${[
    a11,
    a21,
    0,
    a31,
    a12,
    a22,
    0,
    a32,
    0,
    0,
    1,
    0,
    a13,
    a23,
    0,
    a33,
  ].join(',')})`;
}

export function applyHomography(h: number[], x: number, y: number): Pt {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}

export function getHomography(from: Quad, to: Quad): number[] {
  // Solve 8x8 system for projective transform
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const div = M[col][col] || 1e-12;
    for (let j = col; j <= n; j++) M[col][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row[n]);
}

/** Bilinear-ish perspective sample: map dest pixel → source via inverse homography */
export function warpImageToQuad(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  dest: Quad,
  colorHex?: string | null
): void {
  const xs = dest.map((p) => p.x);
  const ys = dest.map((p) => p.y);
  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));

  // Draw via temporary canvas + path clip approximation using triangle strips
  // Fast path: use transform if available through setTransform from homography
  const from: Quad = [
    { x: 0, y: 0 },
    { x: imgW, y: 0 },
    { x: imgW, y: imgH },
    { x: 0, y: imgH },
  ];
  const H = getHomography(from, dest);
  // Use two triangles with canvas transforms (approximate) — draw full image with matrix
  ctx.save();
  // Convert homography to canvas transform (affine approximation via corners avg)
  // Better: drawImage with 2 triangle warps using temporary pattern
  drawTexturedTriangle(ctx, img, imgW, imgH, from[0], from[1], from[2], dest[0], dest[1], dest[2]);
  drawTexturedTriangle(ctx, img, imgW, imgH, from[0], from[2], from[3], dest[0], dest[2], dest[3]);

  if (colorHex) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dest[0].x, dest[0].y);
    ctx.lineTo(dest[1].x, dest[1].y);
    ctx.lineTo(dest[2].x, dest[2].y);
    ctx.lineTo(dest[3].x, dest[3].y);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 0.38;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = colorHex;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.restore();
  }
  ctx.restore();
  void H;
}

function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  s0: Pt,
  s1: Pt,
  s2: Pt,
  d0: Pt,
  d1: Pt,
  d2: Pt
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  // Solve affine transform mapping s → d for triangle
  const denom =
    s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y) || 1e-8;
  const m11 =
    (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denom;
  const m12 =
    (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denom;
  const m13 =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denom;
  const m21 =
    (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denom;
  const m22 =
    (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denom;
  const m23 =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denom;

  ctx.setTransform(m11, m21, m12, m22, m13, m23);
  ctx.drawImage(img, 0, 0, imgW, imgH);
  ctx.restore();
}

export function isLightCategory(category: string): boolean {
  return (
    category === 'lighting' ||
    category === 'false_ceiling' ||
    category === 'glow_light' ||
    category === 'under_cabinet_light' ||
    category === 'fan'
  );
}
