import { useCallback, useEffect, useState } from 'react';
import { assistantApi, type ConversationSummary } from '../../../services/api/assistantApi';

interface UseConversationsResult {
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  /** Refetch manuel — appele quand une nouvelle conv est creee ou supprimee. */
  refresh: () => void;
  /**
   * Supprime (archive) une conversation cote backend + retire de la liste
   * locale optimistically. En cas d'erreur API, restore la liste.
   */
  archive: (conversationId: number) => Promise<void>;
}

interface UseConversationsOptions {
  /**
   * Cle externe qui declenche un refetch quand elle change. Pattern utilise
   * pour rafraichir la liste apres qu'une nouvelle conv est creee
   * (passer conversationId du useAgent — quand il passe de null a une valeur).
   */
  refreshKey?: unknown;
  /** Taille de page (defaut 50, suffisant pour une sidebar sans pagination). */
  pageSize?: number;
}

/**
 * Hook qui gere la liste des conversations utilisateur pour la sidebar.
 *
 * <p>Pattern :</p>
 * <ul>
 *   <li>Fetch au mount + a chaque changement de {@link refreshKey}</li>
 *   <li>Optimistic delete : retire l'item AVANT l'API call, restore si KO</li>
 *   <li>Refresh manuel via {@link refresh} apres ajout d'une nouvelle conv</li>
 * </ul>
 *
 * <p>Pagination : pas exposee pour la v1 (50 dernieres conv suffit pour la
 * sidebar). Si besoin futur : ajouter loadMore + scroll detection.</p>
 */
export function useConversations(options: UseConversationsOptions = {}): UseConversationsResult {
  const { refreshKey, pageSize = 50 } = options;
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    assistantApi
      .listConversations(0, pageSize)
      .then((page) => {
        if (cancelled) return;
        // Tri par updatedAt desc (le backend renvoie deja dans cet ordre selon
        // l'endpoint, mais on force le tri cote front en defense).
        const sorted = [...page.content].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        setConversations(sorted);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load conversations';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageSize, refreshKey, tick]);

  const archive = useCallback(async (conversationId: number) => {
    // Snapshot avant pour restore si echec
    const snapshot = conversations;
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    try {
      await assistantApi.archiveConversation(conversationId);
    } catch (err) {
      // Rollback optimistic update
      setConversations(snapshot);
      throw err;
    }
  }, [conversations]);

  return { conversations, loading, error, refresh, archive };
}
