// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { BaitlyChatAdapter, type ChatRecovery } from './BaitlyChatAdapter';
import { BaitlyAgUiClient } from './BaitlyAgUiClient';
import { reduceBaitlyChat, emptyChat } from './BaitlyChatModel';

const action = { toolCallId: 'fixture-action', toolName: 'synthetic_tool', description: 'Synthetic decision',
  expiresAt: '2099-01-01T00:00:00Z', resumable: true };
export const fresh = (): ChatRecovery => ({ version: 1, resumePolicy: 'durable-decision-v1', conversationId: 9, canStart: true, actions: [], history: [], reconciliation: [] });
function response(frames: unknown[], cut = false): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(frame)}\n\n`));
      if (cut) setTimeout(() => controller.error(new Error('synthetic-private-detail')), 0);
      else controller.close();
    },
  }), { headers: { 'content-type': 'text/event-stream' } });
}
function setup(proof: () => Promise<unknown> = async () => fresh()) {
  const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async (_url, init) => {
    const input = JSON.parse(String(init.body));
    return response([{ type: 'RUN_STARTED', threadId: input.threadId, runId: 'server-fixture' },
      { type: 'TEXT_MESSAGE_START', role: 'assistant', messageId: 'assistant-fixture' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'assistant-fixture', delta: 'Réponse العربية' },
      { type: 'TEXT_MESSAGE_END', messageId: 'assistant-fixture' },
      { type: 'RUN_FINISHED', threadId: input.threadId, runId: 'server-fixture', outcome: { type: 'success' } }]);
  });
  let id = 0;
  const load = vi.fn(proof);
  const adapter = new BaitlyChatAdapter({ conversationId: 9, loadRecovery: load, newId: () => `fixture-${++id}`,
    createClient: () => new BaitlyAgUiClient({ url: 'https://backend.invalid/api/agui/run', fetch, getHeaders: () => ({}), maxFrameBytes: 4096 }) });
  return { adapter, fetch, load };
}

describe('Baitly chat adapter restoration', () => {
  it('restores authoritative text and result receipts idempotently without outgoing messages or automatic tools', async () => {
    const history: ChatRecovery['history'] = [
      { id:'history-1', role:'user', content:'Question de recette', toolCallId:null, hasAttachments:true },
      { id:'history-2', role:'assistant', content:'Réponse العربية', toolCallId:null, hasAttachments:false },
      { id:'history-3', role:'tool', content:null, toolCallId:'fixture-action', hasAttachments:false },
    ];
    const proof: ChatRecovery = { ...fresh(), canStart:false, history, reconciliation:[
      {toolCallId:'fixture-action',toolName:'synthetic_tool',evidence:'RESULT_RECORDED',resultMessageId:'history-3'}] };
    const {adapter,fetch} = setup(async()=>proof);
    await adapter.restore(); await adapter.restore();
    expect(adapter.getSnapshot().model.items.map(item=>item.id)).toEqual(['history-1','history-2','history-3']);
    expect(adapter.getSnapshot().model.messages).toEqual([]);
    expect(adapter.getSnapshot().phase).toBe('blocked');
    await expect(adapter.send('duplicate')).rejects.toBeDefined();
    await expect(adapter.decide('fixture-action',true)).rejects.toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('new uncertainty discovered just before a decision blocks the POST', async () => {
    const {adapter,fetch,load} = setup(async()=>({...fresh(),canStart:false,actions:[action]}));
    await adapter.restore();
    load.mockResolvedValueOnce({...fresh(),canStart:false,actions:[action],reconciliation:[
      {toolCallId:'other-effect',toolName:'synthetic_tool',evidence:'UNCERTAIN',resultMessageId:null}]});
    await adapter.decide(action.toolCallId,true);
    expect(adapter.getSnapshot().phase).toBe('blocked'); expect(fetch).not.toHaveBeenCalled();
  });
  it('an observed stream finish cannot clear uncertainty returned by the journal', async () => {
    const {adapter,fetch,load}=setup(); await adapter.restore();
    load.mockResolvedValueOnce({...fresh(),canStart:false,reconciliation:[
      {toolCallId:'other-effect',toolName:'synthetic_tool',evidence:'UNCERTAIN',resultMessageId:null}]});
    await adapter.send('Synthetic request');
    expect(adapter.getSnapshot().phase).toBe('blocked');
    await expect(adapter.send('duplicate')).rejects.toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects contradictory history, raw tool payloads and foreign result references without exposing them', async () => {
    const tool = {id:'history-1',role:'tool',content:null,toolCallId:'fixture-action',hasAttachments:false};
    for (const proof of [
      {...fresh(),history:[tool]}, // Existing history cannot be called untouched.
      {...fresh(),canStart:false,history:[tool,tool]},
      {...fresh(),canStart:false,history:[{...tool,content:'private-canary'}]},
      {...fresh(),canStart:false,reconciliation:[{toolCallId:'fixture-action',toolName:'synthetic_tool',evidence:'RESULT_RECORDED',resultMessageId:'foreign'}]},
      {...fresh(),canStart:false,actions:[action],history:[tool]},
    ]) {
      const {adapter,fetch}=setup(async()=>proof); await adapter.restore();
      expect(adapter.getSnapshot().phase).toBe('blocked'); expect(fetch).not.toHaveBeenCalled();
      expect(JSON.stringify(adapter.getSnapshot())).not.toContain('private-canary');
    }
  });
  it('mount/subscription/restoration perform reads only; an explicit message sends once', async () => {
    const { adapter, fetch, load } = setup();
    const unsubscribe = adapter.subscribe(() => {});
    await adapter.restore();
    expect(fetch).not.toHaveBeenCalled(); expect(load).toHaveBeenCalledTimes(1);
    await adapter.send('Recette synthétique');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(adapter.getSnapshot().model.items.map(i => i.text)).toEqual(['Recette synthétique','Réponse العربية']);
    expect(adapter.getSnapshot().phase).toBe('ready');
    unsubscribe(); adapter.dispose();
  });
  it.each([true,false])('restores an action without executing it, then explicitly decides confirmed=%s', async confirmed => {
    let proof = { ...fresh(), canStart: false, actions: [action] };
    const { adapter, fetch, load } = setup(async () => proof);
    await adapter.restore(); expect(fetch).not.toHaveBeenCalled();
    expect(adapter.getSnapshot().phase).toBe('review');
    fetch.mockImplementationOnce(async (_url, init) => {
      const input = JSON.parse(String(init.body));
      expect(input.resume).toEqual([{ interruptId: action.toolCallId, status: confirmed ? 'resolved' : 'cancelled', payload: { confirmed } }]);
      expect(input.forwardedProps.conversationId).toBe(9);
      expect(load).toHaveBeenCalledTimes(2); // Fresh proof before POST.
      proof = { ...fresh(), canStart: false, actions: [] };
      return response([{ type: 'RUN_STARTED', threadId: input.threadId, runId: 'server-resume' },
        { type: 'RUN_FINISHED', threadId: input.threadId, runId: 'server-resume', outcome: { type: 'success' } }]);
    });
    await adapter.decide(action.toolCallId, confirmed);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(adapter.getSnapshot().pending).toEqual([]);
  });
  it('does not resume a decision that disappeared, expired or lost its context', async () => {
    for (const next of [[], [{ ...action, expiresAt: '2000-01-01T00:00:00Z' }], [{ ...action, resumable: false }]]) {
      const { adapter, fetch, load } = setup(async () => ({ ...fresh(), canStart: false, actions: [action] }));
      await adapter.restore(); load.mockResolvedValueOnce({ ...fresh(), canStart: false, actions: next });
      await adapter.decide(action.toolCallId, true);
      expect(fetch).not.toHaveBeenCalled(); expect(adapter.getSnapshot().phase).toBe('blocked');
    }
  });
  it('keeps an empty non-authorizing recovery blocked after a cut and a new adapter instance', async () => {
    const first = setup(); await first.adapter.restore();
    first.fetch.mockImplementationOnce(async (_url, init) => {
      const input = JSON.parse(String(init.body));
      return response([{ type: 'RUN_STARTED', threadId: input.threadId, runId: 'server-cut' }], true);
    });
    await first.adapter.send('Synthetic request');
    expect(first.adapter.getSnapshot().phase).toBe('blocked');
    await expect(first.adapter.send('Synthetic request')).rejects.toBeDefined();
    const reloaded = setup(async () => ({ ...fresh(), canStart: false }));
    await reloaded.adapter.restore();
    await expect(reloaded.adapter.send('Synthetic request')).rejects.toBeDefined();
    expect(reloaded.fetch).not.toHaveBeenCalled(); expect(first.fetch).toHaveBeenCalledTimes(1);
  });
  it('storage outage, wrong policy, foreign conversation and duplicate IDs never authorize a POST', async () => {
    for (const proof of [null, { ...fresh(), resumePolicy: 'legacy' }, { ...fresh(), conversationId: 99 },
      { ...fresh(), actions: [action,action] }]) {
      const { adapter, fetch } = setup(async () => proof);
      await adapter.restore(); expect(adapter.getSnapshot().phase).toBe('blocked');
      expect(fetch).not.toHaveBeenCalled();
    }
    const { adapter, fetch } = setup(async () => { throw new Error('synthetic-private-outage'); });
    await adapter.restore();
    expect(JSON.stringify(adapter.getSnapshot())).not.toContain('synthetic-private');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('ignores a stale recovery response after a newer response blocks the conversation', async () => {
    let resolve: (proof: unknown) => void = () => {};
    const { adapter, load, fetch } = setup();
    load.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const stale = adapter.restore();
    load.mockResolvedValueOnce({ ...fresh(), canStart: false });
    await adapter.restore(); resolve(fresh()); await stale;
    expect(adapter.getSnapshot().phase).toBe('blocked'); expect(fetch).not.toHaveBeenCalled();
  });
  it('prevents reentrant sends while publishing the operator message', async () => {
    const { adapter, fetch } = setup(); await adapter.restore();
    let reentered = false;
    adapter.subscribe(() => { if (!reentered) { reentered = true; void adapter.send('duplicate').catch(() => {}); } });
    await adapter.send('Synthetic request');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not send after disposal while recovery is in flight', async () => {
    let resolve: (proof: unknown) => void = () => {};
    const { adapter, fetch } = setup(() => new Promise(done => { resolve = done; }));
    const reading = adapter.restore(); adapter.dispose(); resolve({ ...fresh(), actions: [action] }); await reading;
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('Baitly chat transcript reduction', () => {
  it('preserves incremental tool arguments and backend result without executing it', () => {
    let model = emptyChat();
    model = reduceBaitlyChat(model, { type: 'TOOL_CALL_START', toolCallId: 'tool', toolCallName: 'synthetic_tool' });
    model = reduceBaitlyChat(model, { type: 'TOOL_CALL_ARGS', toolCallId: 'tool', delta: '{"fixture":' });
    model = reduceBaitlyChat(model, { type: 'TOOL_CALL_ARGS', toolCallId: 'tool', delta: 'true}' });
    const result = JSON.stringify({ displayHint: 'summary', isError: false, data: { message: 'Synthetic result' } });
    const next = reduceBaitlyChat(model, { type: 'TOOL_CALL_RESULT', toolCallId: 'tool', messageId: 'result', role: 'tool', content: result });
    expect(model.items[0].complete).toBe(false);
    expect(next.messages[0].toolCalls?.[0].function.arguments).toBe('{"fixture":true}');
    expect(next.messages[1]).toMatchObject({ role: 'tool', toolCallId: 'tool', content: result });
  });
  it('applies validated JSON patches immutably and blocks prototype modification', () => {
    const initial = reduceBaitlyChat(emptyChat(), { type: 'STATE_SNAPSHOT', snapshot: { count: 1 } });
    const next = reduceBaitlyChat(initial, { type: 'STATE_DELTA', delta: [{ op:'replace', path:'/count', value:2 }] });
    expect(initial.state).toEqual({ count:1 }); expect(next.state).toEqual({ count:2 });
    expect(() => reduceBaitlyChat(initial, { type:'STATE_DELTA', delta:[{ op:'add', path:'/__proto__/polluted', value:true }] })).toThrow('BAITLY_AGUI_PROTOCOL');
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});
