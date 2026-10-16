import { LIMITS, loadSnapshot, snapshotHash, validateReview, validateDecisions } from './core.mts';
import type { Snapshot, Candidate, Packet } from './core.mts';

export type Role = 'single' | 'correctness' | 'tests' | 'adjudicator';
export type StageMetrics = {
  model: string; elapsedMs: number; requests: number;
  inputTokens: number; outputTokens: number; toolCalls: number;
};
export type StageInput = { role: Role; snapshot: Snapshot; candidates: Candidate[]; signal: AbortSignal };
export type Invoke = (input: StageInput) => Promise<{ output: unknown; metrics: StageMetrics }>;

export async function review(
  raw: unknown, mode: 'single' | 'team', invoke: Invoke,
  origin: Packet['origin'] = 'live',
): Promise<Packet> {
  // Clone and validate once; mutations to the caller's object cannot change this run.
  const snapshot = loadSnapshot(JSON.parse(JSON.stringify(raw)));
  for (const file of snapshot.files) Object.freeze(file);
  Object.freeze(snapshot.files); Object.freeze(snapshot);
  const started = performance.now();
  const signal = AbortSignal.timeout(LIMITS.deadlineMs);
  const roles: Role[] = mode === 'single' ? ['single'] : ['correctness', 'tests'];
  const stages: Array<{ role: Role; status: string; metrics: StageMetrics | null }> = [];
  const errors: string[] = [], candidates: Candidate[] = [];
  const settled = await Promise.allSettled(roles.map(async role => {
    const response = await invoke({ role, snapshot, candidates: [], signal });
    const findings = validateReview(response.output, snapshot);
    if (role !== 'single' && findings.some(f => f.kind !== (role === 'tests' ? 'test_gap' : 'correctness'))) {
      throw new Error('WRONG_REVIEWER_KIND');
    }
    return { ...response, findings };
  }));
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i], role = roles[i];
    if (result.status === 'rejected') {
      errors.push(`${role}: stage failed or output rejected`);
      stages.push({ role, status: 'failed', metrics: null }); continue;
    }
    stages.push({ role, status: 'complete', metrics: result.value.metrics });
    for (const f of result.value.findings) {
      candidates.push({ ...f, id: `C${String(candidates.length + 1).padStart(3, '0')}`, from: role });
    }
  }
  let decisions: Packet['decisions'] = candidates.map(c => ({
    candidateId: c.id, decision: mode === 'single' && !errors.length ? 'keep' : 'needs_check',
    reason: mode === 'single' ? 'Single-reviewer baseline; no adjudication.' : 'Adjudication not completed.',
  }));
  if (mode === 'team' && !errors.length && candidates.length) {
    try {
      const result = await invoke({ role: 'adjudicator', snapshot, candidates, signal });
      decisions = validateDecisions(result.output, candidates);
      stages.push({ role: 'adjudicator', status: 'complete', metrics: result.metrics });
    } catch {
      errors.push('adjudicator: stage failed or output rejected');
      stages.push({ role: 'adjudicator', status: 'failed', metrics: null });
    }
  }
  return {
    version: 1, origin, mode, snapshotHash: snapshotHash(snapshot),
    complete: !errors.length, errors, candidates, decisions,
    requiresHumanReview: true,
    metrics: {
      wallMs: Math.round(performance.now() - started), stages,
      // A failed request may still be billed; missing usage is never reported as zero.
      usageComplete: !errors.length, costDzd: null,
      costNote: 'Settled DZD cost is not collected by this lab. Inspect dashboard billing separately.',
    },
  };
}
