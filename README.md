<p align="center">
  <img src="https://raw.githubusercontent.com/mohamed-bal/devup-multi-agent-reviewer/main/assets/01-cover.png" alt="DEVUP AI Multi-Agent Code Review — two specialists, one adjudicator, and a baseline you can evaluate" width="100%">
</p>

<h1 align="center">DEVUP AI · Multi-Agent Code Review</h1>

<p align="center">
  <strong>Inspect the change. Challenge the findings. Keep the evidence.</strong><br>
  A read-only TypeScript review lab with two specialist agents, an adjudicator,<br>
  and a single-agent baseline you can evaluate on the same source snapshot.
</p>

<p align="center">
  <strong>TypeScript</strong> &nbsp;·&nbsp; <strong>Node.js 24</strong> &nbsp;·&nbsp;
  <strong>OpenAI Agents SDK</strong> &nbsp;·&nbsp; <strong>DEVUP AI</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> &nbsp;·&nbsp;
  <a href="#how-it-works">Architecture</a> &nbsp;·&nbsp;
  <a href="#see-the-output">Report preview</a> &nbsp;·&nbsp;
  <a href="#run-a-live-review">Live review</a> &nbsp;·&nbsp;
  <a href="https://github.com/mohamed-bal/devup-multi-agent-reviewer/blob/main/article.md">Full tutorial</a>
</p>

---

## A review you can inspect

An AI review should make its reasoning easier to check. This project turns a small committed code change into a structured draft with **file paths, exact source quotations, line ranges, and proposed verification steps**.

| What you get | How it works |
| :--- | :--- |
| **Two focused perspectives** | One agent examines changed behavior; another looks for missing regression coverage. |
| **A challenge step** | An adjudicator keeps, drops, or questions existing candidates. |
| **Source-backed locations** | Local code checks every cited path, range, quotation, and changed-line anchor. |
| **A fixed input** | Every agent reads the same before/after source snapshot. |
| **A visible failure state** | Failed stages produce an incomplete review rather than a clean success. |
| **A baseline** | Compare the team against one reviewer covering both scopes. |

> **Validation status:** 55 local tests and TypeScript checking passed. The included demonstration is scripted; live model compatibility and comparative review quality have not been measured here.

## Quick start

Run the complete offline demonstration **without an API key**.

**Requirements:** Node.js 24, npm, and Git for source capture and its integration test.

```bash
git clone https://github.com/mohamed-bal/devup-multi-agent-reviewer.git
cd devup-multi-agent-reviewer
npm ci
npm test
npm run typecheck
npm run demo
```

The demo writes two inspectable files:

| Output | Contents |
| :--- | :--- |
| `out/demo/review.md` | A readable review draft with candidate findings and source references. |
| `out/demo/review.json` | The snapshot hash, candidates, decisions, status, and demonstration metrics. |

```text
SCRIPTED DEMO — no API requests, no model-quality measurement.
Snapshot: discount-regression.json
Candidates: 2 · retained for human review: 2
Draft saved to out/demo/review.md and review.json.
```

