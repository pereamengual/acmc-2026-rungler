// TWIN DIVERGENCE — how sensitive is the Rungler to a tiny nudge?
//
//   Rungler from the current state ─────────▶ register at clock 1, 2, 3 … ─┐
//                                                                          ├─▶ first clock where they differ
//   twin: same state, OSC1 moved on by ε ───▶ register at clock 1, 2, 3 … ─┘
//
// We take the current state of the Rungler, make a twin whose OSC1 (DATA) phase is moved
// forward by a tiny ε, and count the clocks until their registers hold different bits.
// We repeat this from many points along the way (one trial every few clocks) and report
// the median, so one lucky or unlucky start does not decide the answer.
//
//   short times    a small difference quickly becomes a different bit sequence
//   long times     the two copies keep making the same decisions
//   "not within"   no separation within the limit (for example a periodic, locked orbit)
//
// Why this measure and not a Lyapunov exponent: between clock edges the two copies stay
// exactly ε apart (the motion is a rotation, piecewise isometric). They only separate when,
// at a clock edge, one reads OSC1 on one side of its square-wave edge and the other on the
// other side. The "time to divergence" captures exactly that.
//
// It runs on the event map (event-map.js), so dozens of trials take a few milliseconds.

export const EPSILON = 0.005; // fraction of an OSC1 cycle (1.8 degrees)
export const LIMIT = 1000;    // give up after this many clocks
export const TRIALS = 31;
const CLOCKS_BETWEEN_TRIALS = 16;

function clocksUntilApart(start) {
  const main = start.copy(), twin = start.copy();
  const nudged = twin.theta + EPSILON;
  twin.theta = nudged - Math.floor(nudged);
  for (let clock = 1; clock <= LIMIT; clock++) {
    main.step(); twin.step();
    if (main.pattern !== twin.pattern) return clock;
  }
  return Infinity;
}

// start: an EventRungler at the current state. Returns { median, trials, epsilon, limit }.
export function twinDivergence(start) {
  const walker = start.copy(), results = [];
  for (let trial = 0; trial < TRIALS; trial++) {
    results.push(clocksUntilApart(walker));
    for (let k = 0; k < CLOCKS_BETWEEN_TRIALS; k++) walker.step();
  }
  results.sort((a, b) => a - b);
  return { median: results[Math.floor(results.length / 2)], trials: results.length, epsilon: EPSILON, limit: LIMIT };
}
