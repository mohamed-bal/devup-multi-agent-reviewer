# Code review draft

Origin: **scripted-demo** · Mode: **team**
Run: **complete** · Human review required
Snapshot SHA-256: `0ba64c9ca302c25861c41902c490a82608b100b210bc7b10f570d7d766489ca9`

“Keep” means retained for human review, not a verified bug. No code was executed.

## C001 · keep · Percent values are used as fractions

Kind: correctness · Reviewer: correctness

The contract uses 20 for 20%. With the new formula, discountedTotal&#40;10000, 20&#41; returns -190000 instead of 8000.

**Verify:** Add assert.equal&#40;discountedTotal&#40;10000, 20&#41;, 8000&#41; and run it locally.

**Adjudication:** Consistent with the supplied percent contract; confirm with the proposed assertion.

**src/pricing.mjs · after · L2–L2**

>   return Math.round&#40;subtotalCents &#42; &#40;1 - discountPercent&#41;&#41;;

## C002 · keep · The only supplied test uses zero discount

Kind: test_gap · Reviewer: tests

The existing zero-discount assertion passes with both formulas. It does not exercise the percentage scaling changed in this patch.

**Verify:** Add nonzero-discount cases such as 20 and boundary values 0 and 100.

**Adjudication:** The supplied test does not cover the changed nonzero-discount behavior.

**src/pricing.mjs · after · L2–L2**

>   return Math.round&#40;subtotalCents &#42; &#40;1 - discountPercent&#41;&#41;;

**tests/pricing.test.mjs · after · L3–L3**

> assert.equal&#40;discountedTotal&#40;10000, 0&#41;, 10000&#41;;
