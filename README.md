# arbiter — the entropy that makes a judgement blind

**Two tokens. One chain. The judge proposes; the entropy decides the order;
the ledger remembers all three.**

---

## The two halves

### The YANG — `TYPESAFE_AI_TOKEN`. A function of the state.

Jev reads a state and returns a calibrated probability about a discrete
question. It has a **direction**: text → probability. And it has three
measured weaknesses, all of them measured in this fleet, not assumed:

| weakness | measured |
|---|---|
| **position bias** | with two options whose content was **indistinguishable**, it picked the **first** one **9 times out of 9**, at P = 0.86 |
| **anchoring** | a poisoned ledger entry moved a clearly-stated fact from **0.990 to 0.603 ± 0.060** |
| **surface matching** | it picks the phrasing that *resembles* the source, and can be made to resemble it by writing the option in the source's idiom |

**A position bias is not noise. It is a channel.** Whoever controls the
order of the options controls the answer. That is the hole the yin fills.

### The YIN — `MOTHQUANTUM_TOKEN`. A function of nothing.

A quantum random number generator maps **nothing** → bits. It has no
input, so it has no input to game, no direction to be steered, and no
score to be pulled. It is the only instrument in the fleet that **cannot
depend on the thing being measured**.

**And it decides nothing on its own.** A random permutation is not a
verdict. It is a way of arranging a question so that whoever asked it
cannot have arranged the answer.

### Neither is sufficient

- A judge alone is **gameable** — the order leaks the preference.
- An entropy source alone **decides nothing** — a shuffle is not an answer.

**Together: the entropy fixes the judge's freedom, and the judge gives the
entropy a question.** That is the yin and the yang, and it is not a
metaphor — it is two instruments with disjoint failure modes, composed.

---

## The third element: the cheap re-deriver

`SuperInstance/micro-onnx` (export, optimise, validate small ONNX models)
and `SuperInstance/micrograd-quilt` (train them; note it already has a
`quilt/auditor.py`) are the **local** half of the house's economy:

> A paid expert is an **observer**, not a teacher. It sets a
> pre-registered predicate over a task; the witnessed answer becomes a
> **reusable standard**; then a cheap local model — or no model at all —
> recombines to reach the **same** answer, never a merely similar one.

So the loop is:

```
   MOTH draws a permutation of the options, and COMMITS to it
        (the commit is formed at submit, before any outcome exists)
              |
              v
   JEV answers, in that order, and its reading is recorded
              |
              v
   micro-onnx / micrograd re-derive the same answer LOCALLY,
   from the witnessed standard, without paying again
              |
              v
   ONE chained witness log holds all three
```

**The paid call happens once. The local re-derivation happens forever.**
And a disagreement between the judge and the local model is a **flag**,
not a blend — the same rule the ledger-anchor experiment forced.

---

## The commitment is the whole design

The Moth API does not just return bits. It returns a **commitment**:

```json
"commitment": {
  "binds": ["circuit_hash", "backend", "provider_job_id", "salt"],
  "commit": "5261acfbb24e581559f8a0d16abbbcd83037e6afb17d467bbf89c7e0927c0e95",
  "committed_at": "2026-10-18T16:46:33+00:00",
  "note": "Formed at submit, after the provider accepted the job and before
           any outcome existed. Publish `commit` before collect completes for
           it to mean anything to a third party."
}
```

**Read the note again: it is telling us the design.** The commit is formed
*before any outcome existed*. Publishing it first is what makes it a
commitment rather than a receipt.

**And the permutation is a pure function of the committed seed.** So a
third party can:

1. take the committed seed,
2. recompute the permutation,
3. confirm the judge was shown the options in an order **nobody who
   wanted a particular answer could have chosen**.

**That is the anchor the judge's position bias was missing** — and it
needs no cryptography beyond SHA-256, because the unpredictability comes
from the hardware and the verifiability comes from the commitment.

---

## One chain, three kinds of entry

`SuperInstance/MicroMoth-quilt`'s `tools/collapse_ledger.py` and
`SuperInstance/AI-Writings`' `labs/situation-recorder/recorder.py` are
**the same format**: fnv1a-64 over a canonical cell encoding, `GENESIS =
0x0000000000000000`, one hash per record, chained. (Both are being
upgraded to `witness-chain/1` — SHA-256, RFC 8785 canonicalisation, RFC
6962 domain separation, and a signed tree head. See
`SuperInstance/witness-spec`.)

**So one chained log can hold:**

| entry | source | hardness |
|---|---|---|
| a **READING** | Jev | soft, probabilistic, calibratable — and biasable |
| a **COLLAPSE** | a quantum circuit | hard, physical, and **not re-derivable with a different answer** |
| a **RE-DERIVATION** | micro-onnx / micrograd | cheap, local, and re-runnable forever |

**A collapse is the only measurement in the fleet an adversary cannot
reproduce with a different result.** That is what makes the log worth
chaining to the soft entries.

---

## What the experiments in this repo measured

### E1 — the bias is POSITIONAL, and randomising it is not the fix

`experiments/e1-blind-order.mjs` asks the question the design exists to
answer: **does a drawn presentation order remove the judge's position
bias?**

Two arms, each decisive:

