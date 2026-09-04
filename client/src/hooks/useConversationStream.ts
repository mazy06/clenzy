import { useEffect } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import { useQueryClient } from '@tanstack/react-query';
import { conversationKeys } from './useConversations';
import { getAccessToken } from '../keycloak';
import { API_CONFIG } from '../config/api';

/**
 * Réception en direct des messages de conversation.
 *
 * <p>Le serveur publiait déjà chaque message entrant et sortant sur
 * {@code /topic/conversations/{orgId}} — courtier STOMP actif, trame CONNECT
 * authentifiée par JWT, abonnement autorisé contre l'organisation de la
 * session. Le client, lui, n'ouvrait aucune connexion : `@stomp/stompjs` et
 * `sockjs-client` figuraient dans les dépendances sans qu'une seule ligne ne
 * les importe. Les événements partaient donc dans le vide.</p>
 *
 * <p>Rien ne rattrapait ce silence : `refetchOnWindowFocus` est désactivé
 * globalement, aucune requête de messagerie ne porte de `refetchInterval`, et
 * seules les mutations de l'utilisateur LUI-MÊME invalident le cache. Un écran
 * ouvert ne se rafraîchissait donc jamais — le message n'arrivait qu'après une
 * navigation ou un rechargement.</p>
 */

/** Attente avant la première reconnexion, puis doublée jusqu'au plafond. */
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;

/** Forme minimale de ce que publie le serveur ; seul l'aiguillage nous importe. */
interface ConversationMessageEvent {
  id?: number;
  conversationId?: number;
}

/**
 * URL du point STOMP, dérivée de l'origine de l'API.
 *
 * <p>On vise l'endpoint natif et non sa variante SockJS : `@stomp/stompjs`
 * parle WebSocket directement, ce qui évite d'embarquer `sockjs-client` et
 * son repli par sondage.</p>
 */
function brokerUrl(): string {
  const base = API_CONFIG.BASE_URL || window.location.origin;
  return `${base.replace(/^http/, 'ws')}/ws`;
}

/**
 * Abonne l'écran au flux des conversations de son organisation.
 *
 * @param organizationId organisation de l'utilisateur ; sans elle il n'y a pas
 *                       de destination à écouter
 * @param enabled        laisse l'appelant fermer la connexion quand l'écran
 *                       n'est plus affiché, plutôt que de la garder ouverte
 *                       pour un utilisateur qui n'ouvre jamais la messagerie
 */
export function useConversationStream(
  organizationId: number | null | undefined,
  enabled = true,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !organizationId) {
      return undefined;
    }

    const client = new Client({
      brokerURL: brokerUrl(),
      reconnectDelay: RETRY_BASE_MS,
      // Le courtier ferme une session muette ; ces battements la maintiennent
      // et détectent une coupure réseau silencieuse en quelques secondes.
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      // Le jeton est relu AVANT CHAQUE connexion : après une longue coupure,
      // celui de la première tentative aurait expiré et le CONNECT serait
      // rejeté en boucle.
      beforeConnect: () => {
        const token = getAccessToken();
        client.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      },
      onStompError: (frame) => {
        // Une trame ERROR est renvoyée par le serveur (CONNECT refusé,
        // abonnement non autorisé) : elle ne doit pas passer inaperçue.
        console.warn('[conversations] STOMP refusé :', frame.headers.message);
      },
    });

    // Le délai de reconnexion croît à chaque échec : un serveur en cours de
    // redémarrage ne doit pas être martelé une fois par seconde.
    let retryMs = RETRY_BASE_MS;
    client.onWebSocketClose = () => {
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
      client.reconnectDelay = retryMs;
    };

    client.onConnect = () => {
      retryMs = RETRY_BASE_MS;
      client.reconnectDelay = RETRY_BASE_MS;

      client.subscribe(`/topic/conversations/${organizationId}`, (frame: IMessage) => {
        let event: ConversationMessageEvent;
        try {
          event = JSON.parse(frame.body) as ConversationMessageEvent;
        } catch {
          // Un corps illisible ne doit pas rompre l'abonnement.
          return;
        }

        // On invalide CIBLÉ, jamais `conversationKeys.all` : cette clé couvre
        // aussi chaque fil ouvert et chaque page de la boîte, et une salve de
        // messages déclencherait autant de rechargements complets — c'est
        // exactement la boucle qui avait fait tomber l'écran des objets
        // connectés sur le limiteur de débit.
        if (event.conversationId != null) {
          // Le fil est paginé et la clé se termine par `{ page }` : passer par
          // `conversationKeys.messages(id)` produirait `{ page: undefined }`,
          // qui ne préfixe PAS `{ page: 1 }`. On s'arrête donc à l'identifiant.
          queryClient.invalidateQueries({
            queryKey: [...conversationKeys.all, 'messages', event.conversationId],
            exact: false,
          });
        }

        // La boîte de réception change à chaque message : dernier extrait,
        // horodatage, compteur de non-lus.
        queryClient.invalidateQueries({
          queryKey: [...conversationKeys.all, 'inbox'],
          exact: false,
        });
        queryClient.invalidateQueries({ queryKey: conversationKeys.unreadCount() });
      });
    };

    client.activate();

    return () => {
      // `deactivate` ferme proprement la session STOMP ; sans lui, une
      // navigation répétée laisserait autant de connexions ouvertes.
      void client.deactivate();
    };
  }, [enabled, organizationId, queryClient]);
}
