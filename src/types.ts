// Tipe data inti OpenBurn

export type LayerMode = 'line' | 'fill' | 'fillline' | 'image';
export type DitherMode =
  | 'threshold' | 'ordered' | 'floyd' | 'jarvis' | 'stucki' | 'atkinson' | 'grayscale';

export interface LayerSettings {
  id: number;            // 0..15 (C00..C15)
  name: string;
  color: string;
  mode: LayerMode;
  speed: number;         // mm/s
  power: number;         // % daya maksimum
  minPower: number;      // % daya minimum (untuk grayscale / M4)
  passes: number;
  interval: number;      // mm, jarak antar garis (fill / image)
  angle: number;         // derajat, sudut scan fill
  bidir: boolean;        // scan bolak-balik
  fillAll: boolean;      // isi semua bentuk di layer sekaligus (bentuk bersarang = lubang)
  overscan: number;      // mm, lebih-lintas di ujung baris scan
  output: boolean;       // ikut dikeluarkan ke G-code
  air: boolean;          // air assist (M8/M9)
  zOffset: number;       // mm
  dither: DitherMode;    // untuk mode image
  negative: boolean;     // balik hitam-putih gambar
  priority: number;      // urutan eksekusi (kecil = dulu)
}

export type Origin = 'bl' | 'tl' | 'br' | 'tr';
export type StartFrom = 'absolute' | 'current';

export interface MachineSettings {
  name: string;
  width: number;         // mm
  height: number;        // mm
  origin: Origin;        // posisi origin mesin
  sMax: number;          // nilai S untuk 100% ($30 di GRBL)
  rapidSpeed: number;    // mm/min untuk perkiraan waktu G0
  accel: number;         // mm/s^2 untuk perkiraan waktu
  laserMode: 'M3' | 'M4';
  baud: number;
  startFrom: StartFrom;
  startGcode: string;
  endGcode: string;
  returnHome: boolean;   // G0 X0 Y0 di akhir
  workOffset: boolean;   // kirim G10 L2 P1 saat terhubung (mesin dengan koordinat negatif setelah home)
  workOffsetX: number;   // mm, biasanya -lebar
  workOffsetY: number;   // mm, biasanya -tinggi
}

export interface Move {
  rapid: boolean;
  x0: number; y0: number;
  x1: number; y1: number;
  s: number;             // 0..1 (fraksi daya)
  layer: number;
}

export interface JobResult {
  gcode: string;
  moves: Move[];
  seconds: number;
  cutLength: number;
  rapidLength: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  warnings: string[];
}

export interface XY { x: number; y: number }

export interface Polyline {
  pts: XY[];
  closed: boolean;
}

export const LAYER_COLORS = [
  '#000000', '#0000ff', '#ff0000', '#00e000', '#d0d000', '#ff8000', '#00e0e0', '#ff00ff',
  '#b4b4b4', '#0000a0', '#a00000', '#00a000', '#a0a000', '#c08000', '#00a0ff', '#a000a0',
];

export function defaultLayer(id: number): LayerSettings {
  return {
    id,
    name: '',
    color: LAYER_COLORS[id],
    mode: id === 15 ? 'image' : 'line',
    speed: id === 15 ? 100 : 20,
    power: 50,
    minPower: 0,
    passes: 1,
    interval: 0.1,
    angle: 0,
    bidir: true,
    fillAll: true,
    overscan: 2.5,
    output: true,
    air: false,
    zOffset: 0,
    dither: 'jarvis',
    negative: false,
    priority: id,
  };
}

export function defaultMachine(): MachineSettings {
  return {
    name: 'GRBL Laser',
    width: 400,
    height: 400,
    origin: 'bl',
    sMax: 1000,
    rapidSpeed: 6000,
    accel: 1000,
    laserMode: 'M4',
    baud: 115200,
    startFrom: 'absolute',
    startGcode: '',
    endGcode: '',
    returnHome: true,
    workOffset: false,
    workOffsetX: -400,
    workOffsetY: -400,
  };
}

export const MODE_LABEL: Record<LayerMode, string> = {
  line: 'Line', fill: 'Fill', fillline: 'Fill+Line', image: 'Image',
};

export const DITHER_LABEL: Record<DitherMode, string> = {
  threshold: 'Threshold', ordered: 'Ordered (Bayer)', floyd: 'Floyd-Steinberg',
  jarvis: 'Jarvis', stucki: 'Stucki', atkinson: 'Atkinson', grayscale: 'Grayscale',
};
