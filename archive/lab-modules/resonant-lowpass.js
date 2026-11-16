// RESONANT LOW-PASS FILTER (two poles, state-variable)
//
//   input ──▶ [ low-pass with a resonant peak at the cutoff ] ──▶ low-pass output
//                                                             └──▶ band-pass output
//
//   resonance 0      no peak
//   resonance 1      the peak rings for ever (on the edge of whistling)
//   resonance > 1    the filter whistles by itself: self-oscillation
//
// The two internal "capacitors" (state1, state2) are solved together with the feedback in
// the same sample ("zero-delay feedback", the topology-preserving form described by
// Zavalishin and Simper), so the filter stays stable and in tune up to high cutoffs.
//
// A real filter cannot ring louder and louder: its amplifiers saturate. Here a soft
// saturation on the band-pass capacitor plays that role, so self-oscillation settles at a
// steady level. It is part of the model of the filter, not a safety limiter.

const saturate = x => 2 * Math.tanh(x / 2); // gentle: almost linear below ±1, never beyond ±2

export class ResonantLowpass {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.reset();
  }

  reset() {
    this.state1 = 0;  // band-pass capacitor
    this.state2 = 0;  // low-pass capacitor
    this.low = 0;
    this.band = 0;
  }

  process(input, cutoffHz, resonance) {
    // Numerical guard: keep the cutoff between 10 Hz and 0.45 × sample rate.
    const cutoff = Math.min(0.45 * this.sampleRate, Math.max(10, cutoffHz));
    const g = Math.tan(Math.PI * cutoff / this.sampleRate); // how fast the capacitors charge
    const damping = 2 * (1 - resonance);                    // 2 = no peak, 0 = endless ringing

    // Solve the loop for this sample.
    const band = (this.state1 + g * (input - this.state2)) / (1 + g * (g + damping));
    const low = this.state2 + g * band;

    // Update the capacitors for the next sample.
    this.state1 = saturate(2 * band - this.state1);
    this.state2 = 2 * low - this.state2;

    this.band = band;
    this.low = low;
    return low;
  }
}