**Prefer to inspect before running?** Open the shipped [Markdown example](https://github.com/mohamed-bal/devup-multi-agent-reviewer/blob/main/examples/scripted-review.md) or [JSON packet](https://github.com/mohamed-bal/devup-multi-agent-reviewer/blob/main/examples/scripted-review.json).

## How it works

<p align="center">
  <img src="https://raw.githubusercontent.com/mohamed-bal/devup-multi-agent-reviewer/main/assets/02-architecture.png" alt="A fixed source snapshot feeds correctness and test reviewers in parallel; local evidence checks precede adjudication and a human-reviewed draft" width="100%">
</p>

<p align="center"><sub>Implementation diagram · The application controls the workflow.</sub></p>

1. **Capture** explicitly selected source files at two resolved Git commits.
2. **Review in parallel:** behavioral correctness and change-specific test coverage.
3. **Validate evidence locally:** source paths, line ranges, exact quotations, and changed-line anchors.
4. **Adjudicate** the existing candidate IDs with `keep`, `drop`, or `needs_check`.
5. **Inspect the draft** and verify the proposed regression cases yourself.

The model-facing tools are deliberately narrow:

| Tool | Available capability |
| :--- | :--- |
| `list_files` | List the files included in this snapshot. |
| `get_diff` | Read the unified diff for an exact supplied path. |
| `read_lines` | Read a bounded range from the before or after version. |

These tools read the supplied snapshot. They do not execute source code, edit files, or post repository comments.

## The bug a passing test misses

The teaching fixture changes a percentage calculation while leaving a zero-discount assertion untouched.

```diff
 export function discountedTotal(subtotalCents, discountPercent) {
-  return Math.round(subtotalCents * (100 - discountPercent) / 100);
+  return Math.round(subtotalCents * (1 - discountPercent));
 }
```

With a zero discount, both implementations pass. With a **20% discount on 10,000 cents**, the changed implementation returns **−190,000**, instead of **8,000**. The local suite reproduces those values using the trusted teaching fixture.

<p align="center">
  <img src="https://raw.githubusercontent.com/mohamed-bal/devup-multi-agent-reviewer/main/assets/03-evidence.png" alt="The pricing fixture shows a valid changed-line citation, a zero-discount test that misses the regression, and the difference between source consistency and semantic correctness" width="100%">
</p>

<p align="center"><sub>Actual shipped source and locally reproduced arithmetic · Candidate review text is scripted.</sub></p>

**An exact quotation confirms a location.** It does not prove that the model's conclusion follows from the code. The suite includes a deliberately false explanation with a real quotation to make that boundary explicit.

## See the output

The draft keeps the issue, explanation, verification step, source evidence, and decision together.

<p align="center">
  <img src="https://raw.githubusercontent.com/mohamed-bal/devup-multi-agent-reviewer/main/assets/04-report.png" alt="Original rendering of the offline review packet showing two scripted candidates, exact source evidence, a snapshot hash, and the human-review requirement" width="100%">
</p>

<p align="center"><sub>Original rendering of the actual scripted demo packet · Not a live model result.</sub></p>

| Decision | Meaning |
| :--- | :--- |
| `keep` | Retain the candidate for human review. |
| `drop` | Exclude a candidate judged unsupported, redundant, or outside scope. |
| `needs_check` | Preserve a candidate that still needs verification. |

If a specialist fails, the pipeline skips adjudication and marks the run **incomplete**. If adjudication fails, the original candidates remain available. A complete run with no candidates is not proof that the change is correct.

## Run a live review

Create a local `.env` using the supplied [`.env.example`](https://github.com/mohamed-bal/devup-multi-agent-reviewer/blob/main/.env.example):

```dotenv
DEVUP_API_KEY=REPLACE_WITH_PRIVATE_API_KEY
DEVUP_REVIEW_MODEL=REPLACE_WITH_TOOL_AND_SCHEMA_CAPABLE_MODEL_ID
```

Choose the exact model ID from the current [DEVUP AI catalog](https://docs.devupai.com/docs/models). This configuration needs tools and structured output through the Responses endpoint. Keep the real key private.

Run the baseline:

```bash
node --env-file=.env src/cli.mts fixtures/discount-regression.json single out/discount-single-01
```

Run the team against the same fixture:

```bash
node --env-file=.env src/cli.mts fixtures/discount-regression.json team out/discount-team-01
```

Live runs consume your DEVUP AI balance. Each run requires a new output directory. A completed pipeline writes the JSON packet and Markdown report; an incomplete pipeline also writes them and returns exit code `2`.

## Review your own committed change

Capture only the source, tests, and contract documentation needed for the review:

```bash
npm run capture -- /path/to/repository HEAD~1 HEAD snapshot.json src/pricing.mjs tests/pricing.test.mjs CONTRACT.md
```

Inspect `snapshot.json` before making a live request. It contains the excerpts agents can retrieve. Explicit paths and filename restrictions do not detect secrets embedded in otherwise valid source.

Then run either configuration:

```bash
node --env-file=.env src/cli.mts snapshot.json single out/custom-single-01
```

```bash
node --env-file=.env src/cli.mts snapshot.json team out/custom-team-01
```

<details>
<summary><strong>Capture scope and resource limits</strong></summary>

The collector resolves both refs to commit SHAs and reads committed blobs, not dirty working-tree files. The loader checks the unified diff against both source versions and reconstructs the post-change lines.

| Resource | Lab limit |
| :--- | :--- |
| Explicit files | 8 |
| Serialized snapshot | 160,000 bytes |
| Source text per side | 16,000 JavaScript string code units |
| Diff per file | 20,000 code units |
| Source lines per tool read | 80 |
| Tool calls per agent | 12 |
| Model turns per agent | 6 |
| Requested output cap per call | 3,000 tokens |
| Shared pipeline cancellation deadline | 90 seconds |

Supported source extensions: `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`, `.json`, and `.md`, using simple explicit paths. The teaching collector targets small UTF-8 text changes in SHA-1 repositories. It rejects symlink blobs and binary/control-character content; complex rename handling, mode-only changes, and newline-only changes are outside its intended scope.

These limits bound work, not final spending. Processed or failed requests can still be billed. Reported tokens are not settled cost: `costDzd` remains `null`. A failed stage's missing usage is not reported as zero.

</details>

## Evaluate the extra agents

The project includes a baseline and a human-authored rubric so that extra model calls can be assessed against a clear task.

| Fixture | Evaluation target |
| :--- | :--- |
| `discount-regression` | Percentage-scaling regression and missing nonzero-discount coverage. |
| `clean-refactor` | Equivalent behavior; avoid inventing introduced problems. |
| `removed-validation` | A deleted quantity guard and missing invalid-quantity coverage. |

Use the same model, snapshot, and rubric in both modes. Repeat runs, preserve failures, and manually label the retained candidates. Track precision, recall against the declared fixture issues, duplicates, completion, wall time, and reported usage.

The team has a larger total computation allowance. This is a **pipeline comparison**, not an equal-budget experiment. These small cases are teaching fixtures, not a representative code-review benchmark.

Follow the [evaluation procedure and label format](https://github.com/mohamed-bal/devup-multi-agent-reviewer/blob/main/evaluation.md). The scorer requires a complete live packet, a matching snapshot hash, and labels for every retained candidate:

```bash
npm run score -- out/discount-team-01/review.json labels.json out/discount-team-01/score.json
```

## Built to be checked

| Locally verified | Coverage |
| :--- | :--- |
| **55 passing tests** | Snapshot integrity, exact evidence, tool bounds, immutable inputs, stage failures, adjudication IDs, report escaping, and scoring rules. |
| **TypeScript checking** | Source and tests checked against the pinned dependency types. |
| **Real SDK protocol fixtures** | Tool-call serialization, local tool execution and replay, structured output, usage accounting, and incomplete terminal-response rejection. |
| **Git integration** | Committed-source capture, dirty-tree isolation, additions, deletions, and symlink rejection. |
| **Offline demonstration** | The complete team workflow with hand-authored candidate outputs. |

The SDK protocol fixtures return in memory and do not contact a live endpoint. Live compatibility and review quality remain to be established for your chosen configuration. See the [validation record](https://github.com/mohamed-bal/devup-multi-agent-reviewer/blob/main/validation.md).

## Explore the implementation

| Module | Responsibility |
| :--- | :--- |
| [`src/core.mts`](src/core.mts) | Schemas, diff reconstruction, snapshot tools, evidence checks, and report rendering. |
| [`src/capture.mts`](src/capture.mts) | Capture explicitly selected paths from two Git commits. |
| [`src/agents.mts`](src/agents.mts) | SDK agents, DEVUP AI client, read-only tools, and disabled trace export. |
| [`src/pipeline.mts`](src/pipeline.mts) | Single/team scheduling, candidate IDs, and visible partial failures. |
| [`src/cli.mts`](src/cli.mts) | Opt-in live review and report output. |
| [`src/demo.mts`](src/demo.mts) | Reproducible offline demonstration. |
| [`src/score.mts`](src/score.mts) | Complete live-packet checks and manually labelled fixture metrics. |

<details>
<summary><strong>Pinned development environment</strong></summary>

Validated locally with Node.js **24.19.0**, npm **11.9.0**, and TypeScript **5.9.3**.

| Dependency | Version |
| :--- | :--- |
| `@openai/agents` | `0.20.0` |
| `openai` | `7.2.0` |
| `zod` | `4.1.12` |
| `@types/node` | `24.10.1` |

Use `npm ci` with the supplied lockfile to reproduce the dependency tree used for the local checks.

</details>

---

<p align="center">
  <strong>Build with DEVUP AI</strong><br>
  <a href="https://devupai.com">Platform</a> &nbsp;·&nbsp;
  <a href="https://docs.devupai.com/docs/integrations/openai-agents-sdk-typescript">Agents SDK integration</a> &nbsp;·&nbsp;
  <a href="https://github.com/mohamed-bal/devup-multi-agent-reviewer/blob/main/article.md">Read the full tutorial</a>
</p>

<p align="center">
  <sub>Created by Mohamed Bal · MIT-licensed code and original figures · <a href="LICENSE">License</a> · <a href="assets/README.md">Figure provenance</a></sub>
</p>
