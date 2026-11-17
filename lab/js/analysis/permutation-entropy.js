// PERMUTATION ENTROPY AND STATISTICAL COMPLEXITY
// (Bandt & Pompe 2002; complexity–entropy plane: Rosso et al. 2007)
//
//   one value per event ──▶ [ order of every 4 consecutive values ] ──▶ histogram of 24 orders
//                                                                            │
//                                       entropy H (0 … 1) ◀──────────────────┤
//                                       complexity C (0 … ~0.5) ◀────────────┘
//
// We ignore the values themselves and keep only their ORDER. Four values can come in
// 24 orders (for example "low, high, middle, highest").
//
//   H (entropy)     0 = always the same order (regular)   1 = every order equally often (noise-like)
//   C (complexity)  0 for perfect regularity AND for pure noise; higher when the orders are
//                   irregular but far from equally likely: structure without repetition.
//
// On the H–C plane noise sits bottom right, regular motion bottom left, and signals that are
// structured but not periodic sit higher up in between. Deterministic chaos tends to land
// there, but so can other irregular signals: a hint, never a proof of chaos.

export const ORDER = 4;
const PATTERNS = 24; // 4! orders
export const RESOLUTION = 0.001; // values closer than this count as equal (so a whisper of
                                 // noise on a steady signal does not look like randomness)

// Number the order of `count` values starting at `start` (0 … 23). Equal values keep their
// time order, so ties do not create false patterns.
function orderIndex(series, start, count, delay) {
  const ranks = [];
  for (let i = 0; i < count; i++) ranks.push(i);
  ranks.sort((a, b) => series[start + a * delay] - series[start + b * delay] || a - b);
  // Lehmer code: turn the permutation into a single number.
  let index = 0;
  for (let i = 0; i < count; i++) {
    let smaller = 0;
    for (let j = i + 1; j < count; j++) if (ranks[j] < ranks[i]) smaller++;
    index = index * (count - i) + smaller;
  }
  return index;
}

// delay: compare values `delay` steps apart (1 = neighbours). A larger delay lets a finely
// sampled signal be read at a coarser rhythm without waiting longer for values.
export function orderHistogram(series, order = ORDER, resolution = RESOLUTION, delay = 1) {
  if (resolution > 0) series = Array.from(series, v => Math.round(v / resolution));
  const counts = new Array(PATTERNS).fill(0);
  for (let start = 0; start + (order - 1) * delay < series.length; start++) counts[orderIndex(series, start, order, delay)]++;
  return counts;
}

const shannon = probabilities => probabilities.reduce((sum, p) => (p > 0 ? sum - p * Math.log(p) : sum), 0);

export function entropyAndComplexity(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const N = counts.length;
  const p = counts.map(c => c / total);
  const uniform = new Array(N).fill(1 / N);
  const entropy = shannon(p) / Math.log(N);

  // Jensen–Shannon distance from the uniform (noise) distribution, normalised to 0 … 1.
  const mixture = p.map((value, i) => (value + uniform[i]) / 2);
  const divergence = shannon(mixture) - shannon(p) / 2 - shannon(uniform) / 2;
  const normaliser = -2 / (((N + 1) / N) * Math.log(N + 1) - 2 * Math.log(2 * N) + Math.log(N));
  const complexity = normaliser * divergence * entropy;

  return { entropy, complexity, windows: total };
}
