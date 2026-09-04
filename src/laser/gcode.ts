import { FabricObject } from 'fabric';
import type { Font } from 'opentype.js';
import type { JobResult, LayerSettings, MachineSettings, Move, Polyline, XY } from '../types';
import { objectToShapes, isTextType, dist, geomRect } from '../editor/geometry';
import { getLayer, type LayerStore } from '../editor/layers';
import { rasterizeObject } from './raster';
import { dither } from './dither';

export interface JobInput {
  objects: FabricObject[];
  layers: LayerStore;
  machine: MachineSettings;
  fontFor: (obj: FabricObject) => Font | null;
}

class Emitter {
  lines: string[] = [];
  moves: Move[] = [];
  cur: XY = { x: 0, y: 0 };
  lastS: number | null = null;
  lastF: number | null = null;
  cutLength = 0;
  rapidLength = 0;
  seconds = 0;
  private chain: { len: number; feed: number } | null = null;
  constructor(private m: MachineSettings, private tx: (p: XY) => XY) {}

  comment(s: string) { this.lines.push(`; ${s}`); }
  raw(s: string) { if (s.trim()) this.lines.push(s.trim()); }

  private endChain() {
    if (this.chain) {
      this.seconds += trapezoid(this.chain.len, this.chain.feed / 60, this.m.accel);
      this.chain = null;
    }
  }

  rapid(p: XY, layer: number) {
    if (Math.abs(p.x - this.cur.x) < 1e-6 && Math.abs(p.y - this.cur.y) < 1e-6) return;
    this.endChain();
    const q = this.tx(p);
    this.lines.push(`G0 X${n(q.x)} Y${n(q.y)}`);
    const d = dist(this.cur, p);
    this.rapidLength += d;
    this.seconds += trapezoid(d, this.m.rapidSpeed / 60, this.m.accel);
    this.moves.push({ rapid: true, x0: this.cur.x, y0: this.cur.y, x1: p.x, y1: p.y, s: 0, layer });
    this.cur = p;
  }

  /** Gerak potong. sFrac = fraksi daya 0..1, feed mm/min. */
  cut(p: XY, sFrac: number, feed: number, layer: number) {
    const q = this.tx(p);
    const s = Math.round(Math.max(0, Math.min(1, sFrac)) * this.m.sMax);
    let l = `G1 X${n(q.x)} Y${n(q.y)}`;
    if (this.lastS !== s) { l += ` S${s}`; this.lastS = s; }
    if (this.lastF !== feed) { l += ` F${Math.round(feed)}`; this.lastF = feed; }
    this.lines.push(l);
    const d = dist(this.cur, p);
    if (s > 0) this.cutLength += d;
    if (!this.chain || this.chain.feed !== feed) { this.endChain(); this.chain = { len: 0, feed }; }
    this.chain.len += d;
    this.moves.push({ rapid: false, x0: this.cur.x, y0: this.cur.y, x1: p.x, y1: p.y, s: sFrac, layer });
    this.cur = p;
  }

  finish() { this.endChain(); }
}

/** Perkiraan waktu gerak dengan profil trapesium (v mm/s, a mm/s^2). */
function trapezoid(len: number, v: number, a: number) {
  if (len <= 0 || v <= 0) return 0;
  if (a <= 0) return len / v;
  const dAcc = v * v / a; // jarak untuk akselerasi + deselerasi
  if (len >= dAcc) return len / v + v / a;
  return 2 * Math.sqrt(len / a);
}

function n(v: number) {
  const s = (Math.round(v * 1000) / 1000).toFixed(3);
  return s.replace(/\.?0+$/, '');
}

/** Transformasi koordinat kanvas (y ke bawah, origin kiri-atas bed) ke koordinat mesin. */
export function canvasToMachine(m: MachineSettings): (p: XY) => XY {
  const W = m.width, H = m.height;
  switch (m.origin) {
    case 'bl': return p => ({ x: p.x, y: H - p.y });
    case 'tl': return p => ({ x: p.x, y: p.y });
    case 'br': return p => ({ x: W - p.x, y: H - p.y });
    case 'tr': return p => ({ x: W - p.x, y: p.y });
  }
}

