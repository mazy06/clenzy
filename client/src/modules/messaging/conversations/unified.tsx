import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Chat as ChatIcon,
  Email as EmailIcon,
  Message as MessageIcon,
  Hub as AirbnbIcon,
  Hotel as BookingIcon,
  Groups as GroupsIcon,
  Description as FormIcon,
} from '../../../icons';
import { useContactThreads } from '../../../hooks/useContactMessages';
import { useChannelInbox } from '../../../hooks/useConversations';
import { receivedFormsKeys } from '../../../hooks/useReceivedForms';
import { conversationTitle } from '../../channels/channelConfig';
import type { ConversationDto } from '../../../services/api/conversationApi';
import type { ContactThreadSummary } from '../../../services/api/contactApi';
import { receivedFormsApi, type ReceivedForm } from '../../../services/api/receivedFormsApi';

// ─── Pastilles canal (référence .mg-chn — couleurs spécifiées) ───────────────

export interface ChannelBadge {
  color: string;
  Icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  label: string;
}

const CHANNEL_BADGES: Record<string, ChannelBadge> = {
  WHATSAPP: { color: '#25A36F', Icon: ChatIcon, label: 'WhatsApp' },
  EMAIL: { color: '#7BA3C2', Icon: EmailIcon, label: 'Email' },
  SMS: { color: '#C28A52', Icon: MessageIcon, label: 'SMS' },
  AIRBNB: { color: 'var(--airbnb)', Icon: AirbnbIcon, label: 'Airbnb' },
  BOOKING: { color: 'var(--booking)', Icon: BookingIcon, label: 'Booking.com' },
  INTERNAL: { color: 'var(--accent)', Icon: GroupsIcon, label: 'Interne' },
  FORM: { color: 'var(--accent)', Icon: FormIcon, label: 'Formulaire' },
};

export function getChannelBadge(channel: string): ChannelBadge {
  return CHANNEL_BADGES[channel] ?? { color: 'var(--faint)', Icon: ChatIcon, label: channel };
}

// ─── Avatars (initiales + couleur déterministe, palette référence) ───────────

const AVATAR_COLORS = ['#5F7E8C', '#C28A52', '#7BA3C2', '#4A9B8E', '#9A7FA3', '#4A6B9A'];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.map((w) => w[0]).slice(0, 2).join('') || '?').toUpperCase();
}

// ─── Dates (liste + séparateurs de jour) ─────────────────────────────────────

/** Heure si aujourd'hui, « Hier », sinon « 04 juin ». */
export function formatConvTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/** Libellé de la pilule séparateur de jour du fil. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
  });
}

export function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Conversation unifiée (threads internes + canal + formulaires reçus) ─────

export interface UnifiedConversation {
  /** Clé de sélection stable : `ch-<id>` (canal), `in-<keycloakId>` (interne) ou `form-<id>`. */
  key: string;
  kind: 'channel' | 'internal' | 'form';
  name: string;
  /** Ligne accent sous le nom : propriété (canal), « Chat interne » ou type de formulaire. */
  context: string;
  channel: string;
  preview: string;
  lastAt: string | null;
  unreadCount: number;
  /** Présent quand kind === 'channel'. */
  conv?: ConversationDto;
  /** Présent quand kind === 'internal'. */
  thread?: ContactThreadSummary;
  /** Présent quand kind === 'form'. */
  form?: ReceivedForm;
}

function fromChannelConversation(conv: ConversationDto): UnifiedConversation {
  return {
    key: `ch-${conv.id}`,
    kind: 'channel',
    name: conv.guestName || conversationTitle(conv),
    context: conv.propertyName ?? getChannelBadge(conv.channel).label,
    channel: conv.channel,
    preview: conv.lastMessagePreview || '—',
    lastAt: conv.lastMessageAt ?? conv.createdAt,
    unreadCount: conv.unread ? 1 : 0,
    conv,
  };
}

function fromInternalThread(thread: ContactThreadSummary): UnifiedConversation {
  const name =
    `${thread.counterpartFirstName ?? ''} ${thread.counterpartLastName ?? ''}`.trim() ||
    thread.counterpartEmail;
  return {
    key: `in-${thread.counterpartKeycloakId}`,
    kind: 'internal',
    name,
    context: 'Chat interne',
    channel: 'INTERNAL',
    preview: thread.lastMessagePreview || '—',
    lastAt: thread.lastMessageAt,
    unreadCount: thread.unreadCount,
    thread,
  };
}

