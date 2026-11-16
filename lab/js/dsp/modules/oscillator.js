// OSCILLATOR
//
// The core of every oscillator here is a "phase" that ramps from 0 to 1 and jumps back
// to 0 (a sawtooth core). All waveforms are read from that ramp:
//
//   phase     0 ──────────▶ 1 │ 0 ──────────▶ 1 │ …     (wraps once per cycle)
//   triangle  −1 ↗ +1 ↘ −1
//   square    1 for the first half of the cycle, 0 for the second half (a logic bit)
//   sine      a pure tone
//
// `wrapped` is true on the sample where the ramp jumps back: that is the oscillator's
// rising edge, and it is what clocks the shift register.

export class Oscillator {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.reset();
  }

  reset() {
    this.phase = 0;
    this.step = 0;        // how far the phase moves per sample (frequency / sample rate)
    this.wrapped = false;
  }

  run(frequencyHz) {
    // Safety guard: never move more than 0.45 of a cycle per sample (just under Nyquist).
    this.step = Math.min(0.45, Math.max(0, frequencyHz / this.sampleRate));
    this.phase += this.step;
    this.wrapped = this.phase >= 1;
    if (this.wrapped) this.phase -= Math.floor(this.phase);
  }

  get triangle() { return triangleAt(this.phase); }
  get squareBit() { return squareBitAt(this.phase); }
  get sine() { return Math.sin(2 * Math.PI * this.phase); }

  // How long ago, in samples (with fractions), the last wrap happened.
  // Only meaningful on the sample where `wrapped` is true.
  get samplesSinceWrap() {
    return this.step > 0 ? this.phase / this.step : 0;
  }

  // The frequency changed `samples` ago (a fraction of this sample): redo that stretch
  // at the new frequency. oldStep is the step the oscillator actually used.
  retune(frequencyHz, samples, oldStep) {
    const newStep = Math.min(0.45, Math.max(0, frequencyHz / this.sampleRate));
    const corrected = this.phase + (newStep - oldStep) * samples;
    this.phase = corrected - Math.floor(corrected);
    this.step = newStep;
  }

  // The cycle restarted `samples` ago (at a wrap) and runs at a new frequency since then.
  restartAt(frequencyHz, samples) {
    this.step = Math.min(0.45, Math.max(0, frequencyHz / this.sampleRate));
    this.phase = this.step * samples;
  }

  // Where the phase was a number of samples ago.
  phaseAgo(samples) {
    const earlier = this.phase - this.step * samples;
    return earlier - Math.floor(earlier);
  }
}

export const triangleAt = phase => 1 - 4 * Math.abs(phase - 0.5);
export const squareBitAt = phase => (phase < 0.5 ? 1 : 0);

// Exponential frequency control (like 1 V/octave): every +12 semitones doubles the frequency.
export const transpose = (frequencyHz, semitones) => frequencyHz * 2 ** (semitones / 12);
