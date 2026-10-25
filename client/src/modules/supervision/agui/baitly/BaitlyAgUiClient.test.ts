// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { BaitlyAgUiClient } from './BaitlyAgUiClient';
import { BaitlyAgUiError, type BaitlyAgUiEvent, type BaitlyRunInput } from './BaitlyAgUiProtocol';
import { baitlySseFrames } from './baitlySseFrames';
import { parseToolResult } from '../renderers/parseToolResult';

const threadId = 'baitly-candidate-thread';
const runId = 'baitly-candidate-run';
const started = { type: 'RUN_STARTED', threadId, runId };
const finished = { type: 'RUN_FINISHED', threadId, runId, outcome: { type: 'success' } };
const initialMessages = [{ id: 'operator-fixture', role: 'user' as const, content: 'Recette synthétique' }];
const input: BaitlyRunInput = {
  threadId, runId, state: {}, tools: [], context: [], forwardedProps: { fixture: true },
  messages: initialMessages,
};
type TestFetch = (url: string, init: RequestInit) => Promise<Response>;

function wire(text: string, cut = false): Response {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset < bytes.length) controller.enqueue(bytes.slice(offset, offset += 3));
      else if (cut) controller.error(new Error('synthetic-private-network-detail'));
      else controller.close();
    },
  }), { headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
}
function stream(frames: Record<string, unknown>[], newline = '\n', cut = false): Response {
  return wire(frames.map(e => `data: ${JSON.stringify(e)}${newline}${newline}`).join(''), cut);
}
function client(fetch: TestFetch, maxFrameBytes = 1024 * 1024, getHeaders = () => ({})) {
  return new BaitlyAgUiClient({ url: 'https://backend.invalid/api/agui/run', fetch, maxFrameBytes, getHeaders });
}
async function oracle(frames: Record<string, unknown>[]) {
  // Frozen SDK event contracts are independently asserted in baitlySdkMigration.test.ts.
  return structuredClone(frames);
}

