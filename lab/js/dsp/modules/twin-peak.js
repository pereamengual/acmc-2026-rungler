// TWIN PEAK RESONATOR (as in the Blippoo Box) — shared by stages 3 and 4
//
//               ┌─▶ 3-POLE LOW-PASS 1 (peak 1) ── low 1 ──(+)──┐
//   pulse ─▶ × ─┤                                              ├─▶ low 1 − low 2
//     exciter   └─▶ 3-POLE LOW-PASS 2 (peak 2) ── low 2 ──(−)──┘
//     level
//
// Two parallel, highly resonant 3-pole low-pass filters; the second is subtracted from the
// first, leaving the band between the two peaks (Hordijk, Leonardo Music Journal 19, 2009).
// Each filter bends its own cutoff with the output of its second pole: this gives the ping
// its odd and even harmonics ("all-harmonic distortion"; see modules/three-pole-lowpass.js).
//
// As in the box, three things are fixed, not knobs. The values were chosen by ear in the
// workshop, to sound closest to a Blippoo Box:

import { ThreePoleLowpass } from './three-pole-lowpass.js';

export const RESONANCE = 0.91;        // just below oscillation (1): each pulse edge rings and dies away
export const SELF_MOD_OCTAVES = 8;    // the second pole's output × 8 octaves, fed back to the cutoff
export const EXCITER_LEVEL = 0.04;    // a soft pulse: the filters ring cleanly, the self-modulation bends them

// Output stage: the pings are quiet and sparse, so they are raised to the level of the other
// stages; a soft saturation keeps the loudest settings (fast oscillators) below 0.5.
const OUTPUT_GAIN = 26;
const OUTPUT_CEILING = 0.5;
export const outputStage = x => OUTPUT_CEILING * Math.tanh(x * OUTPUT_GAIN / OUTPUT_CEILING);

export class TwinPeak {
  constructor(sampleRate) {
    this.filter1 = new ThreePoleLowpass(sampleRate);
    this.filter2 = new ThreePoleLowpass(sampleRate);
  }

  reset() { this.filter1.reset(); this.filter2.reset(); }

  // pulse: the comparator output (±1). peak1Hz, peak2Hz: the peaks before self-modulation.
  process(pulse, peak1Hz, peak2Hz) {
    const exciter = pulse * EXCITER_LEVEL;
    // Self-modulation: the second pole, one sample ago, negative (Hordijk's figure 9). Like his
    // single resistor it passes the steady part too: while the pulse is high the ping sounds
    // lower, while it is low, higher.
    const peak1 = peak1Hz * 2 ** (-SELF_MOD_OCTAVES * this.filter1.z);
    const peak2 = peak2Hz * 2 ** (-SELF_MOD_OCTAVES * this.filter2.z);
    const low1 = this.filter1.process(exciter, peak1, RESONANCE);
    const low2 = this.filter2.process(exciter, peak2, RESONANCE);
    return low1 - low2;
  }
}
