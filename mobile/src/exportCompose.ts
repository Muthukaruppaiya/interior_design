import { Image } from 'react-native';
import type { PlacedElement } from './screens/ComposeScreen';
import { elementSource } from './elements';
import { isLightCategory, warpImageToQuad, type Quad } from './perspective';

function resolveAssetUri(source: number): string {
  const resolved = Image.resolveAssetSource(source);
  return resolved?.uri || '';
}

function loadHtmlImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image`));
    img.src = uri;
  });
}

/** Web-only: bake room + perspective elements + glows into JPEG. */
export async function exportCompositionBlob(
  roomImageUri: string,
  placements: PlacedElement[],
  outW = 1280,
  outH = 960
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Canvas export is only available on web');
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  const room = await loadHtmlImage(roomImageUri);
  const scale = Math.max(outW / room.width, outH / room.height);
  const dw = room.width * scale;
  const dh = room.height * scale;
  ctx.drawImage(room, (outW - dw) / 2, (outH - dh) / 2, dw, dh);

  for (const p of placements) {
    const uri = resolveAssetUri(elementSource(p.category) as number);
    if (!uri) continue;
    const img = await loadHtmlImage(uri);
    const quadPx = p.corners.map((c) => ({
      x: c.x * outW,
      y: c.y * outH,
    })) as Quad;

    if (isLightCategory(p.category)) {
      const cx =
        (quadPx[0].x + quadPx[1].x + quadPx[2].x + quadPx[3].x) / 4;
      const cy =
        (quadPx[0].y + quadPx[1].y + quadPx[2].y + quadPx[3].y) / 4;
      const r = Math.max(outW, outH) * 0.2;
      const grd = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      grd.addColorStop(0, 'rgba(255, 240, 200, 0.8)');
      grd.addColorStop(0.3, 'rgba(255, 214, 140, 0.4)');
      grd.addColorStop(1, 'rgba(255, 200, 100, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    warpImageToQuad(
      ctx,
      img,
      img.naturalWidth,
      img.naturalHeight,
      quadPx,
      p.colorHex
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.92
    );
  });
}
