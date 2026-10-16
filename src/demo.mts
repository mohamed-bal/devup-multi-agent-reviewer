import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { review } from './pipeline.mts';
import { snapshotTools, renderReport } from './core.mts';

const snapshot = JSON.parse(await readFile(new URL('../fixtures/discount-regression.json', import.meta.url), 'utf8'));
const scripted = JSON.parse(await readFile(new URL('../fixtures/scripted-reviews.json', import.meta.url), 'utf8'));
const packet = await review(snapshot, 'team', async ({ role, snapshot }) => {
  const tools = snapshotTools(snapshot);
  tools.listFiles(); tools.getDiff('src/pricing.mjs');
  tools.readLines({ path: 'src/pricing.mjs', side: 'after', startLine: 1, endLine: 3 });
  return { output: scripted[role], metrics: {
    model: 'scripted-fixture', elapsedMs: 0, requests: 0,
    inputTokens: 0, outputTokens: 0, toolCalls: tools.callCount,
  } };
}, 'scripted-demo');
await mkdir('out/demo', { recursive: true });
await writeFile('out/demo/review.json', JSON.stringify(packet, null, 2) + '\n');
await writeFile('out/demo/review.md', renderReport(packet));
console.log('SCRIPTED DEMO — no API requests, no model-quality measurement.');
console.log('Snapshot: discount-regression.json');
console.log(`Candidates: ${packet.candidates.length} · retained for human review: ${packet.decisions.filter(d => d.decision === 'keep').length}`);
console.log('Draft saved to out/demo/review.md and review.json.');
