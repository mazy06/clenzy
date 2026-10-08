// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChannelThread from './ChannelThread';
import type { ConversationDto, ConversationMessageDto } from '../../../services/api/conversationApi';

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    currentLanguage: 'fr',
    t: (key: string, fallback?: unknown, opts?: Record<string, unknown>) =>
      typeof fallback === 'string'
        ? fallback.replace(/{{(\w+)}}/g, (_m, name: string) => String(opts?.[name] ?? ''))
        : key,
  }),
}));

// Les dialogues ont leurs propres tests : ici, seul leur déclenchement compte.
vi.mock('../../channels/AttachReservationDialog', () => ({ default: () => null }));
vi.mock('../../channels/SendWhatsAppTemplateDialog', () => ({ default: () => null }));
vi.mock('../../channels/GuestProfileDialog', () => ({ default: () => null }));

const api = vi.hoisted(() => ({
  messages: { content: [] as unknown[] },
  analysis: undefined as undefined | { sentiment: string; score: number; urgent: boolean },
  send: vi.fn(),
  suggest: vi.fn(),
  translate: vi.fn(),
  sendDraft: vi.fn(),
  dismissDraft: vi.fn(),
  status: vi.fn(),
  template: vi.fn(),
}));

vi.mock('../../../hooks/useConversations', () => {
  const idle = (mutate: unknown) => ({ mutate, isPending: false, isError: false });
  return {
    useConversationMessages: () => ({ data: api.messages, isLoading: false }),
    useConversationAnalysis: () => ({ data: api.analysis }),
    useSendMessage: () => idle(api.send),
    useSuggestReply: () => idle(api.suggest),
    useTranslateLastInbound: () => idle(api.translate),
    useSendAiDraft: () => idle(api.sendDraft),
    useDismissAiDraft: () => idle(api.dismissDraft),
    useUpdateConversationStatus: () => idle(api.status),
    useSendTemplate: () => idle(api.template),
  };
});

afterEach(cleanup);

const NOW = Date.now();
const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString();

const message = (id: number, over: Partial<ConversationMessageDto>): ConversationMessageDto => ({
  id,
  conversationId: 1,
  direction: 'INBOUND',
  channelSource: 'WHATSAPP',
  senderName: 'Sofia Marti',
  senderIdentifier: null,
  content: 'Quelle est l’heure d’arrivée ?',
  contentHtml: null,
  externalMessageId: null,
  deliveryStatus: 'DELIVERED',
  sentAt: iso(1),
  readAt: null,
  internalNote: false,
  ...over,
} as ConversationMessageDto);

const conversation = (over: Partial<ConversationDto> = {}): ConversationDto => ({
  id: 1,
  guestId: 5,
  guestName: 'Sofia Marti',
  propertyId: 2,
  propertyName: 'Villa Soleil',
  reservationId: 9,
  channel: 'WHATSAPP',
  status: 'OPEN',
  subject: null,
  lastMessagePreview: 'Quelle est l’heure d’arrivée ?',
  lastMessageAt: iso(1),
  assignedToKeycloakId: null,
  unread: false,
  messageCount: 1,
  createdAt: iso(48),
  checkIn: null,
  checkOut: null,
  externalConversationId: null,
  aiDraftReply: null,
  aiDraftMeta: null,
  ...over,
});

const mount = (conv: ConversationDto = conversation()) =>
  render(
    <MemoryRouter>
      <ChannelThread conv={conv} onArchived={vi.fn()} />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.resetAllMocks();
  api.messages = { content: [message(1, {})] };
  api.analysis = undefined;
});

