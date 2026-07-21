import Keycloak from 'keycloak-js';
import keycloak from '../keycloak';
import apiClient, { type ApiError, syncTokenCookie, refreshSession } from './apiClient';
import storageService, { STORAGE_KEYS, setSessionCookie } from './storageService';

// Types pour les événements de token
export interface TokenEventData {
  timestamp: number;
  userId?: string;
  error?: string;
  retryCount?: number;
  timeUntilExpiry?: number;
}

export interface TokenStats {
  totalTokens: number;
  activeTokens: number;
  expiredTokens: number;
  successRate: string;
}

export interface TokenMetrics {
  refreshCount: number;
  errorCount: number;
  lastRefresh: string;
  averageRefreshTime: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  expiresAt?: string;
  timeUntilExpiry?: number;
  error?: string;
}

// Événements supportés par le service
export type TokenEvent =
  | 'token-expiring'
  | 'token-expired'
  | 'auth-changed'
  | 'auth-failed'
  | 'token-refreshed'
  | 'token-health-check';

// ─── Synchro multi-onglets ───────────────────────────────────────────────────

type TokenSyncAction = 'refresh' | 'logout';

/** Message echange entre onglets. Le shape est valide avant tout traitement. */
interface TokenSyncMessage {
  type?: string;
  action: TokenSyncAction;
  payload?: Record<string, unknown>;
  timestamp?: number;
}

class TokenService {
  private static instance: TokenService;
  private listeners: Map<TokenEvent, Function[]> = new Map();
  private isInitialized = false;
  private retryCount = 0;
  private maxRetries = 3;
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000; // 30 secondes entre les vérifications
  /** Timer de surveillance de santé du token (clear dans shutdown()). */
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  /** Canal principal de synchro multi-onglets (same-origin par construction). */
  private syncChannel: BroadcastChannel | null = null;
  private static readonly SYNC_CHANNEL_NAME = 'clenzy_token_update';

  constructor() {
    // Ne pas initialiser immédiatement, attendre l'appel à initialize()
  }

  /**
   * Obtient l'instance singleton du service
   */
  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  /**
   * Initialise le service de tokens
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) {
        return true;
      }

      // Vérifier que Keycloak est initialisé
      if (!keycloak.authenticated) {
        return false;
      }

      // Initialiser le support multi-onglets
      this.initializeMultiTabSupport();

      // Démarrer la surveillance de santé des tokens
      this.startTokenHealthMonitoring();

      this.isInitialized = true;
      return true;

    } catch (error) {
      return false;
    }
  }

  /**
   * Démarre la surveillance de santé des tokens (sans polling automatique)
   */
  private startTokenHealthMonitoring(): void {
    // Vérification initiale
    this.checkTokenHealth();

    // Idempotent : un seul timer même si initialize() est rappelé après shutdown().
    if (this.healthCheckTimer) return;

    // ⚠️ NE PAS pauser ce timer quand l'onglet est caché (document.hidden) :
    // c'est LUI qui rafraîchit proactivement le token à T-60 s de l'expiration
    // (refreshTokenWithRetry) et resynchronise les cookies (clenzy_session +
    // HttpOnly via syncTokenCookie) — nécessaire à la survie de la session
    // pendant que le SSE supervision et la synchro multi-onglets en dépendent.
    // Le pauser laisserait le token expirer onglet caché → 401 en rafale au
    // retour. Coût onglet caché : ZÉRO requête réseau par tick tant que le
    // token n'approche pas de l'expiration (checkTokenHealth lit
    // keycloak.tokenParsed localement, sans appel HTTP).
    this.healthCheckTimer = setInterval(() => {
      this.checkTokenHealth();
    }, this.healthCheckInterval);
  }

  /**
   * Vérifie la santé du token et déclenche les actions appropriées
   */
  async checkTokenHealth(): Promise<void> {
    if (!keycloak.authenticated) return;

    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return; // Éviter les vérifications trop fréquentes
    }

    this.lastHealthCheck = now;

