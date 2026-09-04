/**
 * Driver GRBL di atas lapisan transport (Web Serial di browser, serial native di desktop Tauri).
 * Streaming memakai protokol character-counting (buffer RX 127 byte).
 */

import { createTransport, transportSupported, type Transport } from './transport';

export interface GrblStatus {
  state: string;              // Idle, Run, Hold, Jog, Alarm, Door, Home, Sleep, Check
  mpos: [number, number, number];
  wpos: [number, number, number];
  wco: [number, number, number];
  feed: number;
  spindle: number;
}

export type GrblEvent =
  | { type: 'connected' } | { type: 'disconnected' }
  | { type: 'rx'; line: string } | { type: 'tx'; line: string }
  | { type: 'status'; status: GrblStatus }
  | { type: 'progress'; sent: number; acked: number; total: number }
  | { type: 'jobdone' } | { type: 'error'; message: string };

const RX_BUFFER = 127;

export class GrblDevice {
  private transport: Transport | null = null;
  private listeners: Array<(e: GrblEvent) => void> = [];
  private queue: string[] = [];
  private inflight: number[] = [];
  private pollTimer: number | null = null;
  private jobTotal = 0;
  private jobAcked = 0;
  private jobSent = 0;
  private running = false;
  private rxBuf = '';
  private decoder = new TextDecoder();
  status: GrblStatus = { state: '-', mpos: [0, 0, 0], wpos: [0, 0, 0], wco: [0, 0, 0], feed: 0, spindle: 0 };
  connected = false;
  verbose = false;

  static supported() { return transportSupported(); }

  on(fn: (e: GrblEvent) => void) { this.listeners.push(fn); }
  private emit(e: GrblEvent) { this.listeners.forEach(f => f(e)); }

  /** Daftar port (desktop). null = browser memilih port lewat dialognya sendiri. */
  async listPorts(): Promise<string[] | null> {
    if (!this.transport) this.transport = createTransport();
    return this.transport.listPorts();
  }

  async connect(baud: number, port: string | null = null) {
    if (!GrblDevice.supported()) throw new Error('Tidak ada akses serial. Gunakan Chrome/Edge atau versi desktop OpenBurn.');
    if (!this.transport) this.transport = createTransport();
    const t = this.transport;
    t.onData((bytes) => this.onBytes(bytes));
    t.onClose(() => { if (this.connected) this.disconnect(); });
    await t.open(port, baud);
    this.connected = true;
    this.queue = []; this.inflight = []; this.rxBuf = '';
    this.emit({ type: 'connected' });
    this.pollTimer = window.setInterval(() => this.realtime('?'), 250);
    await this.realtime('?');
  }

