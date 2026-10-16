import { createHash } from 'node:crypto';
import { z } from 'zod';

export const LIMITS = Object.freeze({
  snapshotBytes: 160_000, files: 8, fileChars: 16_000,
  diffChars: 20_000, linesPerRead: 80, findings: 12,
  maxTurns: 6, toolCalls: 12, deadlineMs: 90_000,
});

export function check(ok: unknown, code: string): asserts ok {
  if (!ok) throw new Error(code);
}
export function validPath(path: string): boolean {
  return path.length <= 180 && /^[A-Za-z0-9_./-]+$/.test(path)
    && !path.startsWith('/') && path.split('/').every(p => p && p !== '.' && p !== '..')
    && !path.split('/').some(p => /^(?:\.env(?:\.|$)|node_modules$|\.git$)/i.test(p))
    && /\.(?:[cm]?js|jsx|ts|tsx|json|md)$/.test(path);
}
const FileSchema = z.object({
  path: z.string().refine(validPath, 'UNSUPPORTED_PATH'),
  before: z.string().max(LIMITS.fileChars).nullable(),
  after: z.string().max(LIMITS.fileChars).nullable(),
  diff: z.string().max(LIMITS.diffChars),
}).strict();
export const SnapshotSchema = z.object({
  version: z.literal(1), source: z.enum(['fixture', 'git-commits']),
  base: z.string().regex(/^[a-f0-9]{40}$/),
  head: z.string().regex(/^[a-f0-9]{40}$/),
  files: z.array(FileSchema).min(1).max(LIMITS.files),
}).strict();
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type Side = 'before' | 'after';

export function lines(text: string | null): string[] {
  if (text === null || text === '') return [];
  const result = text.split('\n');
  if (result.at(-1) === '') result.pop();
  return result;
}

// Verify hunk contents against BOTH snapshots and reconstruct the post-change lines.
// Deliberately supports ordinary, single-file unified diffs, not combined/binary diffs.
export function changedLines(file: Snapshot['files'][number]) {
  const before = lines(file.before), after = lines(file.after);
  const changed = { before: new Set<number>(), after: new Set<number>() };
  check(file.before !== null || file.after !== null, 'MISSING_BOTH_SIDES');
  if (!file.diff) {
    check(file.before === file.after, 'MISSING_DIFF');
    return changed;
  }
  const reconstructed: string[] = [];
  let old = 0, next = 0, remainingOld = 0, remainingNew = 0;
  let inHunk = false, hunks = 0;
  for (const line of lines(file.diff)) {
    const h = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (h) {
      check(remainingOld === 0 && remainingNew === 0, 'TRUNCATED_HUNK');
      const oldCount = Number(h[2] ?? 1), newCount = Number(h[4] ?? 1);
      const startOld = Number(h[1]) - (oldCount > 0 ? 1 : 0);
      const startNew = Number(h[3]) - (newCount > 0 ? 1 : 0);
      check(startOld >= old && startOld <= before.length, 'BAD_HUNK_ORDER');
      reconstructed.push(...before.slice(old, startOld));
      check(reconstructed.length === startNew, 'BAD_NEW_OFFSET');
      old = startOld; next = startNew;
      remainingOld = oldCount; remainingNew = newCount;
      inHunk = true; hunks++; continue;
    }
    if (line === '\\ No newline at end of file') continue;
    if (!inHunk) {
      check(/^(?:diff --git |index |--- |\+\+\+ |new file mode |deleted file mode )/.test(line), 'UNSUPPORTED_DIFF');
      continue;
    }
    const prefix = line[0], value = line.slice(1);
    check(prefix === ' ' || prefix === '-' || prefix === '+', 'INVALID_HUNK_LINE');
    if (prefix !== '+') {
      check(remainingOld > 0 && before[old] === value, 'BEFORE_DIFF_MISMATCH');
      if (prefix === '-') changed.before.add(old + 1);
      old++; remainingOld--;
    }
    if (prefix !== '-') {
      check(remainingNew > 0 && after[next] === value, 'AFTER_DIFF_MISMATCH');
      if (prefix === '+') changed.after.add(next + 1);
      reconstructed.push(value); next++; remainingNew--;
    }
  }
  check(hunks > 0 && remainingOld === 0 && remainingNew === 0, 'TRUNCATED_DIFF');
  reconstructed.push(...before.slice(old));
  check(JSON.stringify(reconstructed) === JSON.stringify(after), 'DIFF_RECONSTRUCTION_MISMATCH');
  return changed;
}

export function loadSnapshot(raw: unknown): Snapshot {
  const serialized = JSON.stringify(raw);
  check(typeof serialized === 'string' && Buffer.byteLength(serialized) <= LIMITS.snapshotBytes, 'SNAPSHOT_TOO_LARGE');
  const snapshot = SnapshotSchema.parse(raw);
  const seen = new Set<string>();
  let changed = false;
  for (const file of snapshot.files) {
    check(!seen.has(file.path), 'DUPLICATE_PATH'); seen.add(file.path);
    for (const text of [file.before, file.after, file.diff]) {
      check(text === null || !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text), 'CONTROL_CHARACTER');
    }
    const anchors = changedLines(file);
    changed ||= anchors.before.size + anchors.after.size > 0;
  }
  check(changed, 'NO_CHANGED_LINES');
  return snapshot;
}
export function snapshotHash(snapshot: Snapshot): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export const EvidenceSchema = z.object({
  path: z.string(), side: z.enum(['before', 'after']),
  startLine: z.number().int().min(1), endLine: z.number().int().min(1),
  quote: z.string().min(1).max(2500),
}).strict();
export const FindingSchema = z.object({
  kind: z.enum(['correctness', 'test_gap']),
  title: z.string().min(1).max(160),
  explanation: z.string().min(1).max(1600),
  verification: z.string().min(1).max(800),
  evidence: z.array(EvidenceSchema).min(1).max(3),
}).strict();
export const ReviewSchema = z.object({ findings: z.array(FindingSchema).max(LIMITS.findings) }).strict();
export type Finding = z.infer<typeof FindingSchema>;

