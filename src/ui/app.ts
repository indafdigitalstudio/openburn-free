import { FabricObject, Path, Textbox, cache } from 'fabric';
import opentype, { type Font } from 'opentype.js';
import { Workspace, type AlignHow } from '../editor/canvas';
import { ToolManager, type ToolName } from '../editor/tools';
import { LayerStore, getLayer } from '../editor/layers';
import { importImage, importSVG, readAsArrayBuffer, readAsDataURL, readAsText, downloadText, pickFile } from '../editor/import';
import { isTextType, textToAbsolutePathData, geomRect } from '../editor/geometry';
import { generateJob, canvasToMachine, formatDuration } from '../laser/gcode';
import { PreviewView } from '../laser/preview';
import { GrblDevice } from '../device/grbl';
import { describeGrblLine } from '../device/grblcodes';
import { t, translateDom, currentLang, setLang } from '../i18n';
import {
  defaultMachine, LAYER_COLORS, MODE_LABEL, DITHER_LABEL,
  type JobResult, type LayerMode, type DitherMode, type MachineSettings, type LayerSettings,
} from '../types';

const LS_MACHINE = 'openburn.machine';
const LS_LAYERS = 'openburn.layers';

const TEMPLATE = `
<div class="menubar">
  <div class="brand"><span class="dot"></span>OpenBurn</div>
  <button id="btnNew" title="Proyek baru">Baru</button>
  <button id="btnOpen" title="Buka proyek (.obp)">Buka</button>
  <button id="btnSave" title="Simpan proyek (.obp)">Simpan</button>
  <span class="sep"></span>
  <button id="btnImport" title="Impor SVG / PNG / JPG / BMP">Impor</button>
  <button id="btnSaveSvg" title="Ekspor desain sebagai SVG">Ekspor SVG</button>
  <button id="btnExportGcode" title="Simpan G-code (.gc)">Simpan G-code</button>
  <span class="sep"></span>
  <button id="btnFont" title="Muat file font TTF/OTF tambahan">Muat font TTF</button>
  <button id="btnMachine">Pengaturan Mesin</button>
  <span class="sep"></span>
  <button id="btnPreview" class="primary">Pratinjau</button>
  <span style="flex:1"></span>
  <select id="langSel" title="Bahasa / Language"><option value="id">ID</option><option value="en">EN</option></select>
  <button id="btnHelp">Bantuan</button>
</div>
<div class="toolbar">
  <button id="btnUndo" title="Undo (Ctrl+Z)">↶</button>
  <button id="btnRedo" title="Redo (Ctrl+Y)">↷</button>
  <span class="sep"></span>
  <button id="btnZoomIn" title="Perbesar">+</button>
  <button id="btnZoomOut" title="Perkecil">−</button>
  <button id="btnZoomFit" title="Muat seluruh area kerja">⛶</button>
  <button id="btnZoomSel" title="Zoom ke seleksi">⌖</button>
  <span class="sep"></span>
  <button data-align="left" title="Rata kiri">⇤</button>
  <button data-align="hcenter" title="Tengah horizontal">↔</button>
  <button data-align="right" title="Rata kanan">⇥</button>
  <button data-align="top" title="Rata atas">⤒</button>
  <button data-align="vcenter" title="Tengah vertikal">↕</button>
  <button data-align="bottom" title="Rata bawah">⤓</button>
  <button data-align="bedcenter" title="Tengah area kerja">⊕</button>
  <span class="sep"></span>
  <button id="btnMirrorH" title="Cermin horizontal">⇋</button>
  <button id="btnMirrorV" title="Cermin vertikal">⇅</button>
  <button id="btnRot90" title="Putar 90°">⟳</button>
  <span class="sep"></span>
  <button id="btnGroup" title="Grup (Ctrl+G)">Grup</button>
  <button id="btnUngroup" title="Lepas grup (Ctrl+U)">Lepas</button>
  <button id="btnDup" title="Duplikat (Ctrl+D)">Duplikat</button>
  <button id="btnArray" title="Susun grid array">Array</button>
  <button id="btnTextPath" title="Ubah teks ke path (perlu font TTF)">Teks→Path</button>
  <button id="btnDelete" title="Hapus (Del)">Hapus</button>
</div>
<div class="main">
  <div class="tools">
    <button data-tool="select" title="Pilih (V)">⬚</button>
    <button data-tool="pan" title="Geser tampilan (H / Spasi)">✋</button>
    <button data-tool="rect" title="Persegi (R)">▭</button>
    <button data-tool="ellipse" title="Elips (E)">◯</button>
    <button data-tool="line" title="Garis (L)">╱</button>
    <button data-tool="polygon" title="Poligon (P) — klik titik, Enter/dobel-klik selesai">⬠</button>
    <button data-tool="text" title="Teks (T)">T</button>
  </div>
  <div class="canvas-wrap" id="canvasWrap"><canvas id="c"></canvas>
  </div>
  <div class="right">
    <div class="tabs">
      <button data-tab="layers" class="active">Cuts / Layers</button>
      <button data-tab="laser">Laser</button>
      <button data-tab="shape">Bentuk</button>
      <button data-tab="console">Konsol</button>
    </div>
    <div class="panel active" id="panelLayers">
      <h4>Palet layer <span class="hint" style="text-transform:none;letter-spacing:0">— klik untuk memberi layer ke objek terpilih</span></h4>
      <div class="palette" id="palette"></div>
      <table class="layers">
        <thead><tr><th style="width:22px"></th><th>Layer</th><th>Mode</th><th style="width:60px">mm/s</th><th style="width:52px">%</th><th style="width:34px">Out</th><th style="width:34px">Air</th></tr></thead>
        <tbody id="layerRows"></tbody>
      </table>

      <div class="ls-head">
        <span class="sw" id="lsSwatch"></span>
        <b id="lsTitle">C00</b>
        <input id="lsName" type="text" placeholder="Nama layer (opsional)">
      </div>

      <h4>Umum</h4>
      <div class="grid2">
        <div class="field"><label>Mode</label><select id="lsMode"></select></div>
        <div class="field"><label>Prioritas (kecil = dulu)</label><input id="lsPriority" type="number" step="1"></div>
      </div>
      <div class="chips">
        <label class="chip"><input id="lsOutput" type="checkbox"> Output</label>
        <label class="chip"><input id="lsAir" type="checkbox"> Air assist</label>
      </div>

      <h4>Potong</h4>
      <div class="grid2">
        <div class="field"><label>Kecepatan (mm/s)</label><input id="lsSpeed" type="number" min="0.1" step="1"></div>
        <div class="field"><label>Daya maks (%)</label><input id="lsPower" type="number" min="0" max="100" step="1"></div>
        <div class="field"><label>Daya min (%)</label><input id="lsMinPower" type="number" min="0" max="100" step="1"></div>
        <div class="field"><label>Jumlah pass</label><input id="lsPasses" type="number" min="1" step="1"></div>
        <div class="field"><label>Z offset (mm)</label><input id="lsZ" type="number" step="0.1"></div>
      </div>

      <div data-ls-section="scan">
        <h4 id="lsScanTitle">Fill</h4>
        <div class="grid2">
          <div class="field"><label>Interval garis (mm)</label><input id="lsInterval" type="number" min="0.01" step="0.01"></div>
          <div class="field"><label>Overscan (mm)</label><input id="lsOverscan" type="number" min="0" step="0.5"></div>
          <div class="field" data-ls-only="fill"><label>Sudut scan (°)</label><input id="lsAngle" type="number" step="1"></div>
          <div class="field" data-ls-only="image"><label>Dither</label><select id="lsDither"></select></div>
        </div>
        <div class="chips">
          <label class="chip"><input id="lsBidir" type="checkbox"> Bolak-balik</label>
          <label class="chip" data-ls-only="fill" title="Bentuk di dalam bentuk lain menjadi lubang (even-odd)"><input id="lsFillAll" type="checkbox"> Isi sekaligus</label>
          <label class="chip" data-ls-only="image"><input id="lsNegative" type="checkbox"> Negatif</label>
        </div>
      </div>
      <p class="hint" id="lsHint"></p>
    </div>
    <div class="panel" id="panelLaser">
      <div class="status-box">
        <span>Status</span><span><span id="devState" class="badge">Terputus</span></span>
        <span>Job</span><span id="devJob">-</span>
        <span>MPos</span><span>X <b id="posX">0.000</b> Y <b id="posY">0.000</b></span>
        <span>WPos</span><span>X <b id="wposX">0.000</b> Y <b id="wposY">0.000</b> <span id="wcoHint" class="hint"></span></span>
      </div>
      <div class="conn-row">
        <select id="baud"><option>115200</option><option>250000</option><option>57600</option><option>9600</option></select>
        <button id="btnConnect">Hubungkan</button>
      </div>
      <span class="hint" id="serialHint"></span>

      <h4>Job</h4>
      <div class="btn-grid cols4">
        <button id="btnStart" class="primary">▶ Mulai</button>
        <button id="btnPause">⏸ Jeda</button>
        <button id="btnResume">⏵ Lanjut</button>
        <button id="btnStop" class="danger">■ Stop</button>
      </div>
      <progress id="jobProgress" value="0" max="100"></progress>
      <div class="kv"><label>Mulai dari</label>
        <select id="startFrom"><option value="absolute">Koordinat absolut</option><option value="current">Posisi saat ini</option></select>
      </div>

      <h4>Kontrol mesin</h4>
      <div class="btn-grid cols3">
        <button id="btnFrame" title="Kepala laser mengelilingi batas desain tanpa menyala">Bingkai</button>
        <button id="btnHome" title="$H">Home</button>
        <button id="btnLaserOff" title="M5">Laser off</button>
        <button id="btnUnlock" title="$X">Buka kunci</button>
        <button id="btnResetAlarm" title="Reset lunak (Ctrl-X) lalu $X">Reset alarm</button>
        <button id="btnHome0" title="G53 G0 X0 Y0">Ke 0 mesin</button>
        <button id="btnSetOrigin" title="G92 X0 Y0: posisi sekarang jadi 0,0 kerja">Set origin</button>
        <button id="btnClearG92" title="G92.1: hapus offset Set origin">Hapus G92</button>
        <button id="btnGoOrigin" title="G0 X0 Y0 (koordinat kerja)">Ke origin</button>
      </div>
      <div class="btn-grid cols1" style="margin-top:4px">
        <button id="btnWorkOffset" title="Kirim G10 L2 P1 sesuai Pengaturan Mesin">Kirim offset kerja (G10 L2 P1)</button>
      </div>

      <h4>Jog</h4>
      <div class="jog-wrap">
        <div class="jog">
          <button data-jog="-1,1">↖</button><button data-jog="0,1">↑</button><button data-jog="1,1">↗</button>
          <button data-jog="-1,0">←</button><button id="btnJogHome" title="Ke origin kerja">⌂</button><button data-jog="1,0">→</button>
          <button data-jog="-1,-1">↙</button><button data-jog="0,-1">↓</button><button data-jog="1,-1">↘</button>
        </div>
        <div class="jog-side">
          <div class="field"><label>Jarak (mm)</label>
            <select id="jogDist"><option>0.1</option><option>1</option><option selected>10</option><option>50</option><option>100</option></select>
          </div>
          <div class="field"><label>Kecepatan (mm/min)</label><input id="jogSpeed" type="number" value="3000" step="100"></div>
        </div>
      </div>

      <h4>Tes laser</h4>
      <div class="fire-row">
        <div class="field"><label>Daya (%)</label><input id="firePower" type="number" value="2" min="0" max="100"></div>
        <button id="btnFire" title="M3 S…">Nyalakan</button>
        <button id="btnFireOff" title="M5">Matikan</button>
      </div>
      <p class="hint">Browser: Chrome/Edge (Web Serial). Desktop: serial native. GRBL 1.1, laser mode $32=1.</p>
    </div>
    <div class="panel" id="panelShape">
      <div id="shapeNone" class="empty">Pilih objek di kanvas untuk melihat dan mengubah propertinya.</div>
      <div id="shapeBox" hidden>
        <div class="sh-head">
          <span class="sh-type" id="shType">Objek</span>
          <span class="sw" id="shSwatch"></span>
          <select id="shLayer" title="Layer objek"></select>
        </div>

        <h4>Posisi &amp; ukuran</h4>
        <div class="grid2">
          <div class="field"><label>X (mm)</label><input id="shX" type="number" step="0.1"></div>
          <div class="field"><label>Y (mm)</label><input id="shY" type="number" step="0.1"></div>
          <div class="field"><label>Lebar (mm)</label><input id="shW" type="number" step="0.1" min="0.01"></div>
          <div class="field"><label>Tinggi (mm)</label><input id="shH" type="number" step="0.1" min="0.01"></div>
          <div class="field"><label>Rotasi (°)</label><input id="shRot" type="number" step="1"></div>
          <div class="field"><label>&nbsp;</label><label class="chip" style="justify-content:center"><input id="shLock" type="checkbox" checked> Kunci rasio</label></div>
        </div>

        <div id="textBox" hidden>
          <h4>Teks</h4>
          <div class="field"><label>Isi</label><textarea id="shText" rows="2"></textarea></div>
          <div class="field" style="margin-top:8px"><label>Font</label><select id="shFontFamily"></select></div>
          <div class="grid2" style="margin-top:8px">
            <div class="field"><label>Gaya</label><select id="shFontStyle"></select></div>
            <div class="field"><label>Ukuran (mm)</label><input id="shFontSize" type="number" step="1" min="1"></div>
          </div>
          <div class="field" style="margin-top:8px"><label>Rata</label>
            <div class="seg">
              <button data-talign="left" title="Rata kiri">Kiri</button>
              <button data-talign="center" title="Rata tengah">Tengah</button>
              <button data-talign="right" title="Rata kanan">Kanan</button>
            </div>
          </div>
          <div class="btn-grid cols2" style="margin-top:10px">
            <button id="btnSysFonts" title="Tampilkan font yang terpasang di komputer (Chrome/Edge)">Font sistem…</button>
            <button id="btnFontHere" title="Muat file font TTF/OTF">Muat TTF/OTF…</button>
          </div>
          <span class="hint" id="fontHint"></span>
        </div>
      </div>
    </div>
    <div class="panel console" id="panelConsole">
      <div class="con-tools">
        <label class="chip"><input id="verbose" type="checkbox"> Status &amp; baris job</label>
        <span style="flex:1"></span>
        <button id="btnCopyLog" title="Salin isi log ke clipboard">Salin</button>
        <button id="btnClearLog">Bersihkan</button>
      </div>
      <div class="quick">
        <button data-cmd="?" title="Status">?</button>
        <button data-cmd="$$" title="Semua pengaturan GRBL">$$</button>
        <button data-cmd="$#" title="Offset koordinat (G54, G92, ...)">$#</button>
        <button data-cmd="$I" title="Versi firmware">$I</button>
        <button data-cmd="$G" title="Status parser (modal aktif)">$G</button>
        <button data-cmd="$X" title="Buka kunci alarm">$X</button>
        <button data-cmd="$H" title="Homing">$H</button>
        <button data-cmd="M5" title="Laser off">M5</button>
      </div>
      <div class="log" id="log"></div>
      <div class="in">
        <span class="prompt">&gt;</span>
        <input id="cmd" placeholder="Ketik G-code atau perintah $ lalu Enter" autocomplete="off" spellcheck="false">
        <button id="btnSend" class="primary">Kirim</button>
      </div>
      <span class="hint">↑ / ↓ untuk riwayat perintah. Baris biru = dikirim, hijau = balasan, merah = error/alarm.</span>
    </div>
  </div>
</div>
<div class="statusbar">
  <span id="stCursor">X: 0.00  Y: 0.00</span>
  <span id="stZoom">Zoom 100%</span>
  <span id="stCount">0 objek</span>
  <span id="stTime"></span>
  <span class="grow"></span>
  <span id="stDev">Mesin: terputus</span>
</div>

<dialog id="dlgMachine">
  <h3>Pengaturan Mesin</h3>
  <div class="grid2">
    <div class="field"><label>Nama</label><input id="mName" type="text"></div>
    <div class="field"><label>Origin mesin</label><select id="mOrigin"><option value="bl">Kiri bawah</option><option value="tl">Kiri atas</option><option value="br">Kanan bawah</option><option value="tr">Kanan atas</option></select></div>
    <div class="field"><label>Lebar area (mm)</label><input id="mWidth" type="number" min="10"></div>
    <div class="field"><label>Tinggi area (mm)</label><input id="mHeight" type="number" min="10"></div>
    <div class="field"><label>S max ($30)</label><input id="mSMax" type="number" min="1"></div>
    <div class="field"><label>Mode laser</label><select id="mLaserMode"><option value="M4">M4 (dinamis, disarankan)</option><option value="M3">M3 (konstan)</option></select></div>
    <div class="field"><label>Kecepatan G0 (mm/min)</label><input id="mRapid" type="number" min="100"></div>
    <div class="field"><label>Akselerasi (mm/s²)</label><input id="mAccel" type="number" min="10"></div>
    <div class="field"><label>Baud rate</label><input id="mBaud" type="number"></div>
    <div class="field"><label style="margin-top:14px"><input id="mReturnHome" type="checkbox"> Kembali ke origin di akhir</label></div>
  </div>
  <h4>Offset koordinat kerja</h4>
  <p class="hint">Untuk mesin yang setelah Home memakai koordinat mesin negatif (MPos −lebar..0). Saat terhubung dikirim
  <code>G10 L2 P1 X.. Y..</code> lalu <code>G54</code>, sehingga koordinat kerja 0..lebar memetakan ke area mesin. Nilai umum: −lebar, −tinggi.</p>
  <div class="grid2">
    <div class="field"><label><input id="mWorkOffset" type="checkbox"> Kirim offset saat terhubung</label></div>
    <div></div>
    <div class="field"><label>Offset X (mm)</label><input id="mWorkOffsetX" type="number" step="1"></div>
    <div class="field"><label>Offset Y (mm)</label><input id="mWorkOffsetY" type="number" step="1"></div>
  </div>
  <div class="field" style="margin-top:8px"><label>G-code awal</label><textarea id="mStart"></textarea></div>
  <div class="field" style="margin-top:8px"><label>G-code akhir</label><textarea id="mEnd"></textarea></div>
  <div class="actions"><button id="mCancel">Batal</button><button id="mSave" class="primary">Simpan</button></div>
</dialog>

<dialog id="dlgPreview">
  <h3>Pratinjau</h3>
  <div class="preview-wrap">
    <canvas id="pvCanvas" width="760" height="520"></canvas>
    <input id="pvSlider" type="range" min="0" max="1000" value="1000">
    <div class="preview-stats">
      <div>Perkiraan waktu<b id="pvTime">-</b></div>
      <div>Panjang potong<b id="pvCut">-</b></div>
      <div>Panjang G0<b id="pvRapid">-</b></div>
      <div>Baris G-code<b id="pvLines">-</b></div>
    </div>
    <div id="pvWarn" class="warn" hidden></div>
    <div class="row"><label style="min-width:auto"><input id="pvRapidChk" type="checkbox" checked> Tampilkan gerak G0</label><button id="pvPlay">▶ Putar</button></div>
  </div>
  <div class="actions"><button id="pvClose">Tutup</button><button id="pvExport">Simpan G-code</button><button id="pvStart" class="primary">Kirim ke mesin</button></div>
</dialog>

<dialog id="dlgPort">
  <h3>Pilih Port Serial</h3>
  <div class="row"><label>Port</label><select id="portSel" style="min-width:200px"></select><button id="portRefresh" title="Segarkan daftar">⟳</button></div>
  <p class="hint" id="portHint">Colokkan mesin lalu klik segarkan jika port belum muncul.</p>
  <div class="actions"><button id="portCancel">Batal</button><button id="portOk" class="primary">Hubungkan</button></div>
</dialog>

<dialog id="dlgArray">
  <h3>Grid Array</h3>
  <div class="grid2">
    <div class="field"><label>Kolom</label><input id="arCols" type="number" value="3" min="1"></div>
    <div class="field"><label>Baris</label><input id="arRows" type="number" value="3" min="1"></div>
    <div class="field"><label>Jarak X (mm)</label><input id="arDx" type="number" value="5" step="0.5"></div>
    <div class="field"><label>Jarak Y (mm)</label><input id="arDy" type="number" value="5" step="0.5"></div>
  </div>
  <div class="actions"><button id="arCancel">Batal</button><button id="arOk" class="primary">Buat</button></div>
</dialog>

<dialog id="dlgHelp">
  <h3>OpenBurn — Bantuan</h3>
  <div class="help-grid">
    <kbd>V</kbd><span>Alat pilih</span>
    <kbd>H</kbd><span>Geser tampilan (atau tahan <kbd>Spasi</kbd> / tombol tengah mouse)</span>
    <kbd>R</kbd> <span>Persegi</span> <kbd>E</kbd> <span>Elips</span> <kbd>L</kbd> <span>Garis</span> <kbd>P</kbd> <span>Poligon</span> <kbd>T</kbd> <span>Teks</span>
    <kbd>Shift</kbd><span>Saat menggambar: kunci rasio 1:1. <kbd>Ctrl</kbd>: snap 1 mm</span>
    <kbd>Ctrl+Z / Y</kbd><span>Undo / Redo</span>
    <kbd>Ctrl+C / V / D</kbd><span>Salin / Tempel / Duplikat</span>
    <kbd>Ctrl+A</kbd><span>Pilih semua</span>
    <kbd>Ctrl+G / U</kbd><span>Grup / lepas grup</span>
    <kbd>Panah</kbd><span>Geser 1 mm (<kbd>Shift</kbd> 10 mm)</span>
    <kbd>Del</kbd><span>Hapus</span>
    <kbd>Roda mouse</kbd><span>Zoom</span>
  </div>
  <p class="hint">Format proyek: .obp (JSON). G-code keluaran: GRBL 1.1 (G0/G1, M3/M4, S, M8/M9). Teks memerlukan font TTF/OTF untuk menjadi garis vektor; tanpa font, teks dibakar sebagai raster.</p>
  <div class="actions"><button id="helpClose">Tutup</button></div>
</dialog>
`;

