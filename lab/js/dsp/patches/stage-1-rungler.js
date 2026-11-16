// STAGE 1 — THE CORE RUNGLER, IN THREE STEPS
//
// The chain of stage 0b stays: source → memory → quantizer → sine voice. Only the source and
// the memory change, and then one new thing at a time:
//
//   STEP 1 · REGISTER   OSC1 (DATA) square ──▶ 8-bit register ──▶ 3-bit DAC ──▶ QUANTIZER ──▶ VOICE
//                       OSC2 (CLOCK) ──────────────▲ clock
//                       (in 0b: noise ──▶ sample & hold ──▶ quantizer ──▶ voice)
//
//   STEP 2 · LOOP       + XOR: the register re-reads its own last bit, so patterns can repeat
//
//   STEP 3 · FEEDBACK   + the Rungler CV moves OSC1 and OSC2 (Rungler → OSC1 / OSC2), and the
//                       loop is closed. You still listen to the same voice.
//
// Controls: step (0, 1, 2), osc1, osc2 (Hz), range (Pitch CV amount, octaves), center (Hz),
//           quantize, scale, xor, depth1, depth2 (0 … 1 = 0 … 4 octaves)

import { NoiseSource } from '../modules/noise.js';
import { Rungler } from '../modules/rungler.js';
import { Oscillator, transpose } from '../modules/oscillator.js';
import { quantize, SCALES, SCALE_CHOICES } from '../modules/quantizer.js';
import { MAX_AMOUNT_OCTAVES } from './stage-0b-sample-hold.js';

export const MAX_DEPTH_OCTAVES = 4;
const LOOP = 1, FEEDBACK = 2; // step indices

// Panel controls → Rungler settings, step by step. Shared by stages 1 and 2 and by the chaos
// indicators, so they all read the knobs the same way. Stage 2 has no step and no XOR switch:
// the full Rungler, with the XOR always on.
export function runglerSettings(controls, settings = {}) {
  const step = controls.step ?? FEEDBACK;
  const feedback = step >= FEEDBACK;
  settings.osc1Hz = controls.osc1;
  settings.osc2Hz = controls.osc2;
  settings.xor = step >= LOOP ? (controls.xor ?? 1) : 0;
  settings.osc1DepthOctaves = feedback ? controls.depth1 * MAX_DEPTH_OCTAVES : 0;
  settings.osc2DepthOctaves = feedback ? controls.depth2 * MAX_DEPTH_OCTAVES : 0;
  settings.driftCents = 0;          // no analogue drift in the workshop (modules/drift.js can add it)
  settings.quantize = 0;            // the quantizer acts on the voice, not inside the loop
  settings.scale = SCALES.major;
  return settings;
}

// Rungler CV (0 … 1) → pitch offset of the voice in semitones, as in 0b: the Pitch CV amount
// (`range`) spreads the eight DAC levels from −amount to +amount octaves around the centre,
// then the quantizer snaps them.
export function voiceSemitones(cv, controls) {
  let semitones = controls.range * 12 * (cv * 2 - 1);
  if (controls.quantize) semitones = quantize(semitones, SCALE_CHOICES[controls.scale]?.degrees ?? SCALES.major);
  return semitones;
}

export class RunglerStage {
  constructor(sampleRate, seed) {
    this.noise = new NoiseSource(seed);           // the register's random power-on state
    this.rungler = new Rungler(sampleRate, this.noise);
    this.voice = new Oscillator(sampleRate);
    this.settings = {};
  }

  render(controls, out) {
    // RUNGLER (what is active depends on the step)
    const r = this.rungler;
    r.run(runglerSettings(controls, this.settings));

    // RUNGLER CV → (QUANTIZER) → pitch of the sine voice
    const semitones = voiceSemitones(r.cv, controls);
    this.voice.run(transpose(controls.center, semitones));

    // What you hear: the voice, in every step
    out.left = out.right = this.voice.sine * 0.35;

    // Monitors
    //   event map: the voice pitch at each clock, against the next (as in 0b)
    //   XY (step 3): OSC1 against OSC2
    // The pitch CV the voice receives, on the fixed scale of 0a and 0b: ±1 = ±3 octaves.
    const pitch = Math.max(-1, Math.min(1, semitones / (MAX_AMOUNT_OCTAVES * 12)));
    out.monitorX = r.osc1.triangle;
    out.monitorY = r.osc2.triangle;
    out.monitorCV = pitch;
    out.event = out.clock = r.clocked;
    out.eventValue = pitch * 0.5 + 0.5;
    out.analysis = r.clocked;           // the Rungler state for the chaos indicators
    out.analysisValue = r.dataPhase;
    out.register = r.register.pattern;
  }
}
