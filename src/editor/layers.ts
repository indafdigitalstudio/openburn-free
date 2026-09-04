import { FabricObject } from 'fabric';
import { defaultLayer, type LayerSettings, type LayerMode } from '../types';

/** Simpan/ambil indeks layer pada objek fabric (properti kustom `layer`). */
export function getLayer(obj: FabricObject): number {
  const l = (obj as any).layer;
  return typeof l === 'number' ? l : 0;
}
export function setLayer(obj: FabricObject, id: number) {
  (obj as any).layer = id;
}

export class LayerStore {
  layers: LayerSettings[] = [];
  listeners: Array<() => void> = [];

  constructor() {
    for (let i = 0; i < 16; i++) this.layers.push(defaultLayer(i));
  }

  get(id: number) { return this.layers[id]; }

  update(id: number, patch: Partial<LayerSettings>) {
    Object.assign(this.layers[id], patch);
    this.emit();
  }

  replaceAll(list: LayerSettings[]) {
    for (let i = 0; i < 16; i++) {
      this.layers[i] = { ...defaultLayer(i), ...(list[i] ?? {}), id: i };
    }
    this.emit();
  }

  onChange(fn: () => void) { this.listeners.push(fn); }
  emit() { this.listeners.forEach(f => f()); }

  /** Urutan eksekusi layer (priority naik). */
  ordered(): LayerSettings[] {
    return [...this.layers].sort((a, b) => a.priority - b.priority || a.id - b.id);
  }

  /** Terapkan tampilan objek sesuai layer (warna stroke, fill semi transparan untuk mode fill). */
  styleObject(obj: FabricObject) {
    const ls = this.layers[getLayer(obj)];
    applyStyle(obj, ls);
  }
}

function hexToRgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function applyStyle(obj: FabricObject, ls: LayerSettings) {
  const t = obj.type;
  if (t === 'image') return;
  if (t === 'group') {
    (obj as any).getObjects().forEach((o: FabricObject) => applyStyle(o, ls));
    return;
  }
  const isText = t === 'textbox' || t === 'text' || t === 'i-text';
  if (isText) {
    // teks selalu tampil terisi warna layer
    obj.set({ fill: ls.color, stroke: null, strokeWidth: 0 });
    return;
  }
  obj.set({
    stroke: ls.color,
    strokeWidth: 0.2,
    strokeUniform: true,
    fill: fillFor(ls.mode, ls.color),
  });
}

function fillFor(mode: LayerMode, color: string) {
  return mode === 'fill' || mode === 'fillline' ? hexToRgba(color, 0.35) : 'transparent';
}
