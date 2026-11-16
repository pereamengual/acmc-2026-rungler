// NOISE SOURCE
//
// A digital stand-in for an analogue noise generator. It is deterministic: the same seed
// always gives the same sequence, so every participant can hear the "same" randomness and
// tests can repeat a run exactly. (Algorithm: xorshift32, a tiny pseudo-random generator.)
//
//   white()     uniform noise between −1 and +1
//   gaussian()  bell-shaped noise, average 0, standard deviation 1 (most values within ±3)

export class NoiseSource {
  constructor(seed = 1) {
    this.state = (seed >>> 0) || 1;
  }

  // One raw random number between 0 and 1.
  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }

  white() {
    return this.next() * 2 - 1;
  }

  gaussian() {
    // Adding four uniform values gives a bell shape; the factor sets the spread to 1.
    const sum = this.next() + this.next() + this.next() + this.next();
    return (sum - 2) * Math.sqrt(3);
  }
}
