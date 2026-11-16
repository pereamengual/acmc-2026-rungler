// THE RUNGLER (two oscillators + shift register + 3-bit DAC, in a loop)
//
//                 ┌──────────────────── pitch modulation ◀──────────────────────┐
//                 ▼                                                             │
//   ┌─────────────────┐  square (data)   ┌─────┐   ┌────────────────┐   ┌──────┴────┐
//   │  OSC1  (DATA)   │─────────────────▶│ XOR │──▶│ 8-bit register │──▶│ 3-bit DAC │──▶ Rungler CV
//   └─────────────────┘                  └──▲──┘   └───────▲────────┘   └───────────┘
//   ┌─────────────────┐                     │ last bit      │ clock (rising edge)
//   │  OSC2  (CLOCK)  │──────────────────────┼───────────────┘
//   └─────────────────┘                     └── from cell 8
//                 ▲
//                 └──────────────────── pitch modulation ◀── Rungler CV
//
// Each sample, in this order:
//   1. CONTROL  the Rungler CV (from the last clock edge) bends both pitches;
//   2. AUDIO    both oscillators run one sample;
//   3. CLOCK    if OSC2 has just wrapped, the register shifts in a new bit and the DAC
//               produces a new CV;
//   4. RETUNE   the new CV applies from the edge itself: the part of this sample that came
//               after the edge is redone at the new frequencies (sub-sample timing).
//
// With steady knobs and no drift this gives the same clock-by-clock sequence as the event
// map (lab/js/analysis/event-map.js and rungler_prototipo.py).
//
// This is a functional model of the block diagram, not an emulation of the circuit.

import { Oscillator, squareBitAt, transpose } from './oscillator.js';
import { ShiftRegister } from './shift-register.js';
import { ThreeBitDAC } from './dac.js';
import { AnalogueDrift } from './drift.js';
import { quantize } from './quantizer.js';

export class Rungler {
  constructor(sampleRate, noise) {
    this.noise = noise;
    this.osc1 = new Oscillator(sampleRate);   // DATA
    this.osc2 = new Oscillator(sampleRate);   // CLOCK
    this.register = new ShiftRegister(8);
    this.dac = new ThreeBitDAC();
    this.drift1 = new AnalogueDrift(sampleRate, noise);
    this.drift2 = new AnalogueDrift(sampleRate, noise);
    this.reset();
  }

  reset() {
    this.osc1.reset(); this.osc2.reset(); this.register.reset();
    // Like real hardware, the register wakes up with random bits (an all-zero register
    // with XOR on would stay at zero for ever).
    for (let cell = 0; cell < 8; cell++) this.register.cells[cell] = this.noise.next() < 0.5 ? 1 : 0;
    this.drift1.reset(); this.drift2.reset();
    this.cv = this.dac.convert(this.register); // Rungler CV, 0 … 1
    this.clocked = false;   // true on the sample of a clock edge
    this.dataPhase = 0;     // where OSC1 was at the last clock edge (0 … 1)
  }

  // settings: { osc1Hz, osc2Hz, osc1DepthOctaves, osc2DepthOctaves, xor,
  //             quantize, scale, driftCents }
  // The two pitches for a given Rungler CV (exponential, like 1 V/oct), plus drift in cents.
  frequencies(settings, cv, osc1Cents, osc2Cents) {
    let osc1Semitones = settings.osc1DepthOctaves * 12 * cv;
    if (settings.quantize) osc1Semitones = quantize(osc1Semitones, settings.scale);
    const osc2Semitones = settings.osc2DepthOctaves * 12 * cv;
    this.f1 = transpose(settings.osc1Hz, osc1Semitones + osc1Cents / 100);
    this.f2 = transpose(settings.osc2Hz, osc2Semitones + osc2Cents / 100);
  }

  run(settings) {
    // 1. CONTROL — the Rungler CV sets both pitches.
    const osc1Cents = this.drift1.run(settings.driftCents);
    const osc2Cents = this.drift2.run(settings.driftCents);
    this.frequencies(settings, this.cv, osc1Cents, osc2Cents);

    // 2. AUDIO — run both oscillators.
    this.osc1.run(this.f1);
    this.osc2.run(this.f2);

    // 3. CLOCK — on the rising edge of OSC2, shift a new bit into the register.
    this.clocked = this.osc2.wrapped;
    if (this.clocked) {
      // The edge happened a fraction of a sample ago: read OSC1 where it was at that
      // instant, not where it is now (sub-sample timing, avoids clock jitter).
      this.dataPhase = this.osc1.phaseAgo(this.osc2.samplesSinceWrap);
      const dataBit = squareBitAt(this.dataPhase);
      const newBit = settings.xor ? dataBit ^ this.register.lastBit : dataBit;
      this.register.clock(newBit);
      this.cv = this.dac.convert(this.register);

      // 4. RETUNE — since the edge, both oscillators should already run at the new pitch.
      const sinceEdge = this.osc2.samplesSinceWrap, oldStep1 = this.osc1.step;
      this.frequencies(settings, this.cv, osc1Cents, osc2Cents);
      this.osc1.retune(this.f1, sinceEdge, oldStep1);
      this.osc2.restartAt(this.f2, sinceEdge);
    }
  }
}
