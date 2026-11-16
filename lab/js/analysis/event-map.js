// THE RUNGLER, CLOCK BY CLOCK (event map)
//
// Between two clock edges nothing in the Rungler changes except the two phases: the
// register and its CV stay put, so both frequencies are constant. That lets us jump from
// one edge straight to the next in a single step:
//
//   at edge n:   CV(n)  = DAC(register)
//                f1, f2 = the two frequencies set by CV(n)
//   next edge:   OSC2 (CLOCK) needs exactly one cycle, 1 / f2 seconds;
//                in that time OSC1 (DATA) moves on by f1 / f2 cycles:
//                θ(n+1) = θ(n) + f1 / f2   (mod 1)
//                new bit = square(θ(n+1)) XOR last bit  →  register shifts
//
// It is the same Rungler as dsp/modules/rungler.js, computed thousands of clocks per
// millisecond instead of in real time — the event_map of rungler_prototipo.py. It is exact
// while the controls stay still; analogue drift is left out.

import { squareBitAt, transpose } from '../dsp/modules/oscillator.js';
import { quantize } from '../dsp/modules/quantizer.js';

export class EventRungler {
  // settings: as for dsp/modules/rungler.js. theta: OSC1 phase at the last edge (0 … 1).
  // cells: the eight register bits after that edge (cell 1 first).
  constructor(settings, theta, cells) {
    this.settings = settings;
    this.theta = theta;
    this.cells = [...cells];
  }

  get cv() { return (4 * this.cells[5] + 2 * this.cells[6] + this.cells[7]) / 7; }

  get pattern() { return this.cells.reduce((value, bit, index) => value | (bit << index), 0); }

  // Jump to the next clock edge.
  step() {
    const s = this.settings, cv = this.cv;
    let osc1Semitones = s.osc1DepthOctaves * 12 * cv;
    if (s.quantize) osc1Semitones = quantize(osc1Semitones, s.scale);
    const f1 = transpose(s.osc1Hz, osc1Semitones);
    const f2 = transpose(s.osc2Hz, s.osc2DepthOctaves * 12 * cv);

    const advanced = this.theta + f1 / f2;
    this.theta = advanced - Math.floor(advanced);

    const dataBit = squareBitAt(this.theta);
    const newBit = s.xor ? dataBit ^ this.cells[7] : dataBit;
    this.cells.pop();
    this.cells.unshift(newBit);
  }

  copy() { return new EventRungler(this.settings, this.theta, this.cells); }
}

export const cellsFromPattern = pattern => Array.from({ length: 8 }, (_, i) => (pattern >> i) & 1);
