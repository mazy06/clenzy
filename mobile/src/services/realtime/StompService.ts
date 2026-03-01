import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { AppState, AppStateStatus } from 'react-native';
import { API_CONFIG } from '@/config/api';
import { useAuthStore } from '@/store/authStore';

/**
 * Service singleton pour la connexion WebSocket STOMP sur mobile.
 * Utilise le WebSocket natif de React Native (pas SockJS).
 * Gere automatiquement la deconnexion en background et la reconnexion en foreground.
 */
class StompService {
  private static instance: StompService;
  private client: Client | null = null;
  private subscriptions = new Map<string, StompSubscription>();
  private pendingSubscriptions: Array<{ destination: string; callback: (body: any) => void; id: string }> = [];
  private connected = false;
  private userId: string | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  static getInstance(): StompService {
    if (!StompService.instance) {
      StompService.instance = new StompService();
    }
    return StompService.instance;
  }

  /**
   * Connecte le client STOMP via WebSocket natif.
   * @param userId keycloakId de l'utilisateur courant
   */
  connect(userId: string): void {
    // Eviter les connexions multiples
    if (this.client?.active && this.userId === userId) {
      return;
    }

    // Deconnecter proprement si deja connecte avec un autre user
    if (this.client?.active) {
      this.disconnect();
    }

    this.userId = userId;
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      console.warn('[StompService] Pas de token disponible, connexion WebSocket reportee');
      return;
    }

    // Construire l'URL WebSocket a partir de l'URL HTTP du backend
    const httpUrl = `${API_CONFIG.BASE_URL}/ws`;
    const wsUrl = httpUrl.replace(/^http/, 'ws');

    this.client = new Client({
      brokerURL: wsUrl,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      // Necessaire pour React Native
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,

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
        const freshToken = useAuthStore.getState().accessToken;
        if (freshToken && this.client) {
          this.client.connectHeaders = {
            Authorization: `Bearer ${freshToken}`,
          };
        }
      },
    });

    // Gestion foreground/background pour economiser la batterie
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    this.client.activate();
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'active') {
      // Retour au premier plan : reconnecter
      if (this.client && !this.client.active) {
        console.debug('[StompService] App active, reconnexion WebSocket');
        this.client.activate();
      }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // Passage en arriere-plan : deconnecter pour economiser la batterie
      if (this.client?.active) {
        console.debug('[StompService] App background, deconnexion WebSocket');
        this.connected = false;
        this.client.deactivate();
      }
    }
  };

  /**
   * S'abonner a une destination STOMP.
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
    this.pendingSubscriptions = this.pendingSubscriptions.filter(p => p.id !== id);
  }

  /**
   * Deconnecter proprement le client STOMP.
   */
  disconnect(): void {
    // Retirer le listener AppState
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.client) {
      for (const [, sub] of this.subscriptions) {
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
