// MONITORS — what you see on screen, all drawn from the running engine
//
//   OSCILLOSCOPE   the audio output (from the browser analyser)
//   SPECTRUM       the audio output, frequency by frequency (from the browser analyser)
//   CV HISTORY     the control voltage of the stage over the last four seconds
//   XY             two signals against each other (which ones depends on the stage)
//   EVENT MAP      a value at one clock event against the same value at the next event
//   REGISTER       the eight cells of the shift register (stages with a Rungler)
//
// Nothing here is simulated: if the audio is stopped, the monitors say so.

import { element } from './controls.js';
import { colors } from './theme.js';

class Monitor {
  constructor(title, caption) {
    this.el = element('figure', 'plot');
    this.key = this.constructor.key;
    const heading = element('figcaption', 'plot-heading');
    this.badge = element('span', 'plot-badge', 'STOPPED');
    heading.append(element('span', '', title), this.badge);
    this.canvas = element('canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', `${title}: ${caption}`);
    this.note = element('p', 'plot-note', caption);
    this.el.append(heading, this.canvas, this.note);
    this.ctx = this.canvas.getContext('2d');
  }

  // Prepare a crisp canvas and return its size in CSS pixels.
  begin() {
    const width = Math.max(1, this.canvas.clientWidth), height = Math.max(1, this.canvas.clientHeight);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(width * ratio)) this.canvas.width = Math.round(width * ratio);
    if (this.canvas.height !== Math.round(height * ratio)) this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  }

  clear(width, height, columns = 8, rows = 4) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = colors().grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 1; i < columns; i++) { const x = Math.round(i * width / columns) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let i = 1; i < rows; i++) { const y = Math.round(i * height / rows) + .5; ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
  }

  label(text, x, y) {
    this.ctx.fillStyle = colors().dim; this.ctx.font = '10px monospace'; this.ctx.fillText(text, x, y);
  }

  message(text) {
    if (!this.ctx) return;
    const { width, height } = this.begin();
    this.clear(width, height);
    this.label(text, 12, 22);
  }

  setLive(live) { this.badge.textContent = live ? 'LIVE' : 'STOPPED'; }
  reset() {}
}

// ── Oscilloscope: the output waveform, triggered on a rising zero crossing ──
export class Oscilloscope extends Monitor {
  static key = 'scope';
  constructor() { super('Oscilloscope', 'Patch output, before the DC blocker · ±1 full scale'); this.data = null; }
  draw(analyser) {
    const { width, height } = this.begin();
    this.clear(width, height);
    this.data ??= new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(this.data);
    const d = this.data, span = Math.min(d.length / 2, 1024);
    let start = 0;
    for (let i = 1; i < d.length - span; i++) if (d[i - 1] <= 0 && d[i] > 0) { start = i; break; }
    const ctx = this.ctx;
    ctx.strokeStyle = colors().ink; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < span; i++) {
      const x = i / (span - 1) * width, y = height / 2 - d[start + i] * height * 0.9;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    this.label(`${(span / analyser.context.sampleRate * 1000).toFixed(1)} ms`, 12, height - 10);
  }
}

// ── Spectrum: logarithmic frequency axis 20 Hz … 20 kHz, −100 … 0 dB ──
export class Spectrum extends Monitor {
  static key = 'spectrum';
  constructor() { super('Spectrum', 'Patch output · 20 Hz – 20 kHz, log scale · −100 to 0 dB'); this.data = null; }
  draw(analyser) {
    const { width, height } = this.begin();
    this.clear(width, height, 3, 5);
    this.data ??= new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(this.data);
    const nyquist = analyser.context.sampleRate / 2, ctx = this.ctx;
    ctx.strokeStyle = colors().ink; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let px = 0; px <= width; px++) {
      const hz = 20 * 1000 ** (px / width);
      const db = this.data[Math.min(this.data.length - 1, Math.round(hz / nyquist * this.data.length))];
      const y = Math.max(0, Math.min(height, -db / 100 * height));
      px ? ctx.lineTo(px, y) : ctx.moveTo(px, y);
    }
    ctx.stroke();
    this.label('20 Hz', 6, height - 8); this.label('630 Hz', width / 2 - 18, height - 8); this.label('20 kHz', width - 46, height - 8);
  }
}

