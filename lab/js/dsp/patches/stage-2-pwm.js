// STAGE 2 — PWM BY COMPARATOR
//
//   ┌──────────┐ OSC1 triangle ──▶ ┌────────────┐
//   │ RUNGLER  │                   │ COMPARATOR │──▶ pulse ──▶ out
//   │ (stage 1)│ OSC2 triangle ──▶ │     >      │
//   └──────────┘                   └────────────┘
//
// One new thing after stage 1: the comparator. The pulse is high while the OSC1 triangle is
// above the OSC2 triangle (as in the Benjolin's PWM output). Its width keeps changing with
// the two waves, so the timbre is "drawn" by the interference between them — and the
// Rungler, still moving both oscillators, keeps redrawing it.
//
// Controls: osc1, osc2, depth1, depth2 (as in stage 1; the XOR is always on). You hear the pulse.

import { NoiseSource } from '../modules/noise.js';
import { Rungler } from '../modules/rungler.js';
import { compare } from '../modules/comparator.js';
import { runglerSettings } from './stage-1-rungler.js';

export class PwmStage {
  constructor(sampleRate, seed) {
    this.noise = new NoiseSource(seed);
    this.rungler = new Rungler(sampleRate, this.noise);
    this.settings = {};
  }

  render(controls, out) {
    const r = this.rungler;
    r.run(runglerSettings(controls, this.settings));

    // COMPARATOR: OSC1 triangle against OSC2 triangle
    const pulse = compare(r.osc1.triangle, r.osc2.triangle);
    out.left = out.right = pulse * 0.2;

    // Monitors: OSC1 against OSC2 (XY); OSC1 phase at each clock edge
    out.monitorX = r.osc1.triangle;
    out.monitorY = r.osc2.triangle;
    out.monitorCV = r.cv * 2 - 1;
    out.event = out.clock = r.clocked;
    out.eventValue = r.dataPhase;
    out.register = r.register.pattern;
  }
}
