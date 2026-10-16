import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { review } from '../src/pipeline.mts';
import type { Invoke } from '../src/pipeline.mts';
import { summarize, scoreRun } from '../src/score.mts';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/discount-regression.json', import.meta.url), 'utf8'));
const scripted = JSON.parse(readFileSync(new URL('../fixtures/scripted-reviews.json', import.meta.url), 'utf8'));
const metrics = { model: 'scripted', elapsedMs: 0, requests: 0, inputTokens: 0, outputTokens: 0, toolCalls: 0 };
const invoke: Invoke = async ({ role }) => ({ output: structuredClone(scripted[role]), metrics });

test('single baseline runs once and keeps locally validated candidates', async () => {
  const roles: string[] = [];
  const packet = await review(fixture, 'single', async input => { roles.push(input.role); return invoke(input); }, 'scripted-demo');
  assert.deepEqual(roles, ['single']); assert.equal(packet.complete, true);
  assert.equal(packet.candidates.length, 2); assert.equal(packet.requiresHumanReview, true);
});
test('team waits for both reviewers before adjudication', async () => {
  const completed = new Set<string>();
  const packet = await review(fixture, 'team', async input => {
    if (input.role === 'adjudicator') assert.deepEqual([...completed].sort(), ['correctness', 'tests']);
    else completed.add(input.role);
    return invoke(input);
  }, 'scripted-demo');
  assert.equal(packet.complete, true); assert.equal(packet.decisions.length, 2);
});
test('a failed reviewer cannot become a successful clean review', async () => {
  const packet = await review(fixture, 'team', async input => {
    if (input.role === 'tests') throw new Error('failure');
    assert.notEqual(input.role, 'adjudicator'); return invoke(input);
  }, 'scripted-demo');
  assert.equal(packet.complete, false); assert.equal(packet.candidates.length, 1);
  assert.equal(packet.decisions[0].decision, 'needs_check');
  assert.equal((packet.metrics as any).usageComplete, false);
});
test('malformed reviewer evidence marks the stage as failed', async () => {
  const packet = await review(fixture, 'single', async () => ({ output: { findings: [{ nope: true }] }, metrics }), 'scripted-demo');
  assert.equal(packet.complete, false); assert.equal(packet.candidates.length, 0);
});
test('specialists cannot return the wrong finding category', async () => {
  const packet = await review(fixture, 'team', async input => input.role === 'tests'
    ? { output: scripted.correctness, metrics } : invoke(input), 'scripted-demo');
  assert.equal(packet.complete, false);
});
test('adjudicator failure preserves candidates as needs_check', async () => {
  const packet = await review(fixture, 'team', async input => {
    if (input.role === 'adjudicator') throw new Error('failure'); return invoke(input);
  }, 'scripted-demo');
  assert.equal(packet.complete, false); assert.equal(packet.candidates.length, 2);
  assert.ok(packet.decisions.every(d => d.decision === 'needs_check'));
});
test('unknown adjudicator IDs reject the entire adjudication', async () => {
  const packet = await review(fixture, 'team', async input => input.role === 'adjudicator'
    ? { output: { decisions: [{ candidateId: 'invented', decision: 'keep', reason: 'x' }] }, metrics }
    : invoke(input), 'scripted-demo');
  assert.equal(packet.complete, false);
});
test('empty successful reviewers skip adjudication without claiming correctness', async () => {
  const packet = await review(fixture, 'team', async () => ({ output: { findings: [] }, metrics }), 'scripted-demo');
  assert.equal(packet.complete, true); assert.equal((packet.metrics as any).stages.length, 2);
});
test('pipeline snapshots are frozen and detached from caller input', async () => {
  const raw = structuredClone(fixture);
  await review(raw, 'single', async input => {
    raw.files[0].after = 'changed outside run';
    assert.notEqual(input.snapshot.files[0].after, raw.files[0].after);
    assert.throws(() => { input.snapshot.files[0].after = 'mutated'; });
    return invoke(input);
  }, 'scripted-demo');
});
test('hand-labelled scoring counts duplicates against precision', () => {
  const s = summarize({ version: 1, origin: 'human-labels', runName: 'manual example', snapshotHash: 'a'.repeat(64),
    expectedIssueIds: ['A', 'B'], candidates: [
      { id: 'C001', verdict: 'true_positive', expectedIssueId: 'A', note: 'Reviewed manually.' },
      { id: 'C002', verdict: 'duplicate', expectedIssueId: 'A', note: 'Same issue.' },
      { id: 'C003', verdict: 'false_positive', expectedIssueId: null, note: 'Unsupported.' },
    ] });
  assert.equal(s.precision, 1 / 3); assert.equal(s.recall, 0.5); assert.deepEqual(s.missedIssueIds, ['B']);
});
test('the same expected issue cannot receive two true-positive labels', () => assert.throws(() => summarize({
  version: 1, origin: 'human-labels', runName: 'x', snapshotHash: 'a'.repeat(64), expectedIssueIds: ['A'],
  candidates: ['C001', 'C002'].map(id => ({ id, verdict: 'true_positive', expectedIssueId: 'A', note: 'x' })),
}), /INVALID_TRUE_POSITIVE/));

const labels = () => ({ version: 1, origin: 'human-labels', runName: 'x', snapshotHash: 'a'.repeat(64),
  expectedIssueIds: ['A'], candidates: [{ id: 'C001', verdict: 'true_positive', expectedIssueId: 'A', note: 'Manual fixture annotation.' }] });
const scoredPacket = () => ({ origin: 'live', complete: true, snapshotHash: 'a'.repeat(64), candidates: [{ id: 'C001' }],
  decisions: [{ candidateId: 'C001', decision: 'keep' }] });
test('scoring requires complete live runs', () => {
  assert.throws(() => scoreRun({ ...scoredPacket(), origin: 'scripted-demo' }, labels()), /COMPLETE_LIVE_RUN_REQUIRED/);
  assert.throws(() => scoreRun({ ...scoredPacket(), complete: false }, labels()), /COMPLETE_LIVE_RUN_REQUIRED/);
});
test('scoring rejects a mismatched snapshot hash', () => assert.throws(() => scoreRun({ ...scoredPacket(), snapshotHash: 'b'.repeat(64) }, labels()), /LABEL_SNAPSHOT_MISMATCH/));
test('scoring rejects missing retained-candidate labels', () => assert.throws(() => scoreRun(scoredPacket(), { ...labels(), candidates: [] }), /LABEL_EVERY_RETAINED_CANDIDATE/));
test('scoring accepts complete candidate coverage', () => assert.equal(scoreRun(scoredPacket(), labels()).recall, 1));
test('empty clean-case denominators are null', () => {
  const score = summarize({ ...labels(), candidates: [], expectedIssueIds: [] });
  assert.equal(score.precision, null); assert.equal(score.recall, null);
});

test('the shipped zero-discount assertion misses the seeded regression', async () => {
  // Executes only the trusted, shipped teaching fixture; the reviewer never executes input code.
  const trusted = fixture.files[0];
  const old = await import('data:text/javascript;base64,' + Buffer.from(trusted.before).toString('base64'));
  const changed = await import('data:text/javascript;base64,' + Buffer.from(trusted.after).toString('base64'));
  assert.equal(old.discountedTotal(10000, 0), 10000);
  assert.equal(changed.discountedTotal(10000, 0), 10000);
  assert.equal(old.discountedTotal(10000, 20), 8000);
  assert.equal(changed.discountedTotal(10000, 20), -190000);
  assert.throws(() => assert.equal(changed.discountedTotal(10000, 20), 8000));
});
