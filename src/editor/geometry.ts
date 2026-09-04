import { FabricObject, util, Point, type TMat2D } from 'fabric';
import type { Font } from 'opentype.js';
import type { Polyline, XY } from '../types';

const TOL = 0.05; // mm, toleransi flatten kurva

/** Konteks konversi: pencari font opentype per objek teks (null = tidak ada outline). */
export interface GeomCtx {
  fontFor: (obj: FabricObject) => Font | null;
}

/**
 * Konversi objek fabric (termasuk grup) menjadi kumpulan polyline dalam koordinat kanvas (mm).
 * Setiap elemen hasil = satu objek daun (bisa punya banyak sub-path, mis. huruf dengan lubang).
 */
export function objectToShapes(obj: FabricObject, ctx: GeomCtx): Polyline[][] {
  const out: Polyline[][] = [];
  walk(obj, ctx, out);
  return out;
}

function walk(obj: FabricObject, ctx: GeomCtx, out: Polyline[][]) {
  if (!obj.visible) return;
  const t = obj.type;
  if (t === 'group' || t === 'activeselection') {
    (obj as any).getObjects().forEach((o: FabricObject) => walk(o, ctx, out));
    return;
  }
  const m = obj.calcTransformMatrix();
  const polys = leafToLocalPolylines(obj, ctx);
  if (!polys) return;
  const tx = (p: XY) => {
    const q = util.transformPoint(new Point(p.x, p.y), m);
    return { x: q.x, y: q.y };
  };
  const shape = polys
    .map(pl => ({ pts: dedupe(pl.pts.map(tx)), closed: pl.closed }))
    .filter(pl => pl.pts.length >= 2);
  if (shape.length) out.push(shape);
}

/** Apakah objek bisa divektorkan (bukan gambar, dan teks hanya jika ada font). */
export function isVectorizable(obj: FabricObject, ctx: GeomCtx): boolean {
  const t = obj.type;
  if (t === 'image') return false;
  if (isTextType(t)) return !!ctx.fontFor(obj);
  if (t === 'group') return (obj as any).getObjects().some((o: FabricObject) => isVectorizable(o, ctx));
  return true;
}

export function isTextType(t: string) {
  return t === 'textbox' || t === 'text' || t === 'i-text';
}

function dedupe(pts: XY[]): XY[] {
  const r: XY[] = [];
  for (const p of pts) {
    const l = r[r.length - 1];
    if (!l || Math.abs(l.x - p.x) > 1e-4 || Math.abs(l.y - p.y) > 1e-4) r.push(p);
  }
  return r;
}

/** Polyline dalam koordinat lokal objek (sebelum matriks transformasi). */
function leafToLocalPolylines(obj: FabricObject, ctx: GeomCtx): Polyline[] | null {
  const o = obj as any;
  switch (obj.type) {
    case 'rect': {
      const w = obj.width, h = obj.height;
      const rx = Math.min(o.rx || 0, w / 2), ry = Math.min(o.ry || 0, h / 2);
      const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
      if (rx <= 0 || ry <= 0) {
        return [{ pts: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], closed: true }];
      }
      const pts: XY[] = [];
      const arc = (cx: number, cy: number, a0: number, a1: number) => {
        const n = arcSegments(Math.max(rx, ry), Math.abs(a1 - a0));
        for (let i = 0; i <= n; i++) {
          const a = a0 + (a1 - a0) * i / n;
          pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
        }
      };
      arc(x1 - rx, y0 + ry, -Math.PI / 2, 0);
      arc(x1 - rx, y1 - ry, 0, Math.PI / 2);
      arc(x0 + rx, y1 - ry, Math.PI / 2, Math.PI);
      arc(x0 + rx, y0 + ry, Math.PI, Math.PI * 1.5);
      return [{ pts, closed: true }];
    }
    case 'ellipse':
      return [{ pts: ellipsePts(o.rx, o.ry), closed: true }];
    case 'circle':
      return [{ pts: ellipsePts(o.radius, o.radius), closed: true }];
    case 'line': {
      const w = obj.width, h = obj.height;
      const xm = o.x1 <= o.x2 ? -1 : 1, ym = o.y1 <= o.y2 ? -1 : 1;
      return [{ pts: [{ x: xm * w / 2, y: ym * h / 2 }, { x: -xm * w / 2, y: -ym * h / 2 }], closed: false }];
    }
    case 'polygon':
    case 'polyline': {
      const off = o.pathOffset as XY;
      const pts = (o.points as XY[]).map(p => ({ x: p.x - off.x, y: p.y - off.y }));
      return [{ pts, closed: obj.type === 'polygon' }];
    }
    case 'path': {
      const off = o.pathOffset as XY;
      return pathToPolylines(o.path, -off.x, -off.y);
    }
    case 'textbox':
    case 'text':
    case 'i-text': {
      const f = ctx.fontFor(obj);
      if (!f) return null;
      return textToLocalPolylines(obj, f);
    }
    default:
      return null;
  }
}

