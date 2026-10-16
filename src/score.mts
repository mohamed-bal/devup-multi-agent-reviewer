import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { check } from './core.mts';

const Scores = z.object({
  version: z.literal(1), origin: z.literal('human-labels'),
  runName: z.string().min(1), snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  // One row for EVERY retained/needs_check candidate; dropped candidates are excluded.
  candidates: z.array(z.object({ id: z.string(),
    verdict: z.enum(['true_positive', 'false_positive', 'duplicate']),
    expectedIssueId: z.string().nullable(), note: z.string().min(1),
  }).strict()),
  expectedIssueIds: z.array(z.string()),
}).strict();
export function summarize(raw: unknown) {
  const data = Scores.parse(raw);
  check(new Set(data.candidates.map(c => c.id)).size === data.candidates.length, 'DUPLICATE_LABEL_ID');
  const expected = new Set(data.expectedIssueIds), found = new Set<string>();
  check(expected.size === data.expectedIssueIds.length, 'DUPLICATE_EXPECTED_ID');
  let tp = 0, fp = 0, duplicates = 0;
  for (const c of data.candidates) {
    if (c.verdict === 'true_positive') {
      check(c.expectedIssueId && expected.has(c.expectedIssueId) && !found.has(c.expectedIssueId), 'INVALID_TRUE_POSITIVE');
      found.add(c.expectedIssueId); tp++;
    } else {
      if (c.verdict === 'duplicate') {
        check(c.expectedIssueId && expected.has(c.expectedIssueId), 'INVALID_DUPLICATE'); duplicates++;
      } else { check(c.expectedIssueId === null, 'FALSE_POSITIVE_HAS_EXPECTED_ID'); fp++; }
    }
  }
  return { runName: data.runName, snapshotHash: data.snapshotHash,
    truePositives: tp, falsePositives: fp, duplicates,
    precision: data.candidates.length ? tp / data.candidates.length : null,
    recall: expected.size ? found.size / expected.size : null,
    missedIssueIds: [...expected].filter(id => !found.has(id)),
    note: 'Human-labelled fixture coverage only; not general review accuracy. Duplicates count against precision.',
  };
}
export function scoreRun(packet: any, labels: unknown) {
  const data = Scores.parse(labels);
  check(packet?.complete === true && packet.origin === 'live', 'COMPLETE_LIVE_RUN_REQUIRED');
  check(packet.snapshotHash === data.snapshotHash, 'LABEL_SNAPSHOT_MISMATCH');
  check(Array.isArray(packet.candidates) && Array.isArray(packet.decisions), 'INVALID_RUN_PACKET');
  const candidateIds = packet.candidates.filter((c: any) =>
    packet.decisions.find((d: any) => d.candidateId === c.id)?.decision !== 'drop').map((c: any) => c.id).sort();
  const labelIds = data.candidates.map(c => c.id).sort();
  check(JSON.stringify(candidateIds) === JSON.stringify(labelIds), 'LABEL_EVERY_RETAINED_CANDIDATE');
  return summarize(data);
}
// Intentionally no model-as-judge scoring and no fabricated live results.
if (process.argv[1]?.endsWith('score.mts')) {
  const [packetPath, labels, output] = process.argv.slice(2);
  check(packetPath && labels && output, 'Usage: npm run score -- review.json labels.json score.json');
  const score = scoreRun(JSON.parse(readFileSync(packetPath, 'utf8')), JSON.parse(readFileSync(labels, 'utf8')));
  writeFileSync(output, JSON.stringify(score, null, 2) + '\n', { flag: 'wx' });
  console.log('Saved human-labelled fixture score.');
}
