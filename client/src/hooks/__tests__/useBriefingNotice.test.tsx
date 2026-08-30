import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const getPageMock = vi.fn();
const markAsReadMock = vi.fn();

vi.mock('../../services/api/notificationsApi', () => ({
  notificationsApi: {
    _endpointAvailable: true,
    getPage: (params: unknown) => getPageMock(params),
    markAsRead: (id: number) => markAsReadMock(id),
  },
}));

import { useBriefingNotice, parseBriefingConversationId } from '../useBriefingNotice';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function notification(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    userId: 'user-x',
    title: 'Weekly review',
    message: 'La semaine ecoulee',
    type: 'info',
    category: 'system',
    notificationKey: 'BRIEFING_READY',
    read: false,
    actionUrl: '/assistant/conversations/42',
    createdAt: '2026-08-30T06:00:00Z',
    ...over,
  };
}

function page(content: unknown[]) {
  return { content, page: 0, size: 20, totalElements: content.length };
}

// ─── Lien porte par la notification ───────────────────────────────────────────

describe('parseBriefingConversationId', () => {
  it('lit l id de conversation du lien de briefing', () => {
    expect(parseBriefingConversationId('/assistant/conversations/42')).toBe(42);
  });

  it('rend null quand le briefing n a pas pu se composer', () => {
    // Pas de conversation a charger : la notification pointe l assistant nu.
    expect(parseBriefingConversationId('/assistant')).toBeNull();
  });

  it('rend null sur un lien absent ou illisible', () => {
    expect(parseBriefingConversationId(undefined)).toBeNull();
    expect(parseBriefingConversationId('/assistant/conversations/zero')).toBeNull();
  });
});

// ─── Revue en attente ─────────────────────────────────────────────────────────

describe('useBriefingNotice', () => {
  beforeEach(() => {
    getPageMock.mockReset();
    markAsReadMock.mockReset();
    markAsReadMock.mockResolvedValue(undefined);
  });

  it('retient la revue parmi les autres notifications non lues', async () => {
    getPageMock.mockResolvedValue(
      page([
        notification({ id: 3, notificationKey: 'PAYMENT_RECEIVED', actionUrl: '/billing' }),
        notification({ id: 9, actionUrl: '/assistant/conversations/108' }),
      ]),
    );

    const { result } = renderHook(() => useBriefingNotice(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.notice).not.toBeNull());
    expect(result.current.notice?.notificationId).toBe(9);
    expect(result.current.notice?.conversationId).toBe(108);
    // Seules les non-lues sont demandees : une revue deja ouverte n allume rien.
    expect(getPageMock).toHaveBeenCalledWith(expect.objectContaining({ unread: true }));
  });

  it('ne signale rien quand aucune revue n attend', async () => {
    getPageMock.mockResolvedValue(page([notification({ notificationKey: 'OPS_ALERT' })]));

    const { result } = renderHook(() => useBriefingNotice(), { wrapper: makeWrapper() });

    await waitFor(() => expect(getPageMock).toHaveBeenCalled());
    expect(result.current.notice).toBeNull();
  });

  it('marque la notification lue — c est ce qui eteint la pastille', async () => {
    getPageMock.mockResolvedValue(page([notification({ id: 11 })]));

    const { result } = renderHook(() => useBriefingNotice(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.notice).not.toBeNull());

    await act(async () => {
      await result.current.dismiss();
    });

    expect(markAsReadMock).toHaveBeenCalledWith(11);
  });
});