function ellipsePts(rx: number, ry: number): XY[] {
  const n = arcSegments(Math.max(rx, ry), Math.PI * 2);
  const pts: XY[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    pts.push({ x: rx * Math.cos(a), y: ry * Math.sin(a) });
  }
  return pts;
}

function arcSegments(r: number, sweep: number) {
  if (r <= TOL) return 2;
  const step = 2 * Math.acos(Math.max(-1, 1 - TOL / r));
  return Math.max(4, Math.min(256, Math.ceil(sweep / Math.max(step, 0.01))));
}

/** Konversi data path fabric (kompleks) menjadi polyline. dx,dy = offset yang ditambahkan ke tiap titik. */
export function pathToPolylines(path: any[], dx = 0, dy = 0): Polyline[] {
  const simple = util.makePathSimpler(path as any) as any[];
  const out: Polyline[] = [];
  let cur: XY[] = [];
  let start: XY = { x: 0, y: 0 };
  let last: XY = { x: 0, y: 0 };
  const flush = (closed: boolean) => {
    if (cur.length >= 2) out.push({ pts: cur, closed });
    cur = [];
  };
  for (const c of simple) {
    switch (c[0]) {
      case 'M':
        flush(false);
        last = { x: c[1] + dx, y: c[2] + dy };
        start = last;
        cur = [last];
        break;
      case 'L':
        last = { x: c[1] + dx, y: c[2] + dy };
        cur.push(last);
        break;
      case 'C': {
        const p1 = { x: c[1] + dx, y: c[2] + dy }, p2 = { x: c[3] + dx, y: c[4] + dy }, p3 = { x: c[5] + dx, y: c[6] + dy };
        cur.push(...flattenCubic(last, p1, p2, p3));
        last = p3;
        break;
      }
      case 'Q': {
        const p1 = { x: c[1] + dx, y: c[2] + dy }, p2 = { x: c[3] + dx, y: c[4] + dy };
        cur.push(...flattenQuad(last, p1, p2));
        last = p2;
        break;
      }
      case 'Z':
      case 'z':
        flush(true);
        last = start;
        cur = [start];
        break;
    }
  }
  flush(false);
  return out;
}

