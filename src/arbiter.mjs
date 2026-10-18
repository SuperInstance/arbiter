// The arbiter: a blind adjudication that can answer "UNDECIDED".
//
//   commit -> ask TWICE (both orders) -> agree? -> record
//
// THE ORDER IS NOT OPTIONAL. The commitment is taken BEFORE the judge is
// called, because a commitment taken afterwards proves nothing: by then
// somebody already knows the answer and could have chosen the order.
//
// WHY TWICE. The judge has a measured POSITION BIAS: with two options whose
// content was identical, it picked the FIRST-SHOWN one 5 times out of 5, at
// P = 0.85-0.88. Randomising the presentation randomises the ANSWER but
// not the RULE -- it turns the judge into a coin flip, which is worth
// nothing.
//
// So the bias is CANCELLED rather than randomised: the same question is
// asked in BOTH orders, and the answer is kept only if the two readings
// AGREE.
//
//   agree    -> an order-independent reading. A verdict.
//   disagree -> the answer was a position artefact. The question is
//               UNDECIDED, and "undecided" is an honest answer. This is
//               the house's own discipline: a failure to decide is not a
//               decision.
//
// A third party can verify the whole thing:
//   1. take the committed seed
//   2. recompute the permutation (a pure function of the seed)
//   3. confirm the judge was shown BOTH orders, drawn from that seed
//   4. confirm the recorded verdict is the reading both orders agreed on
//
// and the one thing nobody can do is move the goalposts after the fact,
// because the seed was committed before the outcome existed.

import { mothRequestBits } from './moth.mjs';
import { permutationFromSeed, seedFromBits } from './entropy.mjs';
import { jevSync } from './jev.mjs';

export const VERDICT = Object.freeze({ DECIDED: 'DECIDED', UNDECIDED: 'UNDECIDED' });

/**
 * THE AGREEMENT GATE -- extracted as a PURE function so it can be tested.
 *
 * It was NOT a pure function before. The logic lived inline inside
 * `adjudicate()`, and the test file re-implemented it locally:
 *
 *     const fwd = firstShown(['A', 'B']);
 *     const rev = firstShown(['B', 'A']);
 *     assert.equal(fwd === rev ? 'DECIDED' : 'UNDECIDED', 'UNDECIDED');
 *
 * ...which asserts the TEST'S OWN re-implementation, and never touches the
 * code that actually runs. An audit removed the gate from the real
 * implementation three ways -- hardcoded to always DECIDED, always
 * UNDECIDED, and with UNDECIDED deleted from VERDICT -- and the suite was
 * **6/6 green every time**. A test that cannot fail is not a test.
 *
 * @param {{key: string}} a   the reading from one presentation order
 * @param {{key: string}} b   the reading from the other
 * @param {boolean} requireAgreement
 */
export function agreement(a, b, requireAgreement = true) {
  const agree = !!a && !!b && a.key === b.key;
  if (!requireAgreement) {
    return { agree, verdict: VERDICT.DECIDED, decided_key: a ? a.key : null };
  }
  return {
    agree,
    verdict: agree ? VERDICT.DECIDED : VERDICT.UNDECIDED,
    decided_key: agree ? a.key : null,
  };
}

/**
 * Adjudicate between options, blind.
 *
 * @param {object} o
 * @param {string|object} o.state     the document (or state) the judge reads
 * @param {string} o.question          the question
 * @param {object} o.options           { KEY: text } -- the alternatives
 * @param {string} [o.mode]            'qpu' | 'emu' (the entropy mode)
 * @param {string} [o.mothKey]         MOTHQUANTUM_TOKEN
 * @param {string} [o.jevKey]          TYPESAFE_AI_TOKEN
 * @param {boolean} [o.requireAgreement] default true
 */
export function adjudicate({
  state, question, options, mode = 'qpu', mothKey, jevKey, nbits = 32, requireAgreement = true,
}) {
  const keys = Object.keys(options);
  if (keys.length < 2) throw new Error('adjudicate needs at least two options');

  // ── 1. DRAW, and COMMIT, before anything is known ──────────────────────
  const draw = mothRequestBits(mothKey, nbits, { mode });
  const seed = seedFromBits(draw.bits);
  const perm = permutationFromSeed(seed, keys.length);
  if (!perm) throw new Error('the draw produced no usable bits');

  // The two presentations. `perm` and its reverse are the SAME pair -- one
  // seed buys both, so they are committed together.
  const forward = perm.map((i) => keys[i]);
  const reverse = [...forward].reverse();

  // ── 2. ASK, in BOTH orders ────────────────────────────────────────────
  const ask = (order) => {
    const criteria = {};
    order.forEach((key, slot) => { criteria[String.fromCharCode(65 + slot)] = options[key]; });
    const r = jevSync(state, {
      which: { type: 'choice', instructions: question, criteria },
    }, { apiKey: jevKey });
    if (r.error) throw new Error('the judge failed: ' + JSON.stringify(r.error).slice(0, 200));
    const probs = r.answers.which.probabilities || {};
    const slotKeys = Object.keys(criteria);
    const pickSlot = slotKeys.find((k) => probs[k] === Math.max(...Object.values(probs)));
    return { slot: pickSlot, key: order[slotKeys.indexOf(pickSlot)], probabilities: probs };
  };
  const a = ask(forward);
  const b = ask(reverse);

  // ── 3. AGREE? ────────────────────────────────────────────────────────
  const { agree, verdict, decided_key } = agreement(a, b, requireAgreement);

  // ── 4. COLLECT and RECORD ────────────────────────────────────────────
  return {
    kind: 'ADJUDICATION',
    at: new Date().toISOString(),
    question,
    options,
    order_forward: forward,
    order_reverse: reverse,
    seed,
    commit: draw.commitment?.commit ?? null,
    commit_binds: draw.commitment?.binds ?? null,
    commit_at: draw.commitment?.committed_at ?? null,
    entropy: { mode: draw.mode, job_id: draw.jobId, bits: draw.bits },
    readings: { forward: a, reverse: b },
    agree,
    verdict,
    decided_key,
  };
}
