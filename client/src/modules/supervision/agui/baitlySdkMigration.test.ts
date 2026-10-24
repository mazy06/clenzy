// @vitest-environment node
// Migration characterization: real installed SDK, synthetic HTTP/SSE only.
// This deliberately exercises the transitive transport used by CopilotKit;
// it is not a new application dependency or a replacement for the UI recipe.
import { HttpAgent, type BaseEvent, type AgentSubscriber } from '@ag-ui/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseToolResult } from './renderers/parseToolResult';

const threadId = 'baitly-contract-thread';
const runId = 'baitly-contract-run';
const started = { type: 'RUN_STARTED', threadId, runId };
const finished = { type: 'RUN_FINISHED', threadId, runId, outcome: { type: 'success' } };
const interrupt = {
  type: 'RUN_FINISHED', threadId, runId,
  outcome: {
    type: 'interrupt',
    interrupts: [{ id: 'confirmation-fixture', reason: 'confirmation_required',
      toolCallId: 'tool-fixture', message: 'Confirmer la recette ?',
      metadata: { toolName: 'synthetic_action', args: { fixture: true } } }],
  },
};

/** Split even inside UTF-8 and SSE boundaries, as a real network may do. */
function response(frames: Record<string, unknown>[], failAfterFrames = false, newline = "\n"): Response {
  const bytes = new TextEncoder().encode(frames.map(frame => `data: ${JSON.stringify(frame)}${newline}${newline}`).join(''));
  let offset = 0;
  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset < bytes.length) {
        controller.enqueue(bytes.slice(offset, offset += 7));
      } else if (failAfterFrames) {
        controller.error(new Error('synthetic network interruption'));
      } else controller.close();
    },
  }), { headers: { 'content-type': 'text/event-stream' } });
}

function makeAgent(fetch: (url: string, init: RequestInit) => Promise<Response>, headers = {}) {
  return new HttpAgent({
    url: 'https://backend.invalid/api/agui/run', agentId: 'clenzy-supervisor',
    threadId, headers, fetch, debug: false,
    initialMessages: [{ id: 'operator-fixture', role: 'user', content: 'Recette synthétique' }],
  });
}

afterEach(() => vi.restoreAllMocks());

