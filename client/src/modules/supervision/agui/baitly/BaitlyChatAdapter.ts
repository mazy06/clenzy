import { z } from 'zod';
import { BaitlyAgUiClient } from './BaitlyAgUiClient';
import { BaitlyAgUiError, type BaitlyAgUiEvent } from './BaitlyAgUiProtocol';
import { emptyChat, reduceBaitlyChat, restoreBaitlyHistory, type ChatModel } from './BaitlyChatModel';

const recoverySchema = z.object({ version: z.literal(1), resumePolicy: z.literal('durable-decision-v1'),
  conversationId: z.number().int().positive().nullable(), canStart: z.boolean(), actions: z.array(z.object({
    toolCallId: z.string().min(1), toolName: z.string().min(1), description: z.string().nullable(),
    expiresAt: z.iso.datetime({ offset: true }), resumable: z.boolean(),
  })), history: z.array(z.object({ id: z.string().min(1), role: z.enum(['user', 'assistant', 'tool']),
    content: z.string().nullable(), toolCallId: z.string().nullable(), hasAttachments: z.boolean(), presentation:z.string().nullable().optional() })).default([]),
  reconciliation: z.array(z.object({ toolCallId: z.string().min(1), toolName: z.string().min(1),
    evidence: z.enum(['AWAITING_DECISION', 'EXPIRED', 'DECLINED', 'RESULT_RECORDED', 'UNCERTAIN', 'CONFLICT']),
    resultMessageId: z.string().nullable() })).default([]),
  completion: z.object({policy:z.enum(['durable-text-v1','durable-tools-v2','durable-writes-v3']),status:z.enum(['RUNNING','SAFE_TEXT','SAFE_TOOLS','SAFE_WRITES','PAUSED','UNCERTAIN']),
    lastMessageId:z.string().nullable(),requestId:z.string().min(1)}).nullable().default(null),
  toolEvidence:z.array(z.object({toolCallId:z.string().min(1),proofKind:z.enum(['NAVIGATION_ONLY_V1','TAX_READ_ONLY_V1','UNVERIFIED']),
    status:z.enum(['STARTED','READ_ONLY_COMPLETED','UNCERTAIN']),resultMessageId:z.string().nullable()})).optional() });
export type ChatRecovery = z.infer<typeof recoverySchema>;
export interface ChatSnapshot {
  phase: 'restoring' | 'ready' | 'running' | 'review' | 'blocked';
  model: ChatModel;
  pending: ChatRecovery['actions'];
  failure: string | null;
  reconciliation: ChatRecovery['reconciliation'];
}
export interface ChatAdapterOptions {
  conversationId: number | null;
  loadRecovery: (conversationId?:number) => Promise<unknown>;
  createClient: () => BaitlyAgUiClient;
  newId?: () => string;
  now?: () => number;
}

