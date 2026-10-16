# Validation record — 16 October 2026

## Completed locally

- Node.js: v24.19.0; npm: 11.9.0.
- Pinned direct runtime packages: `@openai/agents` 0.20.0, `openai` 7.2.0, `zod` 4.1.12.
- TypeScript 5.9.3 with `@types/node` 24.10.1.
- `npm test`: **55 passed, 0 failed, 0 skipped**.
- `npm run typecheck`: passed.
- `npm run demo`: passed; two scripted candidates retained for human review; no API request.
- Local Git integration test: committed blobs, dirty-tree isolation, added/deleted files, symlink rejection.
- Real-SDK protocol tests with in-memory HTTP fixtures: tool execution/replay, schema handling, request parameters, reported usage, incomplete terminal-state rejection. No network access is used by those fixture tests.
- Known pricing regression reproduced by executing only the trusted shipped fixture in the local test harness.
- Four original figures rendered and visually inspected. No live product UI screenshot is claimed.
- HTML structure checked: ten main tutorial sections and four embedded image assets. Browser layout could not be exercised in this runtime; the self-contained HTML uses ordinary responsive CSS.

## Not performed

- Live DEVUP AI requests or model compatibility verification.
- Model review-quality measurement, single/team performance comparison, or settled-cost measurement.
- General vulnerability audit or proof of prompt-injection resistance.
- Publication to a repository, DEV.to, Medium, or any social account.

## Scope

This is a bounded educational implementation. It reviews only explicitly supplied source and preserves human judgment. Exact citation checks prove source consistency, not semantic correctness. More agents and the same model can share mistakes. The team configuration has a larger total compute allowance than the baseline.
