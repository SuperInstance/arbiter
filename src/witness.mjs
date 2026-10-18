// The chained witness log -- witness-chain/1.
//
//   leaf(i) = SHA256(0x00 || JCS(record_i))         RFC 6962 domain separation
//   hash(i) = SHA256(0x01 || hash(i-1) || leaf(i))
//   head    = hash(n)
//
// This is the same rule as SuperInstance/witness-spec and
// AI-Writings' labs/situation-recorder/recorder.py, so one chain can hold
// a JUDGE READING, a QUANTUM COLLAPSE and a LOCAL RE-DERIVATION.
//
// It is a re-implementation rather than an import, because witness-spec is
// not published to npm yet; when it is, this file should become a thin
// re-export so there is exactly ONE rule in the fleet, not two.

import { createHash, createHmac } from 'node:crypto';
import { canonicalize } from './jcs.mjs';

export const GENESIS = '0x' + '0'.repeat(16);
const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);
const HEAD_PREFIX = Buffer.from([0x03]);

export function leafHash(record) {
  return '0x' + createHash('sha256').update(LEAF_PREFIX).update(canonicalize(record), 'utf8').digest('hex');
}
export function chainHash(prev, leaf) {
  return '0x' + createHash('sha256').update(NODE_PREFIX).update(prev, 'utf8').update(leaf, 'utf8').digest('hex');
}
export function signHead(head, key) {
  return '0x' + createHmac('sha256', key).update(HEAD_PREFIX).update(head, 'utf8').digest('hex');
}
export function verifyHead(head, signature, key) {
  const expect = signHead(head, key);
  return expect === signature;
}
export { canonicalize };