export function validateReview(raw: unknown, snapshot: Snapshot): Finding[] {
  const review = ReviewSchema.parse(raw);
  for (const finding of review.findings) {
    let touchesChange = false;
    for (const e of finding.evidence) {
      const file = snapshot.files.find(f => f.path === e.path);
      check(file, 'UNKNOWN_EVIDENCE_PATH');
      const source = lines(file[e.side]);
      check(e.endLine >= e.startLine && e.endLine <= source.length && e.endLine - e.startLine < 40, 'INVALID_EVIDENCE_RANGE');
      check(source.slice(e.startLine - 1, e.endLine).join('\n') === e.quote, 'EVIDENCE_MISMATCH');
      const changed = changedLines(file)[e.side];
      for (let n = e.startLine; n <= e.endLine; n++) touchesChange ||= changed.has(n);
    }
    check(touchesChange, 'NO_CHANGED_ANCHOR');
  }
  return review.findings;
}

export type ReadArgs = { path: string; side: Side; startLine: number; endLine: number };
export function snapshotTools(snapshot: Snapshot) {
  let calls = 0;
  const tick = () => check(++calls <= LIMITS.toolCalls, 'TOOL_BUDGET_EXCEEDED');
  return {
    listFiles() {
      tick();
      return snapshot.files.map(f => ({ path: f.path, beforeLines: lines(f.before).length, afterLines: lines(f.after).length }));
    },
    getDiff(path: string) {
      tick(); const file = snapshot.files.find(f => f.path === path);
      check(file, 'UNKNOWN_PATH'); return file.diff || '(unchanged context file)';
    },
    readLines(args: ReadArgs) {
      tick(); const file = snapshot.files.find(f => f.path === args.path);
      check(file && (args.side === 'before' || args.side === 'after'), 'UNKNOWN_PATH_OR_SIDE');
      const source = lines(file[args.side]);
      check(Number.isInteger(args.startLine) && Number.isInteger(args.endLine)
        && args.startLine >= 1 && args.endLine >= args.startLine
        && args.endLine <= source.length && args.endLine - args.startLine < LIMITS.linesPerRead, 'INVALID_READ_RANGE');
      return source.slice(args.startLine - 1, args.endLine)
        .map((text, i) => ({ line: args.startLine + i, text }));
    },
    get callCount() { return calls; },
  };
}

export type Candidate = Finding & { id: string; from: string };
export const DecisionSchema = z.object({ decisions: z.array(z.object({
  candidateId: z.string(), decision: z.enum(['keep', 'drop', 'needs_check']),
  reason: z.string().min(1).max(1000),
}).strict()).max(LIMITS.findings * 2) }).strict();

export function validateDecisions(raw: unknown, candidates: Candidate[]) {
  const value = DecisionSchema.parse(raw);
  const ids = new Set(candidates.map(c => c.id)), seen = new Set<string>();
  for (const d of value.decisions) {
    check(ids.has(d.candidateId) && !seen.has(d.candidateId), 'INVALID_DECISION_ID');
    seen.add(d.candidateId);
  }
  check(seen.size === ids.size, 'INCOMPLETE_DECISIONS');
  return value.decisions;
}

// Escape model-generated text before embedding it in Markdown/HTML previews.
export const escapeMarkdown = (s: string) => s.replace(/[&<>`*_\[\]{}()#!|~\\]/g, c => `&#${c.charCodeAt(0)};`);
export type Packet = {
  version: 1; origin: 'scripted-demo' | 'live'; mode: 'single' | 'team';
  snapshotHash: string; complete: boolean; errors: string[];
  candidates: Candidate[]; decisions: z.infer<typeof DecisionSchema>['decisions'];
  metrics: unknown; requiresHumanReview: true;
};
export function renderReport(packet: Packet): string {
  const out = ['# Code review draft', '', `Origin: **${packet.origin}** · Mode: **${packet.mode}**`,
    `Run: **${packet.complete ? 'complete' : 'INCOMPLETE'}** · Human review required`,
    `Snapshot SHA-256: \`${packet.snapshotHash}\``, '',
    '“Keep” means retained for human review, not a verified bug. No code was executed.', ''];
  for (const error of packet.errors) out.push(`- Stage failure: ${escapeMarkdown(error)}`);
  for (const c of packet.candidates) {
    const d = packet.decisions.find(d => d.candidateId === c.id);
    out.push(`## ${c.id} · ${d?.decision ?? 'needs_check'} · ${escapeMarkdown(c.title)}`, '',
      `Kind: ${c.kind} · Reviewer: ${escapeMarkdown(c.from)}`, '', escapeMarkdown(c.explanation), '',
      `**Verify:** ${escapeMarkdown(c.verification)}`, '',
      `**Adjudication:** ${escapeMarkdown(d?.reason ?? 'No completed adjudication; inspect manually.')}`, '');
    for (const e of c.evidence) {
      out.push(`**${escapeMarkdown(e.path)} · ${e.side} · L${e.startLine}–L${e.endLine}**`, '',
        ...e.quote.split('\n').map(line => `> ${escapeMarkdown(line)}`), '');
    }
  }
  if (!packet.candidates.length) out.push('No candidate findings. This is not proof that the change is correct.', '');
  return out.join('\n');
}
