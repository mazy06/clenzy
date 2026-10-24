import { baitlyEventSchema, baitlyRunSchema, BaitlyAgUiError,
  type BaitlyAgUiEvent, type BaitlyRunInput, type BaitlyRunOutcome } from './BaitlyAgUiProtocol';
import { baitlySseFrames } from './baitlySseFrames';

export interface BaitlyAgUiClientOptions {
  url: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  /** Read afresh at send time, never persist or cache authentication. */
  getHeaders: () => Record<string, string>;
  /** Candidate limit to calibrate against real tool output before activation. */
  maxFrameBytes: number;
}
export type BaitlyAgUiState = 'idle' | 'running' | 'awaiting_decision' | 'uncertain';

/**
 * Inactive candidate. Only validates/emits protocol events; it never executes
 * tools, retries a request, stores tokens or enables a second live engine.
 * Not a drop-in implementation of the complete CopilotKit React SDK.
 */
export class BaitlyAgUiClient {
  private controller: AbortController | null = null;
  private phase: BaitlyAgUiState = 'idle';
  private pending: { threadId: string; runId: string; ids: string[] } | null = null;
  private readonly sentRuns = new Set<string>();

  constructor(private readonly options: BaitlyAgUiClientOptions) {
    if (!Number.isSafeInteger(options.maxFrameBytes) || options.maxFrameBytes < 1) {
      throw new BaitlyAgUiError('INVALID_INPUT');
    }
  }
  get state(): BaitlyAgUiState { return this.phase; }
  abortRun(): void { this.controller?.abort(); }

  async run(input: BaitlyRunInput, onEvent: (event: BaitlyAgUiEvent) => void | Promise<void>): Promise<BaitlyRunOutcome> {
    if (this.controller || this.phase === 'running') throw new BaitlyAgUiError('BUSY');
    if (this.phase === 'uncertain') throw new BaitlyAgUiError('RECONCILIATION_REQUIRED');
    // Do not expose ZodError.issues: they can include user-controlled values.
    if (!baitlyRunSchema.safeParse(input).success) throw new BaitlyAgUiError('INVALID_INPUT');
    if (this.pending) {
      const p = this.pending;
      if (p.threadId !== input.threadId || p.runId !== input.runId || !input.resume
        || input.resume.length !== p.ids.length || input.resume.some(r => !p.ids.includes(r.interruptId))) {
        throw new BaitlyAgUiError('DECISION_REQUIRED');
      }
    } else if (input.resume) throw new BaitlyAgUiError('DECISION_REQUIRED');
    else if (this.sentRuns.has(input.runId)) throw new BaitlyAgUiError('RECONCILIATION_REQUIRED');

    this.phase = 'running';
    const controller = new AbortController(); this.controller = controller;
    const threadId = input.threadId;
    let sent = false;
    try {
      const headers = { ...this.options.getHeaders(), 'Content-Type': 'application/json', Accept: 'text/event-stream' };
      const body = JSON.stringify(input); // Preserve extension fields and message history.
      sent = true;
      this.sentRuns.add(input.runId);
      const response = await (this.options.fetch ?? fetch)(this.options.url, {
        method: 'POST', credentials: 'include', headers, body, signal: controller.signal,
      });
      if (!response.ok) {
        // Never read/log an error response body. A server error is ambiguous.
        if (response.status < 500) this.phase = this.pending ? 'awaiting_decision' : 'idle';
        try { await response.body?.cancel(); } catch { /* no response diagnostic */ }
        throw new BaitlyAgUiError('HTTP', response.status);
      }
      if (!response.body || !/^text\/event-stream(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
        try { await response.body?.cancel(); } catch { /* no response diagnostic */ }
        throw new BaitlyAgUiError('INVALID_STREAM');
      }
      let serverRunId: string | null = null;
      for await (const data of baitlySseFrames(response.body, this.options.maxFrameBytes)) {
        let raw: unknown;
        try { raw = JSON.parse(data); } catch { throw new BaitlyAgUiError('INVALID_STREAM'); }
        const result = baitlyEventSchema.safeParse(raw);
        if (!result.success) throw new BaitlyAgUiError('PROTOCOL');
        const event = result.data;
        if (controller.signal.aborted) throw new BaitlyAgUiError('ABORTED');
        if (event.type === 'RUN_STARTED') {
          // Java assigns a fresh run UUID, including when resuming a pending run.
          if (serverRunId || event.threadId !== threadId) throw new BaitlyAgUiError('PROTOCOL');
          serverRunId = event.runId;
          this.sentRuns.add(serverRunId);
        } else if (!serverRunId) throw new BaitlyAgUiError('PROTOCOL');
        if (event.type === 'RUN_FINISHED' && (event.threadId !== threadId || event.runId !== serverRunId)) {
          throw new BaitlyAgUiError('PROTOCOL');
        }
        if (event.type === 'RUN_ERROR') throw new BaitlyAgUiError('REMOTE_RUN');
        try { await onEvent(event); } catch { throw new BaitlyAgUiError('CONSUMER'); }
        if (event.type === 'RUN_FINISHED') {
          this.pending = event.outcome.type === 'interrupt'
            ? { threadId, runId: event.runId, ids: event.outcome.interrupts.map(i => i.id) } : null;
          this.phase = this.pending ? 'awaiting_decision' : 'idle';
          return event.outcome;
        }
      }
      throw new BaitlyAgUiError('INVALID_STREAM'); // EOF is not proof of success.
    } catch (error) {
      if (this.phase === 'running') this.phase = sent ? 'uncertain' : this.pending ? 'awaiting_decision' : 'idle';
      if (controller.signal.aborted) throw new BaitlyAgUiError('ABORTED');
      if (error instanceof BaitlyAgUiError) throw error;
      throw new BaitlyAgUiError(sent ? 'NETWORK' : 'INVALID_INPUT');
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }
}
