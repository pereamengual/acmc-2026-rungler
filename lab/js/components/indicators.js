// CHAOS AND ENTROPY INDICATORS — three readings of the running engine
//
//   one value per event ───▶ permutation entropy & complexity ──▶ point on the H–C plane
//   register per clock ────▶ period detector ──────────────────▶ "repeats every p clocks"
//   twin from the state ───▶ time to divergence ───────────────▶ "separate after n clocks"
//
// Two ways of getting the values:
//
//   AHEAD (stages 1 and 2)   from the Rungler's current state, the event map computes the next
//                            thousand clocks in a few milliseconds. Instant, and it follows
//                            every knob move. Exact while the knobs are still.
//   MEASURED (0A, 0B, 3, 4)     the values the engine produces are collected as they come.
//                            There is no shortcut for noise or for the filters, so these fill up
//                            in real time. A reading appears once there are 100 windows of four
//                            values: with fewer, even pure noise would look structured (there are
//                            24 possible orders, and a short series cannot fill them all).
//
// They are didactic indicators of this model, not proofs of chaos. The panel shows only the
// values; every explanation and caveat lives in the "How to read the indicators" section.

import { element } from './controls.js';
import { orderHistogram, entropyAndComplexity, ORDER } from '../analysis/permutation-entropy.js';
import { findPeriod } from '../analysis/period-detector.js';
import { EventRungler, cellsFromPattern } from '../analysis/event-map.js';
import { twinDivergence } from '../analysis/twin-divergence.js';
import { runglerSettings, voiceSemitones } from '../dsp/patches/stage-1-rungler.js';
import { MAX_AMOUNT_OCTAVES } from '../dsp/patches/stage-0b-sample-hold.js';
import { colors } from './theme.js';

const AHEAD_CLOCKS = 600;   // clocks computed ahead for stages 1 and 2
const HISTORY = 1024;       // live values kept
const FIRST_WINDOWS = 100;  // live: show a reading from here (fewer would bias it towards order)…
const STEADY_WINDOWS = 300; // …and call it steady from here
const TRAIL = 90;           // points of the H–C trail
const AHEAD_EVERY_MS = 150; // how often the ahead computation runs

// For each stage: the ordinal delay; which value stream the entropy reads ('analysis' or
// 'events'); and, for the Rungler stages computed ahead, the value taken at each clock.
// (What each stage measures is explained in "How to read this stage".)
const pitchOf = (cv, controls) => voiceSemitones(cv, controls) / (MAX_AMOUNT_OCTAVES * 12) * 0.5 + 0.5;
const SOURCES = {
  '0A': { delay: 16, series: 'analysis' },
  '0B': { delay: 1, series: 'analysis' },
  // stage 1: the voice pitch at each clock, as in 0b
  '1': { delay: 1, series: 'events', ahead: (walker, controls) => pitchOf(walker.cv, controls) },
  // stage 2: the OSC1 phase at each clock edge
  '2': { delay: 1, series: 'analysis', ahead: walker => walker.theta },
  '3': { delay: 1, series: 'analysis' },
  // stage 4: Rungler A's level at each of its clocks (step 1), then the S&H value at each trigger
  '4': { delay: 1, series: 'events' }
};

export class Indicators {
  // controlsOf(stage) returns the stage's current knob values by short name ({ osc1: 183, … }).
  constructor(controlsOf) {
    this.controlsOf = controlsOf;
    this.el = element('figure', 'plot indicators');
    const heading = element('figcaption', 'plot-heading');
    this.badge = element('span', 'plot-badge', 'STOPPED');
    heading.append(element('span', '', 'Entropy & complexity'), this.badge);

    this.canvas = element('canvas', 'hc-plane');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Complexity–entropy plane: entropy on the horizontal axis, complexity on the vertical axis');
    this.ctx = this.canvas.getContext('2d');

    this.readouts = element('dl', 'indicator-list');
    this.rows = {};
    // Entropy and complexity: two rows, one value each; their status goes under the second.
    this.hValue = this.readout('entropy', 'Entropy', false);
    this.cValue = this.readout('entropy', 'Complexity');
    this.periodValue = this.readout('period', 'Register period');
    this.twinValue = this.readout('twin', 'Twin divergence');

    const layout = element('div', 'indicator-layout');
    layout.append(this.canvas, this.readouts);
    this.el.append(heading, layout);
    this.reset();
    // Redraw when the plane changes size, also before START AUDIO (no frames yet): otherwise
    // a plane drawn while the layout was still settling stays stretched, with huge labels.
    // The panel lives as long as the page, so the observer does too.
    this.resizeObserver = new ResizeObserver(() => this.drawPlane());
    this.resizeObserver.observe(this.canvas);
  }

  // Each reading has its value and, on a line of its own below, a status ("collecting 38/100",
  // "rough", "> 1000 clocks"). Every line is one line high, always, even when empty: the
  // column never changes size.
  readout(key, title, withStatus = true) {
    const term = element('dt', '', title), value = element('dd', 'indicator-value');
    value.main = element('span', 'indicator-main', '—');
    value.status = element('span', 'indicator-status', '');
    value.append(value.main);
    if (withStatus) value.append(value.status);
    this.rows[key] = [...(this.rows[key] ?? []), term, value];
    this.readouts.append(term, value);
    return value;
  }

  say(value, text, status = '') { value.main.textContent = text; value.status.textContent = status; }

  // Show only the readings that apply to the stage (keys: entropy, period, twin).
  show(keys) {
    this.keys = keys;
    for (const [key, row] of Object.entries(this.rows)) row.forEach(node => { node.hidden = !keys.includes(key); });
  }

