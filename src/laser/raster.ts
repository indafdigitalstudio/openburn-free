import { FabricObject, util } from 'fabric';

export interface RasterResult {
  gray: Uint8ClampedArray;  // 0..255 (0 = hitam)
  w: number; h: number;     // piksel
  minX: number; minY: number; // koordinat kanvas (mm) sudut kiri-atas bitmap
  px: number;               // ukuran piksel (mm) = interval
}

/**
 * Render satu objek fabric ke bitmap abu-abu dengan resolusi `interval` mm/piksel,
 * memakai transformasi penuh objek (rotasi, skala, mirror ikut terbawa).
 */
export function rasterizeObject(obj: FabricObject, interval: number, negative: boolean): RasterResult | null {
  const px = Math.max(0.02, interval);
  const r = obj.getBoundingRect();
  // getBoundingRect memberi koordinat scene (tanpa viewport) di fabric v6
  const minX = Math.floor(r.left / px) * px;
  const minY = Math.floor(r.top / px) * px;
  const w = Math.ceil((r.left + r.width) / px) - Math.floor(r.left / px);
  const h = Math.ceil((r.top + r.height) / px) - Math.floor(r.top / px);
  if (w <= 0 || h <= 0 || w * h > 40_000_000) return null;

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(1 / px, 0, 0, 1 / px, -minX / px, -minY / px);

  const canvas = (obj as any).canvas;
  const prevSkip = canvas?.skipOffscreen;
  const prevCache = obj.objectCaching;
  if (canvas) canvas.skipOffscreen = false;
  obj.objectCaching = false;
  try {
    obj.render(ctx as any);
  } finally {
    obj.objectCaching = prevCache;
    if (canvas) canvas.skipOffscreen = prevSkip;
  }

  const data = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    const rr = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    let v = 0.299 * rr + 0.587 * g + 0.114 * b;
    if (negative) v = 255 - v;
    gray[i] = v;
  }
  return { gray, w, h, minX, minY, px };
}

void util;
