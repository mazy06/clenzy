import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────

const streamChatMock = vi.fn();
const getMessagesMock = vi.fn();

vi.mock('../../services/api/assistantApi', () => ({
  assistantApi: {
    streamChat: (...args: unknown[]) => streamChatMock(...args),
    getMessages: (...args: unknown[]) => getMessagesMock(...args),
    listConversations: vi.fn(),
    archiveConversation: vi.fn(),
  },
}));

import { useAgent } from '../useAgent';
import type { AgentSseEvent } from '../../services/api/assistantApi';

describe('useAgent', () => {
  beforeEach(() => {
    streamChatMock.mockReset();
    getMessagesMock.mockReset();
  });

  it('starts with idle status and empty messages', () => {
    const { result } = renderHook(() => useAgent());
    expect(result.current.status).toBe('idle');
    expect(result.current.messages).toEqual([]);
    expect(result.current.conversationId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sends a message: appends user + assistant draft, then streams deltas', async () => {
    // Mock streamChat : emit conv_created + text_delta + done
    streamChatMock.mockImplementation(async (
      _body: unknown,
      onEvent: (e: AgentSseEvent) => void,
    ) => {
      onEvent({ type: 'conversation_created', conversationId: 42 });
      onEvent({ type: 'text_delta', delta: 'Salut ' });
      onEvent({ type: 'text_delta', delta: 'le monde' });
      onEvent({ type: 'done', finishReason: 'end_turn' });
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.sendMessage('Bonjour');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('idle');
    });

    expect(result.current.conversationId).toBe(42);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Bonjour');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Salut le monde');
    expect(result.current.messages[1].streaming).toBe(false);
  });

  it('handles tool_call_executed events on assistant message', async () => {
    streamChatMock.mockImplementation(async (
      _body: unknown,
      onEvent: (e: AgentSseEvent) => void,
    ) => {
      onEvent({ type: 'conversation_created', conversationId: 7 });
      onEvent({
        type: 'tool_call_executed',
        toolName: 'list_properties',
        toolCallId: 'toolu_1',
        toolError: false,
        displayHint: 'list',
      });
      onEvent({ type: 'text_delta', delta: 'Tu as 3 proprietes' });
      onEvent({ type: 'done', finishReason: 'end_turn' });
    });

    const { result } = renderHook(() => useAgent());
    await act(async () => {
      await result.current.sendMessage('Liste mes biens');
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));

    const assistant = result.current.messages[1];
    expect(assistant.toolCalls).toHaveLength(1);
    expect(assistant.toolCalls?.[0].toolName).toBe('list_properties');
    expect(assistant.toolCalls?.[0].toolError).toBe(false);
    expect(assistant.content).toBe('Tu as 3 proprietes');
  });

  it('propagates SSE error event to status + error state', async () => {
    streamChatMock.mockImplementation(async (
      _body: unknown,
      onEvent: (e: AgentSseEvent) => void,
    ) => {
      onEvent({ type: 'error', error: 'API overloaded' });
    });

    const { result } = renderHook(() => useAgent());
    await act(async () => {
      await result.current.sendMessage('hi');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error).toBe('API overloaded');
  });

  it('rejects empty/whitespace messages without calling API', async () => {
    const { result } = renderHook(() => useAgent());
    await act(async () => {
      await result.current.sendMessage('');
    });
    await act(async () => {
      await result.current.sendMessage('   ');
    });
    expect(streamChatMock).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('loads existing conversation and filters out tool messages', async () => {
    getMessagesMock.mockResolvedValueOnce([
      { id: 1, role: 'user', content: 'hi', createdAt: '2026-01-01T00:00:00Z' },
      { id: 2, role: 'assistant', content: 'hello', createdAt: '2026-01-01T00:00:01Z' },
      { id: 3, role: 'tool', content: '{}', toolCallId: 'toolu_x', createdAt: '2026-01-01T00:00:02Z' },
      { id: 4, role: 'assistant', content: 'done', createdAt: '2026-01-01T00:00:03Z' },
    ]);

    const { result } = renderHook(() => useAgent());
    await act(async () => {
      await result.current.loadConversation(99);
    });

    expect(result.current.conversationId).toBe(99);
    // 3 messages displayed (user + 2 assistant), tool filtered out
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages.find((m) => m.role === 'tool')).toBeUndefined();
  });

  it('reset clears state', async () => {
    streamChatMock.mockImplementation(async (
      _body: unknown,
      onEvent: (e: AgentSseEvent) => void,
    ) => {
      onEvent({ type: 'conversation_created', conversationId: 1 });
      onEvent({ type: 'text_delta', delta: 'hi' });
      onEvent({ type: 'done', finishReason: 'end_turn' });
    });

    const { result } = renderHook(() => useAgent());
    await act(async () => {
      await result.current.sendMessage('hello');
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));

    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => {
      result.current.reset();
    });

    expect(result.current.conversationId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('passes context (currentPage, selectedPropertyId) in the chat body', async () => {
    streamChatMock.mockImplementation(async (
      _body: unknown,
      onEvent: (e: AgentSseEvent) => void,
    ) => {
      onEvent({ type: 'done', finishReason: 'end_turn' });
    });

    const { result } = renderHook(() => useAgent({
      currentPage: 'dashboard',
      selectedPropertyId: 7,
    }));

    await act(async () => {
      await result.current.sendMessage('test');
    });

    expect(streamChatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'test',
        currentPage: 'dashboard',
        selectedPropertyId: 7,
      }),
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });
});
