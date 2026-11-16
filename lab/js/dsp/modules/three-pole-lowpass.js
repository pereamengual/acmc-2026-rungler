// RESONANT LOW-PASS FILTER, THREE POLES (18 dB/octave) — one half of the Twin Peak
//
//          ┌──────────────── resonance (feedback, inverted) ◀───────────────┐
//          ▼                                                                │
//   input ─(−)─▶ [ pole 1 ] ──▶ [ pole 2 ] ──┬──▶ [ pole 3 ] ──┬──▶ low-pass output
//                                            │                 │
//                                            └─▶ "z" output    └──────────────┘
//                                                (120° behind the input at the peak)
//
// As in the Blippoo Box (Hordijk, Leonardo Music Journal 19, 2009, p. 39 and p. 42): each
// half of the Twin Peak is a highly resonant 3-pole low-pass. At the resonant frequency each
// pole shifts the phase by 60°, so the three together make 180°, and the inverted feedback
// closes the loop in phase. Each pole then passes half of the signal (1/2 × 1/2 × 1/2 = 1/8),
// so the loop needs a gain of 8 to ring for ever:
//
//   resonance 0     no peak
//   resonance 0.9   a strong peak that rings for a while and dies away: a "ping"
//   resonance 1     the edge of oscillation (the Blippoo keeps it just below this)
//
// The peak sits at √3 × the pole frequency (where each pole shifts 60°), so the knob you
// turn is the frequency of the peak itself.
//
// The output of the second pole is also given out ("z"): Hordijk feeds it back to the
// cutoff to bend the time axis of the ringing, which adds odd AND even harmonics without
// changing the level much (all-harmonic distortion; see patches/stage-3-twin-peak.js).
//
// The poles are solved together with the feedback in the same sample (zero-delay feedback,
// the topology-preserving form described by Zavalishin), so the filter stays in tune up to
// high peaks. A soft saturation at the input of the loop plays the role of the amplifiers:
// a loud input cannot make the filter ring without limit.

const SQRT3 = Math.sqrt(3);
const FULL_LOOP = 8; // loop gain at which a 3-pole filter starts to oscillate
const saturate = x => 2 * Math.tanh(x / 2); // almost linear below ±1, never beyond ±2

export class ThreePoleLowpass {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.reset();
  }

  reset() {
    this.pole1 = 0; this.pole2 = 0; this.pole3 = 0; // the three "capacitors"
    this.z = 0;    // output of pole 2
    this.low = 0;  // output of pole 3 (the low-pass output)
  }

  process(input, peakHz, resonance) {
    // Numerical guard: the poles stay between 6 Hz and 0.4 × sample rate.
    const poleHz = Math.min(0.4 * this.sampleRate, Math.max(6, peakHz / SQRT3));
    const g = Math.tan(Math.PI * poleHz / this.sampleRate);
    const G = g / (1 + g);                    // how much of the input each pole passes now
    const k = FULL_LOOP * resonance;

    // Solve the loop for this sample: what the three poles will give, before the new input.
    const s1 = this.pole1 / (1 + g), s2 = this.pole2 / (1 + g), s3 = this.pole3 / (1 + g);
    const memory = G * G * s1 + G * s2 + s3;
    const loopInput = saturate((input - k * memory) / (1 + k * G * G * G));

    // Pole 1, pole 2, pole 3 in series (each: v = G·(in − state), out = v + state).
    const v1 = G * (loopInput - this.pole1), y1 = v1 + this.pole1; this.pole1 = y1 + v1;
    const v2 = G * (y1 - this.pole2),        y2 = v2 + this.pole2; this.pole2 = y2 + v2;
    const v3 = G * (y2 - this.pole3),        y3 = v3 + this.pole3; this.pole3 = y3 + v3;

    this.z = y2;
    this.low = y3;
    return y3;
  }
}