export function generateJob(input: JobInput): JobResult {
  const { layers, fontFor, machine } = input;
  const ctx = { fontFor };
  const warnings: string[] = [];
  const baseTx = canvasToMachine(machine);

  // kelompokkan objek per layer
  const byLayer = new Map<number, FabricObject[]>();
  for (const o of input.objects) {
    if (!o.visible) continue;
    const l = getLayer(o);
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(o);
  }

  // hitung bounds untuk mode "posisi saat ini"
  let offset: XY = { x: 0, y: 0 };
  let bounds: JobResult['bounds'] = null;
  {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [l, objs] of byLayer) {
      if (!layers.get(l).output) continue;
      for (const o of objs) {
        const r = geomRect(o);
        minX = Math.min(minX, r.left); minY = Math.min(minY, r.top);
        maxX = Math.max(maxX, r.left + r.width); maxY = Math.max(maxY, r.top + r.height);
      }
    }
    if (minX !== Infinity) {
      bounds = { minX, minY, maxX, maxY };
      if (machine.startFrom === 'current') {
        const corners = [baseTx({ x: minX, y: minY }), baseTx({ x: maxX, y: maxY })];
        offset = { x: Math.min(corners[0].x, corners[1].x), y: Math.min(corners[0].y, corners[1].y) };
      }
      if (minX < -0.01 || minY < -0.01 || maxX > machine.width + 0.01 || maxY > machine.height + 0.01) {
        warnings.push('Ada objek di luar area kerja mesin.');
      }
    }
  }
  const tx = (p: XY) => { const q = baseTx(p); return { x: q.x - offset.x, y: q.y - offset.y }; };
  const em = new Emitter(machine, tx);
  // posisi awal kepala laser = origin mesin (atau sudut job bila "posisi saat ini")
  em.cur = machine.startFrom === 'current' && bounds
    ? invOriginOf(machine, bounds)
    : invOrigin(machine);

  em.comment(`OpenBurn Free v1.0 - ${new Date().toISOString()}`);
  em.comment(`Mesin: ${machine.name} (${machine.width}x${machine.height} mm, origin ${machine.origin}, S max ${machine.sMax})`);
  em.raw('G21 G90 G17 G94');
  em.raw('M5');
  if (machine.startFrom === 'current') em.raw('G92 X0 Y0');
  if (machine.startGcode) machine.startGcode.split('\n').forEach(l => em.raw(l));

  let anyOutput = false;
  for (const ls of layers.ordered()) {
    const objs = byLayer.get(ls.id);
    if (!objs || !objs.length || !ls.output) continue;
    anyOutput = true;
    const feed = ls.speed * 60;
    em.comment(`Layer C${String(ls.id).padStart(2, '0')} ${ls.name || ''} mode=${ls.mode} speed=${ls.speed}mm/s power=${ls.power}% passes=${ls.passes}`);
    if (ls.air) em.raw('M8');
    if (ls.zOffset) { em.raw(`G91 G0 Z${n(ls.zOffset)}`); em.raw('G90'); }
    em.raw(`${machine.laserMode} S0`);
    em.lastS = 0;

    for (let pass = 0; pass < Math.max(1, ls.passes); pass++) {
      if (ls.passes > 1) em.comment(`Pass ${pass + 1}/${ls.passes}`);
      if (ls.mode === 'image') {
        for (const o of objs) emitImage(em, o, ls, feed, warnings);
      } else {
        const vectorObjs: FabricObject[] = [];
        for (const o of objs) {
          if (o.type === 'image') {
            emitImage(em, o, ls, feed, warnings);
          } else if (isTextType(o.type) && !fontFor(o)) {
            // teks tanpa font: dibakar sebagai raster (fill)
            if (ls.mode === 'line') warnings.push('Teks dengan font tanpa outline diproses sebagai raster (fill). Pilih font dari daftar atau muat TTF.');
            emitImage(em, o, ls, feed, warnings, true);
          } else {
            vectorObjs.push(o);
          }
        }
        if (ls.mode === 'fill' || ls.mode === 'fillline') {
          if (ls.fillAll !== false) {
            // semua bentuk di layer diisi sekaligus (even-odd): bentuk di dalam bentuk menjadi lubang
            const all: Polyline[] = [];
            for (const o of vectorObjs) for (const sh of objectToShapes(o, ctx)) all.push(...sh);
            if (all.length) emitFill(em, all, ls, feed);
          } else {
            for (const o of vectorObjs) {
              for (const sh of objectToShapes(o, ctx)) emitFill(em, sh, ls, feed);
            }
          }
        }
        if (ls.mode === 'line' || ls.mode === 'fillline') {
          const all: Polyline[] = [];
          for (const o of vectorObjs) for (const sh of objectToShapes(o, ctx)) all.push(...sh);
          emitLines(em, all, ls, feed);
        }
      }
    }
    em.raw('M5');
    em.lastS = null;
    if (ls.zOffset) { em.raw(`G91 G0 Z${n(-ls.zOffset)}`); em.raw('G90'); }
    if (ls.air) em.raw('M9');
  }
  if (!anyOutput) warnings.push('Tidak ada objek yang dikeluarkan (periksa layer Output).');

  em.raw('M5');
  if (machine.endGcode) machine.endGcode.split('\n').forEach(l => em.raw(l));
  if (machine.returnHome) em.rapid(machine.startFrom === 'current' && bounds ? invOriginOf(machine, bounds) : invOrigin(machine), -1);
  if (machine.startFrom === 'current') em.raw('G92.1');
  em.raw('M2');
  em.finish();

  return {
    gcode: em.lines.join('\n') + '\n',
    moves: em.moves,
    seconds: em.seconds,
    cutLength: em.cutLength,
    rapidLength: em.rapidLength,
    bounds,
    warnings: [...new Set(warnings)],
  };
}