/** Native UI adapter. No execution on subscribe, reconnect, restore or mount. */
export class BaitlyChatAdapter {
  private snapshot: ChatSnapshot = { phase: 'restoring', model: emptyChat(), pending: [], failure: null, reconciliation: [] };
  private readonly listeners = new Set<() => void>();
  private busy = false;
  private generation = 0;
  private disposed = false;
  private active: BaitlyAgUiClient | null = null;
  private readonly id: () => string;
  private readonly now: () => number;
  private conversationId:number|null;
  constructor(private readonly options: ChatAdapterOptions) {
    this.id = options.newId ?? (() => crypto.randomUUID());
    this.now = options.now ?? Date.now;
    this.conversationId=options.conversationId;
  }
  getSnapshot = (): ChatSnapshot => this.snapshot;
  get conversation():number|null { return this.conversationId; }
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(next: Partial<ChatSnapshot>): void {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener();
  }
  private async proof(): Promise<ChatRecovery> {
    const result = recoverySchema.safeParse(await this.options.loadRecovery(this.conversationId ?? undefined));
    if (!result.success || result.data.conversationId !== this.conversationId
      || new Set(result.data.actions.map(a => a.toolCallId)).size !== result.data.actions.length
      || new Set(result.data.history.map(m => m.id)).size !== result.data.history.length
      || new Set(result.data.reconciliation.map(r => r.toolCallId)).size !== result.data.reconciliation.length
      || result.data.history.some(m => m.role === 'tool' && m.content !== null)
      || result.data.reconciliation.some(r => (r.evidence === 'RESULT_RECORDED' && r.resultMessageId === null)
        || (r.resultMessageId !== null && !result.data.history.some(m => m.id === r.resultMessageId
          && m.role === 'tool' && m.toolCallId === r.toolCallId)))
      || (result.data.canStart && (result.data.actions.length > 0 || (result.data.completion?.status!=='SAFE_WRITES' && result.data.reconciliation.length>0)))
      || (result.data.completion?.status==='SAFE_WRITES' && (result.data.completion.policy!=='durable-writes-v3'
        || result.data.completion.lastMessageId!==result.data.history.at(-1)?.id
        || result.data.history.at(-1)?.role!=='assistant' || !result.data.history.at(-1)?.content?.trim()
        || result.data.reconciliation.some(r=>!['DECLINED','RESULT_RECORDED'].includes(r.evidence))))
      || (result.data.completion?.status==='SAFE_TOOLS' && !this.completeToolProof(result.data))
      || (result.data.canStart && !['SAFE_TOOLS','SAFE_WRITES'].includes(result.data.completion?.status ?? '') && (result.data.toolEvidence?.length ?? 0)>0)
      || (result.data.canStart && result.data.history.length > 0 && ((!['SAFE_TEXT','SAFE_TOOLS','SAFE_WRITES'].includes(result.data.completion?.status ?? ''))
        || result.data.completion?.lastMessageId !== result.data.history.at(-1)?.id
        || result.data.history.some(m => m.hasAttachments)
        || (result.data.completion?.status==='SAFE_TEXT' && result.data.history.some(m=>m.role==='tool'))))
      || (result.data.canStart && result.data.completion !== null && !['SAFE_TEXT','SAFE_TOOLS','SAFE_WRITES'].includes(result.data.completion.status))
      || result.data.actions.some(a => result.data.history.some(m => m.role === 'tool' && m.toolCallId === a.toolCallId))
      || result.data.actions.some(a => result.data.reconciliation.some(r => r.toolCallId === a.toolCallId
        && r.evidence !== 'AWAITING_DECISION'))) {
      throw new BaitlyAgUiError('PROTOCOL');
    }
    return { ...result.data, actions: result.data.actions.filter(a => Date.parse(a.expiresAt) > this.now()) };
  }
  private completeToolProof(proof:ChatRecovery): boolean {
    if(proof.completion?.policy!=='durable-tools-v2' || proof.completion.lastMessageId!==proof.history.at(-1)?.id
      || proof.history.length<4 || proof.history[0]?.role!=='user' || !proof.history.at(-1)?.content?.trim()
      || proof.history.at(-1)?.role!=='assistant' || proof.history.some(m=>m.hasAttachments)
      || proof.actions.length || proof.reconciliation.length) return false;
    const tools=proof.history.filter(m=>m.role==='tool'); const evidence=proof.toolEvidence ?? [];
    if(!tools.length || tools.length!==evidence.length || new Set(tools.map(m=>m.toolCallId)).size!==tools.length
      || new Set(evidence.map(e=>e.toolCallId)).size!==evidence.length) return false;
    const results=new Map(tools.map(message=>[message.toolCallId,message]));
    return evidence.every(e=>e.status==='READ_ONLY_COMPLETED' && e.proofKind!=='UNVERIFIED'
      && results.get(e.toolCallId)?.id===e.resultMessageId && results.get(e.toolCallId)?.content===null);
  }
  private recoveredPhase(proof: ChatRecovery, requireCompletion=false): ChatSnapshot['phase'] {
    if (requireCompletion && proof.completion === null) return 'blocked';
    if (proof.completion?.status === 'RUNNING' || proof.completion?.status === 'UNCERTAIN') return 'blocked';
    if (proof.reconciliation.some(row => row.evidence === 'UNCERTAIN' || row.evidence === 'CONFLICT')) return 'blocked';
    return proof.actions.length ? 'review' : proof.canStart ? 'ready' : 'blocked';
  }
  async restore(): Promise<void> {
    if (this.busy || this.disposed) return;
    const generation = ++this.generation;
    this.update({ phase: 'restoring', failure: null });
    try {
      const proof = await this.proof();
      if (this.disposed || generation !== this.generation) return;
      this.update({ pending: proof.actions, model: restoreBaitlyHistory(proof.history), reconciliation: proof.reconciliation,
        phase: this.recoveredPhase(proof) });
    } catch {
      if (generation === this.generation) this.update({ phase: 'blocked', pending: [], failure: 'RECOVERY_UNAVAILABLE' });
    }
  }
  async send(text: string): Promise<void> {
    const trimmed = text.trim();
    if (this.disposed || this.busy || this.snapshot.phase !== 'ready' || !trimmed) throw new BaitlyAgUiError('DECISION_REQUIRED');
    this.busy = true; ++this.generation;
    const message = { id: this.id(), role: 'user' as const, content: trimmed };
    const model = this.snapshot.model;
    this.update({ phase: 'running', model: { ...model, messages: [...model.messages, message],
      items: [...model.items, { id: message.id, kind: 'user', text: trimmed, complete: true }] } });
    await this.run();
  }
  async decide(id: string, confirmed: boolean): Promise<void> {
    if (this.disposed || this.busy || this.snapshot.phase !== 'review') throw new BaitlyAgUiError('DECISION_REQUIRED');
    this.busy = true; ++this.generation;
    this.update({ phase: 'restoring', failure: null });
    try {
      // Fresh scoped proof immediately before the explicit decision. A stale
      // Redis index, absent row or recorded decision never permits a new POST.
      const proof = await this.proof();
      if (this.disposed) return;
      const action = proof.actions.find(a => a.toolCallId === id && a.resumable);
      if (!action || this.recoveredPhase(proof) === 'blocked') {
        this.update({ phase: 'blocked', pending: proof.actions, reconciliation: proof.reconciliation, failure: 'DECISION_UNAVAILABLE' }); return;
      }
      this.update({ pending: proof.actions, reconciliation: proof.reconciliation });
      await this.run({ id, confirmed });
    } catch {
      this.update({ phase: 'blocked', failure: 'RECOVERY_UNAVAILABLE' });
    } finally { this.busy = false; }
  }
  private async run(decision?: { id: string; confirmed: boolean }): Promise<void> {
    this.busy = true; ++this.generation;
    try {
      const client = this.options.createClient(); this.active = client;
      const runId = this.id();
      const threadId = `baitly-chat-${this.conversationId ?? runId}`;
      if (decision) client.restorePending(threadId, runId, [decision.id]);
      this.update({ phase: 'running', failure: null });
      const outcome = await client.run({ threadId, runId, messages: this.snapshot.model.messages,
        state: this.snapshot.model.state, tools: [], context: [],
        forwardedProps: { conversationId: this.conversationId, completionPolicy:'durable-writes-v3' },
        ...(decision ? { resume: [{ interruptId: decision.id,
          status: decision.confirmed ? 'resolved' as const : 'cancelled' as const,
          payload: { confirmed: decision.confirmed } }] } : {}),
      }, (event: BaitlyAgUiEvent) => {
        if(event.type==='STATE_SNAPSHOT' && event.snapshot && typeof event.snapshot==='object' && 'conversationId' in event.snapshot) {
          const id=(event.snapshot as {conversationId:unknown}).conversationId;
          if(typeof id!=='number' || !Number.isSafeInteger(id) || id<=0 || (this.conversationId!==null && this.conversationId!==id)) throw new BaitlyAgUiError('PROTOCOL');
          this.conversationId=id;
        }
        this.update({ model: reduceBaitlyChat(this.snapshot.model, event) });
      });
      if (this.disposed) return;
      // Terminal SSE alone never authorizes another message; require server proof.
      if (outcome.type === 'interrupt') {
        const proof = await this.proof();
        this.update({ phase: proof.completion?.requestId===runId?this.recoveredPhase(proof,true):'blocked', pending: proof.actions, reconciliation: proof.reconciliation });
      } else {
        const proof = await this.proof();
        this.update({ phase: proof.completion?.requestId===runId?this.recoveredPhase(proof,true):'blocked', pending: proof.actions, reconciliation: proof.reconciliation });
      }
    } catch (error) {
      this.update({ phase: 'blocked', failure: error instanceof BaitlyAgUiError ? error.code : 'RUN_UNCERTAIN' });
    } finally { this.active = null; this.busy = false; }
  }
  stop(): void { this.active?.abortRun(); }
  dispose(): void {
    this.disposed = true; ++this.generation; this.active?.abortRun(); this.listeners.clear();
  }
}
