import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { devupClient, sdkInvoker } from './agents.mts';
import { review } from './pipeline.mts';
import { LIMITS, check, renderReport } from './core.mts';

const [input, mode, outputDir] = process.argv.slice(2);
check(input && (mode === 'single' || mode === 'team') && outputDir,
  'Usage: npm run review -- snapshot.json single|team out/run-name');
const model = process.env.DEVUP_REVIEW_MODEL;
check(model && !model.startsWith('REPLACE_'), 'Set DEVUP_REVIEW_MODEL to a tool/schema-capable catalog model.');
const bytes = await readFile(input);
check(bytes.length <= LIMITS.snapshotBytes, 'SNAPSHOT_TOO_LARGE');
// Refuse to reuse a directory, so failed runs cannot leave a stale successful report.
await mkdir(dirname(resolve(outputDir)), { recursive: true });
await mkdir(resolve(outputDir), { recursive: false });
const packet = await review(JSON.parse(bytes.toString('utf8')), mode, sdkInvoker(devupClient(), model));
await writeFile(resolve(outputDir, 'review.json'), JSON.stringify(packet, null, 2) + '\n', { flag: 'wx' });
await writeFile(resolve(outputDir, 'review.md'), renderReport(packet), { flag: 'wx' });
console.log(`Saved ${mode} review. Status: ${packet.complete ? 'complete' : 'INCOMPLETE'}. Human review required.`);
if (!packet.complete) process.exitCode = 2;
