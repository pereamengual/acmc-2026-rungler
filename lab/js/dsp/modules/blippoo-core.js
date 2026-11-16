// THE CHAOTIC CORE OF THE BLIPPOO BOX (two oscillators, two Runglers, comparator, S&H)
//
//   OSC A square ──▶ clock ─┐
//   OSC B square ──▶ data  ─┴─▶ RUNGLER A ──▶ CV A ──▶ rate of OSC A  (Rungler A → Rate A)
//
//   OSC B square ──▶ clock ─┐
//   OSC A square ──▶ data  ─┴─▶ RUNGLER B ──▶ CV B ──▶ rate of OSC B  (Rungler B → Rate B)
//
//   OSC A triangle ─┐
//   OSC B triangle ─┴─▶ COMPARATOR ──▶ pulse ──▶ (to the Twin Peak, in the stage patch)
//                                        │ rising edge
//   CV A + CV B    (R Mix) ─┐            ▼
//   OSC B triangle (Tri B) ─┴─ switch ─▶ S&H ──▶ S&H CV ──▶ rates of OSC A and OSC B
//
// Each Rungler is the Rungler of stages 1–3 (8-bit register, XOR of the new bit with cell 8,
// cells 6–8 to the DAC) with two differences, as in the Blippoo Box:
//   · the roles are crossed: Rungler A is clocked by OSC A and reads the square of OSC B;
//     Rungler B is clocked by OSC B and reads the square of OSC A. Each oscillator is the
//     CLOCK of one Rungler and the DATA of the other;
//   · the DAC weighs the three cells 1–2–1: five levels around 0 V, the middle ones favoured
//     (modules/dac.js, CentredDAC).
// Each Rungler CV moves the rate of the oscillator that clocks it (its own clock).
//
// The comparator (OSC A triangle above OSC B triangle) gives the pulse. At each rising edge
// the sample & hold takes a snapshot of its source: the sum of the two Rungler CVs (R Mix,
// nine levels) or the triangle of OSC B (Tri B). The held value moves both rates.
//
// Each sample, in this order:
//   1. CONTROL   the two Rungler CVs and the S&H value set both rates;
//   2. AUDIO     both oscillators run one sample;
//   3. CLOCKS    if OSC A wrapped, Rungler A shifts in a new bit; if OSC B wrapped, Rungler B;
//   4. PULSE     the comparator; on its rising edge, the S&H samples its source.
//
// This is a functional model of the block diagram, not an emulation of the circuit.

import { Oscillator, squareBitAt } from './oscillator.js';
import { ShiftRegister } from './shift-register.js';
import { CentredDAC } from './dac.js';
import { SampleAndHold } from './sample-and-hold.js';
import { compare } from './comparator.js';

export const RATE_OCTAVES = 2; // a modulation amount of 1 moves a rate by up to ±2 octaves

export const R_MIX = 0, TRI_B = 1; // S&H source switch

// One Rungler of the box: its own register and DAC; clock and data come from outside.
class CrossedRungler {
  constructor(noise) {
    this.noise = noise;
    this.register = new ShiftRegister(8);
    this.dac = new CentredDAC();
    this.reset();
  }

  reset() {
    // Like real hardware, the register wakes up with random bits.
    for (let cell = 0; cell < 8; cell++) this.register.cells[cell] = this.noise.next() < 0.5 ? 1 : 0;
    this.cv = this.dac.convert(this.register); // −1 … +1
  }

  clock(dataBit) {
    this.register.clock(dataBit ^ this.register.lastBit); // XOR with cell 8
    this.cv = this.dac.convert(this.register);
  }

  get level() { return this.dac.level(this.register); } // 0 … 4
}

export class BlippooCore {
  constructor(sampleRate, noise) {
    this.oscA = new Oscillator(sampleRate);
    this.oscB = new Oscillator(sampleRate);
    this.runglerA = new CrossedRungler(noise);
    this.runglerB = new CrossedRungler(noise);
    this.sampleHold = new SampleAndHold();
    this.reset();
  }

  reset() {
    this.oscA.reset(); this.oscB.reset();
    this.runglerA.reset(); this.runglerB.reset();
    this.sampleHold.reset();
    this.pulse = -1;
    this.clockedA = false; this.clockedB = false; // true on the sample of a clock edge
    this.sampled = false;                         // true on the sample of an S&H trigger
  }

  get sh() { return this.sampleHold.value; } // −1 … +1

  // settings: { rateA, rateB (Hz), runglerToRateA, runglerToRateB, shToRateA, shToRateB (0 … 1),
  //             shSource (R_MIX or TRI_B) }
  run(s) {
    const a = this.runglerA, b = this.runglerB;

    // 1. CONTROL — exponential, like 1 V/oct: the CVs are bipolar, so they bend each rate
    //    up and down around its knob.
    const rateA = s.rateA * 2 ** (RATE_OCTAVES * (s.runglerToRateA * a.cv + s.shToRateA * this.sh));
    const rateB = s.rateB * 2 ** (RATE_OCTAVES * (s.runglerToRateB * b.cv + s.shToRateB * this.sh));

    // 2. AUDIO
    this.oscA.run(rateA);
    this.oscB.run(rateB);

    // 3. CLOCKS — each Rungler on the rising edge of its own oscillator, reading the other
    //    oscillator's square where it was at that instant (sub-sample timing).
    this.clockedA = this.oscA.wrapped;
    this.clockedB = this.oscB.wrapped;
    if (this.clockedA) a.clock(squareBitAt(this.oscB.phaseAgo(this.oscA.samplesSinceWrap)));
    if (this.clockedB) b.clock(squareBitAt(this.oscA.phaseAgo(this.oscB.samplesSinceWrap)));

    // 4. PULSE — the comparator; its rising edge triggers the S&H.
    const pulse = compare(this.oscA.triangle, this.oscB.triangle);
    this.sampled = pulse > this.pulse;
    this.pulse = pulse;
    if (this.sampled) {
      const source = s.shSource === TRI_B ? this.oscB.triangle : (a.cv + b.cv) / 2;
      this.sampleHold.trigger(source);
    }
  }
}
