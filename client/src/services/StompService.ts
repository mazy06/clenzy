import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { API_CONFIG } from '../config/api';

/**
 * Service singleton pour la connexion WebSocket STOMP.
 * Utilise SockJS comme transport (compatible avec le backend Spring).
 */
class StompService {
  private static instance: StompService;
  private client: Client | null = null;
  private subscriptions = new Map<string, StompSubscription>();
  private pendingSubscriptions: Array<{ destination: string; callback: (body: any) => void; id: string }> = [];
  private connected = false;
  private userId: string | null = null;

  static getInstance(): StompService {
    if (!StompService.instance) {
      StompService.instance = new StompService();
    }
    return StompService.instance;
  }

  /**
   * Connecte le client STOMP via SockJS.
   * @param userId keycloakId de l'utilisateur courant
   * @param getToken fonction qui retourne le token JWT actuel
   */
  connect(userId: string, getToken: () => string | undefined): void {
    // Eviter les connexions multiples
    if (this.client?.active && this.userId === userId) {
      return;
    }

    // Deconnecter proprement si deja connecte avec un autre user
    if (this.client?.active) {
      this.disconnect();
    }

    this.userId = userId;
    const token = getToken();
    if (!token) {
      console.warn('[StompService] Pas de token disponible, connexion WebSocket reportee');
      return;
    }

    const wsUrl = `${API_CONFIG.BASE_URL}/ws`;

    this.client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => {
        console.debug('[StompService] Connecte');
        this.connected = true;
        // Re-souscrire les abonnements en attente
        for (const pending of this.pendingSubscriptions) {
          this._doSubscribe(pending.destination, pending.callback, pending.id);
        }
        this.pendingSubscriptions = [];
      },

      onDisconnect: () => {
        console.debug('[StompService] Deconnecte');
        this.connected = false;
      },

      onStompError: (frame) => {
        console.warn('[StompService] Erreur STOMP:', frame.headers['message']);
      },

      onWebSocketError: (event) => {
        console.warn('[StompService] Erreur WebSocket:', event);
      },

      // Rafraichir le token avant chaque reconnexion
      beforeConnect: () => {
        const freshToken = getToken();
        if (freshToken && this.client) {
          this.client.connectHeaders = {
            Authorization: `Bearer ${freshToken}`,
          };
        }
      },
    });

    this.client.activate();
  }

  /**
   * S'abonner a une destination STOMP.
   * Si la connexion n'est pas encore etablie, l'abonnement est mis en file d'attente.
   */
  subscribe(destination: string, callback: (body: any) => void): string {
    const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (this.connected && this.client?.active) {
      this._doSubscribe(destination, callback, id);
    } else {
      this.pendingSubscriptions.push({ destination, callback, id });
    }

    return id;
  }

  private _doSubscribe(destination: string, callback: (body: any) => void, id: string): void {
    if (!this.client) return;

    const subscription = this.client.subscribe(destination, (message: IMessage) => {
      try {
        const body = JSON.parse(message.body);
        callback(body);
      } catch (e) {
        console.warn('[StompService] Erreur parsing message:', e);
      }
    }, { id });

    this.subscriptions.set(id, subscription);
  }

  /**
   * Se desabonner d'une destination.
   */
  unsubscribe(id: string): void {
    const subscription = this.subscriptions.get(id);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(id);
    }
    // Retirer aussi des pending
    this.pendingSubscriptions = this.pendingSubscriptions.filter(p => p.id !== id);
  }

  /**
   * Deconnecter proprement le client STOMP.
   */
  disconnect(): void {
    if (this.client) {
      // Desabonner tout
      for (const [id, sub] of this.subscriptions) {
        try { sub.unsubscribe(); } catch { /* ignore */ }
      }
      this.subscriptions.clear();
      this.pendingSubscriptions = [];
      this.connected = false;

      this.client.deactivate();
      this.client = null;
    }
    this.userId = null;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export default StompService;
