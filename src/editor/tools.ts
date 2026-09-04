import { Rect, Ellipse, Line, Polygon, Textbox, FabricObject } from 'fabric';
import type { Workspace } from './canvas';
import type { XY } from '../types';

export type ToolName = 'select' | 'pan' | 'rect' | 'ellipse' | 'line' | 'polygon' | 'text';

export class ToolManager {
  current: ToolName = 'select';
  onChange: (t: ToolName) => void = () => {};
  activeLayer = 0;
  private drawing: FabricObject | null = null;
  private start: XY = { x: 0, y: 0 };
  private polyPts: XY[] = [];
  private polyPreview: Polygon | null = null;
  fontFamily = 'Arial';
  constructor(private ws: Workspace) {
    const c = ws.canvas;
    c.on('mouse:down', (opt) => {
      const e = opt.e as MouseEvent;
      if (e.button !== 0 || ws.spaceDown) return;
      this.down(opt.scenePoint, e);
    });
    c.on('mouse:move', (opt) => this.move(opt.scenePoint, opt.e as MouseEvent));
    c.on('mouse:up', (opt) => this.up(opt.scenePoint));
    c.on('mouse:dblclick', () => { if (this.current === 'polygon') this.finishPolygon(); });
    window.addEventListener('keydown', (e) => {
      if (this.current === 'polygon' && e.key === 'Enter') this.finishPolygon();
      if (e.key === 'Escape') { this.cancelPolygon(); this.setTool('select'); }
    });
  }

  setTool(t: ToolName) {
    if (this.current === 'polygon' && t !== 'polygon') this.cancelPolygon();
    this.current = t;
    const c = this.ws.canvas;
    const drawing = t !== 'select';
    c.selection = !drawing;
    c.skipTargetFind = drawing;
    c.defaultCursor = t === 'pan' ? 'grab' : drawing ? 'crosshair' : 'default';
    c.hoverCursor = drawing ? 'crosshair' : 'move';
    this.ws.panMode = t === 'pan';
    if (drawing) c.discardActiveObject();
    c.requestRenderAll();
    this.onChange(t);
  }

  private snap(p: XY, e?: MouseEvent): XY {
    if (e?.ctrlKey) return { x: Math.round(p.x), y: Math.round(p.y) };
    return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
  }

  private down(sp: XY, e: MouseEvent) {
    const p = this.snap(sp, e);
    switch (this.current) {
      case 'rect':
        this.start = p;
        this.drawing = new Rect({ left: p.x, top: p.y, width: 0, height: 0, originX: 'left', originY: 'top' });
        this.ws.addObject(this.drawing, this.activeLayer, false);
        break;
      case 'ellipse':
        this.start = p;
        this.drawing = new Ellipse({ left: p.x, top: p.y, rx: 0, ry: 0, originX: 'left', originY: 'top' });
        this.ws.addObject(this.drawing, this.activeLayer, false);
        break;
      case 'line':
        this.start = p;
        this.drawing = new Line([p.x, p.y, p.x, p.y]);
        this.ws.addObject(this.drawing, this.activeLayer, false);
        break;
      case 'polygon':
        this.polyPts.push(p);
        this.updatePolyPreview(p);
        break;
      case 'text': {
        const t = new Textbox('Teks', {
          left: p.x, top: p.y, fontSize: 10, fontFamily: this.fontFamily,
          originX: 'left', originY: 'top', width: 60, editable: true,
        });
        this.ws.addObject(t, this.activeLayer, true);
        this.setTool('select');
        this.ws.canvas.setActiveObject(t);
        t.enterEditing();
        t.selectAll();
        this.ws.snapshot();
        break;
      }
    }
  }

  private move(sp: XY, e: MouseEvent) {
    if (this.current === 'polygon') { if (this.polyPts.length) this.updatePolyPreview(this.snap(sp, e)); return; }
    if (!this.drawing) return;
    const p = this.snap(sp, e);
    const x0 = Math.min(this.start.x, p.x), y0 = Math.min(this.start.y, p.y);
    let w = Math.abs(p.x - this.start.x), h = Math.abs(p.y - this.start.y);
    if (e.shiftKey) { w = h = Math.max(w, h); }
    if (this.current === 'rect') {
      this.drawing.set({ left: x0, top: y0, width: w, height: h });
    } else if (this.current === 'ellipse') {
      this.drawing.set({ left: x0, top: y0, rx: w / 2, ry: h / 2, width: w, height: h });
    } else if (this.current === 'line') {
      (this.drawing as Line).set({ x2: p.x, y2: p.y });
      (this.drawing as any)._setWidthHeight?.();
    }
    this.drawing.setCoords();
    this.ws.canvas.requestRenderAll();
  }

  private up(_sp: XY) {
    if (!this.drawing) return;
    const d = this.drawing;
    this.drawing = null;
    const tooSmall = (d.width ?? 0) < 0.2 && (d.height ?? 0) < 0.2;
    if (tooSmall) { this.ws.canvas.remove(d); }
    else {
      d.setCoords();
      this.ws.canvas.setActiveObject(d);
      this.ws.snapshot();
    }
    this.setTool('select');
  }

  private updatePolyPreview(cursor: XY) {
    const pts = [...this.polyPts, cursor];
    if (this.polyPreview) this.ws.canvas.remove(this.polyPreview);
    this.polyPreview = new Polygon(pts, {
      fill: 'transparent', stroke: '#4da3ff', strokeWidth: 1.2 / this.ws.zoom, strokeDashArray: [2, 2],
      selectable: false, evented: false, objectCaching: false, excludeFromExport: true,
    });
    this.ws.canvas.add(this.polyPreview);
    this.ws.canvas.requestRenderAll();
  }

  private finishPolygon() {
    const pts = this.polyPts.slice();
    this.cancelPolygon();
    if (pts.length >= 3) {
      const poly = new Polygon(pts, { objectCaching: false });
      this.ws.addObject(poly, this.activeLayer, true);
      this.ws.snapshot();
    }
    this.setTool('select');
  }

  private cancelPolygon() {
    this.polyPts = [];
    if (this.polyPreview) { this.ws.canvas.remove(this.polyPreview); this.polyPreview = null; }
    this.ws.canvas.requestRenderAll();
  }
}
