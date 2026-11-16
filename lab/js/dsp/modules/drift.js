// ANALOGUE DRIFT
//
// Real oscillators are never perfectly stable: temperature and component noise make their
// pitch wander slightly. This module produces that wandering as a slow random walk, in cents
// (1/100 of a semitone). `amountCents` is the typical size of the deviation.
//
//   noise ──▶ [ very slow low-pass ] ──▶ pitch deviation (cents)

export class AnalogueDrift {
  constructor(sampleRate, noise, secondsToWander = 1.5) {
    this.noise = noise;
    this.memory = Math.exp(-1 / (secondsToWander * sampleRate));
    this.scale = Math.sqrt(1 - this.memory * this.memory); // keeps the deviation at amountCents
    this.cents = 0;
  }

  run(amountCents) {
    if (amountCents <= 0) { this.cents = 0; return 0; }
    this.cents = this.cents * this.memory + this.noise.gaussian() * this.scale * amountCents;
    return this.cents;
  }

  reset() { this.cents = 0; }
}