  async disconnect() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    const was = this.connected;
    this.connected = false;
    this.queue = []; this.inflight = []; this.running = false;
    try { await this.transport?.close(); } catch { /* abaikan */ }
    if (was) this.emit({ type: 'disconnected' });
  }

  private onBytes(bytes: Uint8Array) {
    this.rxBuf += this.decoder.decode(bytes, { stream: true });
    let idx: number;
    while ((idx = this.rxBuf.indexOf('\n')) >= 0) {
      const line = this.rxBuf.slice(0, idx).replace(/\r$/, '');
      this.rxBuf = this.rxBuf.slice(idx + 1);
      if (line) this.onLine(line);
    }
  }

  private onLine(line: string) {
    if (line.startsWith('<') && line.endsWith('>')) {
      this.parseStatus(line);
      if (this.verbose) this.emit({ type: 'rx', line });
      return;
    }
    this.emit({ type: 'rx', line });
    if (line === 'ok' || line.startsWith('error:')) {
      this.inflight.shift();
      if (this.running) {
        this.jobAcked++;
        this.emit({ type: 'progress', sent: this.jobSent, acked: this.jobAcked, total: this.jobTotal });
        if (this.jobAcked >= this.jobTotal) {
          this.running = false;
          this.emit({ type: 'jobdone' });
        }
      }
      this.pump();
    } else if (line.startsWith('Grbl')) {
      // reset: buffer GRBL kosong
      this.inflight = [];
      this.pump();
    }
  }

  private parseStatus(line: string) {
    const body = line.slice(1, -1);
    const parts = body.split('|');
    const st: GrblStatus = { ...this.status, state: parts[0].split(':')[0] };
    for (const p of parts.slice(1)) {
      const [k, v] = p.split(':');
      const nums = (v ?? '').split(',').map(Number);
      if (k === 'MPos') st.mpos = [nums[0] || 0, nums[1] || 0, nums[2] || 0];
      else if (k === 'WPos') st.wpos = [nums[0] || 0, nums[1] || 0, nums[2] || 0];
      else if (k === 'WCO') st.wco = [nums[0] || 0, nums[1] || 0, nums[2] || 0];
      else if (k === 'FS') { st.feed = nums[0] || 0; st.spindle = nums[1] || 0; }
      else if (k === 'F') st.feed = nums[0] || 0;
    }
    if (parts.some(p => p.startsWith('MPos'))) st.wpos = st.mpos.map((m, i) => m - st.wco[i]) as any;
    else if (parts.some(p => p.startsWith('WPos'))) st.mpos = st.wpos.map((w, i) => w + st.wco[i]) as any;
    this.status = st;
    this.emit({ type: 'status', status: st });
  }

  private async writeRaw(bytes: Uint8Array) {
    if (!this.transport || !this.connected) return;
    try { await this.transport.write(bytes); } catch (err) { this.emit({ type: 'error', message: String(err) }); }
  }

  /** Perintah realtime satu byte (?, !, ~, 0x18, 0x85) tanpa antre. */
  async realtime(cmd: string | number) {
    const b = typeof cmd === 'number' ? new Uint8Array([cmd]) : new TextEncoder().encode(cmd);
    await this.writeRaw(b);
  }

  /** Antrekan satu baris G-code / perintah $. */
  send(line: string) {
    const l = line.trim();
    if (!l) return;
    this.queue.push(l);
    this.pump();
  }

  private pumping = false;
  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.queue.length && this.connected) {
        const next = this.queue[0];
        const used = this.inflight.reduce((a, b) => a + b, 0);
        if (used + next.length + 1 > RX_BUFFER) break;
        this.queue.shift();
        this.inflight.push(next.length + 1);
        if (this.running) this.jobSent++;
        if (!this.running || this.verbose) this.emit({ type: 'tx', line: next });
        await this.writeRaw(new TextEncoder().encode(next + '\n'));
      }
    } finally {
      this.pumping = false;
    }
  }

  /* ---------- Job ---------- */

  startJob(gcode: string) {
    const lines = gcode.split('\n').map(l => l.replace(/;.*$/, '').replace(/\(.*?\)/g, '').trim()).filter(Boolean);
    this.jobTotal = lines.length;
    this.jobAcked = 0; this.jobSent = 0;
    this.running = true;
    this.emit({ type: 'progress', sent: 0, acked: 0, total: this.jobTotal });
    for (const l of lines) this.queue.push(l);
    this.pump();
  }

  get isRunning() { return this.running; }

  pause() { return this.realtime('!'); }
  resume() { return this.realtime('~'); }

  /** Hentikan: feed hold, reset lunak (0x18), kosongkan antrean, lalu buka alarm. */
  async stop() {
    this.queue = [];
    this.inflight = [];
    this.running = false;
    await this.realtime('!');
    await new Promise(r => setTimeout(r, 100));
    await this.realtime(0x18);
    await new Promise(r => setTimeout(r, 600));
    this.send('$X');
    this.emit({ type: 'jobdone' });
  }

  /* ---------- Gerak ---------- */

  jog(dx: number, dy: number, feed: number) {
    const parts = ['$J=G91 G21'];
    if (dx) parts.push(`X${fmt(dx)}`);
    if (dy) parts.push(`Y${fmt(dy)}`);
    parts.push(`F${Math.round(feed)}`);
    this.send(parts.join(' '));
  }
  jogCancel() { return this.realtime(0x85); }
  /** Reset lunak lalu buka kunci alarm (untuk ALARM yang minta "Reset to continue"). */
  async resetAlarm() {
    this.queue = []; this.inflight = []; this.running = false;
    await this.realtime(0x18);
    await new Promise(r => setTimeout(r, 800));
    this.send('$X');
  }
  /** Offset koordinat kerja G54: WPos = MPos - offset (mis. X-400 Y-400 untuk mesin ber-home di kanan/atas). */
  applyWorkOffset(x: number, y: number) {
    this.send(`G10 L2 P1 X${fmt(x)} Y${fmt(y)}`);
    this.send('G54');
  }
  home() { this.send('$H'); }
  unlock() { this.send('$X'); }
  goTo(x: number, y: number) { this.send(`G90 G21 G0 X${fmt(x)} Y${fmt(y)}`); }
  setOrigin() { this.send('G92 X0 Y0'); }
  clearOrigin() { this.send('G92.1'); }
  laserOff() { this.send('M5'); }
}

function fmt(n: number) {
  return (Math.round(n * 1000) / 1000).toString();
}
