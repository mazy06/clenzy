import Keycloak from 'keycloak-js';
import keycloak from '../keycloak';
import { buildApiUrl } from '../config/api';

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

class TokenService {
  private static instance: TokenService;
  private listeners: Map<TokenEvent, Function[]> = new Map();
  private isInitialized = false;
  private retryCount = 0;
  private maxRetries = 3;
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000; // 30 secondes entre les vérifications

  constructor() {
    // Ne pas initialiser immédiatement, attendre l'appel à initialize()
    console.log('TokenService - Instance créée, initialisation différée');
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
        console.log('TokenService - Keycloak non authentifié, attente...');
        return false;
      }

      // Initialiser le support multi-onglets
      this.initializeMultiTabSupport();
      
      // Démarrer la surveillance de santé des tokens
      this.startTokenHealthMonitoring();
      
      this.isInitialized = true;
      console.log('TokenService - Service initialisé avec succès');
      return true;

    } catch (error) {
      console.error('TokenService - Erreur lors de l\'initialisation:', error);
      return false;
    }
  }

  /**
   * Démarre la surveillance de santé des tokens (sans polling automatique)
   */
  private startTokenHealthMonitoring(): void {
    // Vérification initiale
    this.checkTokenHealth();
    
    // Vérification périodique légère (seulement pour la surveillance)
    setInterval(() => {
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
    console.log('TokenService - Token expiré, tentative de re-login...');
    
    // Essayer de rafraîchir le token
    this.refreshTokenWithRetry().catch(() => {
      // Si le rafraîchissement échoue, forcer la re-connexion
      console.log('TokenService - Re-login forcé...');
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
        console.log(`TokenService - Retry ${this.retryCount}/${this.maxRetries} dans ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.refreshTokenWithRetry();
      }
      
      // Trop d'échecs, déclencher re-login
      this.notify('auth-failed', { 
        error: error instanceof Error ? error.message : String(error), 
        retryCount: this.retryCount,
        timestamp: Date.now()
      });
      
      console.error('TokenService - Échec du rafraîchissement après tous les retries');
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

      const refreshed = await keycloak.updateToken(70); // Rafraîchir si expiré dans moins de 70 secondes
      
      if (refreshed) {
        console.log('TokenService - Token rafraîchi avec succès');
        this.notifyOtherTabs('refresh', { timestamp: Date.now() });
        return { success: true };
      } else {
        console.log('TokenService - Token encore valide, pas de rafraîchissement nécessaire');
        return { success: true };
      }

    } catch (error) {
      console.error('TokenService - Erreur lors du rafraîchissement du token:', error);
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
        console.error(`TokenService - Erreur dans le listener pour l'événement ${event}:`, error);
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
      const response = await fetch(buildApiUrl('/admin/tokens/stats'), {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const stats = await response.json();
        console.log('TokenService - Statistiques backend récupérées:', stats);
        return stats;
      } else {
        console.warn('TokenService - Impossible de récupérer les statistiques backend:', response.status);
        return null;
      }
    } catch (error) {
      console.error('TokenService - Erreur lors de la récupération des statistiques backend:', error);
      return null;
    }
  }

  /**
   * Synchronise avec le backend pour obtenir les métriques des tokens
   */
  async getBackendTokenMetrics(): Promise<TokenMetrics | null> {
    try {
      const response = await fetch(buildApiUrl('/admin/tokens/metrics'), {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const metrics = await response.json();
        console.log('TokenService - Métriques backend récupérées:', metrics);
        return metrics;
      } else {
        console.warn('TokenService - Impossible de récupérer les métriques backend:', response.status);
        return null;
      }
    } catch (error) {
      console.error('TokenService - Erreur lors de la récupération des métriques backend:', error);
      return null;
    }
  }

  /**
   * Valide un token côté backend
   */
  async validateTokenBackend(token: string): Promise<TokenValidationResult | null> {
    try {
      const response = await fetch(buildApiUrl('/admin/tokens/validate'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('TokenService - Validation backend réussie:', result);
        return result;
      } else {
        console.warn('TokenService - Échec de la validation backend:', response.status);
        return null;
      }
    } catch (error) {
      console.error('TokenService - Erreur lors de la validation backend:', error);
      return null;
    }
  }

  /**
   * Nettoie les tokens expirés côté backend
   */
  async cleanupExpiredTokens(): Promise<{ success: boolean; cleanedCount?: number; error?: string }> {
    try {
      const response = await fetch(buildApiUrl('/admin/tokens/cleanup'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('TokenService - Nettoyage des tokens réussi:', result);
        return { success: true, cleanedCount: result.cleanedCount };
      } else {
        console.warn('TokenService - Échec du nettoyage des tokens:', response.status);
        return { success: false, error: `Erreur ${response.status}` };
      }
    } catch (error) {
      console.error('TokenService - Erreur lors du nettoyage des tokens:', error);
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
    this.listeners.clear();
    this.isInitialized = false;
    this.retryCount = 0;
    console.log('TokenService - Service arrêté');
  }

  /**
   * Gestion des sessions multiples (onglets)
   */
  private setupMultiTabSync() {
    // Écouter les changements de stockage pour synchroniser entre onglets
    window.addEventListener('storage', (event) => {
      if (event.key === 'clenzy_token_update') {
        console.log('TokenService - Synchronisation inter-onglets détectée');
        this.handleTokenUpdate(JSON.parse(event.newValue || '{}'));
      }
    });

    // Écouter les messages entre onglets
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'TOKEN_UPDATE') {
        console.log('TokenService - Message inter-onglets reçu:', event.data);
        this.handleTokenUpdate(event.data.payload);
      }
    });
  }

  /**
   * Gère la mise à jour des tokens depuis un autre onglet
   */
  private handleTokenUpdate(update: any) {
    if (update.action === 'refresh') {
      console.log('TokenService - Mise à jour des tokens depuis un autre onglet');
      this.refreshToken();
    } else if (update.action === 'logout') {
      console.log('TokenService - Déconnexion depuis un autre onglet');
      this.reset();
    }
  }

  /**
   * Notifie les autres onglets d'une mise à jour des tokens
   */
  private notifyOtherTabs(action: 'refresh' | 'logout', payload?: any) {
    // Via localStorage
    localStorage.setItem('clenzy_token_update', JSON.stringify({ action, payload, timestamp: Date.now() }));
    
    // Via postMessage
    window.postMessage({
      type: 'TOKEN_UPDATE',
      action,
      payload,
      timestamp: Date.now(),
    }, '*');
  }

  /**
   * Initialise la gestion des sessions multiples
   */
  initializeMultiTabSupport() {
    this.setupMultiTabSync();
    console.log('TokenService - Support multi-onglets initialisé');
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
      console.error('TokenService - Erreur lors de la déconnexion:', error);
    }
  }

  /**
   * Réinitialise le service
   */
  reset(): void {
    // No-op for now, as the service is event-driven
    console.log('TokenService - Service réinitialisé (pas de rafraîchissement automatique)');
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
