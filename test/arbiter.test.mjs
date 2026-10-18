// The arbiter's tests. The load-bearing one is at the bottom.
//
// A verdict that cannot say "I do not know" is not a verdict. The judge has
// a measured position bias, so the arbiter's agreement gate is the part
// that carries the safety, and it has to be shown to FIRE.

import test from 'node:test';
import assert from 'node:assert/strict';
import { permutationFromSeed, seedFromBits } from '../src/entropy.mjs';
// The agreement gate ITSELF, not a local re-implementation of it. The
// previous version of this file re-implemented the gate inline and asserted
// its own re-implementation -- and the suite stayed 6/6 green with the
// real gate removed three different ways.
import { agreement, VERDICT } from '../src/arbiter.mjs';

test('a permutation is a pure function of the seed', () => {
  const a = permutationFromSeed('deadbeef', 3);
  const b = permutationFromSeed('deadbeef', 3);
  assert.deepEqual(a, b, 'the same seed must give the same order -- that is what makes it verifiable');
});

test('different seeds give different orders', () => {
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(permutationFromSeed('seed' + i, 3).join(''));
  assert.ok(seen.size > 3, 'the order must actually vary');
});

test('the permutation is UNIFORM over 3 elements', () => {
  // A biased permutation would leak information about the seed, and a
  // leaky permutation is a weak commitment.
  const counts = {};
  for (let i = 0; i < 600; i++) {
    const p = permutationFromSeed('s' + i, 3).join('');
    counts[p] = (counts[p] || 0) + 1;
  }
  const values = Object.values(counts);
  assert.equal(values.length, 6, 'all six permutations must occur');
  for (const v of values) assert.ok(Math.abs(v - 100) < 30, 'each permutation near 100, got ' + v);
});

test('the seed is derived from the whole draw, not a prefix', () => {
  // A truncated seed is a weaker commitment, so the whole output is hashed.
  const a = seedFromBits('1010');
  const b = seedFromBits('1010' + '0'.repeat(64));
  assert.notEqual(a, b, 'a longer draw must give a different seed');
});

test('a draw too short to commit is refused', () => {
  assert.equal(seedFromBits('101'), null, 'a 3-bit draw is not a commitment');
});

test('THE AGREEMENT GATE MUST BE ABLE TO SAY UNDECIDED', () => {
  // The gate is imported, not re-implemented. A position-biased reader
  // disagrees with itself across the two presentations, so the gate must
  // refuse to decide.
  const fwd = { key: 'A', probabilities: { A: 0.9 } };
  const rev = { key: 'B', probabilities: { B: 0.88 } };
  const r = agreement(fwd, rev);
  assert.equal(r.agree, false);
  // The LITERAL, not the constant. Comparing against VERDICT.UNDECIDED
  // would pass even if someone renamed the constant's VALUE -- which is
  // exactly the third mutation the audit tried, and exactly what it
  // missed. A test has to state the expected value from the SPEC.
  assert.equal(r.verdict, 'UNDECIDED');
  assert.equal(r.decided_key, null);
});

test('the agreement gate says DECIDED when both orders agree', () => {
  const fwd = { key: 'A', probabilities: { A: 0.9 } };
  const rev = { key: 'A', probabilities: { A: 0.91 } };
  const r = agreement(fwd, rev);
  assert.equal(r.agree, true);
  assert.equal(r.verdict, 'DECIDED');
  assert.equal(r.decided_key, 'A');
});

test('the agreement gate cannot be bypassed by requireAgreement=false being ignored', () => {
  // With the escape hatch, the gate still reports the truth about agreement;
  // it only changes the VERDICT. A caller that wants to force a decision
  // should not be able to make a DISAGREEMENT look like agreement.
  const fwd = { key: 'A' }, rev = { key: 'B' };
  const r = agreement(fwd, rev, false);
  assert.equal(r.agree, false, 'the escape hatch must not fake agreement');
  assert.equal(r.verdict, 'DECIDED', 'it may still force a verdict');
});

test('the agreement gate handles a missing reading', () => {
  const r = agreement({ key: 'A' }, null);
  assert.equal(r.agree, false);
  assert.equal(r.verdict, 'UNDECIDED');
});
