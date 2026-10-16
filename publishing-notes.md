# Publication handoff

## Ready

- `article.md`: English DEV.to-style draft with front matter, `published: false`.
- `article-preview.html`: self-contained reading preview; images are embedded.
- `assets/01-cover.png`: cover, 1600×900.
- `assets/02-architecture.png`: implementation flow.
- `assets/03-evidence.png`: actual pricing fixture and exact-evidence boundary.
- `assets/04-report.png`: local preview of the scripted demo packet.
- Source, pinned lockfile, fixtures, local tests, evaluation guide, MIT license.

## Before publishing

1. Upload the source to a real repository you control. Add its actual URL near the article's setup section and closing paragraph. No repository URL has been invented or created here.
2. Upload the four PNGs to the publishing platform. Replace the four relative image paths with the actual returned URLs and set the uploaded cover as the article cover. Keep the captions and alternative text.
3. Optionally run the small public fixture against DEVUP AI. Record the exact model and configuration. The present article is valid as an implementation tutorial without claiming live compatibility or comparative quality results.
4. If adding live results, label them manually, include failures, and keep the team-versus-single budget difference explicit. Never substitute the scripted demo for live output.
5. Preview the published-platform layout, especially wide code blocks and image captions. Keep the disclosure and distinction between source validation and semantic truth.
6. If cross-posting to Medium, choose the genuine first publication as the canonical URL after it exists.

## Editorial boundaries

- All integration details come from public APIs/documentation; no private platform internals.
- No upstream infrastructure supplier information or USD pricing.
- No claim that DEVUP Code's Agent mode is released or that this lab is that product.
- No invented downloads, performance gains, cost savings, benchmark scores, or live screenshots.
- Package dependencies are the locally exercised versions; re-check current model capability before making live requests.

## Suggested description

Build a read-only TypeScript code review pipeline with DEVUP AI: two specialists, an adjudicator, exact source citations, visible failures, and a single-agent baseline you can evaluate.
