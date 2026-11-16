// STAGE 0B — CLOCKED SAMPLE & HOLD
//
//   ┌───────┐   ┌───────┐   ┌─────────────┐  pitch  ┌───────────┐
//   │ NOISE │──▶│  S&H  │──▶│ QUANTIZER   │────────▶│ SINE      │──▶ out
//   └───────┘   └───▲───┘   │ (on / off)  │         │ VOICE     │
//                   │       └─────────────┘         └───────────┘
//               ┌───┴───┐
//               │ CLOCK │
//               └───────┘
//
// Each clock pulse picks a new random value and holds it. Every value is independent of the
// last one: the S&H remembers exactly one value until the next clock, then drops it — a
// memory of one step, but no structure. The quantizer snaps the same
// random values onto a scale, turning them into a "conventional" melody.
//
// Controls: clock (Hz), depth (Pitch CV amount, octaves), center (Hz), quantize (0/1),
//           scale (index)

import { NoiseSource } from '../modules/noise.js';
import { SampleAndHold } from '../modules/sample-and-hold.js';
import { quantize, SCALES, SCALE_CHOICES } from '../modules/quantizer.js';
import { Oscillator, transpose } from '../modules/oscillator.js';

export const MAX_AMOUNT_OCTAVES = 3; // the Pitch CV amount knob at its maximum (stages 0a, 0b, 1)

export class SampleHoldStage {
  constructor(sampleRate, seed) {
    this.noise = new NoiseSource(seed);
    this.clock = new Oscillator(sampleRate);
    this.sampleHold = new SampleAndHold();
    this.voice = new Oscillator(sampleRate);
  }

  render(controls, out) {
    // CLOCK → S&H picks a new noise value on every clock pulse
    this.clock.run(controls.clock);
    out.event = out.clock = this.clock.wrapped;
    if (this.clock.wrapped) this.sampleHold.trigger(this.noise.white());

    // HELD VALUE → pitch offset in semitones → (QUANTIZER) → SINE VOICE
    let semitones = controls.depth * 12 * this.sampleHold.value;
    if (controls.quantize) semitones = quantize(semitones, SCALE_CHOICES[controls.scale]?.degrees ?? SCALES.major);
    this.voice.run(transpose(controls.center, semitones));
    out.left = out.right = this.voice.sine * 0.35;

    // Monitors: the pitch CV the voice receives — after Pitch CV amount and the quantizer — so
    // the scale grid shows in the event map (one dot per clock: this step's pitch against the
    // next). It is measured from the centre pitch on a fixed scale, ±1 = ±3 octaves (the knob's
    // maximum), so the amount knob widens or narrows the picture and the centre pitch does not
    // move it.
    const pitch = Math.max(-1, Math.min(1, semitones / (MAX_AMOUNT_OCTAVES * 12)));
    out.monitorX = out.monitorY = 0;
    out.monitorCV = pitch;
    out.eventValue = pitch * 0.5 + 0.5;
  }
}