const FORM_TYPE_LABELS: Record<ReceivedForm['formType'], string> = {
  DEVIS: 'Demande de devis',
  MAINTENANCE: 'Maintenance',
  SUPPORT: 'Support',
};

function fromReceivedForm(form: ReceivedForm): UnifiedConversation {
  return {
    key: `form-${form.id}`,
    kind: 'form',
    name: form.fullName || 'Anonyme',
    context: [FORM_TYPE_LABELS[form.formType], form.city].filter(Boolean).join(' · '),
    channel: 'FORM',
    preview: form.subject || `Formulaire #${form.id}`,
    lastAt: form.createdAt,
    unreadCount: form.status === 'NEW' ? 1 : 0,
    form,
  };
}

function byLastActivityDesc(a: UnifiedConversation, b: UnifiedConversation): number {
  const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
  const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
  return tb - ta;
}

/**
 * Formulaires reçus pour l'inbox agrégée — même clé de cache que
 * `useReceivedForms({ page: 0, size: 50 })` (les invalidations de
 * `useUpdateFormStatus` s'appliquent), avec gating par rôle (`enabled`).
 */
const FORMS_INBOX_PARAMS = { page: 0, size: 50 } as const;

function useReceivedFormsInbox(enabled: boolean) {
  return useQuery({
    queryKey: receivedFormsKeys.list(FORMS_INBOX_PARAMS),
    queryFn: () => receivedFormsApi.list(FORMS_INBOX_PARAMS),
    staleTime: 30_000,
    enabled,
  });
}

/**
 * Inbox unifiée « tout dans un seul visuel » : fusionne les threads internes
 * (contactApi), les conversations canal — WhatsApp / Email / SMS / OTA —
 * (conversationApi) et les formulaires reçus non archivés (receivedFormsApi),
 * triés par dernière activité. Réutilise les hooks/API existants.
 */
export function useUnifiedInbox(canAccessChannels: boolean, includeForms: boolean) {
  const { data: threads, isLoading: threadsLoading, error: threadsError } = useContactThreads(false);
  const {
    data: inboxPage,
    isLoading: inboxLoading,
    error: inboxError,
  } = useChannelInbox([], 0, 50, undefined, canAccessChannels);
  const {
    data: formsPage,
    isLoading: formsLoading,
    error: formsError,
  } = useReceivedFormsInbox(includeForms);

  const items = useMemo(() => {
    const merged: UnifiedConversation[] = [
      ...(threads ?? []).map(fromInternalThread),
      ...(inboxPage?.content ?? []).map(fromChannelConversation),
      ...(formsPage?.content ?? [])
        .filter((form) => form.status !== 'ARCHIVED')
        .map(fromReceivedForm),
    ];
    return merged.sort(byLastActivityDesc);
  }, [threads, inboxPage, formsPage]);

  return {
    items,
    isLoading:
      threadsLoading || (canAccessChannels && inboxLoading) || (includeForms && formsLoading),
    error: threadsError || inboxError || formsError,
  };
}

/**
 * Éléments archivés (filtre « Archivés ») : conversations canal
 * `status === 'ARCHIVED'` + formulaires reçus `ARCHIVED`. Requêtes lazy —
 * déclenchées uniquement quand le filtre est actif.
 */
export function useArchivedInbox(enabled: boolean, includeForms: boolean) {
  const {
    data: archivedPage,
    isLoading: convsLoading,
    error: convsError,
  } = useChannelInbox([], 0, 50, 'ARCHIVED', enabled);
  const {
    data: formsPage,
    isLoading: formsLoading,
    error: formsError,
  } = useReceivedFormsInbox(enabled && includeForms);

  const items = useMemo(() => {
    const merged: UnifiedConversation[] = [
      ...(archivedPage?.content ?? []).map(fromChannelConversation),
      ...(formsPage?.content ?? [])
        .filter((form) => form.status === 'ARCHIVED')
        .map(fromReceivedForm),
    ];
    return merged.sort(byLastActivityDesc);
  }, [archivedPage, formsPage]);

  return {
    items,
    isLoading: enabled && (convsLoading || (includeForms && formsLoading)),
    error: convsError || formsError,
  };
}

// ─── Message de fil normalisé (rendu commun aux deux sources) ────────────────

export interface ThreadMessage {
  id: number;
  /** true = envoyé par moi (bulle accent à droite). */
  out: boolean;
  text: string;
  at: string;
  sender?: string | null;
  /** Noms de fichiers joints (messagerie interne). */
  attachments?: string[];
}
