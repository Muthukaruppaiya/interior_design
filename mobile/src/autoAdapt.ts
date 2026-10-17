import { defaultQuad, isLightCategory, type Quad } from './perspective';

export type AdaptContext = {
  /** drop point in normalized 0–1 canvas space */
  cx: number;
  cy: number;
  category: string;
  /** canvas width / height */
  aspect: number;
};

/**
 * Instant auto-adopt when user drops an element on the uploaded photo.
 * - Scale follows image framing (wider canvas → slightly wider units)
 * - Perspective skew follows drop zone (floor / back wall / side wall / ceiling)
 */
export function adaptQuadAtDrop(ctx: AdaptContext): Quad {
  const { cx, cy, category, aspect } = ctx;
  const aspectFactor = Math.min(1.35, Math.max(0.75, aspect / 1.2));

  const isFloor = category.startsWith('floor');
  const isSide = category.includes('side');
  const isLight = isLightCategory(category);
  const isUpper =
    category.includes('upper') || category === 'curtain' || category === 'chimney';

  // Base size as fraction of frame (auto bigger on large/wide photos)
  let w = 0.22 * aspectFactor;
  let h = 0.16 * aspectFactor;

  if (isFloor) {
    w = 0.34 * aspectFactor;
    h = 0.14 * aspectFactor;
    return defaultQuad(cx, cy, w, h);
  }

  if (isLight) {
    w = 0.16 * aspectFactor;
    h = 0.12 * aspectFactor;
    return defaultQuad(cx, Math.min(cy, 0.35), w, h);
  }

  if (isUpper) {
    w = 0.2 * aspectFactor;
    h = 0.14 * aspectFactor;
  }

  // Side wall if dropped on right/left third
  const onRight = cx > 0.62;
  const onLeft = cx < 0.28;
  if (isSide || onRight || onLeft) {
    const side = onLeft ? 'left' : 'right';
    w = 0.2 * aspectFactor;
    h = 0.22 * aspectFactor;
    return perspectiveAt(cx, cy, w, h, side);
  }

  // Floor-ish lower drop → slight ground plane taper
  if (cy > 0.7) {
    return groundPlaneQuad(cx, cy, w, h);
  }

  // Back wall cupboard under counter band
  if (cy > 0.45 && cy < 0.7) {
    return backWallQuad(cx, cy, w, h);
  }

  return defaultQuad(cx, cy, w, h);
}

function backWallQuad(cx: number, cy: number, w: number, h: number): Quad {
  // Mild perspective: top edge slightly shorter toward vanishing center
  const vanish = 0.5;
  const pull = (cx - vanish) * 0.04;
  return [
    { x: cx - w / 2 + pull * 0.3, y: cy - h / 2 },
    { x: cx + w / 2 + pull * 0.3, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}

function groundPlaneQuad(cx: number, cy: number, w: number, h: number): Quad {
  // Trapezoid: top narrower (farther)
  return [
    { x: cx - w * 0.35, y: cy - h / 2 },
    { x: cx + w * 0.35, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}

function perspectiveAt(
  cx: number,
  cy: number,
  w: number,
  h: number,
  side: 'left' | 'right'
): Quad {
  if (side === 'right') {
    return [
      { x: cx - w / 2, y: cy - h / 2 },
      { x: cx + w / 2, y: cy - h / 2 - 0.03 },
      { x: cx + w / 2 + 0.03, y: cy + h / 2 + 0.04 },
      { x: cx - w / 2, y: cy + h / 2 },
    ];
  }
  return [
    { x: cx - w / 2, y: cy - h / 2 - 0.03 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2 - 0.03, y: cy + h / 2 + 0.04 },
  ];
}
