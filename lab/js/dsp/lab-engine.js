// LAB ENGINE — the rack that holds every stage
//
//   panel controls ──▶ [ smoothing ] ──▶ [ current stage patch ] ─┬─▶ [ DC blocker ] ──▶ audio out
//                                                 │                └──────────────────▶ raw out (for the
//                                                 │                                     oscilloscope and spectrum)
//                                                 └──▶ monitors (XY, events, register)
//
// It does three jobs and nothing else:
//   1. keeps the control values, gliding knobs over ~20 ms so moves do not click;
//   2. runs the patch of the selected stage, one sample at a time;
//   3. protects the output: removes DC and silences the block if a value ever becomes
//      invalid (NaN / infinity), then restarts the patch.
// It also collects what the monitors and the chaos indicators need (see lab/js/analysis/).
//
// It has no Web Audio code, so it also runs in Node for tests.

import { NoiseStage } from './patches/stage-0a-noise.js';
import { SampleHoldStage } from './patches/stage-0b-sample-hold.js';
import { RunglerStage } from './patches/stage-1-rungler.js';
import { PwmStage } from './patches/stage-2-pwm.js';
import { TwinPeakStage } from './patches/stage-3-twin-peak.js';
import { BlippooStage } from './patches/stage-4-blippoo.js';
import { DCBlocker } from './modules/dc-blocker.js';

export const STAGE_PATCHES = Object.freeze({
  '0A': NoiseStage,
  '0B': SampleHoldStage,
  '1': RunglerStage,
  '2': PwmStage,
  '3': TwinPeakStage,
  '4': BlippooStage
});

const GLIDE_SECONDS = 0.02;
const MONITOR_LENGTH = 2048; // samples kept for the monitors (~46 ms at 44.1 kHz)
const MAX_EVENTS = 512;      // clock events kept between two monitor frames
const SLOW_CV_RATE = 250;    // the CV history display is sampled 250 times per second

export class LabEngine {
  constructor(sampleRate, seed = 1) {
    this.sampleRate = sampleRate;
    this.seed = seed;
    this.glide = 1 - Math.exp(-1 / (GLIDE_SECONDS * sampleRate));
    this.stage = '0A';
    this.targets = {};   // per stage: the values the panel asks for
    this.controls = {};  // per stage: the values the patch hears (after gliding)
    this.gliding = {};   // per stage: which controls glide (knobs) and which jump (switches)
    this.out = {};
    this.monitor = {
      x: new Float32Array(MONITOR_LENGTH), y: new Float32Array(MONITOR_LENGTH),
      cv: new Float32Array(MONITOR_LENGTH), write: 0,
      events: new Float32Array(MAX_EVENTS), patterns: new Uint8Array(MAX_EVENTS), eventCount: 0,
      analysis: new Float32Array(MAX_EVENTS), analysisCount: 0,
      clocks: 0, clocksB: 0, // clock pulses since the last snapshot (for the clock LEDs; B: stage 4's OSC B)
      slowCV: new Float32Array(256), slowCount: 0, slowEvery: Math.round(sampleRate / SLOW_CV_RATE), slowTimer: 0
    };
    this.reset();
  }

  // Rebuild every patch from scratch, with the same random seed.
  reset() {
    this.patches = {};
    for (const [id, Patch] of Object.entries(STAGE_PATCHES)) this.patches[id] = new Patch(this.sampleRate, this.seed);
    this.dcLeft = new DCBlocker();
    this.dcRight = new DCBlocker();
    for (const stage of Object.keys(this.targets)) Object.assign(this.controls[stage], this.targets[stage]);
    this.monitor.write = 0;
    this.monitor.eventCount = 0;
    this.monitor.analysisCount = 0;
    this.monitor.slowCount = 0;
    this.monitor.clocks = 0;
    this.monitor.clocksB = 0;
  }

  setStage(stage, parameters = []) {
    this.stage = stage;
    this.out = {}; // forget the monitors of the previous stage (e.g. its register)
    for (const { id, value, glide } of parameters) this.setParameter(id, value, glide, true);
  }

