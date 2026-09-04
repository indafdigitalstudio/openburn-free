# OpenBurn Free

Perangkat lunak laser cutter / engraver **open-source** (lisensi MIT) untuk mesin **GRBL 1.1**.
Berjalan di browser (Chrome/Edge) atau sebagai aplikasi desktop Windows (Tauri).

Ini adalah versi Free. Versi Pro (material library, test grid, DXF, boolean, offset, edit titik, trace,
kamera, rotary, kerf, tab, ramp) tersedia di situs OpenBurn.

## Fitur

**Antarmuka**
- Bahasa Indonesia (bawaan) dan Inggris: pemilih ID/EN di menu atas.

**Editor desain**
- Kanvas 2D dalam satuan milimeter, grid, zoom (roda mouse), geser (spasi / tombol tengah).
- Alat gambar: persegi, elips, garis, poligon, teks. Snap 1 mm dengan `Ctrl`, rasio 1:1 dengan `Shift`.
- Pilih, geser, skala, putar, cermin, rata kiri/kanan/atas/bawah/tengah, tengah area kerja.
- Grup / lepas grup, duplikat, salin-tempel, grid array, undo/redo.
- Panel Bentuk: X, Y, lebar, tinggi, rotasi, isi teks, ukuran font, gaya, rata teks.
- Impor **SVG** (warna stroke dipetakan otomatis ke layer terdekat) dan gambar **PNG/JPG/BMP/GIF/WebP** (drag & drop juga bisa).
- Teks: 14 keluarga font bawaan (OFL) dengan gaya Regular/Bold/Italic/Bold Italic bila tersedia, font sistem lewat
  Local Font Access (Chrome/Edge), muat file TTF/OTF; semua jadi outline vektor untuk G-code.
- Simpan/buka proyek `.obp` (JSON), ekspor SVG.

**Cuts / Layers**
- 16 layer warna (C00–C15); objek diberi layer lewat palet.
- Mode per layer: **Line**, **Fill**, **Fill+Line**, **Image**.
- Kecepatan (mm/s), daya maks/min (%), jumlah pass, interval scan, sudut scan, bolak-balik, overscan,
  isi sekaligus (bentuk bersarang = lubang), air assist (M8/M9), Z offset, prioritas, output on/off.
- Dithering gambar: Threshold, Ordered (Bayer), Floyd-Steinberg, Jarvis, Stucki, Atkinson, Grayscale (daya variabel).

**Laser / G-code**
- Generator G-code **GRBL 1.1** (G0/G1, M3/M4 dinamis, S, F, M8/M9, G92 untuk "mulai dari posisi saat ini").
- Optimasi urutan potong (nearest neighbour), overscan raster, pass berulang.
- Pratinjau simulasi jalur + perkiraan waktu (model akselerasi trapesium), panjang potong, jumlah baris.
- Koneksi ke mesin lewat **Web Serial** (browser) atau serial native (desktop): hubungkan, mulai/jeda/lanjut/stop,
  bingkai (frame), home, buka kunci, reset alarm, set origin, hapus G92, offset kerja G10 L2 P1, jog, tes laser,
  konsol G-code dengan penjelasan kode ALARM/error, status posisi real-time.
- Pengaturan mesin: ukuran area, origin (4 sudut), S max (`$30`), M3/M4, baud, G-code awal/akhir.

## Menjalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:5189` di **Chrome atau Edge** (Web Serial tidak ada di Firefox/Safari).

Build statis:

```bash
npm run build
```

Hasil di folder `dist/` (Web Serial butuh `https://` atau `localhost`).

## Aplikasi desktop (Tauri)

Folder `src-tauri/` berisi pembungkus desktop Tauri 2 dengan backend serial native (crate `serialport`).
Prasyarat Windows: Rust stable, Visual Studio Build Tools dengan workload **Desktop development with C++**, WebView2.

```bash
npm run desktop:dev
npm run desktop:build   # installer: src-tauri/target/release/bundle/nsis/
```

## Rilis

- **1.0.1** (2026-09-04): ikon aplikasi dan tanda merek memakai logo naga OpenBurn.
- **1.0.0** (2026-09-04): rilis pertama versi Free.

## Alur kerja singkat

1. **Pengaturan Mesin**: ukuran area, origin, S max sesuai `$30` GRBL.
2. Gambar / impor desain. Pilih objek, klik warna di palet untuk memindahkannya ke layer.
3. Atur mode, kecepatan, daya tiap layer di **Cuts / Layers**.
4. **Pratinjau** untuk melihat jalur dan perkiraan waktu.
5. Tab **Laser** → **Hubungkan** → **Bingkai** → **Mulai**, atau **Simpan G-code**.

## Catatan teknis

- Koordinat kanvas: origin kiri-atas, Y ke bawah (mm). Konversi ke koordinat mesin memakai pengaturan origin.
- Firmware GRBL sebaiknya dalam laser mode (`$32=1`).
- Streaming ke GRBL memakai protokol character-counting (buffer RX 127 byte).
- Fill memakai scanline vektor even-odd; gambar dan teks tanpa font diraster memakai interval layer.

## Struktur kode

```
src/
  types.ts            tipe data, palet layer, default mesin
  i18n.ts             kamus ID→EN, t(), translateDom()
  editor/canvas.ts    kanvas Fabric.js: grid, zoom/pan, riwayat, rata, grup, array
  editor/tools.ts     alat gambar
  editor/layers.ts    pengaturan layer + gaya objek
  editor/geometry.ts  objek kanvas → polyline (mm), teks → path (opentype.js)
  editor/import.ts    impor SVG/gambar, pemetaan warna ke layer
  laser/gcode.ts      generator G-code (line/fill/image), estimasi waktu
  laser/dither.ts     algoritma dithering
  laser/raster.ts     rasterisasi objek ke bitmap
  laser/preview.ts    penggambar simulasi
  device/transport.ts Web Serial (browser) / serial native (Tauri)
  device/grbl.ts      driver GRBL
  device/grblcodes.ts keterangan kode ALARM/error
  ui/app.ts           seluruh antarmuka
src-tauri/            pembungkus desktop Tauri 2 (Rust)
```

## Lisensi

MIT. Font di `public/fonts` berlisensi SIL Open Font License 1.1 (lihat `LICENSES.txt`).
