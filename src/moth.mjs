// The yin: an entropy source that CANNOT be gamed.
//
// WHY THIS EXISTS. A judge that reads a set of options has a POSITION
// BIAS: it prefers one slot over another regardless of content. Measured
// in SuperInstance/jev-lab: with two options whose content was
// indistinguishable, the judge picked the FIRST one 9 times out of 9, at
// P = 0.86. And on a self-contradictory state it preferred the LATER
// clause 7 times out of 9.
//
// A position bias is not noise. It is a channel: whoever controls the
// ORDER controls the answer. So the order has to be chosen by something
// that has no opinion about the answer.
//
// The Moth Quantum QRNG is exactly that. It is a FUNCTION OF NOTHING --
// no input, so no input to game.
//
// AND IT ALREADY SHIPS THE COMMITMENT. The API returns a `commitment`
// object formed AT SUBMIT, after the provider accepted the job and BEFORE
// any outcome existed, binding circuit_hash, backend, provider_job_id and
// salt. Its own note says: "Publish `commit` before collect completes for
// it to mean anything to a third party."
//
// That is the whole design in one field. The commit is a commitment to the
// outcome made BEFORE the outcome existed. Publish it to the witness log
// first, and the order is no longer anybody's to choose.
//
// HONEST MODES. `mode: 'qpu'` is genuine Born-rule measurement on IBM
// quantum hardware -- slow, and the API's own docs warn that a modest
// shot count can legitimately yield ZERO extractable bytes (the NIST
// SP 800-90B extractor subtracts an ordering penalty when the backend
// returns counts only). `mode: 'emu'` is Moth's own server-side
// simulator -- fast, and NOT hardware. **Every result carries its mode
// and its job id, and a simulated draw is never reported as a real one.**

import { execFileSync } from 'node:child_process';

const BASE = 'https://api.mothquantum.com/api/v1';
const ENGINE = 'comet-qrng-v1';

export function mothRequestBits(apiKey, nbits, opts = {}) {
  const { pollIntervalMs = 1500, maxPolls = 120, mode = 'qpu', shots = 4096 } = opts;
  if (!apiKey) throw new Error('MOTHQUANTUM_TOKEN is not set');
  const nbytes = Math.max(1, Math.ceil(nbits / 8));
  const numQubits = Math.min(20, Math.max(8, nbits));

  const submit = JSON.parse(curl(['-X', 'POST', `${BASE}/engines/${ENGINE}/process`,
    '-H', `Authorization: Bearer ${apiKey}`, '-H', 'Content-Type: application/json',
    '-d', JSON.stringify({ params: { output_bytes: nbytes, num_qubits: numQubits, shots, mode, bell_witness: false } })]));
  const jobId = submit.job_id || submit.id;
  if (!jobId) throw new Error('Moth submit returned no job id: ' + JSON.stringify(submit).slice(0, 200));

  for (let i = 0; i < maxPolls; i++) {
    const st = JSON.parse(curl(['-X', 'GET', `${BASE}/jobs/${jobId}/status`,
      '-H', `Authorization: Bearer ${apiKey}`]));
    const s = (st.status || st.state || '').toLowerCase();
    if (s.includes('succeed') || s.includes('complete') || s.includes('done')) break;
    if (s.includes('fail') || s.includes('error')) throw new Error('Moth job failed: ' + JSON.stringify(st).slice(0, 200));
    sleep(pollIntervalMs);
  }
  const res = JSON.parse(curl(['-X', 'GET', `${BASE}/jobs/${jobId}/result`,
    '-H', `Authorization: Bearer ${apiKey}`]));
  const out = res?.result?.output ?? {};
  return {
    jobId,
    mode: out.mode ?? mode,
    commitment: out.commitment ?? null,
    bits: extractBits(out),
    device: out.device_fingerprint ?? null,
    raw: out,
  };
}

// The engine's output shape, per the fleet's own confirmed-live note:
// the bytes live under a few possible keys depending on the mode.
// The engine's output shape, confirmed live on 2026-10-18:
//
//   random: { bits: 16, bytes: 2, hex: "2a9a", derived: {}, requested_bytes: 2 }
//
// CAREFUL: `random.bits` is a COUNT, not a bitstring. The first version of
// this extractor took it, and got "16" -- sixteen as a decimal string, which
// is not a bitstring at all. The data is in `hex` (or `bitstring`).
//
// The `entropy` block's own `assumptions` are worth reading before trusting
// any of it: "shots are independent repetitions (untestable without
// per-shot memory)". The API is honest about what it cannot show.
function extractBits(out) {
  const cand = (o) => {
    if (!o || typeof o !== 'object') return null;
    if (typeof o.bitstring === 'string') return o.bitstring;
    if (typeof o.hex === 'string') return hexToBits(o.hex);
    if (typeof o.bytes_hex === 'string') return hexToBits(o.bytes_hex);
    if (typeof o.bytes === 'number' && typeof o.hex === 'string') return hexToBits(o.hex);
    return null;
  };
  for (const v of Object.values(out)) {
    const b = cand(v);
    if (b) return b;
  }
  const direct = cand(out);
  if (direct) return direct;
  for (const v of Object.values(out)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const vv of Object.values(v)) { const b = cand(vv); if (b) return b; }
    }
  }
  return null;
}

function hexToBits(hex) {
  return String(hex).replace(/[^0-9a-fA-F]/g, '')
    .split('').map((c) => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
}

function curl(args) {
  return execFileSync('curl', ['-s', '-m', '90', ...args], { encoding: 'utf8' });
}
function sleep(ms) { execFileSync('sleep', [String(ms / 1000)]); }

// Draw a PERMUTATION of n items, using the bits to drive a Fisher-Yates
// walk. The permutation -- not the bits -- is what we commit to.
export function permutationFromBits(bits, n) {
  if (!bits || bits.length < 8) return null;
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(i);
  let bit = 0;
  for (let i = n - 1; i > 0; i--) {
    const need = Math.ceil(Math.log2(i + 1));
    const chunk = bits.slice(bit, bit + need);
    bit += need;
    if (chunk.length < need) return null;
    const r = parseInt(chunk, 2) % (i + 1);
    [idx[i], idx[r]] = [idx[r], idx[i]];
  }
  return idx;
}
