// STAGE 4 — THE BLIPPOO BOX, IN THREE STEPS
//
// Stage 3 stays: oscillators → comparator → Twin Peak, with the same fixed resonator. What
// changes is the chaotic core, one new thing at a time:
//
//   STEP 1 · TWO RUNGLERS   each oscillator clocks its own Rungler and gives data to the other:
//                           OSC A ─clock─▶ RUNGLER A ◀─data─ OSC B
//                           OSC B ─clock─▶ RUNGLER B ◀─data─ OSC A
//                           Rungler A → Rate A, Rungler B → Rate B (each Rungler moves its own clock)
//                           Rungler A → Peak 1, Rungler B → Peak 2
//
//   STEP 2 · SAMPLE & HOLD  + the rising edge of the comparator pulse triggers a S&H, which
//                           samples the sum of the Runglers (R Mix) or the triangle of OSC B
//                           (Tri B). S&H → Rate A / Rate B: the "time-warp".
//
//   STEP 3 · SPREAD PEAKS   + the S&H moves the two peaks in opposite directions: one up, the
//                           other down (S&H spreads peaks).
//
//   ┌──────────────────────────┐ pulse ┌────────────────────┐
//   │ CHAOTIC CORE             │──────▶│ TWIN PEAK          │──▶ out
//   │ (modules/blippoo-core.js)│       │ (modules/twin-peak)│
//   └────────────┬─────────────┘       └─────────▲──────────┘
//                └── CV A, CV B, S&H ────────────┘ peak 1, peak 2
//
// The external inputs of the box (FRQ CV IN, AUDIO IN, RES CV IN) and the AUDIO IN <> OSCS
// crossfader are left out: in the browser the resonator always hears the internal pulse.
//
// Controls: step (0, 1, 2), rateA, rateB, peak1, peak2 (Hz), runglerToRateA, runglerToRateB,
//           runglerToPeak1, runglerToPeak2, shSource (0 R Mix, 1 Tri B), shToRateA, shToRateB,
//           spread (0 … 1)

import { NoiseSource } from '../modules/noise.js';
import { BlippooCore } from '../modules/blippoo-core.js';
import { TwinPeak, outputStage } from '../modules/twin-peak.js';

const SAMPLE_HOLD = 1, SPREAD = 2; // step indices
const PEAK_OCTAVES = 2;            // a modulation amount of 1 moves a peak by up to ±2 octaves

// Panel controls → core settings, step by step.
export function coreSettings(controls, settings = {}) {
  const sampleHold = controls.step >= SAMPLE_HOLD;
  settings.rateA = controls.rateA;
  settings.rateB = controls.rateB;
  settings.runglerToRateA = controls.runglerToRateA;
  settings.runglerToRateB = controls.runglerToRateB;
  settings.shToRateA = sampleHold ? controls.shToRateA : 0;
  settings.shToRateB = sampleHold ? controls.shToRateB : 0;
  settings.shSource = controls.shSource;
  return settings;
}

export class BlippooStage {
  constructor(sampleRate, seed) {
    this.noise = new NoiseSource(seed);           // the registers' random power-on state
    this.core = new BlippooCore(sampleRate, this.noise);
    this.twinPeak = new TwinPeak(sampleRate);
    this.settings = {};
  }

  render(controls, out) {
    // CHAOTIC CORE: two oscillators, two Runglers, comparator, S&H.
    const core = this.core;
    core.run(coreSettings(controls, this.settings));
    const cvA = core.runglerA.cv, cvB = core.runglerB.cv;

    // PEAKS: knob × Rungler (A to peak 1, B to peak 2) × S&H spread (opposite directions).
    const spread = controls.step >= SPREAD ? controls.spread * core.sh : 0;
    const peak1 = controls.peak1 * 2 ** (PEAK_OCTAVES * (controls.runglerToPeak1 * cvA + spread));
    const peak2 = controls.peak2 * 2 ** (PEAK_OCTAVES * (controls.runglerToPeak2 * cvB - spread));

    // TWIN PEAK: the comparator pulse excites it (as in stage 3).
    out.left = out.right = outputStage(this.twinPeak.process(core.pulse, peak1, peak2));

    // Monitors
    //   XY: OSC A triangle against OSC B triangle (what the comparator compares)
    //   CV history: Rungler A in step 1; the S&H from step 2 on
    //   event map: Rungler A level at each of its clocks (step 1); the S&H value at each
    //              trigger (steps 2 and 3), as in stage 0b
    //   register: both Runglers
    const sampleHold = controls.step >= SAMPLE_HOLD;
    out.monitorX = core.oscA.triangle;
    out.monitorY = core.oscB.triangle;
    out.monitorCV = sampleHold ? core.sh : cvA;
    out.clock = core.clockedA;            // the clock LEDs of Rate A and Rate B
    out.clockB = core.clockedB;
    out.event = sampleHold ? core.sampled : core.clockedA;
    out.eventValue = sampleHold ? core.sh * 0.5 + 0.5 : core.runglerA.level / 4;
    out.register = core.runglerA.register.pattern;
    out.registerB = core.runglerB.register.pattern;
  }
}
