import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import StompService from '@/services/realtime/StompService';
import type { ContactMessage } from '@/api/endpoints/contactApi';

/**
 * Evenement WebSocket pour les messages de contact.
 */
interface ContactMessageEvent {
  type: string;           // "NEW_MESSAGE", "THREAD_READ"
  messageId: number | null;
  senderKeycloakId: string;
  recipientKeycloakId: string;
  organizationId: number;
  message: ContactMessage | null;
}

// Cles de query identiques a useMessages.ts
const KEYS = {
  threads: ['contact', 'threads'] as const,
  threadMessages: (counterpartId: string) => ['contact', 'threads', counterpartId, 'messages'] as const,
};

/**
 * Hook qui connecte le WebSocket STOMP et met a jour le cache React Query
 * en temps reel quand un nouveau message de contact arrive.
 *
 * A utiliser dans l'ecran de chat (InternalChatScreen).
 */
export function useContactWebSocket() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const subIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!user?.id || !accessToken) return;

    const stomp = StompService.getInstance();
    stomp.connect(user.id);

    // S'abonner a la queue personnelle de l'utilisateur
    const subId = stomp.subscribe(
      `/user/${user.id}/queue/contact-messages`,
      (event: ContactMessageEvent) => {
        if (event.type === 'NEW_MESSAGE' && event.message) {
          const msg = event.message;
          // Determiner l'interlocuteur pour la cle du cache thread
          const counterpartId = msg.senderId === user.id
            ? msg.recipientId
            : msg.senderId;

          if (counterpartId) {
            // Ajouter le message au cache du thread (si le thread est charge)
            queryClient.setQueryData<ContactMessage[]>(
              KEYS.threadMessages(counterpartId),
              (old) => {
                if (!old) return [msg];
                // Eviter les doublons (si le message vient de notre propre envoi)
                if (old.some(m => m.id === msg.id)) return old;
                return [...old, msg];
              }
            );
          }

          // Invalider la liste des threads (ordre, preview, badge non-lu)
          queryClient.invalidateQueries({ queryKey: KEYS.threads });
        }

        // L'interlocuteur a lu nos messages → rafraichir la liste des threads
        if (event.type === 'THREAD_READ') {
          queryClient.invalidateQueries({ queryKey: KEYS.threads });
        }
      }
    );

    subIdsRef.current.push(subId);

    return () => {
      for (const id of subIdsRef.current) {
        stomp.unsubscribe(id);
      }
      subIdsRef.current = [];
      stomp.disconnect();
    };
  }, [user?.id, accessToken, queryClient]);
}