/** Sudut job (koordinat kanvas) yang menjadi (0,0) pada mode "posisi saat ini". */
function invOriginOf(m: MachineSettings, b: NonNullable<JobResult['bounds']>): XY {
  switch (m.origin) {
    case 'bl': return { x: b.minX, y: b.maxY };
    case 'tl': return { x: b.minX, y: b.minY };
    case 'br': return { x: b.maxX, y: b.maxY };
    case 'tr': return { x: b.maxX, y: b.minY };
  }
}

/** Titik kanvas yang bersesuaian dengan (0,0) mesin. */
function invOrigin(m: MachineSettings): XY {
  switch (m.origin) {
    case 'bl': return { x: 0, y: m.height };
    case 'tl': return { x: 0, y: 0 };
    case 'br': return { x: m.width, y: m.height };
    case 'tr': return { x: m.width, y: 0 };
  }
}

/* ---------- Mode Line ---------- */

function emitLines(em: Emitter, polys: Polyline[], ls: LayerSettings, feed: number) {
  const remaining = polys.filter(p => p.pts.length >= 2);
  const p = ls.power / 100;
  while (remaining.length) {
    // nearest-neighbor dari posisi saat ini
    let best = 0, bestD = Infinity, bestStart = 0, reverse = false;
    for (let i = 0; i < remaining.length; i++) {
      const pl = remaining[i];
      if (pl.closed) {
        for (let k = 0; k < pl.pts.length; k++) {
          const d = dist(em.cur, pl.pts[k]);
          if (d < bestD) { bestD = d; best = i; bestStart = k; reverse = false; }
        }
      } else {
        const d0 = dist(em.cur, pl.pts[0]);
        const d1 = dist(em.cur, pl.pts[pl.pts.length - 1]);
        if (d0 < bestD) { bestD = d0; best = i; bestStart = 0; reverse = false; }
        if (d1 < bestD) { bestD = d1; best = i; bestStart = 0; reverse = true; }
      }
    }
    const pl = remaining.splice(best, 1)[0];
    let pts = pl.pts;
    if (pl.closed) pts = [...pts.slice(bestStart), ...pts.slice(0, bestStart)];
    else if (reverse) pts = [...pts].reverse();
    if (pl.closed) pts = [...pts, pts[0]];
    em.rapid(pts[0], ls.id);
    for (let i = 1; i < pts.length; i++) em.cut(pts[i], p, feed, ls.id);
  }
}

/* ---------- Mode Fill (scanline vektor, even-odd per objek) ---------- */

