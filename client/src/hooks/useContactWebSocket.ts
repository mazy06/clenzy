import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import StompService from '../services/StompService';
import TokenService from '../services/TokenService';
import { contactKeys } from './useContactMessages';
import type { ContactMessage } from '../services/api/contactApi';

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

/**
 * Hook qui connecte le WebSocket STOMP et met a jour le cache React Query
 * en temps reel quand un nouveau message de contact arrive.
 *
 * A utiliser dans le composant parent de la messagerie (InternalChatTab).
 */
export function useContactWebSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const subIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    const stomp = StompService.getInstance();
    const getToken = () => TokenService.getInstance().getCurrentToken();

    stomp.connect(user.id, getToken);

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

          // Ajouter le message au cache du thread (si le thread est charge)
          queryClient.setQueryData<ContactMessage[]>(
            contactKeys.threadMessages(counterpartId),
            (old) => {
              if (!old) return [msg];
              // Eviter les doublons (si le message vient de notre propre envoi)
              if (old.some(m => m.id === msg.id)) return old;
              return [...old, msg];
            }
          );

          // Invalider la liste des threads (ordre, preview, badge non-lu)
          queryClient.invalidateQueries({ queryKey: contactKeys.threads() });
        }

        // L'interlocuteur a lu nos messages → rafraichir la liste des threads
        if (event.type === 'THREAD_READ') {
          queryClient.invalidateQueries({ queryKey: contactKeys.threads() });
        }
      }
    );

    subIdsRef.current.push(subId);

    return () => {
      // Desabonner
      for (const id of subIdsRef.current) {
        stomp.unsubscribe(id);
      }
      subIdsRef.current = [];
      stomp.disconnect();
    };
  }, [user?.id, queryClient]);
}
