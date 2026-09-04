import type { JobResult, MachineSettings } from '../types';
import { LAYER_COLORS } from '../types';

/** Penggambar simulasi jalur laser pada elemen <canvas>. */
export class PreviewView {
  job: JobResult | null = null;
  machine: MachineSettings | null = null;
  progress = 1; // 0..1 fraksi gerak yang digambar
  showRapid = true;

  constructor(public el: HTMLCanvasElement) {}

  setJob(job: JobResult, machine: MachineSettings) {
    this.job = job;
    this.machine = machine;
    this.progress = 1;
    this.draw();
  }

  draw() {
    const ctx = this.el.getContext('2d')!;
    const W = this.el.width, H = this.el.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1f2023';
    ctx.fillRect(0, 0, W, H);
    if (!this.job || !this.machine) return;
    const m = this.machine;
    const z = Math.min(W / m.width, H / m.height) * 0.92;
    const ox = (W - m.width * z) / 2, oy = (H - m.height * z) / 2;
    ctx.setTransform(z, 0, 0, z, ox, oy);
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, m.width, m.height);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1 / z;
    ctx.strokeRect(0, 0, m.width, m.height);

    const moves = this.job.moves;
    const upto = Math.floor(moves.length * this.progress);
    // kelompokkan per (layer, level daya) agar cepat
    const groups = new Map<string, Path2D>();
    const rapid = new Path2D();
    for (let i = 0; i < upto; i++) {
      const mv = moves[i];
      if (mv.rapid) {
        rapid.moveTo(mv.x0, mv.y0); rapid.lineTo(mv.x1, mv.y1);
        continue;
      }
      if (mv.s <= 0) continue;
      const lvl = Math.min(7, Math.floor(mv.s * 8));
      const key = `${mv.layer}:${lvl}`;
      let p = groups.get(key);
      if (!p) { p = new Path2D(); groups.set(key, p); }
      p.moveTo(mv.x0, mv.y0); p.lineTo(mv.x1, mv.y1);
    }
    ctx.lineCap = 'round';
    for (const [key, p] of groups) {
      const [layer, lvl] = key.split(':').map(Number);
      const color = LAYER_COLORS[layer] ?? '#000';
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.25 + 0.75 * ((lvl + 1) / 8);
      ctx.lineWidth = Math.max(0.15, 1.2 / z);
      ctx.stroke(p);
    }
    ctx.globalAlpha = 1;
    if (this.showRapid) {
      ctx.strokeStyle = 'rgba(229,57,53,0.7)';
      ctx.lineWidth = 0.8 / z;
      ctx.setLineDash([2 / z, 2 / z]);
      ctx.stroke(rapid);
      ctx.setLineDash([]);
    }
    // posisi kepala laser saat ini
    const cur = upto > 0 ? moves[upto - 1] : null;
    if (cur) {
      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      ctx.arc(cur.x1, cur.y1, 3 / z, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
