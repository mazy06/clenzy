import { z } from 'zod';

// Candidate transport only. No imports from CopilotKit or AG-UI/Zod 3.
const id = z.string().min(1);
const extra = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();
export const baitlyResumeSchema = z.array(extra({
  interruptId: id,
  status: z.enum(['resolved', 'cancelled']),
  payload: extra({ confirmed: z.boolean() }),
})).min(1).superRefine((entries, ctx) => {
  const ids = new Set<string>();
  entries.forEach((entry, index) => {
    if (ids.has(entry.interruptId) || (entry.status === 'resolved') !== entry.payload.confirmed) {
      ctx.addIssue({ code: 'custom', path: [index], message: 'Invalid decision' });
    }
    ids.add(entry.interruptId);
  });
});

// Preserve extension fields and multimodal content; this is the transport
// envelope, not a replacement for every SDK message/tool JSON Schema.
export const baitlyRunSchema = extra({
  threadId: id, runId: id,
  messages: z.array(extra({ id, role: z.enum(['developer', 'system', 'user', 'assistant', 'tool']) })),
  resume: baitlyResumeSchema.optional(),
});
export type BaitlyRunInput = z.infer<typeof baitlyRunSchema>;
export type BaitlyResume = z.infer<typeof baitlyResumeSchema>;

const interrupt = extra({ id, reason: z.string(), message: z.string().optional(), toolCallId: id.optional(),
  metadata: z.record(z.string(), z.unknown()).optional() });
const outcome = z.discriminatedUnion('type', [
  extra({ type: z.literal('success') }),
  extra({ type: z.literal('cancelled') }),
  extra({ type: z.literal('interrupt'), interrupts: z.array(interrupt).min(1) }),
]);
export const baitlyEventSchema = z.discriminatedUnion('type', [
  extra({ type: z.literal('RUN_STARTED'), threadId: id, runId: id }),
  extra({ type: z.literal('RUN_FINISHED'), threadId: id, runId: id, outcome }),
  extra({ type: z.literal('RUN_ERROR'), message: z.string() }),
  extra({ type: z.literal('TEXT_MESSAGE_START'), messageId: id, role: z.literal('assistant') }),
  extra({ type: z.literal('TEXT_MESSAGE_CONTENT'), messageId: id, delta: z.string() }),
  extra({ type: z.literal('TEXT_MESSAGE_END'), messageId: id }),
  extra({ type: z.literal('TOOL_CALL_START'), toolCallId: id, toolCallName: id, parentMessageId: id.optional() }),
  extra({ type: z.literal('TOOL_CALL_ARGS'), toolCallId: id, delta: z.string() }),
  extra({ type: z.literal('TOOL_CALL_END'), toolCallId: id }),
  extra({ type: z.literal('TOOL_CALL_RESULT'), toolCallId: id, messageId: id, role: z.literal('tool'), content: z.string() }),
  extra({ type: z.literal('STATE_SNAPSHOT'), snapshot: z.unknown() }),
  extra({ type: z.literal('STATE_DELTA'), delta: z.array(z.unknown()) }),
]);
export type BaitlyAgUiEvent = z.infer<typeof baitlyEventSchema>;
export type BaitlyRunOutcome = z.infer<typeof outcome>;

export type BaitlyAgUiErrorCode = 'INVALID_INPUT' | 'BUSY' | 'DECISION_REQUIRED' | 'RECONCILIATION_REQUIRED'
  | 'HTTP' | 'NETWORK' | 'ABORTED' | 'INVALID_STREAM' | 'FRAME_LIMIT' | 'PROTOCOL' | 'REMOTE_RUN' | 'CONSUMER';

/** Fixed diagnostics only: never attach a response body, schema issues or cause. */
export class BaitlyAgUiError extends Error {
  constructor(readonly code: BaitlyAgUiErrorCode, readonly status?: number) {
    super(`BAITLY_AGUI_${code}`);
    this.name = 'BaitlyAgUiError';
  }
}
