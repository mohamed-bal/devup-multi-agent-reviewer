# Manual evaluation protocol

## Status

No live single-versus-team experiment has been run. `fixtures/scripted-reviews.json` is hand-authored demonstration data, not a transcript of model output. It must not be published as a model benchmark.

## Unit of comparison

Use the same snapshot hash, exact model ID, SDK version, and per-agent limits. Single mode covers both correctness and change-specific test gaps. Team mode runs two specialists and, when candidates exist, an adjudicator.

The team spends more total computation. Report this as a comparison of configurations. To study specialization separately, add a budget-matched single-agent control in a later experiment.

Use the three supplied cases first, then add changes representative of your own repository. Run each mode at least three times per case as a small exploratory check; more observations and broader cases are necessary before generalizing. Alternate which mode goes first. Preserve every failed packet.

## Rubric

`fixtures/expected-issues.json` is the human-authored initial rubric. The discount case includes two distinct expected categories: the arithmetic regression and the missing regression test. Apply that rule identically to both modes. A duplicate is another candidate describing the same expected issue/category.

Inspect each retained candidate against the code, stated contract, and a developer-run regression test when applicable. Do not let an LLM's vote serve as ground truth. If a valid unlisted issue appears, update the rubric and re-label both modes consistently.

## Labels file

Create a separate JSON file for each **complete live** packet. Copy its snapshot hash and candidate IDs. Include every candidate whose decision is `keep` or `needs_check`; exclude `drop` candidates.

This example documents the shape. Replace its hash, IDs, and labels from your actual run:

```json
{
  "version": 1,
  "origin": "human-labels",
  "runName": "discount-team-01",
  "snapshotHash": "COPY_THE_64_CHARACTER_HASH_FROM_THE_PACKET",
  "expectedIssueIds": ["discount-percent-scaling", "nonzero-discount-test-gap"],
  "candidates": [
    {
      "id": "C001",
      "verdict": "true_positive",
      "expectedIssueId": "discount-percent-scaling",
      "note": "Replace with your manual verification and its result."
    }
  ]
}
```

Allowed verdicts: `true_positive`, `false_positive`, `duplicate`.

- A true positive names one declared expected issue; only one true positive may claim each expected ID.
- A duplicate names the issue it repeats. Count it against precision.
- A false positive has `expectedIssueId: null`.
- Every row requires a written note.
- If nothing is retained, use `candidates: []`. If the rubric expects no issue, use `expectedIssueIds: []`.

Run:

```bash
npm run score -- out/discount-team-01/review.json labels.json out/discount-team-01/score.json
```

The scorer checks live origin, completion, matching snapshot hash, unique label IDs, and complete candidate coverage. It cannot verify the human labels themselves. The live packet and its source are trusted local experiment records, not a signed provenance system.

## Metrics

- Precision = unique true-positive expected issues / retained candidates, with duplicates counted in the denominator. An empty denominator gives `null`.
- Recall = found expected issues / declared expected issues. No expected issues gives `null`.
- Report false positives on the clean fixture separately; do not interpret its null recall as failure.
- Report duplicate count, missed issue IDs, completion rate, and all failure counts.
- Read wall time and per-stage reported token usage from `review.json`.
- A failed stage has unknown usage in this lab; do not report it as zero. A successfully returned SDK usage object can still depend on the endpoint's reporting.
- Settled DZD cost is not collected. Inspect actual dashboard billing separately if comparing cost; do not infer final billing from token totals alone.

Do not average a few tiny fixtures into a claim that the system finds a stated percentage of all real-world bugs. Keep your model IDs, dates, configurations, and corpus limitations attached to every published result.
