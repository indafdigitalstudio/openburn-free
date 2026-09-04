import { Canvas, FabricObject, Point, ActiveSelection, Group, util } from 'fabric';
import type { MachineSettings, XY } from '../types';
import { LayerStore, getLayer, setLayer } from './layers';

FabricObject.customProperties = ['layer'];
Object.assign(FabricObject.ownDefaults, {
  transparentCorners: false,
  cornerColor: '#4da3ff',
  cornerStrokeColor: '#ffffff',
  borderColor: '#4da3ff',
  cornerSize: 8,
  cornerStyle: 'circle',
  borderScaleFactor: 1.5,
  padding: 2,
  strokeUniform: true,
  objectCaching: false,
});

export type AlignHow = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' | 'bedcenter';

export class Workspace {
  canvas: Canvas;
  private history: string[] = [];
  private histIndex = -1;
  private loading = false;
  private histTimer: number | null = null;
  onCursor: (p: XY) => void = () => {};
  onZoom: (z: number) => void = () => {};
  onSelection: () => void = () => {};
  onHistory: () => void = () => {};
  private panning = false;
  private lastPan: XY = { x: 0, y: 0 };
  spaceDown = false;
  panMode = false;

  constructor(
    public el: HTMLCanvasElement,
    public container: HTMLElement,
    public layers: LayerStore,
    public machine: MachineSettings,
  ) {
    this.canvas = new Canvas(el, {
      preserveObjectStacking: true,
      selectionColor: 'rgba(77,163,255,0.15)',
      selectionBorderColor: '#4da3ff',
      selectionLineWidth: 1,
      fireMiddleClick: true,
      stopContextMenu: true,
      uniformScaling: false,
    });
    this.canvas.on('before:render', ({ ctx }) => this.drawBackground(ctx as CanvasRenderingContext2D));
    this.canvas.on('mouse:wheel', (opt) => {
      const e = opt.e as WheelEvent;
      e.preventDefault(); e.stopPropagation();
      const delta = e.deltaY;
      let zoom = this.canvas.getZoom() * Math.pow(0.999, delta);
      zoom = Math.max(0.05, Math.min(200, zoom));
      this.canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), zoom);
      this.afterZoom();
    });
    this.canvas.on('mouse:down', (opt) => {
      const e = opt.e as MouseEvent;
      if (e.button === 1 || this.spaceDown || this.panMode) {
        this.panning = true;
        this.lastPan = { x: e.clientX, y: e.clientY };
        this.canvas.selection = false;
        this.canvas.setCursor('grabbing');
      }
    });
    this.canvas.on('mouse:move', (opt) => {
      const e = opt.e as MouseEvent;
      if (this.panning) {
        const dx = e.clientX - this.lastPan.x, dy = e.clientY - this.lastPan.y;
        this.lastPan = { x: e.clientX, y: e.clientY };
        this.canvas.relativePan(new Point(dx, dy));
      }
      const p = opt.scenePoint;
      this.onCursor({ x: p.x, y: p.y });
    });
    this.canvas.on('mouse:up', () => {
      if (this.panning) {
        this.panning = false;
        this.canvas.selection = true;
        this.canvas.setCursor('default');
      }
    });
    const sel = () => this.onSelection();
    this.canvas.on('selection:created', sel);
    this.canvas.on('selection:updated', sel);
    this.canvas.on('selection:cleared', sel);
    this.canvas.on('object:modified', () => { this.snapshot(); this.onSelection(); });
    this.canvas.on('object:added', () => this.snapshot());
    this.canvas.on('object:removed', () => this.snapshot());
    this.canvas.on('text:changed', () => this.snapshot());

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.zoomToFit();
    this.snapshot(true);
  }

  private fitted = false;
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (w > 0 && h > 0) {
      this.canvas.setDimensions({ width: w, height: h });
      if (!this.fitted) { this.fitted = true; this.zoomToFit(); }
    }
    this.canvas.requestRenderAll();
  }

  get zoom() { return this.canvas.getZoom(); }

  zoomToFit() {
    const w = this.canvas.getWidth(), h = this.canvas.getHeight();
    const z = Math.min(w / this.machine.width, h / this.machine.height) * 0.9;
    const ox = (w - this.machine.width * z) / 2, oy = (h - this.machine.height * z) / 2;
    this.canvas.setViewportTransform([z, 0, 0, z, ox, oy]);
    this.afterZoom();
  }

  zoomBy(f: number) {
    const z = Math.max(0.05, Math.min(200, this.zoom * f));
    this.canvas.zoomToPoint(new Point(this.canvas.getWidth() / 2, this.canvas.getHeight() / 2), z);
    this.afterZoom();
  }

  zoomToSelection() {
    const objs = this.getSelected();
    if (!objs.length) return this.zoomToFit();
    const a = this.canvas.getActiveObject();
    const r = a ? a.getBoundingRect() : objs[0].getBoundingRect();
    const w = this.canvas.getWidth(), h = this.canvas.getHeight();
    const z = Math.min(w / r.width, h / r.height) * 0.8;
    const ox = w / 2 - (r.left + r.width / 2) * z, oy = h / 2 - (r.top + r.height / 2) * z;
    this.canvas.setViewportTransform([z, 0, 0, z, ox, oy]);
    this.afterZoom();
  }

  private afterZoom() {
    const sw = 1.2 / this.zoom;
    for (const o of this.canvas.getObjects()) setStrokeWidth(o, sw);
    this.canvas.requestRenderAll();
    this.onZoom(this.zoom);
  }

  /* ---------- Latar: bed + grid ---------- */

  private drawBackground(ctx: CanvasRenderingContext2D) {
    const vt = this.canvas.viewportTransform;
    const W = this.canvas.getWidth(), H = this.canvas.getHeight();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(0, 0, W, H);
    ctx.transform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5]);
    const z = vt[0];
    const bw = this.machine.width, bh = this.machine.height;
    // area kerja
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, bw, bh);
    // grid
    const minor = z > 4 ? 1 : z > 1.2 ? 10 : 50;
    const major = minor * 5;
    ctx.lineWidth = 1 / z;
    for (let x = 0; x <= bw + 1e-6; x += minor) {
      const isMajor = Math.abs(x / major - Math.round(x / major)) < 1e-6;
      ctx.strokeStyle = isMajor ? '#c8c8c8' : '#e3e3e3';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, bh); ctx.stroke();
    }
    for (let y = 0; y <= bh + 1e-6; y += minor) {
      const isMajor = Math.abs(y / major - Math.round(y / major)) < 1e-6;
      ctx.strokeStyle = isMajor ? '#c8c8c8' : '#e3e3e3';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(bw, y); ctx.stroke();
    }
    // tepi bed
    ctx.strokeStyle = '#7a7a7a';
    ctx.lineWidth = 2 / z;
    ctx.strokeRect(0, 0, bw, bh);
    // penanda origin mesin
    const o = this.machine.origin;
    const ox = o === 'bl' || o === 'tl' ? 0 : bw;
    const oy = o === 'tl' || o === 'tr' ? 0 : bh;
    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.arc(ox, oy, 4 / z, 0, Math.PI * 2); ctx.fill();
    // label ukuran (dalam piksel, tanpa zoom)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '11px system-ui, sans-serif';
    for (let x = 0; x <= bw + 1e-6; x += major) {
      const sx = vt[4] + x * z;
      ctx.fillText(String(x), sx + 2, vt[5] - 3);
    }
    for (let y = 0; y <= bh + 1e-6; y += major) {
      const sy = vt[5] + y * z;
      const label = this.machine.origin === 'bl' || this.machine.origin === 'br' ? String(bh - y) : String(y);
      ctx.fillText(label, vt[4] - 28, sy + 4);
    }
    ctx.restore();
  }

  /* ---------- Objek ---------- */

  addObject(obj: FabricObject, layer?: number, select = true) {
    if (layer !== undefined) setLayer(obj, layer);
    else if (typeof (obj as any).layer !== 'number') setLayer(obj, 0);
    this.layers.styleObject(obj);
    setStrokeWidth(obj, 1.2 / this.zoom);
    this.canvas.add(obj);
    if (select) this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
  }

  getSelected(): FabricObject[] {
    return this.canvas.getActiveObjects();
  }

  restyleAll() {
    for (const o of this.canvas.getObjects()) {
      this.layers.styleObject(o);
      setStrokeWidth(o, 1.2 / this.zoom);
    }
    this.canvas.requestRenderAll();
  }

  assignLayerToSelected(id: number) {
    const objs = this.getSelected();
    for (const o of objs) { setLayer(o, id); this.layers.styleObject(o); }
    this.canvas.requestRenderAll();
    this.snapshot();
    this.onSelection();
  }

  deleteSelected() {
    const objs = this.getSelected();
    if (!objs.length) return;
    this.canvas.discardActiveObject();
    for (const o of objs) this.canvas.remove(o);
    this.canvas.requestRenderAll();
  }

  selectAll() {
    this.selectObjects(this.canvas.getObjects());
  }

  selectObjects(objs: FabricObject[]) {
    if (!objs.length) return;
    this.canvas.discardActiveObject();
    const sel = objs.length === 1 ? objs[0] : new ActiveSelection(objs, { canvas: this.canvas });
    this.canvas.setActiveObject(sel);
    this.canvas.requestRenderAll();
    this.onSelection();
  }

  group() {
    const objs = this.getSelected();
    if (objs.length < 2) return;
    this.canvas.discardActiveObject();
    for (const o of objs) this.canvas.remove(o);
    const g = new Group(objs);
    setLayer(g, getLayer(objs[0]));
    this.canvas.add(g);
    this.canvas.setActiveObject(g);
    this.canvas.requestRenderAll();
    this.snapshot();
  }

  ungroup() {
    const objs = this.getSelected();
    const groups = objs.filter(o => o.type === 'group') as Group[];
    if (!groups.length) return;
    this.canvas.discardActiveObject();
    const released: FabricObject[] = [];
    for (const g of groups) {
      const layer = getLayer(g);
      this.canvas.remove(g);
      const children = g.removeAll();
      for (const c of children) {
        setLayer(c, layer);
        this.layers.styleObject(c);
        this.canvas.add(c);
        released.push(c);
      }
    }
    if (released.length) this.canvas.setActiveObject(new ActiveSelection(released, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
    this.snapshot();
  }

  async duplicate(offset = 5) {
    const objs = this.getSelected();
    if (!objs.length) return;
    const clones: FabricObject[] = [];
    for (const o of objs) {
      const c = await o.clone(['layer']);
      c.set({ left: (c.left ?? 0) + offset, top: (c.top ?? 0) + offset });
      this.canvas.add(c);
      clones.push(c);
    }
    this.canvas.discardActiveObject();
    this.canvas.setActiveObject(clones.length === 1 ? clones[0] : new ActiveSelection(clones, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
  }

  private clipboard: any[] = [];
  async copy() {
    const objs = this.getSelected();
    this.clipboard = objs.map(o => o.toObject(['layer']));
  }
  async paste() {
    if (!this.clipboard.length) return;
    const objs = await util.enlivenObjects<FabricObject>(this.clipboard);
    this.canvas.discardActiveObject();
    for (const o of objs) {
      o.set({ left: (o.left ?? 0) + 5, top: (o.top ?? 0) + 5 });
      this.layers.styleObject(o);
      setStrokeWidth(o, 1.2 / this.zoom);
      this.canvas.add(o);
    }
    this.canvas.setActiveObject(objs.length === 1 ? objs[0] : new ActiveSelection(objs, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
  }

  nudge(dx: number, dy: number) {
    const a = this.canvas.getActiveObject();
    if (!a) return;
    a.set({ left: (a.left ?? 0) + dx, top: (a.top ?? 0) + dy });
    a.setCoords();
    this.canvas.requestRenderAll();
    this.snapshot();
    this.onSelection();
  }

  mirror(axis: 'x' | 'y') {
    const a = this.canvas.getActiveObject();
    if (!a) return;
    if (axis === 'x') a.set('flipX', !a.flipX); else a.set('flipY', !a.flipY);
    a.setCoords();
    this.canvas.requestRenderAll();
    this.snapshot();
  }

  rotateBy(deg: number) {
    const a = this.canvas.getActiveObject();
    if (!a) return;
    a.rotate(((a.angle ?? 0) + deg) % 360);
    a.setCoords();
    this.canvas.requestRenderAll();
    this.snapshot();
    this.onSelection();
  }

  align(how: AlignHow) {
    const objs = this.getSelected();
    if (!objs.length) return;
    const active = this.canvas.getActiveObject()!;
    if (how === 'bedcenter') {
      const r = active.getBoundingRect();
      const dx = this.machine.width / 2 - (r.left + r.width / 2);
      const dy = this.machine.height / 2 - (r.top + r.height / 2);
      active.set({ left: (active.left ?? 0) + dx, top: (active.top ?? 0) + dy });
      active.setCoords();
    } else if (objs.length === 1) {
      const r = active.getBoundingRect();
      const W = this.machine.width, H = this.machine.height;
      let dx = 0, dy = 0;
      if (how === 'left') dx = -r.left;
      if (how === 'right') dx = W - (r.left + r.width);
      if (how === 'hcenter') dx = W / 2 - (r.left + r.width / 2);
      if (how === 'top') dy = -r.top;
      if (how === 'bottom') dy = H - (r.top + r.height);
      if (how === 'vcenter') dy = H / 2 - (r.top + r.height / 2);
      active.set({ left: (active.left ?? 0) + dx, top: (active.top ?? 0) + dy });
      active.setCoords();
    } else {
      // rata antar objek terhadap bounding box seleksi
      const sel = active.getBoundingRect();
      for (const o of objs) {
        const r = o.getBoundingRect();
        let dx = 0, dy = 0;
        if (how === 'left') dx = sel.left - r.left;
        if (how === 'right') dx = sel.left + sel.width - (r.left + r.width);
        if (how === 'hcenter') dx = sel.left + sel.width / 2 - (r.left + r.width / 2);
        if (how === 'top') dy = sel.top - r.top;
        if (how === 'bottom') dy = sel.top + sel.height - (r.top + r.height);
        if (how === 'vcenter') dy = sel.top + sel.height / 2 - (r.top + r.height / 2);
        // objek di dalam ActiveSelection punya koordinat relatif; pakai matriks
        const m = active.calcTransformMatrix();
        const inv = util.invertTransform(m);
        const p0 = util.transformPoint(new Point(0, 0), inv);
        const p1 = util.transformPoint(new Point(dx, dy), inv);
        o.set({ left: (o.left ?? 0) + (p1.x - p0.x), top: (o.top ?? 0) + (p1.y - p0.y) });
        o.setCoords();
      }
      active.setCoords();
    }
    this.canvas.requestRenderAll();
    this.snapshot();
    this.onSelection();
  }

  /** Susun grid array dari objek terpilih. */
  async arrayGrid(cols: number, rows: number, dx: number, dy: number) {
    const a = this.canvas.getActiveObject();
    if (!a) return;
    const r = a.getBoundingRect();
    const src = a.toObject(['layer']);
    const clones: FabricObject[] = [];
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      if (i === 0 && j === 0) continue;
      const [c] = await util.enlivenObjects<FabricObject>([src]);
      c.set({ left: (c.left ?? 0) + j * (r.width + dx), top: (c.top ?? 0) + i * (r.height + dy) });
      this.layers.styleObject(c);
      setStrokeWidth(c, 1.2 / this.zoom);
      this.canvas.add(c);
      clones.push(c);
    }
    this.canvas.requestRenderAll();
  }

  /* ---------- Riwayat ---------- */

  snapshot(immediate = false) {
    if (this.loading) return;
    if (this.histTimer) clearTimeout(this.histTimer);
    const doIt = () => {
      this.histTimer = null;
      const json = JSON.stringify(this.serializeObjects());
      if (this.history[this.histIndex] === json) return;
      this.history = this.history.slice(0, this.histIndex + 1);
      this.history.push(json);
      if (this.history.length > 60) this.history.shift();
      this.histIndex = this.history.length - 1;
      this.onHistory();
    };
    if (immediate) doIt(); else this.histTimer = window.setTimeout(doIt, 150);
  }
  get canUndo() { return this.histIndex > 0; }
  get canRedo() { return this.histIndex < this.history.length - 1; }
  async undo() { if (this.canUndo) { this.histIndex--; await this.restore(this.history[this.histIndex]); } }
  async redo() { if (this.canRedo) { this.histIndex++; await this.restore(this.history[this.histIndex]); } }

  private async restore(json: string) {
    this.loading = true;
    try {
      await this.loadObjects(JSON.parse(json));
    } finally {
      this.loading = false;
      this.onHistory();
      this.onSelection();
    }
  }

  serializeObjects(): any {
    return this.canvas.toObject(['layer']);
  }

  async loadObjects(json: any) {
    this.loading = true;
    try {
      this.canvas.discardActiveObject();
      await this.canvas.loadFromJSON(json);
      this.restyleAll();
    } finally {
      this.loading = false;
    }
  }

  async clear() {
    this.canvas.discardActiveObject();
    this.canvas.remove(...this.canvas.getObjects());
    this.canvas.requestRenderAll();
    this.snapshot(true);
  }
}

function setStrokeWidth(o: FabricObject, sw: number) {
  if (o.type === 'image') return;
  if (o.type === 'group') { (o as Group).getObjects().forEach(c => setStrokeWidth(c, sw)); return; }
  if (o.type === 'textbox' || o.type === 'text' || o.type === 'i-text') return;
  o.set('strokeWidth', sw);
}