function emitFill(em: Emitter, shape: Polyline[], ls: LayerSettings, feed: number) {
  const ang = (ls.angle * Math.PI) / 180;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const rot = (p: XY): XY => ({ x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos });
  const unrot = (p: XY): XY => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });

  // kumpulkan sisi (edges) dalam ruang terputar
  const edges: Array<[XY, XY]> = [];
  let minY = Infinity, maxY = -Infinity;
  for (const pl of shape) {
    const pts = pl.pts.map(rot);
    if (pts.length < 3) continue;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      edges.push([a, b]);
      minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
    }
  }
  if (!edges.length) return;

  const step = Math.max(0.01, ls.interval);
  const p = ls.power / 100;
  const ov = Math.max(0, ls.overscan);
  let dir = 1;
  const xs: number[] = [];
  for (let y = minY + step / 2; y < maxY; y += step) {
    xs.length = 0;
    for (const [a, b] of edges) {
      if ((a.y <= y) !== (b.y <= y)) {
        xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((u, v) => u - v);
    const spans: Array<[number, number]> = [];
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1e-4) spans.push([xs[i], xs[i + 1]]);
    if (!spans.length) continue;
    if (dir < 0) spans.reverse();
    const first = dir > 0 ? spans[0][0] : spans[0][1];
    const last = dir > 0 ? spans[spans.length - 1][1] : spans[spans.length - 1][0];
    // overscan masuk
    em.rapid(unrot({ x: first - dir * ov, y }), ls.id);
    if (ov > 0) em.cut(unrot({ x: first, y }), 0, feed, ls.id);
    let cx = first;
    for (const sp of spans) {
      const s0 = dir > 0 ? sp[0] : sp[1], s1 = dir > 0 ? sp[1] : sp[0];
      if (Math.abs(s0 - cx) > 1e-4) em.cut(unrot({ x: s0, y }), 0, feed, ls.id);
      em.cut(unrot({ x: s1, y }), p, feed, ls.id);
      cx = s1;
    }
    if (ov > 0) em.cut(unrot({ x: last + dir * ov, y }), 0, feed, ls.id);
    if (ls.bidir) dir = -dir;
  }
}

/* ---------- Mode Image (raster) ---------- */

function emitImage(em: Emitter, obj: FabricObject, ls: LayerSettings, feed: number, warnings: string[], asFill = false) {
  const r = rasterizeObject(obj, ls.interval, ls.negative && !asFill);
  if (!r) { warnings.push('Gambar terlalu besar untuk diraster pada interval ini.'); return; }
  const mode = asFill ? 'threshold' : ls.dither;
  const img = dither(r.gray, r.w, r.h, mode);
  const pMax = ls.power / 100, pMin = ls.minPower / 100;
  const ov = Math.max(0, ls.overscan);
  const powerOf = (v: number) => {
    if (v >= 255) return 0;
    if (mode === 'grayscale') return pMin + (1 - v / 255) * (pMax - pMin);
    return pMax;
  };
  // kuantisasi grayscale ke 64 level agar G-code tidak meledak
  const q = (v: number) => (mode === 'grayscale' ? Math.round(v / 4) * 4 : v);
  let dir = 1;
  for (let row = 0; row < r.h; row++) {
    const y = r.minY + (row + 0.5) * r.px;
    const base = row * r.w;
    let first = -1, last = -1;
    for (let x = 0; x < r.w; x++) {
      if (img[base + x] < 255) { if (first < 0) first = x; last = x; }
    }
    if (first < 0) continue;
    const xOf = (px: number) => r.minX + px * r.px;
    if (dir > 0) {
      em.rapid({ x: xOf(first) - ov, y }, ls.id);
      if (ov > 0) em.cut({ x: xOf(first), y }, 0, feed, ls.id);
      let runV = q(img[base + first]);
      for (let x = first + 1; x <= last + 1; x++) {
        const v = x <= last ? q(img[base + x]) : -1;
        if (v !== runV) {
          em.cut({ x: xOf(x), y }, powerOf(runV), feed, ls.id);
          runV = v;
        }
      }
      if (ov > 0) em.cut({ x: xOf(last + 1) + ov, y }, 0, feed, ls.id);
    } else {
      em.rapid({ x: xOf(last + 1) + ov, y }, ls.id);
      if (ov > 0) em.cut({ x: xOf(last + 1), y }, 0, feed, ls.id);
      let runV = q(img[base + last]);
      for (let x = last - 1; x >= first - 1; x--) {
        const v = x >= first ? q(img[base + x]) : -1;
        if (v !== runV) {
          em.cut({ x: xOf(x + 1), y }, powerOf(runV), feed, ls.id);
          runV = v;
        }
      }
      if (ov > 0) em.cut({ x: xOf(first) - ov, y }, 0, feed, ls.id);
    }
    if (ls.bidir) dir = -dir;
  }
}

export function formatDuration(sec: number) {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
