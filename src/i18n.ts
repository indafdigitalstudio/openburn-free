/**
 * Internasionalisasi sederhana: teks Indonesia = kunci; kamus memetakan ke bahasa lain.
 * Bahasa disimpan di localStorage 'openburn.lang' dan berlaku setelah muat ulang.
 */

export type Lang = 'id' | 'en';
const LS_KEY = 'openburn.lang';

export function currentLang(): Lang {
  try { return (localStorage.getItem(LS_KEY) as Lang) === 'en' ? 'en' : 'id'; } catch { return 'id'; }
}
export function setLang(l: Lang) { localStorage.setItem(LS_KEY, l); }

const EN: Record<string, string> = {
  // ---- menu & toolbar
  'Proyek baru': 'New project', 'Baru': 'New', 'Buka proyek (.obp)': 'Open project (.obp)', 'Buka': 'Open',
  'Simpan proyek (.obp)': 'Save project (.obp)', 'Simpan': 'Save', 'Impor SVG / DXF / PNG / JPG / BMP': 'Import SVG / DXF / PNG / JPG / BMP',
  'Impor': 'Import', 'Ekspor desain sebagai SVG': 'Export design as SVG', 'Ekspor SVG': 'Export SVG', 'Simpan G-code (.gc)': 'Save G-code (.gc)',
  'Simpan G-code': 'Save G-code', 'Muat file font TTF/OTF tambahan': 'Load an extra TTF/OTF font file', 'Muat font TTF': 'Load TTF font',
  'Pengaturan Mesin': 'Machine Settings', 'Pustaka material: preset kecepatan/daya per bahan': 'Material library: speed/power presets per material',
  'Buat matriks uji kecepatan × daya': 'Create a speed × power test matrix', 'Pratinjau': 'Preview', 'Bantuan': 'Help',
  'Perbesar': 'Zoom in', 'Perkecil': 'Zoom out', 'Muat seluruh area kerja': 'Fit work area', 'Zoom ke seleksi': 'Zoom to selection',
  'Rata kiri': 'Align left', 'Tengah horizontal': 'Center horizontally', 'Rata kanan': 'Align right', 'Rata atas': 'Align top',
  'Tengah vertikal': 'Center vertically', 'Rata bawah': 'Align bottom', 'Tengah area kerja': 'Center on work area',
  'Cermin horizontal': 'Mirror horizontally', 'Cermin vertikal': 'Mirror vertically', 'Putar 90°': 'Rotate 90°',
  'Grup (Ctrl+G)': 'Group (Ctrl+G)', 'Grup': 'Group', 'Lepas grup (Ctrl+U)': 'Ungroup (Ctrl+U)', 'Lepas': 'Ungroup',
  'Duplikat (Ctrl+D)': 'Duplicate (Ctrl+D)', 'Duplikat': 'Duplicate', 'Susun grid array': 'Grid array', 'Ubah teks ke path (perlu font TTF)': 'Convert text to path (needs a TTF font)',
  'Teks→Path': 'Text→Path', 'Gabung (union) semua objek terpilih': 'Union all selected objects', '∪ Gabung': '∪ Union',
  'Kurangi: objek paling bawah dikurangi objek lainnya': 'Subtract: bottom-most object minus the others', '∖ Kurangi': '∖ Subtract',
  'Iris: hanya bagian yang tumpang tindih': 'Intersect: overlapping area only', '∩ Iris': '∩ Intersect',
  'XOR: bagian yang tidak tumpang tindih': 'XOR: non-overlapping areas', 'Kontur paralel di luar/dalam bentuk': 'Parallel contour outside/inside the shape',
  'Edit titik (node) bentuk terpilih — atau dobel-klik bentuk': 'Edit nodes of the selected shape — or double-click the shape', 'Edit Titik': 'Edit Nodes',
  'Ubah gambar bitmap menjadi vektor': 'Trace bitmap image to vectors', 'Hapus (Del)': 'Delete (Del)', 'Hapus': 'Delete',
  'Pilih (V)': 'Select (V)', 'Geser tampilan (H / Spasi)': 'Pan view (H / Space)', 'Persegi (R)': 'Rectangle (R)', 'Elips (E)': 'Ellipse (E)',
  'Garis (L)': 'Line (L)', 'Poligon (P) — klik titik, Enter/dobel-klik selesai': 'Polygon (P) — click points, Enter/double-click to finish', 'Teks (T)': 'Text (T)',
  'Tab manual (B): klik kontur untuk menaruh tab, klik tab untuk menghapus': 'Manual tab (B): click a contour to add a tab, click a tab to remove it',
  'Edit titik': 'Edit nodes', 'Sisipkan titik di tengah segmen setelah titik terpilih': 'Insert a node in the middle of the segment after the selected node',
  '+ Titik': '+ Node', 'Hapus titik terpilih (Del)': 'Delete selected node (Del)', '− Titik': '− Node', 'Ubah segmen masuk: garis ↔ kurva': 'Toggle incoming segment: line ↔ curve',
  'Garis/Kurva': 'Line/Curve', 'Tutup/buka subpath': 'Close/open subpath', 'Tutup/Buka': 'Close/Open', 'Selesai (Esc)': 'Done (Esc)', 'Selesai': 'Done',
  // ---- tabs & layers
  'Bentuk': 'Shape', 'Konsol': 'Console', 'Kamera': 'Camera', 'Palet layer': 'Layer palette', '— klik untuk memberi layer ke objek terpilih': '— click to assign the layer to selected objects',
  'Nama layer (opsional)': 'Layer name (optional)', 'Preset material': 'Material preset', '— pilih preset material —': '— choose a material preset —',
  'Terapkan preset ke layer ini': 'Apply preset to this layer', 'Terapkan': 'Apply', 'Buka pustaka material': 'Open material library', 'Pustaka…': 'Library…',
  'Umum': 'General', 'Prioritas (kecil = dulu)': 'Priority (lower = first)', 'Potong': 'Cut', 'Kecepatan (mm/s)': 'Speed (mm/s)', 'Daya maks (%)': 'Max power (%)',
  'Daya min (%)': 'Min power (%)', 'Jumlah pass': 'Passes', 'Kerf offset (mm, + keluar)': 'Kerf offset (mm, + outward)', 'Tab / jembatan potong': 'Tabs / bridges',
  'Beri tab pada kontur tertutup': 'Add tabs to closed contours', 'Lebar tab (mm)': 'Tab width (mm)', 'Jumlah per bentuk': 'Count per shape', 'Jarak antar tab (mm)': 'Spacing between tabs (mm)',
  'Hanya manual': 'Manual only', 'Nilai': 'Value', 'Keliling minimum (mm)': 'Minimum perimeter (mm)',
  'Tab manual (alat ⊣) selalu dipakai bila ada; lebar mengikuti "Lebar tab".': 'Manual tabs (⊣ tool) are always used when present; width follows "Tab width".',
  'Ramp daya': 'Power ramp', 'Ramp awal (mm)': 'Ramp in (mm)', 'Ramp akhir (mm)': 'Ramp out (mm)',
  'Daya naik dari "Daya min" ke "Daya maks" sepanjang ramp awal tiap jalur, dan turun lagi di ramp akhir.': 'Power rises from "Min power" to "Max power" over the ramp-in distance of each path and falls again over the ramp-out.',
  'Fill (scan)': 'Fill (scan)', 'Image (raster)': 'Image (raster)', 'Interval garis (mm)': 'Line interval (mm)', 'Sudut scan (°)': 'Scan angle (°)',
  'Bolak-balik': 'Bidirectional', 'Bentuk di dalam bentuk lain menjadi lubang (even-odd)': 'Shapes inside other shapes become holes (even-odd)', 'Isi sekaligus': 'Fill all at once', 'Negatif': 'Negative',
  'Line mengikuti garis tepi bentuk; kecepatan mm/s dikonversi ke F (mm/min).': 'Line follows the shape outline; speed in mm/s is converted to F (mm/min).',
  'Fill mengisi area dengan garis sejarak interval; Fill+Line menambah garis tepi setelahnya.': 'Fill scans the area with lines at the interval; Fill+Line adds the outline afterwards.',
  'Gambar di-raster baris demi baris sejarak interval; Grayscale memakai daya min–maks.': 'Images are rastered row by row at the interval; Grayscale uses min–max power.',
  // ---- laser
  'Terputus': 'Disconnected', 'Hubungkan': 'Connect', 'Putuskan': 'Disconnect', '▶ Mulai': '▶ Start', '⏸ Jeda': '⏸ Pause', '⏵ Lanjut': '⏵ Resume',
  'Mulai dari': 'Start from', 'Koordinat absolut': 'Absolute coordinates', 'Posisi saat ini': 'Current position', 'Kontrol mesin': 'Machine control',
  'Kepala laser mengelilingi batas desain tanpa menyala': 'Move the head around the design bounds with the laser off', 'Bingkai': 'Frame', 'Buka kunci': 'Unlock',
  'Reset lunak (Ctrl-X) lalu $X': 'Soft reset (Ctrl-X) then $X', 'Reset alarm': 'Reset alarm', 'Ke 0 mesin': 'Go to machine 0',
  'G92 X0 Y0: posisi sekarang jadi 0,0 kerja': 'G92 X0 Y0: current position becomes work 0,0', 'G92.1: hapus offset Set origin': 'G92.1: clear the Set origin offset', 'Hapus G92': 'Clear G92',
  'G0 X0 Y0 (koordinat kerja)': 'G0 X0 Y0 (work coordinates)', 'Ke origin': 'Go to origin', 'Kirim G10 L2 P1 sesuai Pengaturan Mesin': 'Send G10 L2 P1 as set in Machine Settings',
  'Kirim offset kerja (G10 L2 P1)': 'Send work offset (G10 L2 P1)', 'Ke origin kerja': 'Go to work origin', 'Jarak (mm)': 'Distance (mm)', 'Kecepatan (mm/min)': 'Speed (mm/min)',
  'Tes laser': 'Laser test', 'Daya (%)': 'Power (%)', 'Nyalakan': 'Fire', 'Matikan': 'Off',
  'Browser: Chrome/Edge (Web Serial). Desktop: serial native. GRBL 1.1, laser mode $32=1.': 'Browser: Chrome/Edge (Web Serial). Desktop: native serial. GRBL 1.1, laser mode $32=1.',
  'Mesin: terputus': 'Machine: disconnected', 'Mesin: terhubung': 'Machine: connected', 'ALARM — klik Reset alarm': 'ALARM — click Reset alarm', 'selesai': 'done', 'baris': 'lines',
  'Akses serial tidak tersedia: pakai Chrome/Edge atau versi desktop.': 'No serial access: use Chrome/Edge or the desktop app.',
  'Mesin belum terhubung. Buka tab Laser dan klik Hubungkan.': 'Machine not connected. Open the Laser tab and click Connect.',
  'Tidak ada objek untuk dibingkai.': 'Nothing to frame.', 'Gagal terhubung: ': 'Connection failed: ', 'Gagal membaca daftar port: ': 'Could not list ports: ',
  '-- terhubung --': '-- connected --', '-- terputus --': '-- disconnected --', '-- job selesai --': '-- job done --',
  'Pilih Port Serial': 'Select Serial Port', 'Segarkan daftar': 'Refresh list', 'Colokkan mesin lalu klik segarkan jika port belum muncul.': 'Plug in the machine and click refresh if the port is missing.',
  'Tidak ada port serial. Colokkan mesin lalu klik segarkan.': 'No serial ports. Plug in the machine and click refresh.',
  // ---- shape
  'Pilih objek di kanvas untuk melihat dan mengubah propertinya.': 'Select an object on the canvas to view and edit its properties.', 'Objek': 'Object', 'Layer objek': 'Object layer',
  'Posisi & ukuran': 'Position & size', 'Lebar (mm)': 'Width (mm)', 'Tinggi (mm)': 'Height (mm)', 'Rotasi (°)': 'Rotation (°)', 'Kunci rasio': 'Lock ratio',
  'Override laser': 'Laser override', '— kosong = ikut layer': '— empty = use layer', 'Teks': 'Text', 'Isi': 'Content', 'Gaya': 'Style', 'Ukuran (mm)': 'Size (mm)',
  'Rata': 'Align', 'Kiri': 'Left', 'Rata tengah': 'Align center', 'Tengah': 'Center', 'Kanan': 'Right',
  'Tampilkan font yang terpasang di komputer (Chrome/Edge)': 'List fonts installed on this computer (Chrome/Edge)', 'Font sistem…': 'System fonts…', 'Muat file font TTF/OTF': 'Load a TTF/OTF font file', 'Muat TTF/OTF…': 'Load TTF/OTF…',
  'Bawaan': 'Built-in', 'Dimuat': 'Loaded', 'Sistem': 'System', 'Persegi': 'Rectangle', 'Elips': 'Ellipse', 'Lingkaran': 'Circle', 'Garis': 'Line', 'Poligon': 'Polygon', 'Gambar': 'Image', 'Seleksi': 'Selection',
  'objek': 'objects', 'Perkiraan': 'Estimate',
  // ---- camera
  'mati': 'off', 'Kalibrasi': 'Calibration', 'tersimpan': 'saved', 'belum (overlay butuh kalibrasi)': 'none (overlay needs calibration)', 'tidak didukung': 'not supported',
  'Perangkat': 'Device', '(bawaan)': '(default)', 'Segarkan daftar kamera': 'Refresh camera list', '⟳ Daftar': '⟳ List', '▶ Mulai kamera': '▶ Start camera', '■ Berhenti': '■ Stop',
  'Overlay di kanvas': 'Canvas overlay', 'Tampilkan overlay': 'Show overlay', 'Transparansi': 'Opacity', 'Kalibrasi & snapshot': 'Calibration & snapshot', 'Kalibrasi 4 titik…': '4-point calibration…',
  'Hapus kalibrasi': 'Clear calibration', 'Gambar hasil warp seluruh bed sebagai objek gambar (bisa di-trace)': 'Warped image of the whole bed as an image object (can be traced)',
  'Snapshot bed → kanvas': 'Snapshot bed → canvas', 'Frame mentah sebagai objek gambar': 'Raw frame as an image object', 'Snapshot mentah': 'Raw snapshot',
  'Pasang kamera tetap di atas bed. Kalibrasi: seret 4 penanda ke titik bed yang diketahui (mis. sudut bed atau persegi cetakan), lalu simpan. Overlay lalu tampil sejajar kanvas.': 'Mount the camera fixed above the bed. Calibration: drag the 4 markers to known bed points (e.g. bed corners or a printed square), then save. The overlay is then aligned with the canvas.',
  'Kalibrasi Kamera (4 titik)': 'Camera Calibration (4 points)',
  'Seret penanda 1–4 di gambar ke posisi titik bed yang koordinatnya diisi di kanan (mm dari origin mesin, sama seperti penggaris).': 'Drag markers 1–4 on the image to the bed points whose coordinates are entered on the right (mm from machine origin, like the rulers).',
  'Isi: 4 sudut bed': 'Fill: 4 bed corners', 'Persegi kalibrasi X': 'Calibration square X', 'Lebar': 'Width', 'Tinggi': 'Height', 'Isi: sudut persegi': 'Fill: square corners',
  'Buat persegi tersebut di kanvas untuk dibakar sebagai penanda': 'Create that square on the canvas to burn as a marker', 'Buat persegi di kanvas': 'Create square on canvas', 'Simpan kalibrasi': 'Save calibration',
  'Kamera belum aktif. Klik "Mulai kamera" di tab Kamera.': 'Camera is not running. Click "Start camera" in the Camera tab.', 'Browser/WebView ini tidak mendukung akses kamera.': 'This browser/WebView does not support camera access.',
  'Gagal membuka kamera: ': 'Could not open camera: ', 'Kamera belum siap': 'Camera not ready', ' atau belum dikalibrasi.': ' or not calibrated.', 'Mulai kamera dulu.': 'Start the camera first.',
  'Kalibrasi gagal: titik-titik tidak boleh segaris / berimpit.': 'Calibration failed: points must not be collinear / coincident.',
  // ---- console
  'Status & baris job': 'Status & job lines', 'Salin isi log ke clipboard': 'Copy log to clipboard', 'Salin': 'Copy', 'Tersalin': 'Copied', 'Bersihkan': 'Clear',
  'Semua pengaturan GRBL': 'All GRBL settings', 'Offset koordinat (G54, G92, ...)': 'Coordinate offsets (G54, G92, ...)', 'Versi firmware': 'Firmware version', 'Status parser (modal aktif)': 'Parser state (active modes)',
  'Buka kunci alarm': 'Unlock alarm', 'Ketik G-code atau perintah $ lalu Enter': 'Type G-code or a $ command, then Enter', 'Kirim': 'Send',
  '↑ / ↓ untuk riwayat perintah. Baris biru = dikirim, hijau = balasan, merah = error/alarm.': '↑ / ↓ for command history. Blue = sent, green = reply, red = error/alarm.',
  'Gagal menyalin ke clipboard.': 'Could not copy to clipboard.',
  // ---- machine dialog
  'Nama': 'Name', 'Origin mesin': 'Machine origin', 'Kiri bawah': 'Bottom left', 'Kiri atas': 'Top left', 'Kanan bawah': 'Bottom right', 'Kanan atas': 'Top right',
  'Lebar area (mm)': 'Work area width (mm)', 'Tinggi area (mm)': 'Work area height (mm)', 'Mode laser': 'Laser mode', 'M4 (dinamis, disarankan)': 'M4 (dynamic, recommended)', 'M3 (konstan)': 'M3 (constant)',
  'Kecepatan G0 (mm/min)': 'G0 speed (mm/min)', 'Akselerasi (mm/s²)': 'Acceleration (mm/s²)', 'Kembali ke origin di akhir': 'Return to origin at end',
  'Rotary aktif (sumbu Y = putaran benda)': 'Rotary enabled (Y axis = object rotation)', 'Jenis': 'Type', 'Chuck (jepit)': 'Chuck', 'Roller (rol)': 'Roller',
  'mm per putaran (Y untuk 1 putaran)': 'mm per rotation (Y for 1 turn)', 'Diameter benda (mm)': 'Object diameter (mm)', 'Diameter roller (mm)': 'Roller diameter (mm)',
  'Offset koordinat kerja': 'Work coordinate offset',
  'Untuk mesin yang setelah Home memakai koordinat mesin negatif (MPos −lebar..0). Saat terhubung dikirim': 'For machines whose machine coordinates are negative after homing (MPos −width..0). On connect this sends',
  'lalu': 'then', ', sehingga koordinat kerja 0..lebar memetakan ke area mesin. Nilai umum: −lebar, −tinggi.': ', so work coordinates 0..width map onto the machine area. Typical values: −width, −height.',
  'Kirim offset saat terhubung': 'Send offset on connect', 'G-code awal': 'Start G-code', 'G-code akhir': 'End G-code', 'Batal': 'Cancel',
  'Keliling benda': 'Object circumference', 'tinggi desain maksimal 1 putaran. Faktor Y =': 'max design height is 1 turn. Y factor =', '(Y mesin = Y desain × faktor).': '(machine Y = design Y × factor).',
  'Chuck: isi mm per putaran sesuai $101 (mis. 360 bila 1 mm = 1°).': 'Chuck: enter mm per rotation as per $101 (e.g. 360 if 1 mm = 1°).',
  'Roller: bila $101 dikalibrasi ke permukaan roller, mm per putaran = π × diameter roller (faktor 1).': 'Roller: if $101 is calibrated to the roller surface, mm per rotation = π × roller diameter (factor 1).',
  'keliling': 'circumference', 'faktor Y': 'Y factor',
  // ---- preview
  'Perkiraan waktu': 'Estimated time', 'Panjang potong': 'Cut length', 'Panjang G0': 'Rapid length', 'Baris G-code': 'G-code lines', 'Tampilkan gerak G0': 'Show rapid moves',
  '▶ Putar': '▶ Play', '⏹ Berhenti': '⏹ Stop', 'Tutup': 'Close', 'Kirim ke mesin': 'Send to machine', 'Gagal membuat G-code: ': 'Could not generate G-code: ',
  // ---- materials
  'Pustaka Material': 'Material Library', 'Tebal': 'Thickness', 'Aksi': 'Action', 'Catatan': 'Notes', 'Tambah / perbarui dari layer aktif': 'Add / update from active layer',
  'mis. Kayu lapis': 'e.g. Plywood', 'Tebal (mm)': 'Thickness (mm)', 'Potong / Gores / Isi': 'Cut / Score / Fill', 'Tambah dari layer': 'Add from layer', 'Perbarui terpilih': 'Update selected',
  'Impor JSON': 'Import JSON', 'Ekspor JSON': 'Export JSON', 'Kembalikan contoh bawaan (menghapus preset Anda)': 'Restore built-in examples (removes your presets)', 'Terapkan ke layer': 'Apply to layer',
  'Isi nama material.': 'Enter a material name.', 'Pilih baris dulu.': 'Select a row first.', 'Gagal impor: ': 'Import failed: ', 'preset diimpor.': 'presets imported.',
  'Ganti seluruh pustaka dengan contoh bawaan?': 'Replace the whole library with the built-in examples?',
  'Kayu lapis': 'Plywood', 'Gores garis': 'Score line', 'Gores isi': 'Score fill', 'Kardus': 'Cardboard', 'Kulit': 'Leather', 'Akrilik gelap': 'Dark acrylic', 'Akrilik': 'Acrylic',
  'Stainless (spray)': 'Stainless (spray)', 'Tanda': 'Mark', 'Kertas': 'Paper', 'Foto (kayu)': 'Photo (wood)', 'contoh dioda 10 W': '10 W diode example',
  // ---- test grid
  'Test Grid Material': 'Material Test Grid',
  'Kotak per kombinasi kecepatan (baris) × daya (kolom). Tiap kotak memakai override sendiri; mode, interval, dan pass mengikuti layer yang dipilih. Label memakai pengaturan layer tanpa override.': 'One square per speed (rows) × power (columns) combination. Each square has its own override; mode, interval and passes follow the chosen layer. Labels use the layer settings without override.',
  'Ukuran kotak (mm)': 'Square size (mm)', 'Kecepatan min (mm/s)': 'Min speed (mm/s)', 'Kecepatan maks (mm/s)': 'Max speed (mm/s)', 'Jumlah baris (kecepatan)': 'Rows (speed)',
  'Jarak antar kotak (mm)': 'Gap between squares (mm)', 'Jumlah kolom (daya)': 'Columns (power)', 'Ukuran label (mm)': 'Label size (mm)', 'Tulis label nilai': 'Write value labels', 'Buat': 'Create',
  'kotak, area sekitar': 'squares, area about', '(tanpa label). Layer': '(without labels). Layer', 'Daya %': 'Power %',
  // ---- trace
  'Trace Gambar ke Vektor': 'Trace Image to Vectors', 'Ambang hitam-putih': 'Black/white threshold', 'Resolusi (mm/px)': 'Resolution (mm/px)', 'Penghalusan (0–3)': 'Smoothing (0–3)',
  'Penyederhanaan (mm)': 'Simplification (mm)', 'Abaikan bintik < (mm²)': 'Ignore specks < (mm²)', 'Layer hasil': 'Result layer', 'Balik (trace area putih)': 'Invert (trace white areas)',
  'Hapus gambar asli': 'Delete original image', 'Buat vektor': 'Create vectors', 'kontur': 'contours', 'titik': 'nodes',
  'Pilih satu gambar dulu.': 'Select one image first.', 'Tidak ada kontur. Ubah ambang atau balik warna.': 'No contours. Change the threshold or invert.',
  // ---- offset / boolean / array
  'Offset Kontur': 'Contour Offset', 'Membuat garis paralel sejarak tertentu dari bentuk terpilih. Positif = keluar, negatif = ke dalam. Bentuk dengan lubang (huruf) ditangani otomatis.': 'Creates a parallel line at a given distance from the selected shapes. Positive = outward, negative = inward. Shapes with holes (letters) are handled automatically.',
  'Arah': 'Direction', 'Keluar': 'Outward', 'Ke dalam': 'Inward', 'Keduanya': 'Both', 'Sudut': 'Corners', 'Bulat': 'Round', 'Lancip': 'Miter',
  'Pertahankan bentuk asli': 'Keep original shapes', 'Garis terbuka jadi pita': 'Open lines become bands', 'Gabungkan semua terpilih': 'Merge all selected',
  'Tidak ada bentuk vektor terpilih.': 'No vector shapes selected.', 'objek terpilih.': 'objects selected.', 'Pilih bentuk vektor dulu.': 'Select vector shapes first.',
  'Pilih minimal dua bentuk vektor (bukan gambar).': 'Select at least two vector shapes (not images).', 'Ada objek yang tidak bisa dijadikan poligon (teks tanpa font?).': 'Some objects cannot be converted to polygons (text without a font?).',
  'Operasi gagal: ': 'Operation failed: ', 'Offset gagal: ': 'Offset failed: ', 'Hasil kosong (tidak ada area yang tersisa).': 'Empty result (no area left).', 'Hasil kosong (jarak ke dalam terlalu besar?).': 'Empty result (inward distance too large?).',
  'Grid Array': 'Grid Array', 'Kolom': 'Columns', 'Baris': 'Rows', 'Jarak X (mm)': 'X gap (mm)', 'Jarak Y (mm)': 'Y gap (mm)',
  // ---- nodes / text / misc alerts
  'Pilih satu bentuk vektor dulu.': 'Select one vector shape first.', 'Pilih satu objek saja.': 'Select a single object.', 'Lepas grup dulu (Ctrl+U).': 'Ungroup first (Ctrl+U).',
  'Gambar tidak bisa diedit titiknya; gunakan Trace dulu.': 'Images have no nodes; use Trace first.', 'Objek ini tidak bisa diedit titiknya (teks tanpa font?).': 'This object cannot be node-edited (text without a font?).',
  'Pilih titik dulu (klik kotak jangkar).': 'Select a node first (click an anchor square).', 'Pilih titik dulu.': 'Select a node first.', 'Pilih titik (bukan titik awal) dulu.': 'Select a node (not the start node) first.',
  'terpilih': 'selected', 'awal': 'start', 'kurva': 'curve', 'garis': 'line',
  'Pilih objek teks dulu.': 'Select a text object first.', 'Font teks ini belum punya outline. Pilih font dari daftar atau muat file TTF.': 'This text font has no outline. Choose a font from the list or load a TTF file.',
  'Browser ini tidak mendukung Local Font Access (pakai Chrome/Edge 103+).': 'This browser does not support Local Font Access (use Chrome/Edge 103+).', 'Gagal membaca font sistem: ': 'Could not read system fonts: ',
  'font sistem ditambahkan ke daftar.': 'system fonts added to the list.', 'Gagal memuat font: ': 'Could not load font: ', 'tidak tersedia: teks akan dibakar sebagai raster.': 'unavailable: text will be burned as raster.', 'Outline': 'Outline',
  'Buat proyek baru? Desain saat ini akan dihapus.': 'Create a new project? The current design will be cleared.', 'Gagal membuka proyek: ': 'Could not open project: ',
  'SVG kosong atau tidak dikenali.': 'SVG is empty or not recognised.', 'DXF kosong atau entitasnya tidak didukung (didukung: LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE, ELLIPSE, SPLINE, INSERT).': 'DXF is empty or its entities are unsupported (supported: LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE, ELLIPSE, SPLINE, INSERT).',
  // ---- help
  'OpenBurn — Bantuan': 'OpenBurn — Help', 'Alat pilih': 'Select tool', 'Geser tampilan (atau tahan': 'Pan view (or hold', 'Spasi': 'Space', '/ tombol tengah mouse)': '/ middle mouse button)',
  'Saat menggambar: kunci rasio 1:1.': 'While drawing: lock 1:1 ratio.', ': snap 1 mm': ': snap to 1 mm', 'Salin / Tempel / Duplikat': 'Copy / Paste / Duplicate', 'Pilih semua': 'Select all',
  'Grup / lepas grup': 'Group / ungroup', 'Panah': 'Arrows', 'Geser 1 mm (': 'Nudge 1 mm (', 'Roda mouse': 'Mouse wheel',
  'Format proyek: .obp (JSON). G-code keluaran: GRBL 1.1 (G0/G1, M3/M4, S, M8/M9). Teks memerlukan font TTF/OTF untuk menjadi garis vektor; tanpa font, teks dibakar sebagai raster.': 'Project format: .obp (JSON). G-code output: GRBL 1.1 (G0/G1, M3/M4, S, M8/M9). Text needs a TTF/OTF font to become vector lines; without a font, text is burned as raster.',
  // ---- gcode warnings & GRBL codes
  'Ada objek di luar area kerja mesin.': 'Some objects are outside the machine work area.', 'Tidak ada objek yang dikeluarkan (periksa layer Output).': 'No objects are output (check layer Output).',
  'Gambar terlalu besar untuk diraster pada interval ini.': 'Image is too large to raster at this interval.',
  'Rotary aktif: disarankan "Mulai dari posisi saat ini" agar Y relatif ke posisi benda.': 'Rotary enabled: "Start from current position" is recommended so Y is relative to the object.',
  'Teks dengan font tanpa outline diproses sebagai raster (fill). Pilih font dari daftar atau muat TTF.': 'Text whose font has no outline is processed as raster (fill). Choose a font from the list or load a TTF.',
  'Hard limit tersentuh. Posisi mungkin hilang; lakukan Home.': 'Hard limit triggered. Position may be lost; home the machine.',
  'Target gerak melewati batas travel mesin (soft limit). Cek offset koordinat kerja / origin / ukuran area.': 'Motion target exceeds machine travel (soft limit). Check work offset / origin / work area size.',
  'Reset saat mesin bergerak. Posisi mungkin hilang; lakukan Home.': 'Reset while moving. Position may be lost; home the machine.',
  'Homing gagal: siklus dibatalkan (reset).': 'Homing failed: cycle aborted (reset).', 'Homing gagal: pintu terbuka.': 'Homing failed: door open.',
  'Homing gagal: tidak bisa lepas dari limit switch (cek $27 pull-off).': 'Homing failed: could not clear the limit switch (check $27 pull-off).', 'Homing gagal: limit switch tidak ditemukan dalam jarak travel.': 'Homing failed: limit switch not found within travel.',
  'G-code dikunci karena alarm / jog aktif. Reset alarm atau $X.': 'G-code locked due to alarm / active jog. Reset alarm or $X.', 'Feed rate (F) belum ditentukan atau nol.': 'Feed rate (F) undefined or zero.',
  'Perintah $ hanya boleh saat Idle.': '$ commands only allowed when Idle.',
  // ---- lisensi
  'Lisensi': 'Licence', 'Lisensi OpenBurn Pro': 'OpenBurn Pro licence', 'OpenBurn Pro — Lisensi': 'OpenBurn Pro — Licence', 'Pemilik': 'Owner', 'Update sampai': 'Updates until',
  'Versi aplikasi': 'App version', 'Kunci lisensi': 'Licence key', 'Beli lisensi': 'Buy licence', 'Hapus lisensi': 'Remove licence', 'Aktifkan': 'Activate',
  'Fitur Pro: pustaka material, test grid, DXF, boolean, offset, edit titik, trace, kamera, rotary, kerf, tab, ramp, override. Kunci diverifikasi offline; tidak perlu internet atau akun.': 'Pro features: material library, test grid, DXF, boolean, offset, node editing, trace, camera, rotary, kerf, tabs, ramp, override. Keys are verified offline; no internet or account needed.',
  'Trial': 'Trial', 'hari': 'days', 'Trial Pro': 'Pro trial', 'Free': 'Free', 'Pro aktif': 'Pro active', 'hari tersisa': 'days left', 'Free (fitur Pro terkunci)': 'Free (Pro features locked)', 'komputer': 'computers',
  'tersedia di OpenBurn Pro. Masukkan kunci lisensi untuk mengaktifkannya.': 'is available in OpenBurn Pro. Enter a licence key to unlock it.', 'Tempel kunci lisensi dulu.': 'Paste a licence key first.',
  'Kunci tidak valid.': 'Invalid key.', 'Lisensi aktif atas nama': 'Licence activated for', 'Terima kasih!': 'Thank you!', 'Hapus kunci lisensi dari komputer ini?': 'Remove the licence key from this computer?',
  'Format kunci tidak dikenali.': 'Key format not recognised.', 'Kunci rusak.': 'Corrupted key.', 'Tanda tangan kunci tidak valid.': 'Key signature is invalid.', 'Versi kunci tidak didukung.': 'Unsupported key version.',
  'Pustaka material': 'Material library', 'Test grid': 'Test grid', 'Boolean bentuk': 'Shape boolean', 'Offset kontur': 'Contour offset', 'Trace gambar': 'Image trace', 'Tab manual': 'Manual tabs', 'Kerf offset': 'Kerf offset', 'Tab / jembatan': 'Tabs / bridges', 'Impor DXF': 'DXF import', 'Target jog melewati batas travel.': 'Jog target exceeds travel limits.', 'Perintah G-code tidak didukung.': 'Unsupported G-code command.',
};

export function t(s: string): string {
  if (currentLang() !== 'en') return s;
  return EN[s] ?? s;
}

/** Terjemahkan teks, title, dan placeholder di seluruh subtree (dipanggil sekali setelah template dipasang). */
export function translateDom(root: ParentNode) {
  if (currentLang() !== 'en') return;
  const walk = (n: Node) => {
    for (const c of Array.from(n.childNodes)) {
      if (c.nodeType === Node.TEXT_NODE) {
        const raw = c.textContent ?? '';
        const trimmed = raw.replace(/\s+/g, ' ').trim();
        if (trimmed && EN[trimmed]) c.textContent = raw.replace(trimmed, EN[trimmed]).replace(raw.trim(), EN[trimmed]);
      } else if (c.nodeType === Node.ELEMENT_NODE) {
        const el = c as HTMLElement;
        for (const a of ['title', 'placeholder']) {
          const v = el.getAttribute(a);
          if (v && EN[v]) el.setAttribute(a, EN[v]);
        }
        if (el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') walk(el);
      }
    }
  };
  walk(root);
  if (root instanceof Document || (root as any).ownerDocument) document.documentElement.lang = 'en';
}