    try {
      // Vérifier l'expiration du token
      const tokenExp = keycloak.tokenParsed?.exp;
      if (!tokenExp) {
        this.notify('auth-changed', { error: 'Token invalide', timestamp: now });
        return;
      }

      const currentTime = Math.floor(now / 1000);
      const timeUntilExpiry = tokenExp - currentTime;

      if (timeUntilExpiry <= 60) { // 1 minute avant expiration
        this.notify('token-expiring', {
          timeUntilExpiry,
          timestamp: now,
          userId: keycloak.tokenParsed?.sub
        });
        await this.refreshTokenWithRetry();
      } else if (timeUntilExpiry <= 0) {
        this.notify('token-expired', {
          timestamp: now,
          userId: keycloak.tokenParsed?.sub
        });
        // Déclencher re-login ou redirection
        this.handleTokenExpired();
      } else {
        // Token en bonne santé
        this.notify('token-health-check', {
          timeUntilExpiry,
          timestamp: now,
          userId: keycloak.tokenParsed?.sub
        });
      }
    } catch (error) {
      this.notify('auth-changed', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: now
      });
    }
  }

  /**
   * Gère l'expiration du token
   */
  private handleTokenExpired(): void {
    // Cas hard refresh : pas de refresh token disponible (cf. refreshToken()
    // commentaire). Sans refresh token, keycloak.logout() est la seule option,
    // mais on ne veut PAS forcer le logout silencieusement — laisser le 401
    // de la prochaine requete API declencher le flow naturel via apiClient.
    if (!keycloak.refreshToken) {
      return;
    }

    // Essayer de rafraîchir le token
    this.refreshTokenWithRetry().catch(() => {
      // Si le rafraîchissement échoue, forcer la re-connexion
      keycloak.logout();
    });
  }

  /**
   * Rafraîchit le token avec retry intelligent
   */
  async refreshTokenWithRetry(): Promise<boolean> {
    try {
      const result = await this.refreshToken();
      if (result.success) {
        this.retryCount = 0; // Reset en cas de succès
        this.notify('token-refreshed', {
          timestamp: Date.now(),
          userId: keycloak.tokenParsed?.sub
        });
        return true;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      this.retryCount++;

      if (this.retryCount <= this.maxRetries) {
        // Backoff exponentiel : 1s, 2s, 4s
        const delay = Math.pow(2, this.retryCount - 1) * 1000;

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.refreshTokenWithRetry();
      }

      // Trop d'échecs, déclencher re-login
      this.notify('auth-failed', {
        error: error instanceof Error ? error.message : String(error),
        retryCount: this.retryCount,
        timestamp: Date.now()
      });

      return false;
    }
  }

  /**
   * Rafraîchit le token actuel
   */
  async refreshToken(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!keycloak.authenticated) {
        return {
          success: false,
          error: 'Utilisateur non authentifié'
        };
      }

      // Cas hard refresh : le cookie HttpOnly clenzy_auth ne stocke QUE le
      // access token (pas le refresh token — voir tache de suivi #156). Apres
      // un hard refresh, keycloak.refreshToken est undefined car restaure
      // manuellement via le cookie. keycloak.updateToken() rejette dans ce cas
      // avec "no refresh token", ce qui declenche le retry loop puis le logout
      // cascade dans handleTokenExpired() (line 170 → keycloak.logout()) →
      // onAuthLogout → handleGlobalLogout() → window.location = /login.
      //
      // Mode degrade (hard refresh) : pas de refresh token JS. Depuis le pattern
      // BFF, un cookie HttpOnly clenzy_refresh permet un renouvellement cote
      // serveur — on le tente ici. Qu'il aboutisse ou non, on ne force PAS le
      // logout (le 401 d'une requete API reelle pilotera la suite) : succes
      // silencieux conserve, degradation gracieuse.
      if (!keycloak.refreshToken) {
        await refreshSession().catch(() => false);
        return { success: true };
      }

      const refreshed = await keycloak.updateToken(70); // Rafraîchir si expiré dans moins de 70 secondes

      if (refreshed && keycloak.token) {
        // Synchroniser le cookie cross-domain partage avec la landing page.
        // Le token vit en memoire dans keycloak.token (plus de localStorage).
        setSessionCookie(keycloak.token);

        // Sync to HttpOnly cookie (server-side, secure against XSS)
        syncTokenCookie(keycloak.token).catch(() => { /* best-effort */ });

        this.notifyOtherTabs('refresh', { timestamp: Date.now() });
        return { success: true };
      } else {
        return { success: true };
      }

    } catch (error) {
      return {
        success: false,
        error: `Échec du rafraîchissement du token: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Écouter les événements de token
   */
  on(event: TokenEvent, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Supprimer un listener
   */
  off(event: TokenEvent, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Notifier tous les listeners d'un événement
   */
  private notify(event: TokenEvent, data?: TokenEventData): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
      }
    });
  }

  /**
   * Vérifier manuellement la santé du token (pour les composants React)
   */
  async manualHealthCheck(): Promise<{
    isHealthy: boolean;
    timeUntilExpiry?: number;
    status: 'healthy' | 'expiring' | 'expired' | 'error';
  }> {
    try {
      if (!keycloak.authenticated) {
        return { isHealthy: false, status: 'error' };
      }

      const tokenExp = keycloak.tokenParsed?.exp;
      if (!tokenExp) {
        return { isHealthy: false, status: 'error' };
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = tokenExp - currentTime;

      if (timeUntilExpiry <= 0) {
        return { isHealthy: false, status: 'expired' };
      } else if (timeUntilExpiry <= 60) {
        return { isHealthy: true, timeUntilExpiry, status: 'expiring' };
      } else {
        return { isHealthy: true, timeUntilExpiry, status: 'healthy' };
      }
    } catch (error) {
      return { isHealthy: false, status: 'error' };
    }
  }

  /**
   * Synchronise avec le backend pour obtenir les statistiques des tokens
   */
  async getBackendTokenStats(): Promise<TokenStats | null> {
    try {
      const stats = await apiClient.get<TokenStats>('/admin/tokens/stats');
      return stats;
    } catch (error) {
      return null;
    }
  }

  /**
   * Synchronise avec le backend pour obtenir les métriques des tokens
   */
  async getBackendTokenMetrics(): Promise<TokenMetrics | null> {
    try {
      const metrics = await apiClient.get<TokenMetrics>('/admin/tokens/metrics');
      return metrics;
    } catch (error) {
      return null;
    }
  }

  /**
   * Valide un token côté backend
   */
  async validateTokenBackend(token: string): Promise<TokenValidationResult | null> {
    try {
      const result = await apiClient.post<TokenValidationResult>('/admin/tokens/validate', { token });
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Nettoie les tokens expirés côté backend
   */
  async cleanupExpiredTokens(): Promise<{ success: boolean; cleanedCount?: number; error?: string }> {
    try {
      const result = await apiClient.post<{ cleanedCount: number }>('/admin/tokens/cleanup');
      return { success: true, cleanedCount: result.cleanedCount };
    } catch (error: unknown) {
      if (error instanceof Error && 'status' in error) {
        return { success: false, error: `Erreur ${(error as ApiError).status}` };
      }
      return { success: false, error: 'Erreur de connexion' };
    }
  }

  /**
   * Obtient des informations détaillées sur le token actuel
   */
  getCurrentTokenInfo(): {
    isAuthenticated: boolean;
    userId?: string;
    username?: string;
    email?: string;
    roles?: string[];
    expiresAt?: string;
    timeUntilExpiry?: number;
  } {
    if (!keycloak.authenticated || !keycloak.tokenParsed) {
      return { isAuthenticated: false };
    }

    const token = keycloak.tokenParsed;
    if (!token.exp) {
      return { isAuthenticated: false };
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = token.exp - currentTime;

    return {
      isAuthenticated: true,
      userId: token.sub,
      username: token.preferred_username,
      email: token.email,
      roles: token.realm_access?.roles || [],
      expiresAt: new Date(token.exp * 1000).toISOString(),
      timeUntilExpiry: timeUntilExpiry > 0 ? timeUntilExpiry : 0,
    };
  }

  /**
   * Force la vérification de santé du token (pour les composants qui en ont besoin)
   */
  async forceHealthCheck(): Promise<void> {
    await this.checkTokenHealth();
  }

  /**
   * Arrête le service et nettoie les ressources
   */
  shutdown(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.listeners.clear();
    this.isInitialized = false;
    this.retryCount = 0;
    this.syncChannel?.close();
    this.syncChannel = null;
  }

  /**
   * Gestion des sessions multiples (onglets).
   *
   * Canal principal : BroadcastChannel (same-origin par construction, pas de
   * (de)serialisation manuelle). Fallback : event 'storage' pour les
   * navigateurs sans BroadcastChannel (Z1-SEC-FRONTAUX-05). Dans les deux
   * cas le shape du message est valide avant traitement.
   */
  private setupMultiTabSync() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.syncChannel = new BroadcastChannel(TokenService.SYNC_CHANNEL_NAME);
      this.syncChannel.addEventListener('message', (event: MessageEvent) => {
        const update = this.parseSyncMessage(event.data);
        if (update) this.handleTokenUpdate(update);
      });
    } else {
      // Fallback : l'event 'storage' ne se declenche que dans les AUTRES
      // onglets du meme origin. Parse defensif : une valeur malformee sur la
      // cle (autre code, extension, corruption) ne doit pas casser la synchro.
      window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEYS.TOKEN_UPDATE || !event.newValue) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.newValue);
        } catch {
          return;
        }
        const update = this.parseSyncMessage(parsed);
        if (update) this.handleTokenUpdate(update);
      });
    }

    // Canal postMessage historique : n'accepter que les messages de NOTRE
    // origine (Z1-SEC-FRONTAUX-04) — sans ce garde, toute fenetre/iframe
    // capable de poster vers la page pourrait piloter la session.
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: unknown } | null)?.type !== 'TOKEN_UPDATE') return;
      const update = this.parseSyncMessage(event.data);
      if (update) this.handleTokenUpdate(update);
    });
  }

  /**
   * Valide le shape d'un message de synchro multi-onglets.
   * Retourne null si le message n'appartient pas au protocole attendu.
   */
  private parseSyncMessage(raw: unknown): TokenSyncMessage | null {
    if (!raw || typeof raw !== 'object') return null;
    const action = (raw as { action?: unknown }).action;
    if (action !== 'refresh' && action !== 'logout') return null;
    return raw as TokenSyncMessage;
  }

  /**
   * Gère la mise à jour des tokens depuis un autre onglet
   */
  private handleTokenUpdate(update: TokenSyncMessage) {
    if (update.action === 'refresh') {
      this.refreshToken();
    } else if (update.action === 'logout') {
      this.reset();
    }
  }

  /**
   * Notifie les autres onglets d'une mise à jour des tokens.
   * Le postMessage same-window historique a ete retire : il ne notifiait que
   * la fenetre courante (inutile pour l'inter-onglets) sans validation.
   */
  private notifyOtherTabs(action: TokenSyncAction, payload?: Record<string, unknown>) {
    const message: TokenSyncMessage = { type: 'TOKEN_UPDATE', action, payload, timestamp: Date.now() };
    if (this.syncChannel) {
      this.syncChannel.postMessage(message);
      return;
    }
    // Fallback localStorage : declenche l'event 'storage' dans les autres onglets
    storageService.setJSON(STORAGE_KEYS.TOKEN_UPDATE, message);
  }

  /**
   * Initialise la gestion des sessions multiples
   */
  initializeMultiTabSupport() {
    this.setupMultiTabSync();
  }

  /**
   * Obtient le token actuel
   */
  getCurrentToken(): string | undefined {
    return keycloak.token;
  }

  /**
   * Vérifie si le token est valide
   */
  isTokenValid(): boolean {
    return !!(keycloak.authenticated && keycloak.token);
  }

  /**
   * Déconnecte l'utilisateur
   */
  async logout(): Promise<void> {
    try {
      this.notifyOtherTabs('logout');
      await keycloak.logout();
    } catch (error) {
    }
  }

  /**
   * Réinitialise le service
   */
  reset(): void {
    // No-op for now, as the service is event-driven
  }

  /**
   * Obtient l'état d'initialisation
   */
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }
}

// Export par défaut
export default TokenService;
