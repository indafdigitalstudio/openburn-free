import { Color, FabricImage, FabricObject, loadSVGFromString } from 'fabric';
import { LAYER_COLORS } from '../types';
import { setLayer } from './layers';

const PX_TO_MM = 25.4 / 96;

export function readAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsText(file);
  });
}

export function readAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

export function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as ArrayBuffer);
    r.onerror = () => rej(r.error);
    r.readAsArrayBuffer(file);
  });
}

/** Indeks warna palet layer yang paling dekat dengan warna CSS yang diberikan. */
export function nearestLayerColor(css: string | null | undefined, fallback = 0): number {
  if (!css || css === 'none' || css === 'transparent') return fallback;
  let rgb: number[];
  try { rgb = new Color(css).getSource(); } catch { return fallback; }
  if (!rgb || rgb[3] === 0) return fallback;
  let best = fallback, bestD = Infinity;
  LAYER_COLORS.forEach((hex, i) => {
    const n = parseInt(hex.slice(1), 16);
    const d = ((n >> 16) - rgb[0]) ** 2 + (((n >> 8) & 255) - rgb[1]) ** 2 + ((n & 255) - rgb[2]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/**
 * Impor SVG menjadi daftar objek terpisah (satuan px 96 dpi dikonversi ke mm).
 * Layer tiap objek dipilih dari warna stroke (atau fill) terdekat di palet.
 */
export async function importSVG(text: string, defaultLayer = 0): Promise<FabricObject[]> {
  const { objects } = await loadSVGFromString(text);
  const objs = objects.filter((o): o is FabricObject => !!o);
  for (const o of objs) {
    const stroke = typeof o.stroke === 'string' ? o.stroke : null;
    const fill = typeof o.fill === 'string' ? o.fill : null;
    const layer = stroke && stroke !== 'none' ? nearestLayerColor(stroke, defaultLayer) : nearestLayerColor(fill, defaultLayer);
    setLayer(o, o.type === 'image' ? 15 : layer);
    o.set({
      left: (o.left ?? 0) * PX_TO_MM,
      top: (o.top ?? 0) * PX_TO_MM,
      scaleX: (o.scaleX ?? 1) * PX_TO_MM,
      scaleY: (o.scaleY ?? 1) * PX_TO_MM,
      objectCaching: false,
    });
    o.setCoords();
  }
  return objs;
}

/** Impor gambar bitmap; lebar awal disesuaikan (mm). */
export async function importImage(dataUrl: string, targetWidthMm = 100): Promise<FabricImage> {
  const img = await FabricImage.fromURL(dataUrl);
  const w = img.width || 1;
  const s = targetWidthMm / w;
  img.set({ left: 10, top: 10, scaleX: s, scaleY: s, objectCaching: false });
  img.setCoords();
  return img;
}

export function downloadText(name: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.onchange = () => res(inp.files?.[0] ?? null);
    inp.click();
  });
}
