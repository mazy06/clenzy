// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import InternalThread from './InternalThread';
import type { ContactThreadSummary } from '../../../services/api/contactApi';

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    currentLanguage: 'fr',
    t: (key: string, fallback?: unknown, opts?: Record<string, unknown>) =>
      typeof fallback === 'string'
        ? fallback.replace(/{{(\w+)}}/g, (_m, name: string) => String(opts?.[name] ?? ''))
        : key,
  }),
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('./QuoteMessageCard', () => ({ default: () => null }));
vi.mock('./DepositMessageCard', () => ({ default: () => null }));

const api = vi.hoisted(() => ({
  messages: [] as unknown[],
  reply: vi.fn(),
  replyInThread: vi.fn(),
  archive: vi.fn(),
  suggest: vi.fn(),
}));

vi.mock('../../../hooks/useContactMessages', () => {
  const idle = (mutate: unknown) => ({ mutate, isPending: false, isError: false });
  return {
    useThreadMessages: () => ({ data: api.messages, isLoading: false }),
    useReplyMessage: () => idle(api.reply),
    useReplyInThread: () => idle(api.replyInThread),
    useArchiveThread: () => idle(api.archive),
  };
});
vi.mock('../../../hooks/useAi', () => ({ useAiSuggestResponse: () => ({ mutate: api.suggest, isPending: false, isError: false }) }));

afterEach(cleanup);

const thread: ContactThreadSummary = {
  counterpartKeycloakId: 'kc-1',
  counterpartFirstName: 'Nadia',
  counterpartLastName: 'Ouali',
  counterpartEmail: 'nadia@example.com',
  lastMessagePreview: null,
  lastMessageAt: new Date().toISOString(),
  unreadCount: 0,
  totalMessages: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  api.messages = [
    { id: 7, senderId: 'kc-1', senderName: 'Nadia Ouali', message: 'Le ménage est-il fait ?', createdAt: new Date().toISOString() },
  ];
});

const mount = () => render(<InternalThread thread={thread} onArchived={vi.fn()} />);

describe('InternalThread', () => {
  it('montre l’interlocuteur et son message', () => {
    mount();
    expect(within(screen.getByRole('banner')).getByText('Nadia Ouali')).toBeTruthy();
    expect(screen.getByText('Le ménage est-il fait ?')).toBeTruthy();
  });

  it('n’offre pas d’onglet « Note interne » : le serveur ne sait pas consigner une note ici', () => {
    mount();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('la suggestion IA arrive dans une carte et n’écrase pas la saisie en cours', () => {
    api.suggest.mockImplementation((_vars, opts) => opts.onSuccess({ response: 'Oui, c’est fait.' }));
    mount();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Je regarde et je reviens' } });

    fireEvent.click(screen.getByRole('button', { name: 'Suggérer une réponse' }));
    expect(api.suggest).toHaveBeenCalledWith({ message: 'Le ménage est-il fait ?' }, expect.any(Object));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Je regarde et je reviens');

    fireEvent.click(within(screen.getByRole('region', { name: 'Réponse suggérée' })).getByRole('button', { name: 'Utiliser' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Oui, c’est fait.');
  });

  it('répond au dernier message du correspondant', () => {
    mount();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'C’est fait' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(api.reply).toHaveBeenCalledWith(
      { id: 7, data: { message: 'C’est fait', attachments: undefined } },
      expect.any(Object),
    );
  });
});
