import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationApi } from '../services/api/conversationApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const conversationKeys = {
  all: ['conversations'] as const,
  inbox: (channels?: string[], status?: string, page?: number) =>
    [...conversationKeys.all, 'inbox', { channels, status, page }] as const,
  messages: (conversationId: number, page?: number) =>
    [...conversationKeys.all, 'messages', conversationId, { page }] as const,
  unreadCount: () => [...conversationKeys.all, 'unread-count'] as const,
  analysis: (conversationId: number, lastMessageAt: string | null) =>
    [...conversationKeys.all, 'analysis', conversationId, lastMessageAt] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

/** Inbox des conversations filtre par channels OTA (status=ARCHIVED → conversations archivées) */
export function useChannelInbox(
  channels: string[],
  page = 0,
  size = 20,
  status?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: conversationKeys.inbox(channels, status, page),
    queryFn: () => conversationApi.getInbox({ channels, status, page, size }),
    staleTime: 30_000,
    enabled,
  });
}

/** Messages d'une conversation */
export function useConversationMessages(
  conversationId: number | null,
  page = 0,
  size = 50,
) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId!, page),
    queryFn: () => conversationApi.getMessages(conversationId!, { page, size }),
    staleTime: 15_000,
    enabled: conversationId != null,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Marquer une conversation comme lue */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: number) =>
      conversationApi.markAsRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

/** Envoyer un message dans une conversation */
export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      content,
      contentHtml,
      internalNote,
    }: {
      conversationId: number;
      content: string;
      contentHtml?: string;
      /** true = note d'équipe : consignée dans le fil, jamais envoyée au voyageur. */
      internalNote?: boolean;
    }) => conversationApi.sendMessage(conversationId, { content, contentHtml, internalNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

/** Archiver / restaurer une conversation OTA (status ARCHIVED ↔ OPEN) */
export function useUpdateConversationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, status }: { conversationId: number; status: string }) =>
      conversationApi.updateStatus(conversationId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

/** Rattacher une conversation « à trier » à une réservation (relais WhatsApp). */
export function useAttachToReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, reservationId, memorizePhone }: { conversationId: number; reservationId: number; memorizePhone?: boolean }) =>
      conversationApi.attachToReservation(conversationId, reservationId, memorizePhone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

/** Envoyer un template WhatsApp sur une conversation. */
export function useSendTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, templateKey }: { conversationId: number; templateKey: string }) =>
      conversationApi.sendTemplate(conversationId, templateKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

/** Concierge IA : valider et envoyer le brouillon suggéré. */
export function useSendAiDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: number) => conversationApi.sendAiDraft(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

/** Concierge IA : rejeter le brouillon (sans envoi). */
export function useDismissAiDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: number) => conversationApi.dismissAiDraft(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

/** Envoyer un template WhatsApp depuis une réservation (envoi proactif). */
export function useSendTemplateForReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, templateKey }: { reservationId: number; templateKey: string }) =>
      conversationApi.sendTemplateForReservation(reservationId, templateKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

// ─── Copilote IA ────────────────────────────────────────────────────────────

/**
 * Sentiment et urgence du dernier message voyageur. La clé porte la date du
 * dernier message : un nouveau message relance l'analyse, une simple
 * navigation entre conversations non. Gratuit côté serveur (mots-clés), mais
 * on évite tout appel tant que la conversation n'est pas ouverte.
 */
export function useConversationAnalysis(
  conversationId: number | null,
  lastMessageAt: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: conversationKeys.analysis(conversationId ?? -1, lastMessageAt),
    queryFn: () => conversationApi.getAnalysis(conversationId!),
    enabled: enabled && conversationId != null,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Génère un brouillon de réponse (jamais envoyé : l'opérateur le relit et l'utilise). */
export function useSuggestReply() {
  return useMutation({
    mutationFn: (conversationId: number) => conversationApi.suggestReply(conversationId),
  });
}

/** Traduit le dernier message du voyageur (langue cible = langue de l'interface). */
export function useTranslateLastInbound() {
  return useMutation({
    mutationFn: ({ conversationId, target }: { conversationId: number; target: string }) =>
      conversationApi.translateLastInbound(conversationId, target),
  });
}
