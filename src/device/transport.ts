/**
 * Lapisan transport serial: Web Serial (browser) atau serial native lewat Tauri (desktop).
 */

export interface Transport {
  readonly kind: 'webserial' | 'tauri';
  /** Daftar port (hanya Tauri); null berarti pemilihan port lewat dialog browser. */
  listPorts(): Promise<string[] | null>;
  open(port: string | null, baud: number): Promise<void>;
  close(): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
  onData(cb: (bytes: Uint8Array) => void): void;
  onClose(cb: () => void): void;
}

export function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function transportSupported() {
  return isTauri() || (typeof navigator !== 'undefined' && 'serial' in navigator);
}

export function createTransport(): Transport {
  return isTauri() ? new TauriTransport() : new WebSerialTransport();
}

/* ---------- Web Serial ---------- */

class WebSerialTransport implements Transport {
  readonly kind = 'webserial' as const;
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private dataCb: (b: Uint8Array) => void = () => {};
  private closeCb: () => void = () => {};
  private closing = false;

  async listPorts() { return null; }

  async open(_port: string | null, baud: number) {
    if (!('serial' in navigator)) throw new Error('Web Serial tidak didukung browser ini. Gunakan Chrome/Edge atau versi desktop.');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: baud });
    this.port = port;
    this.closing = false;
    this.writer = port.writable!.getWriter();
    this.readLoop();
  }

  private async readLoop() {
    while (this.port?.readable && !this.closing) {
      this.reader = this.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) this.dataCb(value);
        }
      } catch {
        /* port dicabut / dibatalkan */
      } finally {
        try { this.reader.releaseLock(); } catch { /* abaikan */ }
      }
      if (!this.closing) break;
    }
    if (!this.closing) { this.closing = true; await this.teardown(); this.closeCb(); }
  }

  private async teardown() {
    try { await this.reader?.cancel(); } catch { /* abaikan */ }
    try { this.writer?.releaseLock(); } catch { /* abaikan */ }
    try { await this.port?.close(); } catch { /* abaikan */ }
    this.reader = null; this.writer = null; this.port = null;
  }

  async close() {
    if (this.closing) return;
    this.closing = true;
    await this.teardown();
  }

  async write(bytes: Uint8Array) {
    if (!this.writer) throw new Error('port tidak terbuka');
    await this.writer.write(bytes);
  }

  onData(cb: (b: Uint8Array) => void) { this.dataCb = cb; }
  onClose(cb: () => void) { this.closeCb = cb; }
}

/* ---------- Tauri (serialport crate di Rust) ---------- */

class TauriTransport implements Transport {
  readonly kind = 'tauri' as const;
  private dataCb: (b: Uint8Array) => void = () => {};
  private closeCb: () => void = () => {};
  private unlisten: Array<() => void> = [];
  private opened = false;

  private async api() {
    const [core, event] = await Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/api/event')]);
    return { invoke: core.invoke, listen: event.listen };
  }

  async listPorts() {
    const { invoke } = await this.api();
    return await invoke<string[]>('serial_list');
  }

  async open(port: string | null, baud: number) {
    if (!port) throw new Error('Pilih port serial dulu.');
    const { invoke, listen } = await this.api();
    await this.detach();
    this.unlisten.push(await listen<number[]>('serial-data', (e) => this.dataCb(Uint8Array.from(e.payload))));
    this.unlisten.push(await listen('serial-closed', () => { if (this.opened) { this.opened = false; this.detach(); this.closeCb(); } }));
    await invoke('serial_open', { port, baud });
    this.opened = true;
  }

  private async detach() {
    for (const u of this.unlisten) { try { u(); } catch { /* abaikan */ } }
    this.unlisten = [];
  }

  async close() {
    const { invoke } = await this.api();
    this.opened = false;
    await this.detach();
    try { await invoke('serial_close'); } catch { /* abaikan */ }
  }

  async write(bytes: Uint8Array) {
    const { invoke } = await this.api();
    await invoke('serial_write', { data: Array.from(bytes) });
  }

  onData(cb: (b: Uint8Array) => void) { this.dataCb = cb; }
  onClose(cb: () => void) { this.closeCb = cb; }
}
