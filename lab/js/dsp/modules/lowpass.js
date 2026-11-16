// ONE-POLE LOW-PASS FILTER (6 dB per octave)
//
// The digital equivalent of a single resistor and capacitor. Each sample the output moves
// a fraction of the way towards the input: a low cutoff means a small fraction, so the
// output changes slowly (a smooth, wandering line); a high cutoff lets it follow quickly.
//
//   input ──▶ [ RC ] ──▶ output
//
// This is a system with memory: its output depends on past inputs, not only on the present
// one. The memory fades — each past input counts a little less every sample ("memory" below
// is that per-sample factor) — so the filter blends the recent past rather than storing it.

export class OnePoleLowpass {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.output = 0;
    this.memory = 0; // how much of the previous output is kept each sample (0 … 1)
  }

  process(input, cutoffHz) {
    this.memory = Math.exp(-2 * Math.PI * cutoffHz / this.sampleRate);
    this.output = this.output + (1 - this.memory) * (input - this.output);
    return this.output;
  }

  // Filtering noise makes it quieter. This factor restores the original loudness
  // (for white noise in: variance out = variance in × (1 − memory) / (1 + memory)).
  get noiseLevelCompensation() {
    return Math.sqrt((1 + this.memory) / (1 - this.memory));
  }

  reset() {
    this.output = 0;
  }
}
