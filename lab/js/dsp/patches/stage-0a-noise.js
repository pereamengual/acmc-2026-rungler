// STAGE 0A — CONTINUOUS NOISE
//
//   ┌───────┐ ──────────────────────────────────────▶ out   Listen 0: the noise source itself
//   │       │   ┌──────────────────────┐
//   │       │ ─▶│ LOW-PASS (audio)     │────────────▶ out   Listen 1: filtered noise
//   │ NOISE │   │ cutoff = bandwidth×100│
//   │       │   └──────────────────────┘
//   │       │   ┌──────────────┐  CV   ┌───────────┐
//   └───────┘ ─▶│ LOW-PASS     │──────▶│ SINE      │──▶ out   Listen 2: noise → voice pitch
//               │ (bandwidth)  │ pitch │ VOICE     │
//               └──────────────┘       └───────────┘
//
// The three Listen choices follow the lesson: first the raw material (noise), then what a
// filter does to it, then the filtered noise used as a control voltage instead of a sound.
//
// The pitch wanders smoothly and never repeats. There is no clock and no register:
// nothing is stored except the filter's own smoothing.
//
// Why two filters: the bandwidth (0.05 … 30 Hz) is far below hearing, so the filtered noise
// that drives the pitch is a control voltage, not a sound. Listen 1 sends the same noise
// through a second, audio-rate filter whose cutoff is the bandwidth × 100 (5 Hz … 3 kHz), so
// you can hear what "less bandwidth" means: a darker, slower noise. The bandwidth knob then
// shows the real cutoff (see `display` in core/parameters.js).
//
// Controls: bandwidth (Hz), depth (Pitch CV amount, octaves), center (Hz),
//           listen (0 noise source, 1 filtered noise, 2 noise → voice pitch)
//
// For the entropy indicator, which needs one value per "event", the CV sent to the voice
// (after Pitch CV amount) is read 32 times per cycle of its bandwidth (there is no clock
// here to give events); the indicator then compares every 16th value, i.e. values half a
// bandwidth cycle apart.

import { NoiseSource } from '../modules/noise.js';
import { OnePoleLowpass } from '../modules/lowpass.js';
import { Oscillator, transpose } from '../modules/oscillator.js';
import { MAX_AMOUNT_OCTAVES } from './stage-0b-sample-hold.js';

export const AUDIO_CUTOFF_FACTOR = 100;
export const CV_DELAY_SECONDS = 0.025; // XY delay for the slow control voltage (Listen 2)

// XY MONITOR: a delay map — each value against the same signal a moment earlier.
//   Listen 0 and 1 (audio): the value one sample earlier.
//   Listen 2 (control voltage, much slower): the value 25 ms earlier. Here, as in the CV
//   history, what is shown is the CV that reaches the oscillator — after the Pitch CV amount
//   knob — on a fixed scale: ±1 = ±3 octaves. At amount 0 it is a dot: nothing moves the pitch.
// Unrelated values fill a square; a signal with memory (each value close to the previous
// one) gathers along the diagonal. The filter gives the noise a short, fading memory: each
// output is a weighted average of the recent past, which it gradually forgets.

export class NoiseStage {
  constructor(sampleRate, seed) {
    this.noise = new NoiseSource(seed);
    this.lowpass = new OnePoleLowpass(sampleRate);       // makes the pitch CV
    this.audioLowpass = new OnePoleLowpass(sampleRate);  // makes the audible filtered noise
    this.voice = new Oscillator(sampleRate);
    this.previousSample = 0;
    this.cvHistory = new Float32Array(Math.round(CV_DELAY_SECONDS * sampleRate));
    this.cvWrite = 0;
    this.analysisTimer = new Oscillator(sampleRate);
  }

  render(controls, out) {
    // NOISE → LOW-PASS → CV (about −1 … +1)
    const filtered = this.lowpass.process(this.noise.gaussian(), controls.bandwidth);
    const cv = filtered * this.lowpass.noiseLevelCompensation * 0.35;

    // CV × amount → pitch of the sine voice (in octaves)
    const pitchOctaves = controls.depth * cv;
    this.voice.run(transpose(controls.center, 12 * pitchOctaves));
    const sent = pitchOctaves / MAX_AMOUNT_OCTAVES; // the CV the oscillator receives, ±1 = ±3 octaves

    // NOISE → LOW-PASS (audio): same loudness at every cutoff, thanks to the compensation
    const white = this.noise.white();
    const audible = this.audioLowpass.process(white, controls.bandwidth * AUDIO_CUTOFF_FACTOR)
      * this.audioLowpass.noiseLevelCompensation;

    if (controls.listen === 0) out.left = out.right = white * 0.12;
    else if (controls.listen === 1) out.left = out.right = audible * 0.12;
    else out.left = out.right = this.voice.sine * 0.35;

    // Monitors: the delay map of the signal you are listening to (see XY MONITOR above).
    const cvEarlier = this.cvHistory[this.cvWrite];
    this.cvHistory[this.cvWrite] = sent;
    this.cvWrite = (this.cvWrite + 1) % this.cvHistory.length;
    const heard = controls.listen === 0 ? white : audible;
    if (controls.listen === 2) { out.monitorX = sent; out.monitorY = cvEarlier; }
    else { out.monitorX = heard; out.monitorY = this.previousSample; }
    this.previousSample = heard;
    out.monitorCV = sent;
    this.analysisTimer.run(32 * controls.bandwidth);
    out.analysis = this.analysisTimer.wrapped;
    out.analysisValue = sent; // what the voice receives: at amount 0 it is steady, and reads as regular
  }
}
