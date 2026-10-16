import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSnapshot, validateReview, snapshotTools, snapshotHash, changedLines,
  LIMITS, validPath, renderReport, validateDecisions } from '../src/core.mts';

const get = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
const fixture = () => loadSnapshot(get('discount-regression'));
const finding = () => get('scripted-reviews').correctness.findings[0];

for (const name of ['discount-regression', 'clean-refactor', 'removed-validation']) {
  test(`loads and reconstructs ${name}`, () => assert.equal(loadSnapshot(get(name)).files.length, 3));
}
for (const path of ['../x.mjs', '/x.ts', 'src/../x.ts', '.env', '.env.production.js',
  'node_modules/x.js', '.git/config.json', 'src/x;touch.ts', 'src/a:b.ts', 'src/x.png', 'src//x.ts']) {
  test(`rejects path ${path}`, () => assert.equal(validPath(path), false));
}
test('permits ordinary explicit source paths', () => assert.ok(validPath('tests/pricing.test.mjs')));
test('rejects oversized snapshot before schema traversal', () => assert.throws(() => loadSnapshot({ text: 'x'.repeat(LIMITS.snapshotBytes) }), /SNAPSHOT_TOO_LARGE/));
test('rejects duplicate paths', () => {
  const s = get('discount-regression'); s.files.push(s.files[0]);
  assert.throws(() => loadSnapshot(s), /DUPLICATE_PATH/);
});
test('rejects changed source without matching diff', () => {
  const s = get('discount-regression'); s.files[0].after += 'bad\n';
  assert.throws(() => loadSnapshot(s), /DIFF_RECONSTRUCTION_MISMATCH/);
});
test('rejects truncated hunks', () => {
  const s = get('discount-regression'); s.files[0].diff = s.files[0].diff.split('\n').slice(0, 4).join('\n');
  assert.throws(() => loadSnapshot(s));
});
test('rejects a snapshot with no content changes', () => {
  const s = get('discount-regression'); s.files = [s.files[1]];
  assert.throws(() => loadSnapshot(s), /NO_CHANGED_LINES/);
});
test('rejects terminal control characters', () => {
  const s = get('discount-regression'); s.files[1].after += '\u001b[31m';
  assert.throws(() => loadSnapshot(s), /CONTROL_CHARACTER/);
});
test('records both removed and added lines', () => {
  const c = changedLines(fixture().files[0]);
  assert.deepEqual([...c.before], [2]); assert.deepEqual([...c.after], [2]);
});
test('valid source evidence is accepted', () => assert.equal(validateReview({ findings: [finding()] }, fixture()).length, 1));
test('rejects invented quotes', () => {
  const f = finding(); f.evidence[0].quote = 'invented';
  assert.throws(() => validateReview({ findings: [f] }, fixture()), /EVIDENCE_MISMATCH/);
});
test('rejects invalid source ranges', () => {
  const f = finding(); f.evidence[0].endLine = 999;
  assert.throws(() => validateReview({ findings: [f] }, fixture()), /INVALID_EVIDENCE_RANGE/);
});
test('rejects invented files', () => {
  const f = finding(); f.evidence[0].path = 'secret.ts';
  assert.throws(() => validateReview({ findings: [f] }, fixture()), /UNKNOWN_EVIDENCE_PATH/);
});
test('requires at least one changed-line anchor', () => {
  const f = finding(); f.evidence[0] = { path: 'src/pricing.mjs', side: 'after', startLine: 1, endLine: 1,
    quote: fixture().files[0].after!.split('\n')[0] };
  assert.throws(() => validateReview({ findings: [f] }, fixture()), /NO_CHANGED_ANCHOR/);
});
test('exact quotes do not prove semantic truth', () => {
  const f = finding(); f.explanation = 'This function launches a rocket.';
  assert.equal(validateReview({ findings: [f] }, fixture()).length, 1);
});
test('deleted-line evidence can be cited on before side', () => {
  const s = loadSnapshot(get('removed-validation')); const f = finding();
  f.evidence = [{ path: 'src/quantity.mjs', side: 'before', startLine: 2, endLine: 2,
    quote: s.files[0].before!.split('\n')[1] }];
  assert.equal(validateReview({ findings: [f] }, s).length, 1);
});
test('snapshot hash changes when source changes', () => assert.notEqual(snapshotHash(fixture()), snapshotHash(loadSnapshot(get('clean-refactor')))));
test('read tool cannot leave supplied snapshot', () => assert.throws(() => snapshotTools(fixture()).readLines({ path: '../x', side: 'after', startLine: 1, endLine: 1 }), /UNKNOWN_PATH/));
test('read tool rejects invalid range', () => assert.throws(() => snapshotTools(fixture()).readLines({ path: 'src/pricing.mjs', side: 'after', startLine: 0, endLine: 1 }), /INVALID_READ_RANGE/));
test('tool budget is finite', () => {
  const tools = snapshotTools(fixture());
  for (let i = 0; i < LIMITS.toolCalls; i++) tools.listFiles();
  assert.throws(() => tools.listFiles(), /TOOL_BUDGET_EXCEEDED/);
});
test('adjudication cannot omit IDs or add new ones', () => {
  const c = [{ ...finding(), id: 'C001', from: 'correctness' }];
  assert.throws(() => validateDecisions({ decisions: [] }, c), /INCOMPLETE_DECISIONS/);
  assert.throws(() => validateDecisions({ decisions: [{ candidateId: 'C999', decision: 'keep', reason: 'x' }] }, c), /INVALID_DECISION_ID/);
});
test('report escapes model HTML and Markdown', () => {
  const candidate = { ...finding(), id: 'C001', from: 'single', title: '<script>alert(1)</script> ![x](https://x)' };
  const report = renderReport({ version: 1, origin: 'scripted-demo', mode: 'single', snapshotHash: 'a', complete: true,
    errors: [], candidates: [candidate], decisions: [], metrics: {}, requiresHumanReview: true });
  assert.ok(!report.includes('<script>')); assert.ok(!report.includes('![x]('));
});
