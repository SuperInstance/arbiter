import { mothRequestBits } from '../src/moth.mjs';
import { permutationFromSeed, seedFromBits } from '../src/entropy.mjs';
import { jevSync } from '../src/jev.mjs';

const argOf = (name, dflt) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : dflt; };
const MODE = argOf('--mode', 'emu');
const N = parseInt(argOf('--n', '6'), 10);

const DOC = 'The deployment target is OSPREY-3. The deployment target is KESTREL-9.';
const A_TEXT = 'the orphan is excluded but the child of the orphan still folds, and the child is NOT reported as an orphan';
const B_TEXT = 'a record whose ancestor is missing, even transitively, is itself an orphan, so the child is excluded too';

const rows = [];
async function arm(label, identical) {
  for (let i = 0; i < N; i++) {
    const draw = mothRequestBits(process.env.MOTHQUANTUM_TOKEN, 32, { mode: MODE });
    const seed = seedFromBits(draw.bits);
    const perm = permutationFromSeed(seed, 2);
    if (!perm) { console.log('  (draw too short; skipping)'); continue; }
    const texts = identical ? ['the same option', 'the same option'] : [A_TEXT, B_TEXT];
    const criteria = {};
    perm.forEach((origIdx, slot) => { criteria[String.fromCharCode(65 + slot)] = texts[origIdx]; });
    const r = jevSync({ document: DOC }, {
      which: { type: 'choice', instructions: 'According to spec section 5.5, which of these two readings is correct?', criteria },
    });
    if (r.error) { console.log('  transport:', JSON.stringify(r.error).slice(0, 80)); continue; }
    const ans = r.answers.which;
    const probs = ans.probabilities || {};
    const slotKeys = Object.keys(criteria);
    const pickSlot = slotKeys.find((k) => probs[k] === Math.max(...Object.values(probs)));
    const pickOrig = perm[slotKeys.indexOf(pickSlot)];
    rows.push({ arm: label, i, mode: draw.mode, jobId: draw.jobId, commit: draw.commitment?.commit ?? null,
      seed, perm, pickSlot, pickOrig, probs });
    console.log(`  ${label} #${i} shown=orig[${perm.join(',')}] picked=${pickSlot}(orig ${pickOrig}) P=${JSON.stringify(probs)} (${draw.mode})`);
  }
}

console.log(`  mode=${MODE}  N=${N}`);
console.log('  --- ARM A: two IDENTICAL options, drawn PRESENTATION order ---');
await arm('A', true);
console.log('  --- ARM B: two REAL readings, drawn PRESENTATION order ---');
await arm('B', false);

console.log('  ---');
const A = rows.filter((r) => r.arm === 'A'), B = rows.filter((r) => r.arm === 'B');
const AFirst = A.filter((r) => r.pickSlot === 'A').length;
console.log(`  ARM A: picked the FIRST-SHOWN slot ${AFirst}/${A.length}. (Fixed order measured 9/9 for the first slot; chance is ~50%.)`);
const BContent = B.filter((r) => r.pickOrig === 0).length;
const BFirst = B.filter((r) => r.pickSlot === 'A').length;
console.log(`  ARM B: followed the CONTENT (the spec reading) in ${BContent}/${B.length}; followed the FIRST-SHOWN slot in ${BFirst}/${B.length}.`);
import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../data/e1-blind-order.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), mode: MODE, n: N, rows }, null, 2));
console.log('  -> data/e1-blind-order.json');