// ── CV history: the stage's control voltage over the last four seconds ──
const CV_CAPTION = 'Control voltage of this stage · last 4 s · −1 … +1';
export class CVHistory extends Monitor {
  static key = 'cv';
  constructor() { super('CV history', CV_CAPTION); this.reset(); }
  caption(text = CV_CAPTION) { this.note.textContent = text; }
  reset() { this.values = new Float32Array(1000); this.write = 0; }
  push(values) {
    for (const v of values) { this.values[this.write] = v; this.write = (this.write + 1) % this.values.length; }
  }
  draw() {
    const { width, height } = this.begin();
    this.clear(width, height, 4, 4);
    const ctx = this.ctx, n = this.values.length;
    ctx.strokeStyle = colors().ink; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const v = this.values[(this.write + k) % n];
      const x = k / (n - 1) * width, y = height / 2 - Math.max(-1.2, Math.min(1.2, v)) * height * 0.42;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    this.label('−4 s', 6, height - 8); this.label('now', width - 28, height - 8);
  }
}

// ── XY: two signals against each other, with a slow fade so shapes build up ──
// A stage can ask for its own axes and style (see `xy` in notes.js): stage 0A draws a delay
// map with dots and a faint diagonal, where "same value as a moment ago" would fall.
const XY_AXES = {
  '1': ['OSC1 (DATA) triangle', 'OSC2 (CLOCK) triangle'],
  '2': ['OSC1 (DATA) triangle', 'OSC2 (CLOCK) triangle'],
  '3': ['filter 1 (second pole, ×30)', 'filter 2 (second pole, ×30)'],
  '4': ['OSC A triangle', 'OSC B triangle']
};
export class XYPlot extends Monitor {
  static key = 'xy';
  constructor() { super('XY', 'Two engine signals against each other'); this.scale = 1.2; }
  reset() { this.cleared = false; }
  draw(frame, view = {}) {
    const { width, height } = this.begin();
    const ctx = this.ctx;
    if (!this.cleared) { this.clear(width, height, 4, 4); this.cleared = true; }
    ctx.fillStyle = colors().fade; ctx.fillRect(0, 0, width, height);
    const dots = view.style === 'dots';
    const xy = frame.xy;
    let peak = 1;
    for (let i = 0; i < xy.length; i++) peak = Math.max(peak, Math.abs(xy[i]));
    this.scale += (peak * 1.1 - this.scale) * 0.1;
    const size = Math.min(width, height), left = (width - size) / 2, top = (height - size) / 2;
    const X = v => left + (0.5 + v / (2 * this.scale)) * size;
    const Y = v => top + (0.5 - v / (2 * this.scale)) * size;
    if (view.diagonal) {
      ctx.strokeStyle = colors().line; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(X(-this.scale), Y(-this.scale)); ctx.lineTo(X(this.scale), Y(this.scale)); ctx.stroke();
    }
    ctx.strokeStyle = ctx.fillStyle = colors().ink; ctx.lineWidth = 1; ctx.beginPath();
    if (dots) {
      for (let k = 0; k < xy.length; k += 2) ctx.fillRect(X(xy[k]) - 1, Y(xy[k + 1]) - 1, 2, 2);
    } else {
      // A curve, not straight segments: each sample is a control point and the line passes
      // through the midpoints between samples, so fast waves stay round instead of angular.
      ctx.moveTo(X(xy[0]), Y(xy[1]));
      for (let k = 2; k < xy.length - 2; k += 2) {
        const x = X(xy[k]), y = Y(xy[k + 1]);
        ctx.quadraticCurveTo(x, y, (x + X(xy[k + 2])) / 2, (y + Y(xy[k + 3])) / 2);
      }
      ctx.stroke();
    }
    const [ax, ay] = view.axes || XY_AXES[frame.stage] || ['X', 'Y'];
    this.note.textContent = `X: ${ax} · Y: ${ay}`;
  }
}