  // Live history starts again (a moved knob is a new system). The ahead mode needs no reset.
  reset() {
    this.series = []; this.patterns = []; this.trail = [];
    this.lastAhead = 0;
    for (const value of [this.hValue, this.cValue, this.periodValue, this.twinValue]) this.say(value, '—');
  }

  setLive(live) { this.badge.textContent = live ? 'LIVE' : 'STOPPED'; }

  // Called once per engine frame.
  add(frame) {
    this.series.push(...frame[SOURCES[frame.stage]?.series ?? 'analysis']);
    if (this.series.length > HISTORY) this.series.splice(0, this.series.length - HISTORY);
    this.patterns.push(...frame.patterns);
    if (this.patterns.length > HISTORY) this.patterns.splice(0, this.patterns.length - HISTORY);
    // The Rungler state at the last clock edge: OSC1 phase (analysis stream) and register.
    if (frame.events.length && frame.analysis.length) {
      this.state = { stage: frame.stage, theta: frame.analysis.at(-1), pattern: frame.patterns.at(-1) };
    }
    this.latest = frame;
  }

  update() {
    const frame = this.latest;
    if (!frame) return;
    const source = SOURCES[frame.stage];
    if (!source) { this.showNothing(); return; }
    if (source.ahead) this.updateAhead(frame.stage, source);
    else this.updateLive(frame, source);
    this.drawPlane();
  }

  showNothing() {
    for (const value of [this.hValue, this.cValue, this.periodValue, this.twinValue]) this.say(value, '—');
  }

  // ── AHEAD: stages 1 and 2, from the current Rungler state ──
  updateAhead(stage, source) {
    const now = performance.now();
    if (this.state?.stage !== stage) { this.say(this.hValue, '—'); this.say(this.cValue, '—', 'waiting for a clock…'); return; }
    if (now - this.lastAhead < AHEAD_EVERY_MS) return;
    this.lastAhead = now;

    const controls = this.controlsOf(stage);
    const settings = runglerSettings(controls);
    const start = new EventRungler(settings, this.state.theta, cellsFromPattern(this.state.pattern));

    const walker = start.copy(), values = [], patterns = [];
    for (let clock = 0; clock < AHEAD_CLOCKS; clock++) {
      walker.step();
      values.push(source.ahead(walker, controls));
      patterns.push(walker.pattern);
    }

    this.showEntropy(values, source);
    const period = findPeriod(patterns);
    this.say(this.periodValue, period ? `${period} clock${period > 1 ? 's' : ''}` : 'none');
    const twin = twinDivergence(start);
    if (twin.median === Infinity) this.say(this.twinValue, 'never', `> ${twin.limit} clocks`);
    else this.say(this.twinValue, `${twin.median} clocks`);
  }

  // ── MEASURED: 0A, 0B, 3, collected as the engine runs ──
  updateLive(frame, source) {
    const windows = Math.max(0, this.series.length - (ORDER - 1) * source.delay);
    if (windows < FIRST_WINDOWS) { this.say(this.hValue, '—'); this.say(this.cValue, '—', `collecting ${windows}/${FIRST_WINDOWS}`); }
    else this.showEntropy(this.series, source, windows < STEADY_WINDOWS ? 'rough' : '');
    // Register period, live, where one register value is stored per clock (stages 1 and 2).
    if (source.ahead) {
      const period = findPeriod(this.patterns);
      if (this.patterns.length < 24) this.say(this.periodValue, '—', `collecting ${this.patterns.length}/24`);
      else this.say(this.periodValue, period ? `${period} clock${period > 1 ? 's' : ''}` : 'none');
    }
  }

  showEntropy(series, source, status = '') {
    const result = entropyAndComplexity(orderHistogram(series, ORDER, undefined, source.delay));
    if (!result) return;
    this.trail.push(result);
    if (this.trail.length > TRAIL) this.trail.shift();
    this.say(this.hValue, `H ${result.entropy.toFixed(2)}`);
    this.say(this.cValue, `C ${result.complexity.toFixed(2)}`, status);
  }

  drawPlane() {
    const ctx = this.ctx;
    if (!ctx) return;
    const width = Math.max(1, this.canvas.clientWidth), height = Math.max(1, this.canvas.clientHeight);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(width * ratio)) this.canvas.width = Math.round(width * ratio);
    if (this.canvas.height !== Math.round(height * ratio)) this.canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // The square of the plane, with room for the axis names: C above it, H below it.
    const left = 2, top = 14, w = width - left - 2, h = height - top - 16;
    const X = entropy => left + entropy * w, Y = complexity => top + h - (complexity / 0.5) * h;
    ctx.strokeStyle = colors().line; ctx.strokeRect(left + .5, top + .5, w, h);
    ctx.fillStyle = colors().dim; ctx.font = '9px monospace';
    ctx.fillText('C ↑ complexity', left, top - 4);
    ctx.textAlign = 'right'; ctx.fillText('entropy H →', left + w, height - 3); ctx.textAlign = 'left';
    ctx.fillText('regular', X(0.03), Y(0.03));
    ctx.textAlign = 'right'; ctx.fillText('noise', X(0.98), Y(0.03)); ctx.textAlign = 'center';
    ctx.fillText('structured,', X(0.5), Y(0.45)); ctx.fillText('irregular', X(0.5), Y(0.45) + 10);
    ctx.textAlign = 'left';

    this.trail.forEach((point, i) => {
      ctx.globalAlpha = 0.15 + 0.85 * (i + 1) / this.trail.length;
      ctx.fillStyle = colors().ink;
      const size = i === this.trail.length - 1 ? 7 : 3;
      ctx.fillRect(X(point.entropy) - size / 2, Y(point.complexity) - size / 2, size, size);
    });
    ctx.globalAlpha = 1;
  }
}
