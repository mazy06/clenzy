import patch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';
import { BaitlyAgUiError, type BaitlyAgUiEvent } from './BaitlyAgUiProtocol';

export interface ChatItem {
  id: string;
  kind: 'user' | 'assistant' | 'tool';
  text: string;
  toolName?: string;
  result?: string;
  complete: boolean;
}
export interface WireMessage {
  [key: string]: unknown;
  id: string; role: 'user' | 'assistant' | 'tool'; content: string;
  toolCallId?: string;
  toolCalls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}
export interface ChatModel { items: ChatItem[]; messages: WireMessage[]; state: unknown }
export const emptyChat = (): ChatModel => ({ items: [], messages: [], state: {} });

/** Immutable presentation reduction, never executes tools or applies navigation. */
export function reduceBaitlyChat(model: ChatModel, event: BaitlyAgUiEvent): ChatModel {
  const items = model.items.map(item => ({ ...item }));
  const messages = model.messages.map(message => ({ ...message,
    ...(message.toolCalls ? { toolCalls: message.toolCalls.map(call => ({ ...call, function: { ...call.function } })) } : {}) }));
  switch (event.type) {
    case 'TEXT_MESSAGE_START':
      if (items.some(i => i.id === event.messageId)) throw new BaitlyAgUiError('PROTOCOL');
      items.push({ id: event.messageId, kind: 'assistant', text: '', complete: false });
      messages.push({ id: event.messageId, role: 'assistant', content: '' });
      break;
    case 'TEXT_MESSAGE_CONTENT': {
      const item = items.find(i => i.id === event.messageId && i.kind === 'assistant');
      const message = messages.find(m => m.id === event.messageId);
      if (!item || !message || item.complete) throw new BaitlyAgUiError('PROTOCOL');
      item.text += event.delta; message.content += event.delta;
      break;
    }
    case 'TEXT_MESSAGE_END': {
      const item = items.find(i => i.id === event.messageId && i.kind === 'assistant');
      if (!item) throw new BaitlyAgUiError('PROTOCOL');
      item.complete = true;
      break;
    }
    case 'TOOL_CALL_START': {
      if (items.some(i => i.id === event.toolCallId)) throw new BaitlyAgUiError('PROTOCOL');
      items.push({ id: event.toolCallId, kind: 'tool', toolName: event.toolCallName, text: '', complete: false });
      const parentId = event.parentMessageId ?? `tool-message-${event.toolCallId}`;
      let parent = messages.find(m => m.id === parentId && m.role === 'assistant');
      if (!parent) { parent = { id: parentId, role: 'assistant', content: '' }; messages.push(parent); }
      parent.toolCalls = [...(parent.toolCalls ?? []), { id: event.toolCallId, type: 'function',
        function: { name: event.toolCallName, arguments: '' } }];
      break;
    }
    case 'TOOL_CALL_ARGS': {
      const call = messages.flatMap(m => m.toolCalls ?? []).find(c => c.id === event.toolCallId);
      if (!call) throw new BaitlyAgUiError('PROTOCOL');
      call.function.arguments += event.delta;
      break;
    }
    case 'TOOL_CALL_RESULT': {
      let item = items.find(i => i.id === event.toolCallId && i.kind === 'tool');
      // A restored server resume may return a result without replaying its START.
      if (!item) { item = { id: event.toolCallId, kind: 'tool', text: '', complete: false }; items.push(item); }
      if (item.complete || messages.some(m => m.id === event.messageId)) throw new BaitlyAgUiError('PROTOCOL');
      item.result = event.content; item.complete = true;
      messages.push({ id: event.messageId, role: 'tool', toolCallId: event.toolCallId, content: event.content });
      break;
    }
    case 'STATE_SNAPSHOT': return { items, messages, state: structuredClone(event.snapshot) };
    case 'STATE_DELTA':
      try {
        // Operation[] is validated by the library, with prototype writes banned.
        return { items, messages, state: patch.applyPatch<unknown>(model.state, event.delta as Operation[], true, false, true).newDocument };
      } catch { throw new BaitlyAgUiError('PROTOCOL'); }
    default: break;
  }
  return { ...model, items, messages };
}
