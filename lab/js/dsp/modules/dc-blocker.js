// DC BLOCKER
//
// A very low high-pass filter (about 4 Hz at 48 kHz): it removes any constant offset from
// the output, so speakers and headphones only receive movement, not a steady push.
//
//   input ──▶ [ high-pass ] ──▶ output
//
// Its cutoff is kept far below hearing on purpose. A higher cutoff (it used to be about
// 35 Hz) makes the flat parts of a pulse sag visibly towards zero on the oscilloscope,
// as a square wave does through a coupling capacitor.

const KEEP = 0.9995; // how much of the previous output is kept each sample: cutoff ≈ (1 − KEEP) · fs / 2π

export class DCBlocker {
  constructor() { this.reset(); }

  process(input) {
    const output = input - this.previousInput + KEEP * this.previousOutput;
    this.previousInput = input;
    this.previousOutput = output;
    return output;
  }

  reset() { this.previousInput = 0; this.previousOutput = 0; }
}
