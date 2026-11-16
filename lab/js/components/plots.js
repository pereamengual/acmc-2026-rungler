import { element } from './controls.js';
class CanvasView {
  constructor(title, kind, description) {
    this.kind = kind;
    this.el = element('figure', 'plot');
    const caption = element('figcaption', 'plot-heading');
    caption.append(element('span', '', title), element('span', 'plot-badge', 'SIMULATED'));
    this.canvas = element('canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', `${title}: ${description}. Demo disabled; no measurement or audio.`);
    this.note = element('p', 'plot-note', 'Demo disabled · no engine data');
    this.el.append(caption, this.canvas, this.note);
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) { this.note.textContent = 'Canvas 2D unavailable in this browser'; return; }
    this.observer = new ResizeObserver(() => this.draw(this.lastFrame));
    this.observer.observe(this.el);
    this.draw(null);
  }
  draw(frame) {
    this.lastFrame = frame;
    if (!this.ctx) return;
    const width = Math.max(1, this.canvas.clientWidth);
    const height = this.canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(width * ratio) || this.canvas.height !== Math.round(height * ratio)) {
      this.canvas.width = Math.round(width * ratio); this.canvas.height = Math.round(height * ratio);
    }
    const ctx = this.ctx;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#252525'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += width / 8) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = 0; y < height; y += height / 4) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
    ctx.fillStyle = '#aaa'; ctx.font = '10px monospace';
    ctx.fillText(this.kind === 'xy' ? 'X / Y · arbitrary units' : this.kind === 'spectrum' ? 'Illustrative bins · not FFT / Hz / dB' : 'Position / amplitude · arbitrary units', 12, height - 10);
    this.note.textContent = frame ? 'Illustrative graphics · no DSP or measured data' : 'Demo disabled · no engine data';
    this.canvas.setAttribute('aria-label', `${this.el.querySelector('figcaption span').textContent}: ${this.note.textContent}`);
    if (!frame) { ctx.fillText('NO ENGINE DATA', 12, 22); return; }
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.5;
    const points = frame[this.kind];
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const px = 12 + x * (width - 24), py = 18 + (1 - y) * (height - 48);
      if (this.kind === 'spectrum') { ctx.moveTo(px, height - 30); ctx.lineTo(px, py); }
      else if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
  dispose() { this.observer?.disconnect(); this.el.remove(); }
}
export class Oscilloscope extends CanvasView {
  constructor() { super('Oscilloscope', 'scope', 'Illustrative trace, not a captured waveform'); }
}
export class CVMonitor extends CanvasView {
  constructor() { super('CV monitor', 'cv', 'Illustrative steps, not sampled control voltages'); }
}
export class SpectrumAnalyzer extends CanvasView {
  constructor() { super('Spectrum analyzer', 'spectrum', 'Illustrative bars, not an FFT or spectrum measurement'); }
}
export class XYPlot extends CanvasView {
  constructor() { super('XY plot', 'xy', 'Illustrative curve, not a reconstructed phase space'); }
}
