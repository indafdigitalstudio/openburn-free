import type { DitherMode } from '../types';

/**
 * Terapkan dithering pada citra abu-abu (0 = hitam/bakar penuh, 255 = putih/tidak dibakar).
 * Untuk mode 'grayscale' nilai dikembalikan apa adanya.
 * Hasil: Uint8ClampedArray ukuran w*h (nilai 0 atau 255 untuk mode biner).
 */
export function dither(gray: Uint8ClampedArray, w: number, h: number, mode: DitherMode): Uint8ClampedArray {
  switch (mode) {
    case 'grayscale': return gray.slice();
    case 'threshold': return threshold(gray);
    case 'ordered': return ordered(gray, w, h);
    case 'floyd': return errorDiffusion(gray, w, h, [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]]);
    case 'jarvis': return errorDiffusion(gray, w, h, [
      [1, 0, 7 / 48], [2, 0, 5 / 48],
      [-2, 1, 3 / 48], [-1, 1, 5 / 48], [0, 1, 7 / 48], [1, 1, 5 / 48], [2, 1, 3 / 48],
      [-2, 2, 1 / 48], [-1, 2, 3 / 48], [0, 2, 5 / 48], [1, 2, 3 / 48], [2, 2, 1 / 48]]);
    case 'stucki': return errorDiffusion(gray, w, h, [
      [1, 0, 8 / 42], [2, 0, 4 / 42],
      [-2, 1, 2 / 42], [-1, 1, 4 / 42], [0, 1, 8 / 42], [1, 1, 4 / 42], [2, 1, 2 / 42],
      [-2, 2, 1 / 42], [-1, 2, 2 / 42], [0, 2, 4 / 42], [1, 2, 2 / 42], [2, 2, 1 / 42]]);
    case 'atkinson': return errorDiffusion(gray, w, h, [
      [1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]]);
  }
}

function threshold(g: Uint8ClampedArray) {
  const out = new Uint8ClampedArray(g.length);
  for (let i = 0; i < g.length; i++) out[i] = g[i] < 128 ? 0 : 255;
  return out;
}

const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
];

function ordered(g: Uint8ClampedArray, w: number, h: number) {
  const out = new Uint8ClampedArray(g.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const t = (BAYER8[y & 7][x & 7] + 0.5) / 64 * 255;
    out[i] = g[i] < t ? 0 : 255;
  }
  return out;
}

function errorDiffusion(g: Uint8ClampedArray, w: number, h: number, kernel: number[][]) {
  const buf = new Float32Array(g.length);
  for (let i = 0; i < g.length; i++) buf[i] = g[i];
  const out = new Uint8ClampedArray(g.length);
  for (let y = 0; y < h; y++) {
    // serpentine agar pola lebih halus
    const ltr = (y & 1) === 0;
    for (let k = 0; k < w; k++) {
      const x = ltr ? k : w - 1 - k;
      const i = y * w + x;
      const old = buf[i];
      const nv = old < 128 ? 0 : 255;
      out[i] = nv;
      const err = old - nv;
      for (const [dx, dy, f] of kernel) {
        const xx = x + (ltr ? dx : -dx), yy = y + dy;
        if (xx < 0 || xx >= w || yy >= h) continue;
        buf[yy * w + xx] += err * f;
      }
    }
  }
  return out;
}

/** Ubah RGBA (di atas putih) menjadi abu-abu 0..255. */
export function rgbaToGray(data: Uint8ClampedArray, w: number, h: number, negative = false): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3] / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    let v = lum * a + 255 * (1 - a);
    if (negative) v = 255 - v;
    out[i] = v;
  }
  return out;
}