// ── Event map: value at clock event n (x) against event n+1 (y), accumulated ──
const EVENT_LABEL = {
  '0B': 'pitch CV sent to the voice, step n → n+1 (±3 octaves from the centre)',
  '1': 'pitch CV sent to the voice, step n → n+1 (±3 octaves from the centre)',
  '2': 'OSC1 (DATA) phase at clock edge n → n+1',
  '3': 'filter 1 peak amplitude n → n+1 (×30, soft-limited to 0 … 1)',
  '4': 'value n → n+1'
};
export class EventMap extends Monitor {
  static key = 'events';
  constructor() { super('Event map', 'One value per clock event, plotted against the next'); this.limit = 3000; this.reset(); }
  reset() { this.points = []; this.last = null; }
  setLimit(events) { this.limit = events; this.trim(); } // how many events stay on the map
  trim() { if (this.points.length > this.limit * 2) this.points.splice(0, this.points.length - this.limit * 2); }
  add(events) { // called once per engine frame, so no event is counted twice
    for (const value of events) {
      if (this.last !== null) this.points.push(this.last, value);
      this.last = value;
    }
    this.trim();
  }
  // label: what the axes show; a stage with steps can give its own (lab/js/notes.js, eventLabel).
  draw(stage, label = EVENT_LABEL[stage]) {
    const { width, height } = this.begin();
    this.clear(width, height, 4, 4);
    if (!EVENT_LABEL[stage]) { this.label('No clock in this stage: nothing to map.', 12, 22); this.note.textContent = 'Events appear from stage 0b on.'; return; }
    const size = Math.min(width, height), left = (width - size) / 2, top = (height - size) / 2;
    const ctx = this.ctx;
    ctx.strokeStyle = colors().line; ctx.strokeRect(left + .5, top + .5, size - 1, size - 1);
    ctx.fillStyle = colors().ink;
    const count = this.points.length / 2;
    for (let k = 0; k < this.points.length; k += 2) {
      const age = (k / 2) / Math.max(1, count);
      ctx.globalAlpha = 0.25 + 0.75 * age;
      ctx.fillRect(left + this.points[k] * (size - 3), top + (1 - this.points[k + 1]) * (size - 3), 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
    this.note.textContent = `${label} · ${count} events`;
  }
}

// ── Register: the eight cells; cells 6–8 feed the DAC ──
export class RegisterView extends Monitor {
  static key = 'register';
  constructor() { super('Shift register', 'Cells 1–8 · cells 6, 7, 8 feed the 3-bit DAC'); }
  draw(frame) {
    const { width, height } = this.begin();
    this.ctx.clearRect(0, 0, width, height);
    if (frame.register === null) {
      this.label('No shift register in this stage.', 12, 22);
      this.note.textContent = 'The register appears from stage 1 on.';
      return;
    }
    // Stage 4 (Blippoo Box): two Runglers, each with a 1–2–1 DAC (five levels, 0 … 4).
    if (frame.registerB !== null && frame.registerB !== undefined) {
      const a = this.row(frame.register, height * 0.30, [1, 2, 1], 'Rungler A');
      const b = this.row(frame.registerB, height * 0.72, [1, 2, 1], 'Rungler B');
      this.note.textContent = `Cells 1–8 · DAC 1–2–1 on cells 6–8 · A level ${a}/4 · B level ${b}/4`;
      return;
    }
    const dac = this.row(frame.register, height / 2 - 8, [4, 2, 1], 'DAC');
    this.note.textContent = `Pattern ${frame.register.toString(2).padStart(8, '0').split('').reverse().join('')} (cell 1 … 8) · DAC ${dac}/7`;
  }
  // One register: eight cells centred on `middle`; returns its DAC value with these weights.
  row(pattern, middle, weights, name) {
    const width = Math.max(1, this.canvas.clientWidth), ctx = this.ctx, gap = 6;
    const two = name !== 'DAC';
    const cell = Math.min(two ? 30 : 52, (width - 24 - gap * 7) / 8);
    const left = (width - (cell * 8 + gap * 7)) / 2, top = middle - cell / 2;
    let dac = 0;
    for (let c = 0; c < 8; c++) {
      const bit = (pattern >> c) & 1, x = left + c * (cell + gap);
      ctx.strokeStyle = c >= 5 ? colors().ink : colors().dim; ctx.lineWidth = c >= 5 ? 2 : 1;
      ctx.strokeRect(x + .5, top + .5, cell, cell);
      if (bit) { ctx.fillStyle = colors().ink; ctx.fillRect(x + 4, top + 4, cell - 7, cell - 7); }
      if (!two) this.label(String(c + 1), x + cell / 2 - 3, top + cell + 16);
      if (c >= 5) dac += bit * weights[c - 5];
    }
    const top3 = weights.reduce((sum, w) => sum + w, 0);
    this.label(two ? `${name} · level ${dac} / ${top3}` : `DAC = ${dac} / ${top3}`, left, top - 8);
    return dac;
  }
}
