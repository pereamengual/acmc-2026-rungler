// PERIOD DETECTOR — does the register repeat itself?
//
//   register pattern at each clock ──▶ [ shortest exact repetition ] ──▶ period (in clocks) or none
//
// We keep one register pattern per clock. The period is the shortest p for which the most
// recent patterns repeat exactly every p clocks, at least three times over (and over at least
// 24 clocks, so that a short coincidence is not taken for a cycle).
//
// What it says: only that the sequence of bits repeats. The oscillators' phases are part of
// the state too, so a repeating register is a strong hint of a periodic orbit, not a proof.

export const MAX_PERIOD = 128;
const REPEATS = 3;
const MIN_SPAN = 24;

export function findPeriod(patterns, maxPeriod = MAX_PERIOD) {
  const n = patterns.length;
  for (let period = 1; period <= maxPeriod; period++) {
    const span = Math.max(MIN_SPAN, REPEATS * period);
    if (span > n) break;
    let repeats = true;
    for (let i = n - span + period; i < n; i++) {
      if (patterns[i] !== patterns[i - period]) { repeats = false; break; }
    }
    if (repeats) return period;
  }
  return null;
}