describe('ChannelThread — copilote IA', () => {
  it('génère une suggestion, la reprend dans la composition et referme la carte', () => {
    api.suggest.mockImplementation((_id, opts) =>
      opts.onSuccess({ response: 'Bonjour Sofia, l’arrivée est possible dès 15h.', tone: 'friendly', language: 'fr', alternatives: [] }),
    );
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Suggérer une réponse' }));
    expect(api.suggest).toHaveBeenCalledWith(1, expect.any(Object));
    const card = screen.getByRole('region', { name: 'Réponse suggérée' });
    expect(within(card).getByText('Bonjour Sofia, l’arrivée est possible dès 15h.')).toBeTruthy();

    fireEvent.click(within(card).getByRole('button', { name: 'Utiliser' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Bonjour Sofia, l’arrivée est possible dès 15h.');
    expect(screen.queryByRole('region', { name: 'Réponse suggérée' })).toBeNull();
  });

  it('une suggestion en échec propose de réessayer au lieu de se taire', () => {
    api.suggest.mockImplementation((_id, opts) => opts.onError(new Error('503')));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Suggérer une réponse' }));
    expect(screen.getByRole('alert').textContent).toContain('Suggestion IA indisponible');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(api.suggest).toHaveBeenCalledTimes(2);
  });

  it('traduit le dernier message du voyageur sous sa bulle, puis le masque', () => {
    api.translate.mockImplementation((_vars, opts) => opts.onSuccess({ targetLanguage: 'fr', translatedText: 'What time is check-in?' }));
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Traduire' }));
    expect(api.translate).toHaveBeenCalledWith({ conversationId: 1, target: 'fr' }, expect.any(Object));
    expect(screen.getByText('What time is check-in?')).toBeTruthy();
    expect(screen.getByText('Traduction · FR')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Masquer la traduction' }));
    expect(screen.queryByText('What time is check-in?')).toBeNull();
  });

  it('signale une traduction identique au message plutôt que de le répéter', () => {
    api.translate.mockImplementation((_vars, opts) => opts.onSuccess({ targetLanguage: 'fr', translatedText: 'Quelle est l’heure d’arrivée ?' }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Traduire' }));
    expect(screen.getByText('Le message est déjà dans votre langue.')).toBeTruthy();
  });

  it('affiche le brouillon du concierge IA, à valider avant envoi', () => {
    mount(conversation({ aiDraftReply: 'Le code de la boîte à clés est 4821.' }));
    const card = screen.getByRole('region', { name: 'Brouillon Concierge IA' });
    fireEvent.click(within(card).getByRole('button', { name: 'Envoyer' }));
    expect(api.sendDraft).toHaveBeenCalledWith(1);

    fireEvent.click(within(card).getByRole('button', { name: 'Éditer' }));
    expect(api.dismissDraft).toHaveBeenCalledWith(1);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Le code de la boîte à clés est 4821.');
  });

  it('remonte l’urgence et le mécontentement dans l’entête', () => {
    api.analysis = { sentiment: 'NEGATIVE', score: 0.1, urgent: true };
    mount();
    const header = screen.getByRole('banner');
    expect(within(header).getByText('Urgent')).toBeTruthy();
    expect(within(header).getByText('Mécontent')).toBeTruthy();
  });
});

describe('ChannelThread — composition', () => {
  it('envoie une réponse au voyageur', () => {
    mount();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Dès 15h !' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(api.send).toHaveBeenCalledWith(
      { conversationId: 1, content: 'Dès 15h !', internalNote: false },
      expect.any(Object),
    );
  });

  it('consigne une note interne sans la présenter comme une réponse', () => {
    mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Note interne' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Client exigeant, soigner l’accueil.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la note' }));
    expect(api.send).toHaveBeenCalledWith(
      { conversationId: 1, content: 'Client exigeant, soigner l’accueil.', internalNote: true },
      expect.any(Object),
    );
  });

  it('réarme le mode « Répondre » après l’envoi d’une note', () => {
    api.send.mockImplementation((_vars, opts) => opts.onSuccess());
    mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Note interne' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la note' }));
    expect(screen.getByRole('tab', { name: 'Répondre' }).getAttribute('aria-selected')).toBe('true');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });

  it('WhatsApp > 24 h : bloque la réponse libre mais autorise la note interne', () => {
    api.messages = { content: [message(1, { sentAt: iso(30) })] };
    mount();
    expect(screen.getByText(/Fenêtre de 24h dépassée/)).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
    // Pas de suggestion possible : on ne peut de toute façon pas répondre.
    expect(screen.queryByRole('button', { name: 'Suggérer une réponse' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Note interne' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false);
  });
});
