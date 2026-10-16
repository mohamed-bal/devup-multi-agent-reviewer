import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import OpenAI from 'openai';
import { sdkInvoker } from '../src/agents.mts';
import { loadSnapshot, validateReview } from '../src/core.mts';

const raw = JSON.parse(readFileSync(new URL('../fixtures/discount-regression.json', import.meta.url), 'utf8'));
const scripted = JSON.parse(readFileSync(new URL('../fixtures/scripted-reviews.json', import.meta.url), 'utf8'));

function fakeResponse(output: object[], n: number, status = 'completed') {
  return new Response(JSON.stringify({ id: `resp_fixture_${n}`, object: 'response', created_at: 1,
    model: 'fixture-model', status, output,
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15,
      input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
const final = (value: unknown) => [{ id: 'msg_fixture', type: 'message', role: 'assistant', status: 'completed',
  content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] }];

test('real SDK serializes tools, executes a local read, and validates structured output without a network call', async () => {
  const bodies: any[] = [];
  const client = new OpenAI({ apiKey: 'fixture-only', baseURL: 'https://fixture.invalid/v1', maxRetries: 0,
    fetch: async (url, init) => {
      assert.equal(String(url), 'https://fixture.invalid/v1/responses');
      bodies.push(JSON.parse(String(init?.body)));
      if (bodies.length === 1) return fakeResponse([{ id: 'fc_fixture', type: 'function_call',
        call_id: 'call_fixture', name: 'read_lines', status: 'completed',
        arguments: JSON.stringify({ path: 'src/pricing.mjs', side: 'after', startLine: 1, endLine: 3 }),
      }], 1);
      return fakeResponse(final(scripted.correctness), 2);
    },
  });
  const snapshot = loadSnapshot(raw);
  const result = await sdkInvoker(client, 'fixture-model')({ role: 'correctness', snapshot, candidates: [], signal: AbortSignal.timeout(5000) });
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].store, false); assert.equal(bodies[0].stream, false);
  assert.equal(bodies[0].max_output_tokens, 3000);
  assert.deepEqual(bodies[0].tools.map((t: any) => t.name).sort(), ['get_diff', 'list_files', 'read_lines']);
  const returned = bodies[1].input.find((i: any) => i.type === 'function_call_output');
  assert.ok(returned.output.includes('discountedTotal')); assert.equal(returned.call_id, 'call_fixture');
  assert.equal(validateReview(result.output, snapshot).length, 1);
  assert.equal(result.metrics.toolCalls, 1); assert.equal(result.metrics.requests, 2);
  assert.equal(result.metrics.inputTokens, 20); assert.equal(result.metrics.outputTokens, 10);
  assert.equal(bodies[1].previous_response_id, undefined);
});

test('real SDK rejects incomplete Responses terminal state', async () => {
  const client = new OpenAI({ apiKey: 'fixture-only', baseURL: 'https://fixture.invalid/v1', maxRetries: 0,
    fetch: async () => fakeResponse(final(scripted.correctness), 1, 'incomplete') });
  await assert.rejects(() => sdkInvoker(client, 'fixture-model')({ role: 'correctness', snapshot: loadSnapshot(raw), candidates: [], signal: AbortSignal.timeout(5000) }));
});