function flattenCubic(p0: XY, p1: XY, p2: XY, p3: XY): XY[] {
  const approx = dist(p0, p1) + dist(p1, p2) + dist(p2, p3);
  const n = Math.max(2, Math.min(200, Math.ceil(Math.sqrt(approx / TOL * 0.3))));
  const r: XY[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    r.push({
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return r;
}

function flattenQuad(p0: XY, p1: XY, p2: XY): XY[] {
  const approx = dist(p0, p1) + dist(p1, p2);
  const n = Math.max(2, Math.min(200, Math.ceil(Math.sqrt(approx / TOL * 0.3))));
  const r: XY[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    r.push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    });
  }
  return r;
}

export function dist(a: XY, b: XY) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/* ---------- Teks ke outline via opentype.js ---------- */

/** Perintah path (string SVG) untuk objek teks fabric dalam koordinat lokal objek. */
export function textToLocalPathData(obj: FabricObject, font: Font): string {
  const o = obj as any;
  const lines: string[] = o.textLines ?? [String(o.text ?? '')];
  const fontSize: number = o.fontSize;
  const lineHeight: number = o.lineHeight ?? 1.16;
  const w = obj.width, h = obj.height;
  let y = -h / 2;
  let d = '';
  for (let i = 0; i < lines.length; i++) {
    const hl = typeof o.getHeightOfLine === 'function' ? o.getHeightOfLine(i) : fontSize * lineHeight * 1.13;
    const baseline = y + hl / lineHeight * (1 - 0.222);
    const leftOff = typeof o._getLineLeftOffset === 'function' ? o._getLineLeftOffset(i) : 0;
    const x = -w / 2 + leftOff;
    const p = font.getPath(lines[i], x, baseline, fontSize, { kerning: true });
    d += p.toPathData(4) + ' ';
    y += hl;
  }
  return d.trim();
}

function textToLocalPolylines(obj: FabricObject, font: Font): Polyline[] {
  const d = textToLocalPathData(obj, font);
  if (!d) return [];
  const parsed = util.parsePath(d) as any[];
  return pathToPolylines(parsed, 0, 0);
}

/** Path data teks dalam koordinat kanvas absolut (untuk tool "Ubah teks ke path"). */
export function textToAbsolutePathData(obj: FabricObject, font: Font): string {
  const d = textToLocalPathData(obj, font);
  const m = obj.calcTransformMatrix();
  const parsed = util.makePathSimpler(util.parsePath(d) as any) as any[];
  const tx = (x: number, y: number) => {
    const q = util.transformPoint(new Point(x, y), m as TMat2D);
    return `${q.x.toFixed(4)} ${q.y.toFixed(4)}`;
  };
  return parsed.map(c => {
    switch (c[0]) {
      case 'M': return `M ${tx(c[1], c[2])}`;
      case 'L': return `L ${tx(c[1], c[2])}`;
      case 'C': return `C ${tx(c[1], c[2])} ${tx(c[3], c[4])} ${tx(c[5], c[6])}`;
      case 'Q': return `Q ${tx(c[1], c[2])} ${tx(c[3], c[4])}`;
      default: return 'Z';
    }
  }).join(' ');
}

/* ---------- Objek → path absolut (kurva dipertahankan) ---------- */

const KAPPA = 0.5522847498;

/** Perintah path lokal (sebelum transform) untuk objek dasar; null bila tidak didukung. */
function localPathCommands(obj: FabricObject, fontFor: (o: FabricObject) => Font | null): any[] | null {
  const o = obj as any;
  switch (obj.type) {
    case 'path': {
      const off = o.pathOffset as XY;
      return (util.makePathSimpler(o.path) as any[]).map(c => shiftCmd(c, -off.x, -off.y));
    }
    case 'rect': {
      const w = obj.width, h = obj.height;
      const rx = Math.min(o.rx || 0, w / 2), ry = Math.min(o.ry || 0, h / 2);
      const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
      if (rx <= 0 || ry <= 0) return [['M', x0, y0], ['L', x1, y0], ['L', x1, y1], ['L', x0, y1], ['Z']];
      const kx = rx * KAPPA, ky = ry * KAPPA;
      return [
        ['M', x0 + rx, y0], ['L', x1 - rx, y0], ['C', x1 - rx + kx, y0, x1, y0 + ry - ky, x1, y0 + ry],
        ['L', x1, y1 - ry], ['C', x1, y1 - ry + ky, x1 - rx + kx, y1, x1 - rx, y1],
        ['L', x0 + rx, y1], ['C', x0 + rx - kx, y1, x0, y1 - ry + ky, x0, y1 - ry],
        ['L', x0, y0 + ry], ['C', x0, y0 + ry - ky, x0 + rx - kx, y0, x0 + rx, y0], ['Z'],
      ];
    }
    case 'ellipse':
    case 'circle': {
      const rx = obj.type === 'circle' ? o.radius : o.rx, ry = obj.type === 'circle' ? o.radius : o.ry;
      const kx = rx * KAPPA, ky = ry * KAPPA;
      return [
        ['M', rx, 0], ['C', rx, ky, kx, ry, 0, ry], ['C', -kx, ry, -rx, ky, -rx, 0],
        ['C', -rx, -ky, -kx, -ry, 0, -ry], ['C', kx, -ry, rx, -ky, rx, 0], ['Z'],
      ];
    }
    case 'polygon':
    case 'polyline': {
      const off = o.pathOffset as XY;
      const pts = (o.points as XY[]).map(p => ({ x: p.x - off.x, y: p.y - off.y }));
      if (pts.length < 2) return null;
      const cmds: any[] = [['M', pts[0].x, pts[0].y], ...pts.slice(1).map(p => ['L', p.x, p.y])];
      if (obj.type === 'polygon') cmds.push(['Z']);
      return cmds;
    }
    case 'line': {
      const w = obj.width, h = obj.height;
      const xm = o.x1 <= o.x2 ? -1 : 1, ym = o.y1 <= o.y2 ? -1 : 1;
      return [['M', xm * w / 2, ym * h / 2], ['L', -xm * w / 2, -ym * h / 2]];
    }
    case 'textbox':
    case 'text':
    case 'i-text': {
      const f = fontFor(obj);
      if (!f) return null;
      return util.makePathSimpler(util.parsePath(textToLocalPathData(obj, f)) as any) as any[];
    }
    default:
      return null;
  }
}

function shiftCmd(c: any[], dx: number, dy: number): any[] {
  const r = [c[0]];
  for (let i = 1; i < c.length; i += 2) r.push(c[i] + dx, c[i + 1] + dy);
  return r;
}

/** Data path SVG dalam koordinat kanvas absolut, kurva dipertahankan. */
export function objectToAbsolutePathData(obj: FabricObject, fontFor: (o: FabricObject) => Font | null): string | null {
  const cmds = localPathCommands(obj, fontFor);
  if (!cmds || !cmds.length) return null;
  const m = obj.calcTransformMatrix();
  const tx = (x: number, y: number) => {
    const q = util.transformPoint(new Point(x, y), m as TMat2D);
    return `${q.x.toFixed(4)} ${q.y.toFixed(4)}`;
  };
  return cmds.map(c => {
    switch (c[0]) {
      case 'M': return `M ${tx(c[1], c[2])}`;
      case 'L': return `L ${tx(c[1], c[2])}`;
      case 'C': return `C ${tx(c[1], c[2])} ${tx(c[3], c[4])} ${tx(c[5], c[6])}`;
      case 'Q': return `Q ${tx(c[1], c[2])} ${tx(c[3], c[4])}`;
      default: return 'Z';
    }
  }).join(' ');
}

/* ---------- Bantu bounding box ---------- */

export interface GeomRect { left: number; top: number; width: number; height: number; scaledW: number; scaledH: number }

/**
 * Kotak batas objek dalam koordinat kanvas TANPA tebal stroke/padding
 * (getBoundingRect fabric menyertakan stroke sehingga angka tidak bulat).
 * scaledW/scaledH = ukuran objek setelah skala, sebelum rotasi.
 */
export function geomRect(obj: FabricObject): GeomRect {
  const m = obj.calcTransformMatrix();
  const w = obj.width ?? 0, h = obj.height ?? 0;
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => util.transformPoint(new Point(x, y), m));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  return {
    left: minX, top: minY, width: maxX - minX, height: maxY - minY,
    scaledW: w * Math.hypot(m[0], m[1]),
    scaledH: h * Math.hypot(m[2], m[3]),
  };
}

export function boundsOf(shapes: Polyline[][]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) for (const pl of s) for (const p of pl.pts) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}
