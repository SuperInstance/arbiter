// E2 -- THE DOUBLE PRESENTATION.
//
// E1 established the shape of the bias: it is POSITIONAL. With two options
// whose content was identical, the judge picked the FIRST-SHOWN one 5 times
// out of 5, at P = 0.85-0.88 -- and the draw moved WHICH option was first,
// so it moved the ANSWER without changing the RULE.
//
// Randomising a bias is not removing it. It turns the judge into a coin
// flip, and a coin flip is worth nothing.
//
// THE FIX IS TO CANCEL THE BIAS, NOT TO RANDOMISE IT: ask the SAME
// question in BOTH orders and keep the answer only if the two readings
// AGREE.
//
//   * agree   -> the judge found something order-independent. That is a
//                verdict, and the witness log records both readings, the
//                seed, and the commitment.
//   * disagree -> the answer was a position artefact. The question is
//                UNDECIDED, and "undecided" is an honest answer, not a
//                guess. This is the house's own discipline: a failure to
//                decide is not a decision.
//
// The permutation's REVERSE is the other order, so one draw buys both
// presentations -- and the SAME seed, so the pair is committed together.
//
// TWO ARMS:
//   ARM A: two options with IDENTICAL content. The two readings MUST
//          disagree (it picks the first each time), so the verdict must
//          be UNDECIDED. If the mechanism ever says "decided" here, it is
//          broken.
//   ARM B: two options with REAL content. The question is whether the two
//          readings agree -- and when they do, whether the agreed answer
//          is the CONTENT (the spec's reading) or merely the first slot.

import { mothRequestBits } from '../src/moth.mjs';
import { permutationFromSeed, seedFromBits } from '../src/entropy.mjs';
import { jevSync } from '../src/jev.mjs';
import { writeFileSync } from 'node:fs';

const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const MODE = argOf('--mode', 'emu');
const N = parseInt(argOf('--n', '6'), 10);
const DOC = 'The deployment target is OSPREY-3. The deployment target is KESTREL-9.';
const A_TEXT = 'the orphan is excluded but the child of the orphan still folds, and the child is NOT reported as an orphan';
const B_TEXT = 'a record whose ancestor is missing, even transitively, is itself an orphan, so the child is excluded too';

const Q = 'According to spec section 5.5, which of these two readings is correct?';

function ask(order, texts) {
  const criteria = {};
  order.forEach((origIdx, slot) => { criteria[String.fromCharCode(65 + slot)] = texts[origIdx]; });
  const r = jevSync({ document: DOC }, { which: { type: 'choice', instructions: Q, criteria } });
  if (r.error) return null;
  const probs = r.answers.which.probabilities || {};
  const slotKeys = Object.keys(criteria);
  const pickSlot = slotKeys.find((k) => probs[k] === Math.max(...Object.values(probs)));
  return { pickSlot, pickOrig: order[slotKeys.indexOf(pickSlot)], probs };
}

const rows = [];
for (const [label, identical] of [['A', true], ['B', false]]) {
  for (let i = 0; i < N; i++) {
    const draw = mothRequestBits(process.env.MOTHQUANTUM_TOKEN, 32, { mode: MODE });
    const seed = seedFromBits(draw.bits);
    const perm = permutationFromSeed(seed, 2);
    const rev = [perm[1], perm[0]];
    const texts = identical ? ['the same option', 'the same option'] : [A_TEXT, B_TEXT];
    const fwd = ask(perm, texts);
    const bwd = ask(rev, texts);
    if (!fwd || !bwd) { console.log('  transport failure'); continue; }
    const agree = fwd.pickOrig === bwd.pickOrig;
    rows.push({ arm: label, i, mode: draw.mode, jobId: draw.jobId, commit: draw.commitment?.commit ?? null,
      seed, perm, fwd, bwd, agree, verdict: agree ? (fwd.pickOrig === 0 ? 'A_TEXT (the spec reading)' : 'B_TEXT (the brief reading)') : 'UNDECIDED' });
    console.log(`  ${label} #${i} fwd=orig${fwd.pickOrig} bwd=orig${bwd.pickOrig} -> ${agree ? 'AGREE: ' + (fwd.pickOrig === 0 ? 'A_TEXT' : 'B_TEXT') : 'DISAGREE -> UNDECIDED'}`);
  }
}
console.log('  ---');
for (const label of ['A', 'B']) {
  const rs = rows.filter((r) => r.arm === label);
  if (!rs.length) continue;
  const dec = rs.filter((r) => r.agree).length;
  const aText = rs.filter((r) => r.agree && r.fwd.pickOrig === 0).length;
  console.log(`  ARM ${label}: decided ${dec}/${rs.length}; of those, the SPEC's reading won ${aText}/${dec || 0}`);
}
writeFileSync('/tmp/arb/data/e2-paired.json', JSON.stringify({ at: new Date().toISOString(), mode: MODE, n: N, rows }, null, 2));