describe('Baitly SDK migration: existing AG-UI transport contracts', () => {
  it('keeps UTF-8 text, message identity, state snapshots and patches across fragmented SSE', async () => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => response([
      started,
      { type: 'STATE_SNAPSHOT', snapshot: { phase: 'thinking', count: 0 } },
      { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/count', value: 1 }] },
      { type: 'TEXT_MESSAGE_START', messageId: 'reply-fixture', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'reply-fixture', delta: 'Réponse ' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'reply-fixture', delta: 'de recette العربية' },
      { type: 'TEXT_MESSAGE_END', messageId: 'reply-fixture' }, finished,
    ]));
    const agent = makeAgent(fetch);
    await agent.runAgent({ runId });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(agent.messages.find(m => m.id === 'reply-fixture')).toMatchObject({
      role: 'assistant', content: 'Réponse de recette العربية',
    });
    expect(agent.state).toEqual({ phase: 'thinking', count: 1 });
  });

  it('preserves tool arguments and the backend generative UI wrapper without executing a tool', async () => {
    const result = JSON.stringify({ displayHint: 'summary', isError: false, data: { fixture: true } });
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => response([
      started,
      { type: 'TOOL_CALL_START', toolCallId: 'tool-fixture', toolCallName: 'synthetic_action' },
      { type: 'TOOL_CALL_ARGS', toolCallId: 'tool-fixture', delta: '{"fixture":' },
      { type: 'TOOL_CALL_ARGS', toolCallId: 'tool-fixture', delta: 'true}' },
      { type: 'TOOL_CALL_END', toolCallId: 'tool-fixture' },
      { type: 'TOOL_CALL_RESULT', toolCallId: 'tool-fixture', messageId: 'result-fixture', role: 'tool', content: result },
      finished,
    ]));
    const agent = makeAgent(fetch);
    const args = vi.fn();
    await agent.runAgent({ runId }, { onToolCallEndEvent: ({ toolCallArgs }) => { args(toolCallArgs); } });
    expect(args).toHaveBeenCalledExactlyOnceWith({ fixture: true });
    const toolMessage = agent.messages.find(m => m.role === 'tool');
    expect(toolMessage).toMatchObject({ toolCallId: 'tool-fixture', content: result });
    expect(parseToolResult(toolMessage && 'content' in toolMessage ? toolMessage.content : null)).toEqual({
      displayHint: 'summary', isError: false, data: { fixture: true },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])('resumes only after the explicit human decision confirmed=%s', async confirmed => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => response([started, finished]));
    fetch.mockResolvedValueOnce(response([started, interrupt]));
    const agent = makeAgent(fetch);
    const outcomes: string[] = [];
    const subscriber: AgentSubscriber = { onRunFinishedEvent: ({ outcome }) => { outcomes.push(outcome); } };
    await agent.runAgent({ runId }, subscriber);
    expect(outcomes).toEqual(['interrupt']);
    expect(fetch).toHaveBeenCalledTimes(1); // No automatic confirmation or replay.
    await agent.runAgent({ runId, resume: [{ interruptId: 'confirmation-fixture',
      status: confirmed ? 'resolved' : 'cancelled', payload: { confirmed } }] }, subscriber);
    expect(fetch).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String(fetch.mock.calls[1][1].body));
    expect(body).toMatchObject({ threadId, runId, resume: [{ interruptId: 'confirmation-fixture',
      status: confirmed ? 'resolved' : 'cancelled', payload: { confirmed } }] });
    expect(body.messages).toContainEqual({ id: 'operator-fixture', role: 'user', content: 'Recette synthétique' });
    expect(outcomes).toEqual(['interrupt', 'success']);
  });

  it('keeps authorization isolated between agents and preserves the POST SSE contract', async () => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => response([started, finished]));
    // Public synthetic markers, never credentials copied from a session.
    await makeAgent(fetch, { Authorization: 'Bearer synthetic-A' }).runAgent({ runId });
    await makeAgent(fetch, { Authorization: 'Bearer synthetic-B' }).runAgent({ runId });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: {
      Authorization: 'Bearer synthetic-A', 'Content-Type': 'application/json', Accept: 'text/event-stream',
    } });
    expect(fetch.mock.calls[1][1].headers).toMatchObject({ Authorization: 'Bearer synthetic-B' });
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).not.toHaveProperty('resume');
  });

  it('does not replay a rejected HTTP request', async () => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response('', { status: 401 }));
    const failed = vi.fn();
    const agent = makeAgent(fetch);
    // The SDK reports failures through its subscriber; do not assume rejection semantics.
    await agent.runAgent({ runId }, { onRunFailed: ({ error }) => { failed(error); } }).catch(() => undefined);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(failed.mock.calls[0][0]).toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts the in-flight request without starting another run or inventing success', async () => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>((_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Synthetic abort', 'AbortError')), { once: true });
      }));
    const agent = makeAgent(fetch);
    const finalized = vi.fn();
    const success = vi.fn();
    const running = agent.runAgent({ runId }, {
      onRunFinalized: () => { finalized(); },
      onRunFinishedEvent: () => { success(); },
    }).catch(() => undefined);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    agent.abortRun();
    await running;
    expect(fetch.mock.calls[0][1].signal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(finalized).toHaveBeenCalledTimes(1);
    expect(success).not.toHaveBeenCalled();
  });

  it('records the existing SDK CRLF parsing defect as a migration gap, never as success', async () => {
    // Known defect in 1.0.2: Java emits LF, but a replacement must also accept
    // standard CRLF. Change this assertion to a success contract when fixed.
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      response([started, finished], false, '\r\n'));
    const agent = makeAgent(fetch);
    const failed = vi.fn();
    await expect(agent.runAgent({ runId }, { onRunFailed: ({ error }) => { failed(error); } }))
      .rejects.toBeInstanceOf(SyntaxError);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('retains a delivered fragment and reports a cut stream without replaying its request', async () => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => response([
      started,
      { type: 'TEXT_MESSAGE_START', messageId: 'partial-fixture', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'partial-fixture', delta: 'Fragment synthétique' },
    ], true));
    const events: BaseEvent[] = [];
    const failed = vi.fn();
    const agent = makeAgent(fetch);
    await agent.runAgent({ runId }, {
      onEvent: ({ event }) => { events.push(event); },
      onRunFailed: ({ error }) => { failed(error); },
    }).catch(() => undefined);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(failed.mock.calls[0][0]).toMatchObject({ message: 'synthetic network interruption' });
    expect(events.some(e => e.type === 'TEXT_MESSAGE_CONTENT')).toBe(true);
    expect(events.some(e => e.type === 'RUN_FINISHED')).toBe(false);
    expect(agent.messages.find(m => m.id === 'partial-fixture')).toMatchObject({ content: 'Fragment synthétique' });
  });
});