  // id looks like "1.osc1": stage "1", control "osc1".
  setParameter(id, value, glide = true, jump = false) {
    if (typeof id !== 'string' || !Number.isFinite(value)) return;
    const dot = id.indexOf('.');
    const stage = id.slice(0, dot), name = id.slice(dot + 1);
    this.targets[stage] ??= {}; this.controls[stage] ??= {}; this.gliding[stage] ??= {};
    this.targets[stage][name] = value;
    this.gliding[stage][name] = glide;
    if (jump || !glide || !(name in this.controls[stage])) this.controls[stage][name] = value;
  }

  updateControls(stage) {
    const targets = this.targets[stage], controls = this.controls[stage], gliding = this.gliding[stage];
    if (!targets) return;
    for (const name in targets) {
      controls[name] = gliding[name]
        ? controls[name] + (targets[name] - controls[name]) * this.glide
        : targets[name];
    }
  }

  // Render `frames` samples into two output arrays (and, if given, `raw`: the left channel
  // before the DC blocker, so the oscilloscope shows the patch exactly). Returns false after a fault.
  process(left, right, frames, raw = null) {
    const patch = this.patches[this.stage];
    if (!patch) { left.fill(0, 0, frames); right.fill(0, 0, frames); raw?.fill(0, 0, frames); return true; }
    const controls = this.controls[this.stage] ??= {};
    const out = this.out, monitor = this.monitor;
    for (let n = 0; n < frames; n++) {
      this.updateControls(this.stage);
      out.event = false; out.analysis = false; out.clock = false; out.clockB = false;
      patch.render(controls, out);

      const l = this.dcLeft.process(out.left), r = this.dcRight.process(out.right);
      if (!Number.isFinite(l) || !Number.isFinite(r)) { this.reset(); return false; }
      left[n] = l; right[n] = r;
      if (raw) raw[n] = out.left;

      const i = monitor.write;
      monitor.x[i] = out.monitorX; monitor.y[i] = out.monitorY; monitor.cv[i] = out.monitorCV;
      monitor.write = (i + 1) % MONITOR_LENGTH;
      if (out.clock) monitor.clocks++;
      if (out.clockB) monitor.clocksB++;
      if (out.event && monitor.eventCount < MAX_EVENTS) {
        monitor.patterns[monitor.eventCount] = out.register ?? 0;
        monitor.events[monitor.eventCount++] = out.eventValue;
      }
      // A second stream of values: the patch's own analysis values if it gives them (0a's CV,
      // stage 1's OSC1 phase at each clock), otherwise the event values.
      if ((out.event || out.analysis) && monitor.analysisCount < MAX_EVENTS) {
        monitor.analysis[monitor.analysisCount++] = out.analysis ? out.analysisValue : out.eventValue;
      }
      if (++monitor.slowTimer >= monitor.slowEvery) {
        monitor.slowTimer = 0;
        if (monitor.slowCount < monitor.slowCV.length) monitor.slowCV[monitor.slowCount++] = out.monitorCV;
      }
    }
    return true;
  }

  // A snapshot for the screen: the last 2048 samples (all of them, unless `points` asks for
  // fewer: thinning makes fast waves look like polygons in the XY plot); the clock events
  // and the slow CV history since the previous snapshot.
  snapshot(points = MONITOR_LENGTH) {
    const m = this.monitor, stride = MONITOR_LENGTH / points;
    const xy = new Float32Array(points * 2), cv = new Float32Array(points);
    for (let k = 0; k < points; k++) {
      const i = (m.write + Math.floor(k * stride)) % MONITOR_LENGTH;
      xy[2 * k] = m.x[i]; xy[2 * k + 1] = m.y[i]; cv[k] = m.cv[i];
    }
    const events = m.events.slice(0, m.eventCount), patterns = m.patterns.slice(0, m.eventCount);
    const analysis = m.analysis.slice(0, m.analysisCount);
    const slowCV = m.slowCV.slice(0, m.slowCount);
    const clocks = m.clocks, clocksB = m.clocksB;
    m.eventCount = 0; m.analysisCount = 0; m.slowCount = 0; m.clocks = 0; m.clocksB = 0;
    return {
      type: 'monitor', stage: this.stage, xy, cv, events, patterns, analysis, slowCV, clocks, clocksB,
      register: this.out.register ?? null,
      registerB: this.out.registerB ?? null  // stage 4: the second Rungler
    };
  }
}
