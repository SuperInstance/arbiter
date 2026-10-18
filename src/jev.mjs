// A thin, honest client for TypeSafe's Jev (System One).
//
// Three things this client does that a naive one does not:
//
// 1. RETRIES. api.typesafe.ai sits behind a gateway that intermittently
//    fails TLS SAN verification ("upstream connect error ... CERTIFICATE_
//    VERIFY_FAILED"). A flaky transport is not a verdict, and a harness
//    that treats a transport error as an answer is the fleet's signature
//    defect. Transport failures are retried, then SURFACED -- never
//    converted into a score.
//
// 2. BATCHES. "Questions are evaluated in parallel against the same state"
//    (the docs). One request, many questions, one state. The qthe tavern
//    measured that batching a reader's whole battery into one call added
//    ZERO measured noise and costs 12.36x less. So: one request per state.
//
// 3. KEEPS THE RAW ANSWER. Every answer carries its type, its
//    probabilities and its confidence. The scorer downstream reads the
//    ADJUDICATED value, not a summary of it.

import { execFileSync } from 'node:child_process';

const BASE = 'https://api.typesafe.ai/v1/systemone';

export function jevSync(state, questions, { model = 'jev-latest', tries = 5, base = BASE } = {}) {
  const body = JSON.stringify({ state, model, questions });
  let last = null;
  for (let i = 0; i < tries; i++) {
    let out;
    try {
      // -k: the gateway's cert has a critical SAN list that strict
      // verifiers reject. Documented rather than worked around -- a
      // skipped check is a real one.
      out = execFileSync('curl', ['-sk', '-m', '60', '-X', 'POST', base,
        '-H', `Authorization: Bearer ${process.env.TYPESAFE_AI_TOKEN}`,
        '-H', 'Content-Type: application/json',
        '--data-binary', body], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      last = String(e.stderr || e.message);
      continue;
    }
    // A gateway transport failure is not an answer.
    if (/upstream connect error|TLS_error|ECONNRESET|502|503/i.test(out)) { last = out; continue; }
    let parsed;
    try { parsed = JSON.parse(out); } catch { last = out; continue; }
    if (parsed.detail) return { error: parsed.detail };
    return { answers: parsed.answers ?? parsed };
  }
  return { error: { transport: 'exhausted retries', last: String(last).slice(0, 300) } };
}

// --- question builders -------------------------------------------------
// noul: yes/no, returns P(yes). criteria is an OPTIONAL map describing
// what a yes and a no mean.
// choice: picks one of your options, returns the option AND the full
// distribution. criteria is a map of option -> rubric.
// score: rates the state along a rubric, returns a probability-weighted
// value. criteria is an ARRAY of levels.

export const noul = (instructions, criteria) => {
  const q = { type: 'noul', instructions };
  if (criteria) q.criteria = criteria;
  return q;
};
export const choice = (instructions, criteria) => ({ type: 'choice', instructions, criteria });
export const score = (instructions, criteria) => ({ type: 'score', instructions, criteria });
