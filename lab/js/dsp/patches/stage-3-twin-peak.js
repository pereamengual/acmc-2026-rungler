// STAGE 3 — EXCITER AND TWIN PEAK RESONATOR
//
//   OSC1 (DATA) ─┬─ square ──▶ ┌─────────┐
//                │             │ RUNGLER │──▶ CV ──▶ OSC1 and OSC2 pitch
//   OSC2 (CLOCK) ┼─ clock ───▶ └─────────┘
//                │
//                └─ triangles ─▶ COMPARATOR ─▶ EXCITER ─────────┬─▶ 3-POLE LOW-PASS 1 ─ low 1 ─(+)─┐
//                                                               │                                 ├─▶ out
//                                                               └─▶ 3-POLE LOW-PASS 2 ─ low 2 ─(−)─┘
//
//   Each filter also bends its own cutoff with the output of its second pole (self-modulation).
//
// As described by Hordijk for the Blippoo Box (Leonardo Music Journal 19, 2009, pp. 39–43):
//
//   · The resonator is two parallel, highly resonant 3-pole low-pass filters. The output of the
//     second is subtracted from the first: what both pass cancels, and a band is left between
//     the two cutoffs, with a resonant peak at each edge (Twin Peak). It does not matter which
//     peak is higher; only when both are equal does the band close.
//   · "Resonance is fixed at the point of near oscillation": the filters do not whistle on their
//     own. They ring and die away — each edge of the comparator pulse makes a "ping" of two
//     damped sine waves, in the rhythm of the pulses when the oscillators are slow.
//   · The exciter is the same comparator pulse train that, in the box, also clocks the sample
//     and hold (stage 4).
//   · To give the ping its character, the output of the second pole is fed back to the cutoff.
//     This bends the time axis of the ringing rather than its level, and adds odd and even
//     harmonics ("all-harmonic distortion"). Overdriven, the resonator can bifurcate: partials
//     an octave or more below.
//
// As in the box, three things are fixed, not knobs: the resonance, the self-modulation and the
// exciter level (modules/twin-peak.js, shared with stage 4).
//
// Controls: osc1, osc2 (Hz), peak1, peak2 (Hz), depth1, depth2 (Rungler → OSC1 / OSC2)

import { NoiseSource } from '../modules/noise.js';
import { Rungler } from '../modules/rungler.js';
import { compare } from '../modules/comparator.js';
import { TwinPeak, outputStage } from '../modules/twin-peak.js';
import { MAX_DEPTH_OCTAVES } from './stage-1-rungler.js';

// Monitors: inside the filters the pings are small (a few hundredths), so they are shown ×30.
// The XY plot widens its own scale if a loud setting goes beyond ±1; the event map, which
// needs 0 … 1, gets them soft-limited. Only the view is scaled, never the sound.
const MONITOR_GAIN = 30;

export class TwinPeakStage {
  constructor(sampleRate, seed) {
    this.noise = new NoiseSource(seed);           // the register's random power-on state
    this.rungler = new Rungler(sampleRate, this.noise);
    this.twinPeak = new TwinPeak(sampleRate);
    this.settings = { xor: 1, quantize: 0, scale: 0, driftCents: 0 };
    this.recent = [0, 0]; // last two values of filter 1, to find its peaks
  }

  render(controls, out) {
    // RUNGLER: its oscillators give the pulse that excites the filters; its CV moves the oscillators.
    const s = this.settings, r = this.rungler;
    s.osc1Hz = controls.osc1;
    s.osc2Hz = controls.osc2;
    s.osc1DepthOctaves = controls.depth1 * MAX_DEPTH_OCTAVES;
    s.osc2DepthOctaves = controls.depth2 * MAX_DEPTH_OCTAVES;
    r.run(s);

    // COMPARATOR → TWIN PEAK: the pulse (OSC1 triangle against OSC2 triangle) excites the two
    // resonant low-passes, which bend their own peaks (modules/twin-peak.js).
    const pulse = compare(r.osc1.triangle, r.osc2.triangle);
    const twinPeak = this.twinPeak.process(pulse, controls.peak1, controls.peak2);

    out.left = out.right = outputStage(twinPeak);

    // Monitors: the second-pole outputs of the two filters (XY); Rungler CV; register.
    out.monitorX = this.twinPeak.filter1.z * MONITOR_GAIN;
    out.monitorY = this.twinPeak.filter2.z * MONITOR_GAIN;
    out.monitorCV = r.cv * 2 - 1;
    out.register = r.register.pattern;
    out.clock = r.clocked; // for the clock LED (the event map uses filter peaks instead)

    // Events: every local maximum of filter 1, plotted against the next one (a peak-to-peak
    // return map: a regular ping gives a few dots, an irregular one a structured cloud).
    const [beforeLast, last] = this.recent;
    const now = out.monitorX;
    out.event = last > beforeLast && last >= now && last > 0.02;
    out.eventValue = Math.tanh(last);
    this.recent[0] = last; this.recent[1] = now;
  }
}
