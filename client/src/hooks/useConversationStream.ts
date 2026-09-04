import { useEffect } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import { useQueryClient } from '@tanstack/react-query';
import { conversationKeys } from './useConversations';
import { contactKeys } from './useContactMessages';
import type { ContactMessage } from '../services/api/contactApi';
import type { ConversationMessageDto, PageResponse } from '../services/api/conversationApi';
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
 * <p>Rien ne rattrapait ce silence côté conversations voyageur :
 * `refetchOnWindowFocus` est désactivé globalement, ces requêtes ne portent
 * aucun `refetchInterval`, et seules les mutations de l'utilisateur LUI-MÊME
 * invalident le cache. Un écran ouvert ne se rafraîchissait donc jamais.</p>
 *
 * <p>Le chat INTERNE, lui, emprunte un tout autre chemin — `ContactMessage`,
 * publié sur `/topic/contact/{orgId}` — que personne n'écoutait davantage. Il
 * ne s'en tirait que par un sondage toutes les 30 à 60 secondes : jamais perdu,
 * mais jamais instantané non plus. Les deux familles sont donc abonnées ici.</p>
 */

/** Attente avant la première reconnexion, puis doublée jusqu'au plafond. */
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;

/**
 * Écrit le message reçu directement dans le fil en cache.
 *
 * <p>La trame PORTE déjà le message : invalider pour aller le rechercher en
 * HTTP ajoutait un aller-retour complet entre son arrivée et son affichage,
 * alors qu'il était là. On l'insère donc, et le fil ouvert se met à jour sans
 * un octet de réseau.</p>
 *
 * <p>Les messages arrivent triés du plus ancien au plus récent, paginés : le
 * nouveau appartient à la page marquée `last`. Les autres pages ne le
 * concernent pas.</p>
 *
 * @returns `true` si le cache a été mis à jour ; `false` s'il faut retomber sur
 *          une invalidation — page absente du cache, ou fil dont la dernière
 *          page n'est pas chargée.
 */
function appendToThread(
  queryClient: ReturnType<typeof useQueryClient>,
  message: ConversationMessageDto,
): boolean {
  const entries = queryClient.getQueriesData<PageResponse<ConversationMessageDto>>({
    queryKey: [...conversationKeys.all, 'messages', message.conversationId],
    exact: false,
  });

  let patched = false;
  entries.forEach(([key, page]) => {
    if (!page || !page.last) return;
    // Le serveur nous renvoie aussi NOTRE propre message : sans ce garde, il
    // apparaîtrait deux fois après un envoi.
    if (page.content.some((existing) => existing.id === message.id)) {
      patched = true;
      return;
    }
    queryClient.setQueryData(key, {
      ...page,
      content: [...page.content, message],
      totalElements: page.totalElements + 1,
    });
    patched = true;
  });
  return patched;
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
 * Ajoute un message de chat interne au fil déjà en cache.
 *
 * <p>Contrairement aux conversations voyageur, ce fil n'est pas paginé : le
 * cache contient un simple tableau, et le message va à la fin.</p>
 */
function appendToContactThread(
  queryClient: ReturnType<typeof useQueryClient>,
  cleFil: string,
  message: ContactMessage,
): void {
  [false, true].forEach((archived) => {
    const cle = contactKeys.threadMessages(cleFil, archived);
    const actuel = queryClient.getQueryData<ContactMessage[]>(cle);
    if (!Array.isArray(actuel)) return;
    // Le serveur renvoie aussi NOTRE propre message : sans ce garde, il
    // apparaîtrait deux fois après un envoi.
    if (actuel.some((m) => m.id === message.id)) return;
    queryClient.setQueryData(cle, [...actuel, message]);
  });
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
        let event: ConversationMessageDto;
        try {
          event = JSON.parse(frame.body) as ConversationMessageDto;
        } catch {
          // Un corps illisible ne doit pas rompre l'abonnement.
          return;
        }

        if (event.conversationId != null && event.id != null) {
          // Le fil ouvert se met à jour SANS réseau : la trame porte le
          // message. On ne retombe sur une invalidation que si le cache ne
          // contient pas la dernière page — le seul cas où il manque du
          // contexte. La clé s'arrête à l'identifiant : la clé complète se
          // termine par `{ page }`, et `{ page: undefined }` ne préfixe pas
          // `{ page: 1 }`.
          if (!appendToThread(queryClient, event)) {
            queryClient.invalidateQueries({
              queryKey: [...conversationKeys.all, 'messages', event.conversationId],
              exact: false,
            });
          }
        }

        // La boîte de réception, elle, porte des AGRÉGATS que la trame ne
        // contient pas — compteur de non-lus, ordre, dernier extrait — donc
        // une invalidation reste nécessaire. Elle n'est pas sur le chemin
        // critique : le fil ouvert est déjà à jour.
        queryClient.invalidateQueries({
          queryKey: [...conversationKeys.all, 'inbox'],
          exact: false,
        });
        queryClient.invalidateQueries({ queryKey: conversationKeys.unreadCount() });
      });

      // ── Chat interne ────────────────────────────────────────────────────
      client.subscribe(`/topic/contact/${organizationId}`, (frame: IMessage) => {
        let event: { message?: ContactMessage & { threadId?: number | null } };
        try {
          event = JSON.parse(frame.body);
        } catch {
          return;
        }

        // Le fil ouvert est écrit DIRECTEMENT depuis la trame, qui porte le
        // message complet. Invalider ferait repartir chaque poste abonné en
        // HTTP : sur une organisation de vingt personnes, un seul message
        // provoquait vingt rechargements du fil — la tempête qu'on a déjà vue
        // sur les objets connectés.
        const message = event.message;
        if (message?.threadId != null) {
          appendToContactThread(queryClient, `group:${message.threadId}`, message);
        } else {
          queryClient.invalidateQueries({
            queryKey: [...contactKeys.all, 'thread-messages'],
            exact: false,
          });
        }

        // La liste des fils porte des agrégats absents de la trame — non-lus,
        // ordre, dernier extrait : elle reste invalidée.
        queryClient.invalidateQueries({
          queryKey: [...contactKeys.all, 'threads'],
          exact: false,
        });
      });

      // Une reconnexion laisse un trou : les événements émis pendant la coupure
      // ne sont pas rejoués. On recale donc les listes à chaque (re)connexion —
      // c'est ce qui permet de desserrer le sondage sans rien perdre.
      queryClient.invalidateQueries({ queryKey: contactKeys.all, exact: false });
      queryClient.invalidateQueries({
        queryKey: [...conversationKeys.all, 'inbox'],
        exact: false,
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
