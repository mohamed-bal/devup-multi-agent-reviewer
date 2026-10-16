# DEVUP AI Multi-Agent Code Review Lab

A small, read-only TypeScript lab: two reviewers, local evidence checks, an adjudicator, and a single-agent baseline. The included demo is scripted. No live model-quality result is claimed.

## Start without an API key

Requires Node.js 24 and npm. Git is needed for capture and its local integration test.

```bash
npm ci
npm test
npm run typecheck
npm run demo
```

Open `out/demo/review.md`. The demo makes no API requests. `article.md` is the full English tutorial; `article-preview.html` is a self-contained reading copy with embedded figures.

## Live review

Copy `.env.example` to `.env` and fill in your private DEVUP AI key and exact current model ID. Select a model supporting tools and structured output through Responses. Do not commit the key.

```bash
node --env-file=.env src/cli.mts fixtures/discount-regression.json single out/discount-single-01
node --env-file=.env src/cli.mts fixtures/discount-regression.json team out/discount-team-01
```

These commands consume API balance. A new output directory is required for every run. Success writes `review.json` and `review.md`. Incomplete pipelines also write a packet and return exit code 2. Configuration/capture failures throw before a review packet is produced.

The 90-second pipeline signal and six-turn per-agent limit bound work. They are not a guaranteed spend limit. Already processed requests may be billed, including failed runs. Reported token totals are not settled cost; `costDzd` is deliberately `null`.

## Capture your own committed change

```bash
npm run capture -- /path/to/repository HEAD~1 HEAD snapshot.json src/pricing.mjs tests/pricing.test.mjs CONTRACT.md
```

- Supply only the exact files needed, including relevant unchanged context files.
- Inspect the snapshot before any live request; this is the source the agents can retrieve.
- The script resolves both refs and reads Git blobs, never the working tree.
- Supported files: small UTF-8 `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`, `.json`, and `.md` files with simple paths; 8 files maximum.
- The teaching collector requires 40-character SHA-1 commits and ordinary content diffs. It rejects symlinks and binary/control-character content. Newline-only/mode-only changes and complex rename handling are not its target.
- Filename restrictions do not detect secrets embedded in otherwise valid source.
- The snapshot does not include the whole repository. Missing context limits review quality.

After inspection:

```bash
node --env-file=.env src/cli.mts snapshot.json single out/custom-single-01
node --env-file=.env src/cli.mts snapshot.json team out/custom-team-01
```

## Modules

| File | Role |
| --- | --- |
| `src/core.mts` | Schemas, diff reconstruction, snapshot-only tools, evidence checks, report rendering |
| `src/capture.mts` | Explicit-path committed-source capture |
| `src/agents.mts` | Real SDK, bounded tools, DEVUP AI client, trace export disabled |
| `src/pipeline.mts` | Code-controlled single/team scheduling and visible partial failure |
| `src/demo.mts` | Hand-authored offline demo |
| `src/score.mts` | Complete live-packet checks and manually labelled fixture metrics |
| `tests/sdk.test.mts` | Real SDK with an in-memory HTTP fixture; no live connection |

## Evaluation

Read `evaluation.md`. The three shipped fixtures and rubric are teaching examples, not a representative benchmark. Repeat both modes on the same snapshots and record failures. Team mode has more total computation: it is a pipeline comparison, not an equal-budget experiment.

An exact source quote confirms location. It does not prove the model's explanation. `keep` means retained for a human, not verified or approved. No supplied snapshot code is executed by the review pipeline.

## Reproducibility

Validated locally with Node.js 24.19.0. `package.json` and `package-lock.json` pin the dependency tree used by the local checks. The live endpoint/model combination remains unverified here. No API key is supplied.

No repository has been published or remote comments posted by this package. Assets are original SVG/PNG figures plus a rendered scripted-demo report. See `assets/README.md` for provenance and captions.

License: MIT for code and original figures; see `LICENSE`.
