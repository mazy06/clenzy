import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../services/api/notificationsApi';

/**
 * Cle de notification portee par les briefings proactifs — miroir de
 * {@code NotificationKey.BRIEFING_READY} cote serveur.
 */
const BRIEFING_READY = 'BRIEFING_READY';

export interface BriefingNotice {
  /** Notification a marquer lue une fois la revue ouverte. */
  notificationId: number;
  /** Conversation de la revue, ou null si le briefing n'a pas pu se composer. */
  conversationId: number | null;
  /** Intitule court : « Weekly review », « Briefing matinal », « Alertes du jour ». */
  title: string;
}

/**
 * Extrait l'id de conversation du lien porte par la notification
 * (`/assistant/conversations/42`).
 *
 * <p>Retourne null quand le lien ne le porte pas : c'est le cas d'un briefing
 * qui n'a pas pu se composer, ou la notification pointe `/assistant` tout court.
 * L'appelant doit alors se contenter de la pastille, sans rien charger.</p>
 */
export function parseBriefingConversationId(actionUrl?: string): number | null {
  if (!actionUrl) return null;
  const match = actionUrl.match(/\/assistant\/conversations\/(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * La revue en attente, s'il y en a une.
 *
 * <p>Le backend notifie deja chaque briefing compose ({@code BRIEFING_READY}).
 * On relit ces notifications non lues plutot que d'ajouter un endpoint : la
 * source de verite du « il y a une revue a lire » est le fait qu'elle n'a pas
 * encore ete ouverte, pas une date de generation.</p>
 *
 * <p>Sondage pause quand l'onglet est cache — une revue hebdomadaire ne
 * justifie pas de reveiller un onglet en arriere-plan.</p>
 */
export function useBriefingNotice() {
  const queryClient = useQueryClient();

  const { data } = useQuery<BriefingNotice | null>({
    queryKey: ['notifications', 'briefing-notice'],
    queryFn: async () => {
      const page = await notificationsApi.getPage({ page: 0, size: 20, unread: true });
      const hit = page.content.find((n) => n.notificationKey === BRIEFING_READY);
      if (!hit) return null;
      return {
        notificationId: hit.id,
        conversationId: parseBriefingConversationId(hit.actionUrl),
        title: hit.title,
      };
    },
    refetchInterval: () => {
      if (typeof document !== 'undefined' && document.hidden) return false;
      return notificationsApi._endpointAvailable ? 60_000 : false;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  /** Marque la notification lue — c'est ce qui eteint la pastille. */
  const dismiss = useCallback(async () => {
    if (!data) return;
    await notificationsApi.markAsRead(data.notificationId);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [data, queryClient]);

  return { notice: data ?? null, dismiss };
}

export default useBriefingNotice;