export function createApp(root: HTMLElement) {
  root.innerHTML = TEMPLATE;
  translateDom(root);
  (root.querySelector('#langSel') as HTMLSelectElement).value = currentLang();
  root.querySelector('#langSel')!.addEventListener('change', (e) => { setLang((e.target as HTMLSelectElement).value as any); location.reload(); });
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const $$ = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));

  /* ---------- State ---------- */
  const machine: MachineSettings = { ...defaultMachine(), ...safeJSON(localStorage.getItem(LS_MACHINE)) };
  const layers = new LayerStore();
  const savedLayers = safeJSON(localStorage.getItem(LS_LAYERS));
  if (Array.isArray(savedLayers)) layers.replaceAll(savedLayers);
  const ws = new Workspace($<HTMLCanvasElement>('#c'), $('#canvasWrap'), layers, machine);
  const tools = new ToolManager(ws);
  const device = new GrblDevice();
  const preview = new PreviewView($<HTMLCanvasElement>('#pvCanvas'));
  type StyleKey = 'regular' | 'bold' | 'italic' | 'bolditalic';
  const STYLE_LABEL: Record<StyleKey, string> = { regular: 'Regular', bold: 'Bold', italic: 'Italic', bolditalic: 'Bold Italic' };
  const STYLE_ORDER: StyleKey[] = ['regular', 'bold', 'italic', 'bolditalic'];
  const fontRegistry = new Map<string, Font>();                       // "family::style" -> outline opentype
  let bundledFonts: Array<{ family: string; styles: Partial<Record<StyleKey, string>> }> = [];
  const systemFonts = new Map<string, Map<StyleKey, any>>();          // family -> style -> FontData
  const customFonts = new Map<string, Map<StyleKey, ArrayBuffer>>();  // family -> style -> data TTF
  const styleKey = (bold: boolean, italic: boolean): StyleKey => (bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'regular');
  const classifyStyle = (name: string): StyleKey => styleKey(/bold|heavy|black/i.test(name), /italic|oblique/i.test(name));
  const styleOf = (o: any): StyleKey => styleKey(String(o.fontWeight) === 'bold' || Number(o.fontWeight) >= 600, o.fontStyle === 'italic');
  const fontFor = (o: FabricObject): Font | null => fontRegistry.get(`${(o as any).fontFamily ?? ''}::${styleOf(o)}`) ?? null;
  let activeLayer = 0;
  let lastJob: JobResult | null = null;
  let projectName = 'desain';

  const persist = () => {
    localStorage.setItem(LS_MACHINE, JSON.stringify(machine));
    localStorage.setItem(LS_LAYERS, JSON.stringify(layers.layers));
  };
  layers.onChange(() => { persist(); ws.restyleAll(); renderLayerTable(); fillLayerEditor(); });

  /* ---------- Tabs ---------- */
  $$('.tabs button').forEach(b => b.addEventListener('click', () => {
    $$('.tabs button').forEach(x => x.classList.toggle('active', x === b));
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel' + cap(b.dataset.tab!)));
  }));
  const showTab = (t: string) => $<HTMLElement>(`.tabs button[data-tab="${t}"]`).click();

  /* ---------- Tools ---------- */
  $$('.tools button').forEach(b => b.addEventListener('click', () => tools.setTool(b.dataset.tool as ToolName)));
  tools.onChange = (t) => $$('.tools button').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
  tools.onChange('select');

  /* ---------- Toolbar ---------- */
  $('#btnUndo').onclick = () => ws.undo();
  $('#btnRedo').onclick = () => ws.redo();
  $('#btnZoomIn').onclick = () => ws.zoomBy(1.25);
  $('#btnZoomOut').onclick = () => ws.zoomBy(0.8);
  $('#btnZoomFit').onclick = () => ws.zoomToFit();
  $('#btnZoomSel').onclick = () => ws.zoomToSelection();
  $$('[data-align]').forEach(b => b.addEventListener('click', () => ws.align(b.dataset.align as AlignHow)));
  $('#btnMirrorH').onclick = () => ws.mirror('x');
  $('#btnMirrorV').onclick = () => ws.mirror('y');
  $('#btnRot90').onclick = () => ws.rotateBy(90);
  $('#btnGroup').onclick = () => ws.group();
  $('#btnUngroup').onclick = () => ws.ungroup();
  $('#btnDup').onclick = () => ws.duplicate();
  $('#btnDelete').onclick = () => ws.deleteSelected();
  $('#btnArray').onclick = () => { if (ws.getSelected().length) $<HTMLDialogElement>('#dlgArray').showModal(); };
  $('#arCancel').onclick = () => $<HTMLDialogElement>('#dlgArray').close();
  $('#arOk').onclick = async () => {
    $<HTMLDialogElement>('#dlgArray').close();
    await ws.arrayGrid(num('#arCols', 1), num('#arRows', 1), num('#arDx', 0), num('#arDy', 0));
  };
  $('#btnTextPath').onclick = () => textToPath();
  ws.onHistory = () => {
    ($('#btnUndo') as HTMLButtonElement).disabled = !ws.canUndo;
    ($('#btnRedo') as HTMLButtonElement).disabled = !ws.canRedo;
    $('#stCount').textContent = `${ws.canvas.getObjects().length} ${t('objek')}`;
    renderLayerTable();
  };
  ws.onZoom = (z) => { $('#stZoom').textContent = `Zoom ${Math.round(z * 100)}%`; };
  ws.onCursor = (p) => {
    const my = machine.origin === 'bl' || machine.origin === 'br' ? machine.height - p.y : p.y;
    $('#stCursor').textContent = `X: ${p.x.toFixed(2)}  Y: ${my.toFixed(2)}`;
  };

  /* ---------- Menu: proyek ---------- */
  $('#btnNew').onclick = async () => {
    if (ws.canvas.getObjects().length && !confirm(t('Buat proyek baru? Desain saat ini akan dihapus.'))) return;
    await ws.clear();
    projectName = 'desain';
  };
  $('#btnSave').onclick = () => {
    const data = { app: 'OpenBurn', version: 1, machine, layers: layers.layers, canvas: ws.serializeObjects() };
    downloadText(`${projectName}.obp`, JSON.stringify(data), 'application/json');
  };
  $('#btnOpen').onclick = async () => {
    const f = await pickFile('.obp,.json');
    if (!f) return;
    await openProject(f);
  };
  async function openProject(f: File) {
    try {
      const data = JSON.parse(await readAsText(f));
      if (data.machine) { Object.assign(machine, data.machine); ws.zoomToFit(); }
      if (Array.isArray(data.layers)) layers.replaceAll(data.layers);
      await ws.loadObjects(data.canvas ?? { objects: [] });
      for (const o of ws.canvas.getObjects()) if (isTextType(o.type)) await ensureFont(String((o as any).fontFamily), styleOf(o));
      ws.canvas.requestRenderAll();
      ws.snapshot(true);
      projectName = f.name.replace(/\.(obp|json)$/i, '');
      persist();
      fillMachineDialog();
    } catch (e) {
      alert(t('Gagal membuka proyek: ') + e);
    }
  }
  $('#btnImport').onclick = async () => {
    const f = await pickFile('.svg,.png,.jpg,.jpeg,.bmp,.gif,.webp,.obp');
    if (f) await importFile(f);
  };
  async function importFile(f: File) {
    const name = f.name.toLowerCase();
    try {
      if (name.endsWith('.obp')) return openProject(f);
      if (name.endsWith('.svg')) {
        const objs = await importSVG(await readAsText(f), activeLayer);
        if (!objs.length) return alert(t('SVG kosong atau tidak dikenali.'));
        ws.canvas.discardActiveObject();
        for (const o of objs) ws.addObject(o, getLayer(o), false);
        ws.selectObjects(objs);
        ws.snapshot();
      } else {
        const img = await importImage(await readAsDataURL(f), Math.min(100, machine.width * 0.5));
        ws.addObject(img, 15);
        ws.snapshot();
      }
    } catch (e) {
      alert(t('Gagal impor: ') + e);
    }
  }
  const wrap = $('#canvasWrap');
  wrap.addEventListener('dragover', e => { e.preventDefault(); });
  wrap.addEventListener('drop', async e => {
    e.preventDefault();
    for (const f of Array.from(e.dataTransfer?.files ?? [])) await importFile(f);
  });
  $('#btnSaveSvg').onclick = () => {
    const svg = ws.canvas.toSVG({ width: `${machine.width}mm`, height: `${machine.height}mm`, viewBox: { x: 0, y: 0, width: machine.width, height: machine.height } } as any, (s: string) => s);
    downloadText(`${projectName}.svg`, svg, 'image/svg+xml');
  };
  $('#btnExportGcode').onclick = () => {
    const job = buildJob();
    if (!job) return;
    downloadText(`${projectName}.gc`, job.gcode);
  };
  $('#btnHelp').onclick = () => $<HTMLDialogElement>('#dlgHelp').showModal();
  $('#helpClose').onclick = () => $<HTMLDialogElement>('#dlgHelp').close();

  /* ---------- Font ---------- */
  /** Daftarkan font: outline untuk G-code + FontFace (dengan weight/style) agar kanvas merender font yang sama. */
  async function registerFont(buf: ArrayBuffer, family: string, style: StyleKey) {
    const parsed = opentype.parse(buf);
    try {
      const face = new FontFace(family, buf, {
        weight: style === 'bold' || style === 'bolditalic' ? '700' : '400',
        style: style === 'italic' || style === 'bolditalic' ? 'italic' : 'normal',
      });
      await face.load();
      document.fonts.add(face);
    } catch { /* abaikan: font sistem sudah terpasang */ }
    cache.clearFontCache();
    fontRegistry.set(`${family}::${style}`, parsed);
    return parsed;
  }
  /** Gaya yang tersedia untuk sebuah keluarga font. */
  function availableStyles(family: string): StyleKey[] {
    const b = bundledFonts.find(f => f.family === family);
    if (b) return STYLE_ORDER.filter(k => b.styles[k]);
    const sy = systemFonts.get(family);
    if (sy) return STYLE_ORDER.filter(k => sy.has(k));
    const cu = customFonts.get(family);
    if (cu) return STYLE_ORDER.filter(k => cu.has(k));
    return [];
  }
  /** Pastikan outline font+gaya tersedia (bawaan / sistem / dimuat). */
  async function ensureFont(family: string, style: StyleKey = 'regular'): Promise<Font | null> {
    const key = `${family}::${style}`;
    if (fontRegistry.has(key)) return fontRegistry.get(key)!;
    const b = bundledFonts.find(f => f.family === family);
    if (b?.styles[style]) {
      const r = await fetch(`./fonts/${b.styles[style]}`);
      if (!r.ok) return null;
      return registerFont(await r.arrayBuffer(), family, style);
    }
    const sysf = systemFonts.get(family)?.get(style);
    if (sysf) {
      const blob: Blob = await sysf.blob();
      return registerFont(await blob.arrayBuffer(), family, style);
    }
    const cu = customFonts.get(family)?.get(style);
    if (cu) return registerFont(cu, family, style);
    return null;
  }
  function refreshFontSelect(selected?: string) {
    const sel = $<HTMLSelectElement>('#shFontFamily');
    const cur = selected ?? sel.value;
    sel.innerHTML = '';
    const addGroup = (label: string, names: string[]) => {
      if (!names.length) return;
      const g = document.createElement('optgroup');
      g.label = label;
      for (const n of names) g.appendChild(new Option(n, n));
      sel.appendChild(g);
    };
    addGroup(t('Bawaan'), bundledFonts.map(f => f.family));
    addGroup(t('Dimuat'), [...customFonts.keys()]);
    addGroup(t('Sistem'), [...systemFonts.keys()].sort());
    if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
    refreshStyleSelect(sel.value);
  }
  function refreshStyleSelect(family: string, current?: StyleKey) {
    const sel = $<HTMLSelectElement>('#shFontStyle');
    const cur = current ?? (sel.value as StyleKey);
    sel.innerHTML = '';
    const styles = availableStyles(family);
    for (const k of (styles.length ? styles : ['regular'] as StyleKey[])) sel.add(new Option(STYLE_LABEL[k], k));
    sel.value = styles.includes(cur) ? cur : 'regular';
    sel.disabled = styles.length <= 1;
  }
  async function applyFont(family: string, style: StyleKey) {
    const styles = availableStyles(family);
    if (styles.length && !styles.includes(style)) style = 'regular';
    const f = await ensureFont(family, style);
    $('#fontHint').textContent = f ? '' : `${t('Outline')} "${family} ${STYLE_LABEL[style]}" ${t('tidak tersedia: teks akan dibakar sebagai raster.')}`;
    tools.fontFamily = family;
    const objs = ws.getSelected().filter(o => isTextType(o.type));
    for (const o of objs) {
      o.set({
        fontFamily: family,
        fontWeight: style === 'bold' || style === 'bolditalic' ? 'bold' : 'normal',
        fontStyle: style === 'italic' || style === 'bolditalic' ? 'italic' : 'normal',
      });
      fitTextbox(o as Textbox);
    }
    refreshStyleSelect(family, style);
    if (objs.length) { ws.canvas.requestRenderAll(); ws.snapshot(); fillShape(); }
  }
  $('#shFontFamily').addEventListener('change', () => applyFont($<HTMLSelectElement>('#shFontFamily').value, $<HTMLSelectElement>('#shFontStyle').value as StyleKey));
  $('#shFontStyle').addEventListener('change', () => applyFont($<HTMLSelectElement>('#shFontFamily').value, $<HTMLSelectElement>('#shFontStyle').value as StyleKey));
  $('#btnSysFonts').onclick = async () => {
    const q = (window as any).queryLocalFonts;
    if (typeof q !== 'function') return alert(t('Browser ini tidak mendukung Local Font Access (pakai Chrome/Edge 103+).'));
    try {
      const list: any[] = await q.call(window);
      for (const fd of list) {
        const st = String(fd.style ?? 'Regular');
        const key = classifyStyle(st);
        // hanya gaya dasar; abaikan Light/Medium/Condensed dsb. kecuali belum ada wakil untuk kunci itu
        const isPlain = /^(regular|normal|book|bold|italic|oblique|bold italic|bold oblique)$/i.test(st);
        let m = systemFonts.get(fd.family);
        if (!m) { m = new Map(); systemFonts.set(fd.family, m); }
        if (!m.has(key) || isPlain) m.set(key, fd);
      }
      refreshFontSelect();
      $('#fontHint').textContent = `${systemFonts.size} ${t('font sistem ditambahkan ke daftar.')}`;
    } catch (e) {
      alert(t('Gagal membaca font sistem: ') + e);
    }
  };
  $('#btnFontHere').onclick = () => $('#btnFont').click();
  $('#btnFont').onclick = async () => {
    const f = await pickFile('.ttf,.otf');
    if (!f) return;
    try {
      const buf = await readAsArrayBuffer(f);
      const parsed = opentype.parse(buf);
      const family = parsed.names.fontFamily?.en ?? f.name.replace(/\.\w+$/, '');
      const style = classifyStyle(parsed.names.fontSubfamily?.en ?? '');
      let m = customFonts.get(family);
      if (!m) { m = new Map(); customFonts.set(family, m); }
      m.set(style, buf);
      await registerFont(buf, family, style);
      refreshFontSelect(family);
      await applyFont(family, style);
    } catch (e) {
      alert(t('Gagal memuat font: ') + e);
    }
  };
  /** Lebar kotak teks mengikuti baris terpanjang (tanpa pembungkusan otomatis). */
  function fitTextbox(t: Textbox) {
    if (!isTextType(t.type)) return;
    t.set('width', 1e6);
    (t as any).initDimensions?.();
    const w = Math.max(1, (t as any).calcTextWidth() + 0.5);
    t.set('width', w);
    (t as any).initDimensions?.();
    t.setCoords();
  }
  ws.canvas.on('text:changed', (e: any) => { if (e.target) fitTextbox(e.target); });
  ws.canvas.on('text:editing:exited', (e: any) => { if (e.target) { fitTextbox(e.target); ws.canvas.requestRenderAll(); fillShape(); } });
  $$('[data-talign]').forEach(b => b.addEventListener('click', () => {
    const objs = ws.getSelected().filter(o => isTextType(o.type));
    if (!objs.length) return;
    for (const o of objs) o.set('textAlign', b.dataset.talign);
    ws.canvas.requestRenderAll();
    ws.snapshot();
    fillShape();
  }));
  // font bawaan (OFL) dari public/fonts/fonts.json; Open Sans dimuat langsung
  fetch('./fonts/fonts.json').then(r => (r.ok ? r.json() : []))
    .then(async (list) => {
      bundledFonts = list;
      refreshFontSelect('Open Sans');
      await ensureFont('Open Sans');
      tools.fontFamily = 'Open Sans';
      ws.canvas.requestRenderAll();
    })
    .catch(() => { /* tanpa font bawaan: teks dibakar sebagai raster */ });
  function textToPath() {
    const objs = ws.getSelected().filter(o => isTextType(o.type));
    if (!objs.length) return alert(t('Pilih objek teks dulu.'));
    if (objs.some(o => !fontFor(o))) return alert(t('Font teks ini belum punya outline. Pilih font dari daftar atau muat file TTF.'));
    ws.canvas.discardActiveObject();
    for (const o of objs) {
      const d = textToAbsolutePathData(o, fontFor(o)!);
      const layer = getLayer(o);
      ws.canvas.remove(o);
      if (!d.trim()) continue;
      const p = new Path(d, { objectCaching: false });
      ws.addObject(p, layer, true);
    }
    ws.snapshot();
  }

  /* ---------- Layers ---------- */
  const modeSel = $<HTMLSelectElement>('#lsMode');
  (Object.keys(MODE_LABEL) as LayerMode[]).forEach(m => modeSel.add(new Option(MODE_LABEL[m], m)));
  const ditherSel = $<HTMLSelectElement>('#lsDither');
  (Object.keys(DITHER_LABEL) as DitherMode[]).forEach(m => ditherSel.add(new Option(DITHER_LABEL[m], m)));
  const shLayer = $<HTMLSelectElement>('#shLayer');
  LAYER_COLORS.forEach((c, i) => { shLayer.add(new Option(`C${pad(i)}`, String(i))); void c; });

  const palette = $('#palette');
  LAYER_COLORS.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'swatch';
    d.style.background = c;
    d.title = `C${pad(i)}`;
    d.innerHTML = `<span>${pad(i)}</span>`;
    d.onclick = () => setActiveLayer(i, true);
    palette.appendChild(d);
  });

  function setActiveLayer(i: number, assign: boolean) {
    activeLayer = i;
    tools.activeLayer = i;
    if (assign && ws.getSelected().length) ws.assignLayerToSelected(i);
    $$('.swatch').forEach((s, k) => s.classList.toggle('active', k === i));
    fillLayerEditor();
    renderLayerTable();
  }

  function usedLayers(): Set<number> {
    const s = new Set<number>();
    for (const o of ws.canvas.getObjects()) s.add(getLayer(o));
    s.add(activeLayer);
    return s;
  }

  function renderLayerTable() {
    const tb = $('#layerRows');
    tb.innerHTML = '';
    for (const id of [...usedLayers()].sort((a, b) => a - b)) {
      const l = layers.get(id);
      const tr = document.createElement('tr');
      if (id === activeLayer) tr.classList.add('sel');
      tr.innerHTML = `<td><span class="sw" style="background:${l.color}"></span></td>
        <td>C${pad(id)}${l.name ? ' ' + l.name : ''}</td>
        <td>${MODE_LABEL[l.mode]}</td>
        <td><input type="number" value="${l.speed}" data-k="speed" step="1" min="0.1"></td>
        <td><input type="number" value="${l.power}" data-k="power" step="1" min="0" max="100"></td>
        <td><input type="checkbox" ${l.output ? 'checked' : ''} data-k="output"></td>
        <td><input type="checkbox" ${l.air ? 'checked' : ''} data-k="air"></td>`;
      tr.addEventListener('click', (e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') setActiveLayer(id, false); });
      tr.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
        const k = inp.dataset.k as keyof LayerSettings;
        const v = inp.type === 'checkbox' ? inp.checked : Number(inp.value);
        layers.update(id, { [k]: v } as any);
        if (id === activeLayer) fillLayerEditor();
      }));
      tb.appendChild(tr);
    }
  }

  const lsFields: Array<[string, keyof LayerSettings, 'num' | 'str' | 'bool']> = [
    ['#lsName', 'name', 'str'], ['#lsMode', 'mode', 'str'], ['#lsSpeed', 'speed', 'num'], ['#lsPower', 'power', 'num'],
    ['#lsMinPower', 'minPower', 'num'], ['#lsPasses', 'passes', 'num'], ['#lsInterval', 'interval', 'num'],
    ['#lsAngle', 'angle', 'num'], ['#lsOverscan', 'overscan', 'num'], ['#lsPriority', 'priority', 'num'],
    ['#lsZ', 'zOffset', 'num'], ['#lsDither', 'dither', 'str'], ['#lsBidir', 'bidir', 'bool'], ['#lsFillAll', 'fillAll', 'bool'],
    ['#lsNegative', 'negative', 'bool'], ['#lsAir', 'air', 'bool'], ['#lsOutput', 'output', 'bool'],
  ];
  let fillingEditor = false;
  function fillLayerEditor() {
    fillingEditor = true;
    const l = layers.get(activeLayer);
    $('#lsTitle').textContent = `C${pad(activeLayer)}`;
    $('#lsSwatch').style.background = l.color;
    for (const [sel, k, t] of lsFields) {
      const el = $<HTMLInputElement>(sel);
      if (t === 'bool') el.checked = !!l[k]; else el.value = String(l[k]);
    }
    updateEditorSections(l.mode);
    fillingEditor = false;
  }
  /** Tampilkan bagian editor yang relevan dengan mode layer. */
  function updateEditorSections(mode: LayerMode) {
    const isFill = mode === 'fill' || mode === 'fillline';
    const isImage = mode === 'image';
    $('[data-ls-section="scan"]').hidden = !(isFill || isImage);
    $('#lsScanTitle').textContent = isImage ? t('Image (raster)') : t('Fill (scan)');
    $$('[data-ls-only="fill"]').forEach(el => { el.hidden = !isFill; });
    const isLine = mode === 'line' || mode === 'fillline';
    $$('[data-ls-only="line"]').forEach(el => { el.hidden = !isLine; });
    $$('[data-ls-only="image"]').forEach(el => { el.hidden = !isImage; });
    $('#lsHint').textContent = isImage
      ? t('Gambar di-raster baris demi baris sejarak interval; Grayscale memakai daya min–maks.')
      : isFill
        ? t('Fill mengisi area dengan garis sejarak interval; Fill+Line menambah garis tepi setelahnya.')
        : t('Line mengikuti garis tepi bentuk; kecepatan mm/s dikonversi ke F (mm/min).');
  }
  for (const [sel, k, t] of lsFields) {
    $<HTMLInputElement>(sel).addEventListener('change', (e) => {
      if (fillingEditor) return;
      const el = e.target as HTMLInputElement;
      const v = t === 'bool' ? el.checked : t === 'num' ? Number(el.value) : el.value;
      layers.update(activeLayer, { [k]: v } as any);
    });
  }
  setActiveLayer(0, false);

  /* ---------- Panel bentuk ---------- */
  let fillingShape = false;
  function fillShape() {
    const a = ws.canvas.getActiveObject();
    $('#shapeNone').hidden = !!a;
    $('#shapeBox').hidden = !a;
    if (!a) return;
    fillingShape = true;
    const r = geomRect(a);
    const d = toDisplayXY(r);
    $<HTMLInputElement>('#shX').value = fmt2(d.x);
    $<HTMLInputElement>('#shY').value = fmt2(d.y);
    $<HTMLInputElement>('#shW').value = fmt2(r.scaledW);
    $<HTMLInputElement>('#shH').value = fmt2(r.scaledH);
    $<HTMLInputElement>('#shRot').value = (a.angle ?? 0).toFixed(1);
    const objs = ws.getSelected();
    const ls = new Set(objs.map(getLayer));
    shLayer.value = ls.size === 1 ? String([...ls][0]) : '';
    $('#shSwatch').style.background = ls.size === 1 ? layers.get([...ls][0]).color : 'linear-gradient(135deg,#888 50%,#444 50%)';
    $('#shType').textContent = objs.length > 1 ? `${objs.length} ${t('objek')}` : t(typeName(a.type));
    const isText = objs.length === 1 && isTextType(a.type);
    $('#textBox').hidden = !isText;
    if (isText) {
      const t = a as Textbox;
      $<HTMLTextAreaElement>('#shText').value = t.text ?? '';
      $<HTMLInputElement>('#shFontSize').value = String(t.fontSize);
      const fam = String(t.fontFamily);
      const sel = $<HTMLSelectElement>('#shFontFamily');
      if (![...sel.options].some(o => o.value === fam)) sel.appendChild(new Option(fam, fam));
      sel.value = fam;
      refreshStyleSelect(fam, styleOf(t));
      $$('[data-talign]').forEach(b => b.classList.toggle('active', b.dataset.talign === (t.textAlign ?? 'left')));
    }
    fillingShape = false;
  }
  ws.onSelection = () => { fillShape(); renderLayerTable(); };
  const applyShape = () => {
    if (fillingShape) return;
    const a = ws.canvas.getActiveObject();
    if (!a) return;
    const r = geomRect(a);
    const d0 = toDisplayXY(r);
    const dx = num('#shX', d0.x), dy = num('#shY', d0.y);
    let w = num('#shW', r.scaledW), h = num('#shH', r.scaledH);
    const lock = $<HTMLInputElement>('#shLock').checked;
    const cw = r.scaledW, ch = r.scaledH;
    if (lock && Math.abs(w - cw) > 1e-6 && Math.abs(h - ch) < 1e-6) h = ch * (w / cw);
    else if (lock && Math.abs(h - ch) > 1e-6) w = cw * (h / ch);
    if ((a.width ?? 0) > 0) a.set('scaleX', w / a.width);
    if ((a.height ?? 0) > 0) a.set('scaleY', h / a.height);
    a.rotate(num('#shRot', a.angle ?? 0));
    a.setCoords();
    const r2 = geomRect(a);
    const { x, y } = fromDisplayXY(dx, dy, r2);
    a.set({ left: (a.left ?? 0) + (x - r2.left), top: (a.top ?? 0) + (y - r2.top) });
    a.setCoords();
    ws.canvas.requestRenderAll();
    ws.snapshot();
    fillShape();
  };
  /** X/Y tampilan = jarak sudut objek terdekat-origin ke origin mesin (mengikuti penggaris). */
  function toDisplayXY(r: { left: number; top: number; width: number; height: number }) {
    const o = machine.origin;
    const x = o === 'br' || o === 'tr' ? machine.width - (r.left + r.width) : r.left;
    const y = o === 'bl' || o === 'br' ? machine.height - (r.top + r.height) : r.top;
    return { x, y };
  }
  function fromDisplayXY(x: number, y: number, r: { width: number; height: number }) {
    const o = machine.origin;
    return {
      x: o === 'br' || o === 'tr' ? machine.width - x - r.width : x,
      y: o === 'bl' || o === 'br' ? machine.height - y - r.height : y,
    };
  }
  ['#shX', '#shY', '#shW', '#shH', '#shRot'].forEach(s => $(s).addEventListener('change', applyShape));
  /* ---------- Pengaturan mesin ---------- */
  function fillMachineDialog() {
    $<HTMLInputElement>('#mName').value = machine.name;
    $<HTMLSelectElement>('#mOrigin').value = machine.origin;
    $<HTMLInputElement>('#mWidth').value = String(machine.width);
    $<HTMLInputElement>('#mHeight').value = String(machine.height);
    $<HTMLInputElement>('#mSMax').value = String(machine.sMax);
    $<HTMLSelectElement>('#mLaserMode').value = machine.laserMode;
    $<HTMLInputElement>('#mRapid').value = String(machine.rapidSpeed);
    $<HTMLInputElement>('#mAccel').value = String(machine.accel);
    $<HTMLInputElement>('#mBaud').value = String(machine.baud);
    $<HTMLInputElement>('#mReturnHome').checked = machine.returnHome;
    $<HTMLInputElement>('#mWorkOffset').checked = !!machine.workOffset;
    $<HTMLInputElement>('#mWorkOffsetX').value = String(machine.workOffsetX ?? -machine.width);
    $<HTMLInputElement>('#mWorkOffsetY').value = String(machine.workOffsetY ?? -machine.height);
    $<HTMLTextAreaElement>('#mStart').value = machine.startGcode;
    $<HTMLTextAreaElement>('#mEnd').value = machine.endGcode;
    $<HTMLSelectElement>('#startFrom').value = machine.startFrom;
    $<HTMLSelectElement>('#baud').value = String(machine.baud);
  }
  fillMachineDialog();
  $('#btnMachine').onclick = () => { fillMachineDialog(); $<HTMLDialogElement>('#dlgMachine').showModal(); };
  $('#mCancel').onclick = () => $<HTMLDialogElement>('#dlgMachine').close();
  $('#mSave').onclick = () => {
    machine.name = $<HTMLInputElement>('#mName').value;
    machine.origin = $<HTMLSelectElement>('#mOrigin').value as any;
    machine.width = num('#mWidth', 400);
    machine.height = num('#mHeight', 400);
    machine.sMax = num('#mSMax', 1000);
    machine.laserMode = $<HTMLSelectElement>('#mLaserMode').value as any;
    machine.rapidSpeed = num('#mRapid', 6000);
    machine.accel = num('#mAccel', 1000);
    machine.baud = num('#mBaud', 115200);
    machine.returnHome = $<HTMLInputElement>('#mReturnHome').checked;
    machine.workOffset = $<HTMLInputElement>('#mWorkOffset').checked;
    machine.workOffsetX = num('#mWorkOffsetX', -machine.width);
    machine.workOffsetY = num('#mWorkOffsetY', -machine.height);
    machine.startGcode = $<HTMLTextAreaElement>('#mStart').value;
    machine.endGcode = $<HTMLTextAreaElement>('#mEnd').value;
    persist();
    fillMachineDialog();
    $<HTMLDialogElement>('#dlgMachine').close();
    ws.zoomToFit();
  };
  $('#startFrom').addEventListener('change', () => { machine.startFrom = $<HTMLSelectElement>('#startFrom').value as any; persist(); });

  /* ---------- Job / pratinjau ---------- */
  function buildJob(): JobResult | null {
    try {
      const job = generateJob({ objects: ws.canvas.getObjects(), layers, machine, fontFor });
      lastJob = job;
      $('#stTime').textContent = `${t('Perkiraan')}: ${formatDuration(job.seconds)}`;
      return job;
    } catch (e) {
      alert(t('Gagal membuat G-code: ') + e);
      return null;
    }
  }
  let playTimer: number | null = null;
  $('#btnPreview').onclick = () => {
    const job = buildJob();
    if (!job) return;
    preview.setJob(job, machine);
    $<HTMLInputElement>('#pvSlider').value = '1000';
    $('#pvTime').textContent = formatDuration(job.seconds);
    $('#pvCut').textContent = `${(job.cutLength / 1000).toFixed(2)} m`;
    $('#pvRapid').textContent = `${(job.rapidLength / 1000).toFixed(2)} m`;
    $('#pvLines').textContent = String(job.gcode.split('\n').length);
    const w = $('#pvWarn');
    w.hidden = !job.warnings.length;
    w.textContent = job.warnings.map(t).join(' ');
    $<HTMLDialogElement>('#dlgPreview').showModal();
  };
  $('#pvSlider').addEventListener('input', () => { preview.progress = num('#pvSlider', 1000) / 1000; preview.draw(); });
  $('#pvRapidChk').addEventListener('change', () => { preview.showRapid = $<HTMLInputElement>('#pvRapidChk').checked; preview.draw(); });
  $('#pvPlay').onclick = () => {
    if (playTimer) { clearInterval(playTimer); playTimer = null; $('#pvPlay').textContent = t('▶ Putar'); return; }
    let v = 0;
    $('#pvPlay').textContent = t('⏹ Berhenti');
    playTimer = window.setInterval(() => {
      v += 4;
      if (v > 1000) { v = 1000; clearInterval(playTimer!); playTimer = null; $('#pvPlay').textContent = t('▶ Putar'); }
      $<HTMLInputElement>('#pvSlider').value = String(v);
      preview.progress = v / 1000; preview.draw();
    }, 40);
  };
  const closePreview = () => { if (playTimer) { clearInterval(playTimer); playTimer = null; } $<HTMLDialogElement>('#dlgPreview').close(); };
  $('#pvClose').onclick = closePreview;
  $('#pvExport').onclick = () => { if (lastJob) downloadText(`${projectName}.gc`, lastJob.gcode); };
  $('#pvStart').onclick = () => { closePreview(); startJob(); };

  /* ---------- Perangkat ---------- */
  const log = $('#log');
  function addLog(cls: string, text: string) {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    log.appendChild(d);
    while (log.childElementCount > 500) log.removeChild(log.firstChild!);
    log.scrollTop = log.scrollHeight;
  }
  if (!GrblDevice.supported()) {
    $('#serialHint').textContent = t('Akses serial tidak tersedia: pakai Chrome/Edge atau versi desktop.');
    ($('#btnConnect') as HTMLButtonElement).disabled = true;
  }
  device.on((e) => {
    switch (e.type) {
      case 'connected':
        $('#btnConnect').textContent = t('Putuskan');
        $('#stDev').textContent = `${t('Mesin: terhubung')} @${machine.baud}`;
        addLog('rx', t('-- terhubung --'));
        if (machine.workOffset) {
          device.applyWorkOffset(machine.workOffsetX, machine.workOffsetY);
          addLog('rx', `-- offset kerja dikirim: G10 L2 P1 X${machine.workOffsetX} Y${machine.workOffsetY} --`);
        }
        break;
      case 'disconnected':
        $('#btnConnect').textContent = t('Hubungkan');
        $('#stDev').textContent = t('Mesin: terputus');
        $('#devState').textContent = t('Terputus');
        $('#devState').className = 'badge';
        addLog('err', t('-- terputus --'));
        break;
      case 'rx': {
        const bad = e.line.startsWith('error') || e.line.startsWith('ALARM');
        addLog(bad ? 'err' : 'rx', '< ' + e.line);
        const why = describeGrblLine(e.line);
        if (why) addLog('err', '   ↳ ' + t(why));
        if (e.line.startsWith('ALARM')) { $('#devJob').textContent = t('ALARM — klik Reset alarm'); showTab('laser'); }
        break;
      }
      case 'tx': addLog('tx', '> ' + e.line); break;
      case 'error': addLog('err', '!! ' + e.message); break;
      case 'status': {
        const s = e.status;
        const b = $('#devState');
        b.textContent = s.state; b.className = 'badge ' + s.state;
        $('#posX').textContent = s.mpos[0].toFixed(3); $('#posY').textContent = s.mpos[1].toFixed(3);
        $('#wposX').textContent = s.wpos[0].toFixed(3); $('#wposY').textContent = s.wpos[1].toFixed(3);
        const off = Math.abs(s.wco[0]) > 0.001 || Math.abs(s.wco[1]) > 0.001;
        $('#wcoHint').textContent = off ? `offset ${s.wco[0].toFixed(1)}, ${s.wco[1].toFixed(1)}` : '';
        break;
      }
      case 'progress': {
        const pct = e.total ? (e.acked / e.total) * 100 : 0;
        $<HTMLProgressElement>('#jobProgress').value = pct;
        $('#devJob').textContent = `${e.acked} / ${e.total} ${t('baris')} · ${pct.toFixed(1)}%`;
        break;
      }
      case 'jobdone':
        $('#devJob').textContent = t('selesai');
        addLog('rx', t('-- job selesai --'));
        break;
    }
  });
  async function refreshPorts() {
    const sel = $<HTMLSelectElement>('#portSel');
    const cur = sel.value;
    sel.innerHTML = '';
    const ports = (await device.listPorts()) ?? [];
    for (const p of ports) sel.add(new Option(p, p));
    if (ports.includes(cur)) sel.value = cur;
    $('#portHint').textContent = ports.length ? `${ports.length} port ditemukan.` : t('Tidak ada port serial. Colokkan mesin lalu klik segarkan.');
    ($('#portOk') as HTMLButtonElement).disabled = !ports.length;
  }
  async function doConnect(port: string | null) {
    machine.baud = Number($<HTMLSelectElement>('#baud').value);
    persist();
    try { await device.connect(machine.baud, port); } catch (err) { alert(t('Gagal terhubung: ') + err); }
  }
  $('#btnConnect').onclick = async () => {
    if (device.connected) return device.disconnect();
    let ports: string[] | null = null;
    try { ports = await device.listPorts(); } catch (err) { return alert(t('Gagal membaca daftar port: ') + err); }
    if (ports === null) return doConnect(null); // browser: dialog Web Serial
    await refreshPorts();
    $<HTMLDialogElement>('#dlgPort').showModal();
  };
  $('#portRefresh').onclick = () => refreshPorts();
  $('#portCancel').onclick = () => $<HTMLDialogElement>('#dlgPort').close();
  $('#portOk').onclick = async () => {
    const port = $<HTMLSelectElement>('#portSel').value;
    $<HTMLDialogElement>('#dlgPort').close();
    await doConnect(port);
  };
  const needDev = () => { if (!device.connected) { alert(t('Mesin belum terhubung. Buka tab Laser dan klik Hubungkan.')); showTab('laser'); return false; } return true; };
  function startJob() {
    if (!needDev()) return;
    const job = buildJob();
    if (!job) return;
    if (job.warnings.length && !confirm(job.warnings.map(t).join('\n') + '\n\n' + t('Lanjutkan?'))) return;
    device.startJob(job.gcode);
    showTab('laser');
  }
  $('#btnStart').onclick = () => startJob();
  $('#btnPause').onclick = () => device.pause();
  $('#btnResume').onclick = () => device.resume();
  $('#btnStop').onclick = () => device.stop();
  $('#btnHome').onclick = () => needDev() && device.home();
  $('#btnUnlock').onclick = () => needDev() && device.unlock();
  $('#btnResetAlarm').onclick = () => needDev() && device.resetAlarm();
  $('#btnWorkOffset').onclick = () => { if (needDev()) device.applyWorkOffset(machine.workOffsetX ?? -machine.width, machine.workOffsetY ?? -machine.height); };
  $('#btnHome0').onclick = () => needDev() && device.send('G53 G0 X0 Y0');
  $('#btnClearG92').onclick = () => needDev() && device.clearOrigin();
  $('#btnSetOrigin').onclick = () => needDev() && device.setOrigin();
  $('#btnGoOrigin').onclick = () => needDev() && device.goTo(0, 0);
  $('#btnJogHome').onclick = () => needDev() && device.goTo(0, 0);
  $('#btnLaserOff').onclick = () => needDev() && device.laserOff();
  $('#btnFrame').onclick = () => {
    if (!needDev()) return;
    const objs = ws.canvas.getObjects().filter(o => layers.get(getLayer(o)).output);
    if (!objs.length) return alert(t('Tidak ada objek untuk dibingkai.'));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const o of objs) {
      const r = geomRect(o);
      minX = Math.min(minX, r.left); minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.left + r.width); maxY = Math.max(maxY, r.top + r.height);
    }
    const tx = canvasToMachine(machine);
    let pts = [tx({ x: minX, y: minY }), tx({ x: maxX, y: minY }), tx({ x: maxX, y: maxY }), tx({ x: minX, y: maxY })];
    if (machine.startFrom === 'current') {
      const ox = Math.min(...pts.map(p => p.x)), oy = Math.min(...pts.map(p => p.y));
      pts = pts.map(p => ({ x: p.x - ox, y: p.y - oy }));
      device.send('G92 X0 Y0');
    }
    device.send('M5');
    device.send('G90 G21');
    for (const p of [...pts, pts[0]]) device.send(`G0 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}`);
    if (machine.startFrom === 'current') device.send('G92.1');
  };
  $$('[data-jog]').forEach(b => b.addEventListener('click', () => {
    if (!needDev()) return;
    const [dx, dy] = b.dataset.jog!.split(',').map(Number);
    const d = Number($<HTMLSelectElement>('#jogDist').value);
    device.jog(dx * d, dy * d, num('#jogSpeed', 3000));
  }));
  $('#btnFire').onclick = () => { if (needDev()) device.send(`M3 S${Math.round(machine.sMax * num('#firePower', 2) / 100)}`); };
  $('#btnFireOff').onclick = () => needDev() && device.laserOff();
  $('#btnSend').onclick = () => {
    const inp = $<HTMLInputElement>('#cmd');
    const v = inp.value.trim();
    if (!v || !needDev()) return;
    if (v === '?' || v === '!' || v === '~') device.realtime(v); else device.send(v);
    inp.value = '';
  };
  const cmdHistory: string[] = [];
  let histPos = -1;
  $('#cmd').addEventListener('keydown', (e) => {
    const inp = e.target as HTMLInputElement;
    if (e.key === 'Enter') {
      if (inp.value.trim()) { cmdHistory.unshift(inp.value.trim()); if (cmdHistory.length > 50) cmdHistory.pop(); }
      histPos = -1;
      $('#btnSend').click();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histPos < cmdHistory.length - 1) { histPos++; inp.value = cmdHistory[histPos]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histPos > 0) { histPos--; inp.value = cmdHistory[histPos]; } else { histPos = -1; inp.value = ''; }
    }
  });
  $$('[data-cmd]').forEach(b => b.addEventListener('click', () => {
    if (!needDev()) return;
    const v = b.dataset.cmd!;
    if (v === '?') device.realtime('?'); else device.send(v);
  }));
  $('#btnClearLog').onclick = () => { log.innerHTML = ''; };
  $('#btnCopyLog').onclick = async () => {
    try { await navigator.clipboard.writeText(log.innerText); $('#btnCopyLog').textContent = t('Tersalin'); setTimeout(() => { $('#btnCopyLog').textContent = t('Salin'); }, 1200); }
    catch { alert(t('Gagal menyalin ke clipboard.')); }
  };
  $('#verbose').addEventListener('change', () => { device.verbose = $<HTMLInputElement>('#verbose').checked; });

  /* ---------- Keyboard ---------- */
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const active = ws.canvas.getActiveObject() as any;
    if (active?.isEditing) return;
    if (root.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { ws.spaceDown = true; ws.canvas.setCursor('grab'); e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey) {
      switch (k) {
        case 'z': e.preventDefault(); e.shiftKey ? ws.redo() : ws.undo(); return;
        case 'y': e.preventDefault(); ws.redo(); return;
        case 'a': e.preventDefault(); ws.selectAll(); return;
        case 'c': e.preventDefault(); ws.copy(); return;
        case 'v': e.preventDefault(); ws.paste(); return;
        case 'd': e.preventDefault(); ws.duplicate(); return;
        case 'g': e.preventDefault(); ws.group(); return;
        case 'u': e.preventDefault(); ws.ungroup(); return;
        case 's': e.preventDefault(); $('#btnSave').click(); return;
        case 'o': e.preventDefault(); $('#btnOpen').click(); return;
        case 'i': e.preventDefault(); $('#btnImport').click(); return;
      }
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    switch (k) {
      case 'delete': case 'backspace': ws.deleteSelected(); break;
      case 'arrowleft': ws.nudge(-step, 0); e.preventDefault(); break;
      case 'arrowright': ws.nudge(step, 0); e.preventDefault(); break;
      case 'arrowup': ws.nudge(0, -step); e.preventDefault(); break;
      case 'arrowdown': ws.nudge(0, step); e.preventDefault(); break;
      case 'v': tools.setTool('select'); break;
      case 'h': tools.setTool('pan'); break;
      case 'r': tools.setTool('rect'); break;
      case 'e': tools.setTool('ellipse'); break;
      case 'l': tools.setTool('line'); break;
      case 'p': tools.setTool('polygon'); break;
      case 't': tools.setTool('text'); break;
      case 'f': ws.zoomToFit(); break;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { ws.spaceDown = false; ws.canvas.setCursor('default'); }
  });

  // isi awal
  ws.onHistory();
  ws.onZoom(ws.zoom);
  fillShape();

  // hook untuk skrip/debug: window.openburn
  (window as any).openburn = { ws, layers, machine, device, tools, buildJob, importFile, openProject, fontFor, ensureFont, fontRegistry, persist };

  function num(sel: string, def: number) {
    const v = Number($<HTMLInputElement>(sel).value);
    return Number.isFinite(v) ? v : def;
  }
}

function safeJSON(s: string | null) {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function esc(t: string) { return t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)); }
const TYPE_NAME: Record<string, string> = {
  rect: 'Persegi', ellipse: 'Elips', circle: 'Lingkaran', line: 'Garis', polygon: 'Poligon', polyline: 'Polyline',
  path: 'Path', textbox: 'Teks', text: 'Teks', 'i-text': 'Teks', image: 'Gambar', group: 'Grup', activeselection: 'Seleksi',
};
function typeName(t: string) { return TYPE_NAME[t] ?? t; }
/** 2 desimal, tanpa nol berlebih (80 tetap "80", 8.5 jadi "8.5"). */
function fmt2(v: number) { return String(Math.round(v * 100) / 100); }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
void FabricObject;
