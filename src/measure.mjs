// The house's measurement discipline, in code.
//
//   * REPEATS. Every claim is asked N times. One reading is an anecdote.
//   * SPREAD. The min and max of the repeats are kept, always, next to the
//     verdict. A score without its spread is a lie waiting to be quoted.
//   * THE NOISE BAND. The judge moves ~0.01-0.02 on a saturated cell, so
//     a score within that band of a threshold is a COIN FLIP and must be
//     reported as such, not as a pass or a fail.
//   * MINIMUM CONFIDENCE, NEVER MEAN. A weighted mean is the same lie as
//     a mean: it hides one weak link behind many strong ones. When a claim
//     needs several questions, the claim's confidence is the MINIMUM over
//     them.
//   * LATEST WINS, NEVER BEST. Keeping the best reading lets a caller
//     re-ask until a gate passes. We keep every reading.
//   * A TRANSPORT ERROR IS NOT AN ANSWER.

export const NOISE_BAND = 0.02;

export function summarise(samples) {
  const xs = samples.filter((x) => typeof x === 'number');
  if (!xs.length) return { n: 0, error: true };
  const min = Math.min(...xs), max = Math.max(...xs);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return { n: xs.length, min, max, mean, spread: max - min, last: xs[xs.length - 1] };
}

// A verdict against a threshold, with the band respected.
export function verdict(score, threshold = 0.5) {
  if (typeof score !== 'number') return 'UNMEASURED';
  // A tolerance: 0.5 + 0.02 is 0.520000000000000018 in float64, and
  // without the epsilon a score exactly ON the band reads as a clean YES.
  if (Math.abs(score - threshold) <= NOISE_BAND + 1e-9) return 'COIN_FLIP';
  return score >= threshold ? 'YES' : 'NO';
}

// The confidence of a claim that needs several questions is the MINIMUM.
export function minConfidence(answers) {
  const cs = answers.map((a) => a?.confidence).filter((c) => typeof c === 'number');
  return cs.length ? Math.min(...cs) : null;
}