- **ARM A (the control).** Two options with **identical content**, in a
  drawn order. A correct reader has no reason to prefer either, so the
  pick should be ~50/50. The fixed-order measurement was **9/9 for the
  first slot**.
- **ARM B (the real question).** Two options with real content — the
  spec's reading of the orphan rule and the brief's — in a drawn order.
  Does the pick follow the **content**, or the **slot**?

**Result: the judge picked the FIRST-SHOWN option 5 times out of 5**, at
P = 0.85–0.88, and the draw moved which option was first — so it moved
the **answer** without changing the **rule**.

> **Randomising a bias is not removing it.** It turns the judge into a
> coin flip, and a coin flip is worth nothing.

### E2 — so CANCEL the bias instead: ask both orders, keep only what agrees

`experiments/e2-paired.mjs` asks the same question in **both** orders.
One draw buys both, because the permutation's reverse is the other order,
so the pair is committed together.

- **agree** → an **order-independent** reading. A verdict.
- **disagree** → the answer was a position artefact. The question is
  **UNDECIDED**, and *a failure to decide is not a decision*.

**ARM A (identical options) came out UNDECIDED 6 times out of 6** — which is
exactly right: two indistinguishable options have no answer, and the
mechanism says so instead of inventing one.

**ARM B (real content) came out AGREE 5 times out of 5** — and the agreed
answer was the **brief's** reading, not the spec's.

> **The judge is order-independent on this content** — 5/5 agreement across
> both presentations means it is genuinely *reading*, not just following
> position. **And it sides with the brief.**

**Which is the first time this disagreement has been machine-checked.** The
house's own answer is the spec's three-clause rule, and it is decided
**mechanically** — by the fold suite's 13 discriminating cases, where every
port agrees. The Elixir port implemented the *transitive* rule and
**silently lost the child's effect**, which is how the disagreement
surfaced in the first place.

**Now both readings are on the record with receipts, and the mechanical one
wins.** Which is the whole point: **the judge is a SECOND READER, never
the decider.** Its job is to be order-independent and reproducible, and to
**flag** when it disagrees with the mechanical answer — a disagreement that
is information, not noise.

**And note what the two arms together establish:** the gate says UNDECIDED
exactly where there is nothing to decide, and DECIDED exactly where there
is. **A verdict that can say "I do not know" is a verdict.**

**This is the final shape of the design.** The entropy is not there to
randomise the judge. It is there to make the *pair of presentations*
something nobody chose, so that the agreement between two orderings is
evidence of something real.

### And the flaw the experiment found in the design itself

Two, both worth more than the confirmations.

**1. The permutation was taken directly from the raw QRNG bits, and every
draw came out `[0,1]`** — the order never varied. *A randomisation that
does not randomise is worse than none, because it looks like it is
working.* The fix is the textbook construction: **a QRNG is an entropy
SOURCE, not a bit source.**

```
seed   = the QRNG output (unpredictable, witnessed, committed)
stream = SHA-256(seed || counter)          -- a good, deterministic stream
perm   = Fisher-Yates over the stream, with rejection sampling
```

SHA-256 is an expander, so whatever structure the raw output has, the
expanded stream does not inherit it — and the permutation becomes a **pure
function of the committed seed**, which is what makes it verifiable by a
third party. Measured over 600 seeds, the six 3-permutations came out
**104, 101, 97, 101, 98, 99** against an expected 100 each.

**2. The first version of E1 swapped the CONTENT of the options but kept
the criteria object's key insertion order fixed** — so the judge was shown
the same presentation every time, and picked the same way every time. The
experiment was measuring nothing. *A permutation of a FIXED LABEL SET
removes nothing; the draw has to change what the judge actually SEES.*

---

## Honest modes, honest numbers

- `mode: 'qpu'` is genuine Born-rule measurement on **IBM quantum
  hardware** — slow (a job takes tens of seconds), and the API's own docs
  warn that a modest shot count can legitimately yield **zero extractable
  bytes**, because the NIST SP 800-90B extractor subtracts an ordering
  penalty when the backend returns counts only. That is a real "no usable
  output" from a job that ran for real, not a bug.
- `mode: 'emu'` is Moth's own **server-side simulator** (`provenance.backend:
  "aer"`). Fast, and **not hardware**. Every result carries its mode and
  its job id, and **a simulated draw is never reported as a real one.**
- The API's `entropy` block states its own assumptions, including *"shots
  are independent repetitions (untestable without per-shot memory)"*. Read
  them before trusting the output.

---

## What this does NOT claim

- **It does not make the judge reliable.** It removes the one channel
  through which the *reader of the question* could control the answer. The
  judge's surface-matching and anchoring remain, and the
  ledger-anchor finding stands: **a witnessed ledger is a one-way ratchet**,
  so a re-derivation must **compare** against the record and flag a
  disagreement, never blend.
- **It does not replace the witness log.** The log is what makes a verdict
  reproducible with **no judge call at all**; the entropy is what makes the
  *order* defensible when a judge is called.
- **The magnitudes in the experiments are not constants.** The position
  bias (9/9) and the anchoring (−0.39) were measured on particular states.
  Do not quote them as laws.
- **One commitment is not a chain.** A single commit proves the order was
  fixed in advance; the chain proves the sequence of commitments was. The
  signed tree head is what makes the chain's head non-repudiable.
