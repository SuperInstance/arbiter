// Turning QRNG output into a usable permutation.
//
// THE FLAW THIS FIXES, FOUND BY THE EXPERIMENT THAT USED IT.
//
// The first version drew the permutation directly from the QRNG's raw
// bits: `need = ceil(log2(i+1))` bits, taken from the FRONT of the
// output. In the experiment, the first bit came out '0' on four
// consecutive draws, so every permutation came out [0,1] and the ORDER
// NEVER VARIED. A randomisation that does not randomise is worse than no
// randomisation, because it looks like it is working.
//
// THE FIX IS THE TEXTBOOK CONSTRUCTION: a QRNG is an entropy SOURCE, not
// a bit source.
//
//     seed  = the QRNG output (unpredictable, witnessed, committed)
//     stream = SHA-256(seed || counter)  -- a good, deterministic bit stream
//     permutation = Fisher-Yates over the stream
//
// SHA-256 is an expander: whatever structure the raw output has, the
// expanded stream does not inherit it. And the permutation becomes a
// PURE FUNCTION OF THE SEED, which is what makes it VERIFIABLE.
//
// THE VERIFIABILITY IS THE POINT. The commitment the API returns is formed
// at submit, before any outcome existed, and binds circuit_hash, backend,
// provider_job_id and salt. So:
//
//     commit(seed)  -- published to the witness log BEFORE the judge runs
//     permutation = f(seed)   -- anyone can recompute it
//     the judge answers in that order
//     the log records seed, commit, permutation, verdict, score
//
// A third party re-derives the permutation from the committed seed and
// confirms that the order the judge saw was not chosen by anyone who
// wanted a particular answer. **That is the anchor the judge's position
// bias was missing.**

import { createHash } from 'node:crypto';

export function seedToStream(seed, nbytes) {
  const out = [];
  for (let c = 0; out.length < nbytes; c++) {
    out.push(...Buffer.from(createHash('sha256').update(String(seed)).update('|' + c).digest()));
  }
  return out.slice(0, nbytes);
}

// Fisher-Yates over a byte stream, with rejection sampling so the
// distribution is exactly uniform (a plain `% (i+1)` biases the low
// residues).
export function permutationFromSeed(seed, n) {
  const stream = seedToStream(seed, 4 * n + 64);
  let pos = 0;
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const bound = i + 1;
    const need = Math.ceil(Math.log2(bound));
    let r;
    for (;;) {
      let b = 0;
      for (let k = 0; k < need; k++) {
        const byte = stream[pos >> 3];
        const bit = (byte >> (7 - (pos & 7))) & 1;
        b = (b << 1) | bit;
        pos++;
      }
      if (b < bound) { r = b; break; }        // rejection: keeps it uniform
    }
    [idx[i], idx[r]] = [idx[r], idx[i]];
  }
  return idx;
}

// The seed is the committed value. Hex the whole QRNG output -- never
// truncate it to "enough" bits, because the seed IS the commitment and a
// truncated seed is a weaker commitment.
export function seedFromBits(bits) {
  if (!bits || bits.length < 16) return null;
  return createHash('sha256').update('moth-seed:' + bits).digest('hex');
}
