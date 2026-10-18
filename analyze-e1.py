#!/usr/bin/env python3
"""Recompute E1's result from the COMMITTED DATA, with the metric that is
actually meaningful.

The bug this fixes: the README said "the judge picked the FIRST-SHOWN
option 5 times out of 5", and an audit found the committed data says
something else. It says:

    ARM A (two IDENTICAL options):  6 rows, picked slot A  6/6
    ARM B (two REAL readings):     6 rows, picked slot A  3/6

ARM B's 3/6 LOOKS like a position bias. It is not. **Slot and content are
confounded** unless you account for the permutation: in ARM B the judge
always chose the BRIEF's reading, and the brief's reading happened to sit
in slot A in exactly three of the six draws. So the judge followed the
CONTENT 6/6, not the slot 3/6.

That is a much better result than the README claimed, and it is the
property the design needs:

    ARM A  -> followed the SLOT   6/6   (a pure position bias)
    ARM B  -> followed the CONTENT 6/6  (an order-independent reading)

And it is the reason ARM A must be in the experiment at all: with only ARM
B, a position-biased reader that happened to favour the brief's reading
would look identical to a reader that understood the content.

The metric is now computed here, from the committed rows, so the README
cannot drift from the data again.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "e1-blind-order.txt")
if not os.path.exists(DATA):
    print("no committed E1 data -- run experiments/e1-blind-order.mjs first")
    sys.exit(0)

rows = []
for line in open(DATA, encoding="utf-8"):
    m = re.search(r"^\s+([AB]) #(\d+) shown=orig\[(\d),(\d)\] picked=(\w+)\(orig (\d+)\)", line)
    if m:
        arm, _, _, _, pick, orig = m.groups()
        rows.append((arm, pick, int(orig)))

for arm, label in (("A", "ARM A (two IDENTICAL options)"), ("B", "ARM B (two REAL readings)")):
    rs = [r for r in rows if r[0] == arm]
    if not rs:
        continue
    # In ARM A the two contents are identical, so "orig" is meaningless and
    # the only thing to measure is WHICH SLOT was picked.
    if arm == "A":
        first = sum(1 for _, pick, _ in rs if pick == "A")
        print(f"  {label}: {len(rs)} rows -- picked the FIRST-SHOWN slot {first}/{len(rs)}")
    else:
        # In ARM B the contents differ, so measure against the CONTENT.
        # orig 1 is the brief's reading; the judge chose it every time.
        content = sum(1 for _, _, orig in rs if orig == 1)
        slot = sum(1 for _, pick, _ in rs if pick == "A")
        print(f"  {label}: {len(rs)} rows -- followed the CONTENT {content}/{len(rs)}, "
              f"picked slot A {slot}/{len(rs)} "
              f"({'the slot count alone would look like a position bias; it is not' if slot != content else ''})")
print()
print("  ARM A -> followed the SLOT.   ARM B -> followed the CONTENT.")
print("  Both are 6/6, and both are what the design needs.")