describe('inactive Baitly Zod 4 transport candidate', () => {
  it('duplicate START in the same run fails closed rather than reopening an invocation',async()=>{
    const start={type:'TOOL_CALL_START',toolCallId:'one',toolCallName:'synthetic_action'};
    const fetch=vi.fn<TestFetch>(async()=>stream([started,start,start,finished]));
    const candidate=client(fetch);
    await expect(candidate.run(input,()=>{})).rejects.toMatchObject({code:'PROTOCOL'});
    expect(candidate.state).toBe('uncertain');expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(['\n', '\r\n', '\r'])('matches SDK event contracts with newline=%j, including fragmented UTF-8', async newline => {
    const frames = [started,
      { type: 'STATE_SNAPSHOT', snapshot: { phase: 'thinking' } },
      { type: 'STATE_DELTA', delta: [{ op: 'add', path: '/count', value: 1 }] },
      { type: 'TEXT_MESSAGE_START', messageId: 'reply-fixture', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'reply-fixture', delta: 'Réponse العربية' },
      { type: 'TEXT_MESSAGE_END', messageId: 'reply-fixture' }, finished];
    const expected = await oracle(frames); // SDK reference uses supported LF framing.
    const events: BaitlyAgUiEvent[] = [];
    const fetch = vi.fn<TestFetch>(async () => stream(frames, newline));
    const candidate = client(fetch);
    expect(await candidate.run(input, e => { events.push(e); })).toEqual({ type: 'success' });
    expect(events).toEqual(expected);
    expect(candidate.state).toBe('idle');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual(input);
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it.each(['list', 'details', 'chart_bar', 'kpi_summary', 'data_table', 'availability', 'quote', 'summary', 'navigation'])(
    'preserves the SDK tool envelope and renderer input for %s', async displayHint => {
      const content = JSON.stringify({ displayHint, isError: false, data: { fixture: true } });
      const frames = [started,
        { type: 'TOOL_CALL_START', toolCallId: 'tool-fixture', toolCallName: 'synthetic_action' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tool-fixture', delta: '{"fixture":' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tool-fixture', delta: 'true}' },
        { type: 'TOOL_CALL_END', toolCallId: 'tool-fixture' },
        { type: 'TOOL_CALL_RESULT', messageId: 'result-fixture', toolCallId: 'tool-fixture', role: 'tool', content }, finished];
      const expected = await oracle(frames);
      const events: BaitlyAgUiEvent[] = [];
      await client(async () => stream(frames)).run(input, e => { events.push(e); });
      expect(events).toEqual(expected);
      const result = events.find(e => e.type === 'TOOL_CALL_RESULT');
      expect(parseToolResult(result?.content)).toEqual({ displayHint, isError: false, data: { fixture: true } });
    });

  it.each([true, false])('requires a matching explicit decision confirmed=%s, without auto resume', async confirmed => {
    const interruption = { type: 'RUN_FINISHED', threadId, runId, outcome: { type: 'interrupt', interrupts: [
      { id: 'decision-fixture', reason: 'confirmation_required', metadata: { fixture: true } },
    ] } };
    const fetch = vi.fn<TestFetch>(async () => stream([started, finished]));
    fetch.mockResolvedValueOnce(stream([started, interruption]));
    const candidate = client(fetch);
    expect(await candidate.run(input, () => {})).toEqual(interruption.outcome);
    expect(candidate.state).toBe('awaiting_decision');
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(candidate.run(input, () => {})).rejects.toMatchObject({ code: 'DECISION_REQUIRED' });
    const resume = [{ interruptId: 'decision-fixture', status: confirmed ? 'resolved' as const : 'cancelled' as const,
      payload: { confirmed } }];
    await candidate.run({ ...input, resume }, () => {});
    expect(JSON.parse(String(fetch.mock.calls[1][1].body))).toEqual({ ...input, resume });
    expect(candidate.state).toBe('idle');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects contradictory, duplicate and foreign decisions before sending', async () => {
    const fetch = vi.fn<TestFetch>(async () => stream([started, { type: 'RUN_FINISHED', threadId, runId,
      outcome: { type: 'interrupt', interrupts: [{ id: 'decision-fixture', reason: 'fixture' }] } }]));
    const candidate = client(fetch);
    await candidate.run(input, () => {});
    const entry = { interruptId: 'decision-fixture', status: 'resolved' as const, payload: { confirmed: false } };
    await expect(candidate.run({ ...input, resume: [entry] }, () => {})).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const valid = { ...entry, payload: { confirmed: true } };
    await expect(candidate.run({ ...input, resume: [valid, valid] }, () => {})).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(candidate.run({ ...input, resume: [{ ...valid, interruptId: 'other' }] }, () => {}))
      .rejects.toMatchObject({ code: 'DECISION_REQUIRED' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(candidate.state).toBe('awaiting_decision');
  });

  it('uses the run identity assigned by Java, including on the explicit resume', async () => {
    // AgentSseEventToAgUi creates a fresh UUID; it does not echo input.runId.
    const serverRunId = 'run-server-fixture';
    const nextRunId = 'run-server-resume-fixture';
    const fetch = vi.fn<TestFetch>(async () => stream([
      { ...started, runId: nextRunId }, { ...finished, runId: nextRunId },
    ]));
    fetch.mockResolvedValueOnce(stream([{ ...started, runId: serverRunId },
      { type: 'RUN_FINISHED', threadId, runId: serverRunId, outcome: { type: 'interrupt',
        interrupts: [{ id: 'decision-fixture', reason: 'fixture' }] } }]));
    const candidate = client(fetch);
    await candidate.run(input, () => {});
    await candidate.run({ ...input, runId: serverRunId, resume: [{ interruptId: 'decision-fixture',
      status: 'resolved', payload: { confirmed: true } }] }, () => {});
    expect(JSON.parse(String(fetch.mock.calls[1][1].body)).runId).toBe(serverRunId);
    expect(candidate.state).toBe('idle');
  });

  it.each(['cut', 'eof', 'wrong-id', 'server-error'])('blocks subsequent sends after uncertain %s, without leaking diagnostics', async kind => {
    const frames = [started, { type: 'TEXT_MESSAGE_START', messageId: 'partial', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'partial', delta: 'synthetic-private-content' }];
    const fetch = vi.fn<TestFetch>(async () => kind === 'server-error' ? new Response('synthetic-private-content', { status: 500 })
      : stream(kind === 'wrong-id' ? [started, { ...finished, runId: 'other' }] : frames, '\n', kind === 'cut'));
    const candidate = client(fetch);
    const events: BaitlyAgUiEvent[] = [];
    let error: unknown;
    try { await candidate.run(input, e => { events.push(e); }); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(BaitlyAgUiError);
    expect(String(error)).not.toContain('synthetic-private');
    expect(JSON.stringify(error)).not.toContain('synthetic-private');
    expect(candidate.state).toBe('uncertain');
    expect(events.some(e => e.type === 'RUN_FINISHED')).toBe(false);
    await expect(candidate.run({ ...input, runId: 'new-run' }, () => {})).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reads current auth per request, includes HttpOnly cookies, never reads HTTP error payloads', async () => {
    const denied = new Response('synthetic-private-error-body', { status: 401 });
    const text = vi.spyOn(denied, 'text');
    let marker = 'Bearer synthetic-A';
    const fetch = vi.fn<TestFetch>(async (_url, init) => {
      const sent = JSON.parse(String(init.body));
      return stream([{ ...started, runId: sent.runId }, { ...finished, runId: sent.runId }]);
    });
    fetch.mockResolvedValueOnce(denied);
    const candidate = client(fetch, 1024, () => ({ Authorization: marker }));
    await expect(candidate.run(input, () => {})).rejects.toMatchObject({ code: 'HTTP', status: 401 });
    expect(text).not.toHaveBeenCalled();
    marker = 'Bearer synthetic-B';
    await candidate.run({ ...input, runId: 'fresh-run' }, () => {});
    expect(fetch.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer synthetic-A' });
    expect(fetch.mock.calls[1][1]).toMatchObject({ credentials: 'include', headers: { Authorization: 'Bearer synthetic-B' } });
    await expect(candidate.run({ ...input, runId: 'fresh-run' }, () => {})).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('allows only one active request and aborts without inventing a terminal event', async () => {
    const fetch = vi.fn<TestFetch>(async (_url, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('synthetic-private-abort')), { once: true });
    }));
    const candidate = client(fetch);
    const events: BaitlyAgUiEvent[] = [];
    const run = candidate.run(input, e => { events.push(e); });
    const rejected = expect(run).rejects.toMatchObject({ code: 'ABORTED' });
    await expect(candidate.run(input, () => {})).rejects.toMatchObject({ code: 'BUSY' });
    candidate.abortRun();
    await rejected;
    expect(candidate.state).toBe('uncertain');
    expect(events).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('holds the single-flight guard until terminal stream cleanup is complete', async () => {
    let release: () => void = () => {};
    let cancelling = false;
    const bytes = new TextEncoder().encode([started, finished].map(e => `data: ${JSON.stringify(e)}\n\n`).join(''));
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(bytes); },
      cancel() {
        cancelling = true;
        return new Promise<void>(resolve => { release = resolve; });
      },
    });
    const fetch = vi.fn<TestFetch>(async () => new Response(body, { headers: { 'content-type': 'text/event-stream' } }));
    const candidate = client(fetch);
    const first = candidate.run(input, () => {});
    await vi.waitFor(() => expect(cancelling).toBe(true));
    await expect(candidate.run({ ...input, runId: 'new-run' }, () => {})).rejects.toMatchObject({ code: 'BUSY' });
    release();
    await expect(first).resolves.toEqual({ type: 'success' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sanitizes remote run and consumer failures, retaining uncertainty', async () => {
    const remote = client(async () => stream([started, { type: 'RUN_ERROR', message: 'synthetic-private-error' }]));
    await expect(remote.run(input, () => {})).rejects.toMatchObject({ code: 'REMOTE_RUN', message: 'BAITLY_AGUI_REMOTE_RUN' });
    expect(remote.state).toBe('uncertain');
    const consumer = client(async () => stream([started, finished]));
    await expect(consumer.run(input, () => { throw new Error('synthetic-private-consumer'); }))
      .rejects.toMatchObject({ code: 'CONSUMER', message: 'BAITLY_AGUI_CONSUMER' });
    expect(consumer.state).toBe('uncertain');
  });

  it('rejects invalid input without invoking HTTP, auth or a consumer', async () => {
    const fetch = vi.fn<TestFetch>();
    const headers = vi.fn(() => ({}));
    const consumer = vi.fn();
    const candidate = client(fetch, 300, headers);
    await expect(candidate.run({ ...input, runId: '' }, consumer)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(fetch).not.toHaveBeenCalled();
    expect(headers).not.toHaveBeenCalled();
    expect(consumer).not.toHaveBeenCalled();
    expect(candidate.state).toBe('idle');
  });

  it('rejects oversized and malformed frames before exposing payloads or claiming success', async () => {
    for (const response of [wire(`data: ${JSON.stringify({ private: 'x'.repeat(1000) })}\n\n`),
      wire('data: {"type":"TEXT_MESSAGE_CONTENT","delta":"synthetic-private"}\n\n')]) {
      const candidate = client(async () => response, 300);
      const events: BaitlyAgUiEvent[] = [];
      await expect(candidate.run(input, e => { events.push(e); })).rejects.toBeInstanceOf(BaitlyAgUiError);
      expect(events).toEqual([]);
      expect(candidate.state).toBe('uncertain');
    }
  });

  it('parses SSE comments, multiline data and blank dispatches without corrupting JSON', async () => {
    const response = wire(':keepalive\r\nevent: message\r\ndata: {"fixture":\r\ndata: true}\r\n\r\n\r\n');
    const frames: string[] = [];
    for await (const frame of baitlySseFrames(response.body!, 300)) frames.push(frame);
    expect(frames).toEqual(['{"fixture":\ntrue}']);
    expect(JSON.parse(frames[0])).toEqual({ fixture: true });
  });
});
