import { z } from 'zod';
import { BaitlyAgUiClient } from './BaitlyAgUiClient';
import { BaitlyAgUiError, type BaitlyAgUiEvent } from './BaitlyAgUiProtocol';
import { emptyChat, reduceBaitlyChat, type ChatModel } from './BaitlyChatModel';

const recoverySchema = z.object({ version: z.literal(1), resumePolicy: z.literal('durable-decision-v1'),
  conversationId: z.number().int().positive(), canStart: z.boolean(), actions: z.array(z.object({
    toolCallId: z.string().min(1), toolName: z.string().min(1), description: z.string().nullable(),
    expiresAt: z.iso.datetime({ offset: true }), resumable: z.boolean(),
  })) });
export type ChatRecovery = z.infer<typeof recoverySchema>;
export interface ChatSnapshot {
  phase: 'restoring' | 'ready' | 'running' | 'review' | 'blocked';
  model: ChatModel;
  pending: ChatRecovery['actions'];
  failure: string | null;
}
export interface ChatAdapterOptions {
  conversationId: number;
  loadRecovery: () => Promise<unknown>;
  createClient: () => BaitlyAgUiClient;
  newId?: () => string;
  now?: () => number;
}

/** Inactive UI seam. No effect on subscribe, reconnect, restore or mount. */
export class BaitlyChatAdapter {
  private snapshot: ChatSnapshot = { phase: 'restoring', model: emptyChat(), pending: [], failure: null };
  private readonly listeners = new Set<() => void>();
  private busy = false;
  private generation = 0;
  private disposed = false;
  private active: BaitlyAgUiClient | null = null;
  private readonly id: () => string;
  private readonly now: () => number;
  constructor(private readonly options: ChatAdapterOptions) {
    this.id = options.newId ?? (() => crypto.randomUUID());
    this.now = options.now ?? Date.now;
  }
  getSnapshot = (): ChatSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(next: Partial<ChatSnapshot>): void {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener();
  }
  private async proof(): Promise<ChatRecovery> {
    const result = recoverySchema.safeParse(await this.options.loadRecovery());
    if (!result.success || result.data.conversationId !== this.options.conversationId
      || new Set(result.data.actions.map(a => a.toolCallId)).size !== result.data.actions.length) {
      throw new BaitlyAgUiError('PROTOCOL');
    }
    return { ...result.data, actions: result.data.actions.filter(a => Date.parse(a.expiresAt) > this.now()) };
  }
  async restore(): Promise<void> {
    if (this.busy || this.disposed) return;
    const generation = ++this.generation;
    this.update({ phase: 'restoring', failure: null });
    try {
      const proof = await this.proof();
      if (this.disposed || generation !== this.generation) return;
      this.update({ pending: proof.actions,
        phase: proof.actions.length ? 'review' : proof.canStart ? 'ready' : 'blocked' });
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
      if (!action) { this.update({ phase: 'blocked', pending: proof.actions, failure: 'DECISION_UNAVAILABLE' }); return; }
      this.update({ pending: proof.actions });
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
      const threadId = `baitly-chat-${this.options.conversationId}`;
      if (decision) client.restorePending(threadId, runId, [decision.id]);
      this.update({ phase: 'running', failure: null });
      const outcome = await client.run({ threadId, runId, messages: this.snapshot.model.messages,
        state: this.snapshot.model.state, tools: [], context: [],
        forwardedProps: { conversationId: this.options.conversationId },
        ...(decision ? { resume: [{ interruptId: decision.id,
          status: decision.confirmed ? 'resolved' as const : 'cancelled' as const,
          payload: { confirmed: decision.confirmed } }] } : {}),
      }, (event: BaitlyAgUiEvent) => { this.update({ model: reduceBaitlyChat(this.snapshot.model, event) }); });
      if (this.disposed) return;
      // Only a finished, observed run may allow another explicit live message.
      if (outcome.type === 'interrupt') {
        const proof = await this.proof();
        this.update({ phase: proof.actions.length ? 'review' : 'blocked', pending: proof.actions });
      } else {
        const proof = await this.proof();
        this.update({ phase: proof.actions.length ? 'review' : 'ready', pending: proof.actions });
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
