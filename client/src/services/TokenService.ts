import keycloak from '../keycloak';
import { buildApiUrl } from '../config/api';

// Types pour les tokens
export interface TokenInfo {
  tokenId: string;
  subject: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  isValid: boolean;
  timeUntilExpiry: number;
}

export interface TokenStats {
  cacheSize: number;
  blacklistSize: number;
  validTokens: number;
  invalidTokens: number;
  revokedTokens: number;
  rejectedTokens: number;
  cacheHits: number;
  errors: number;
  lastCleanup: string;
}

export interface TokenValidationResult {
  valid: boolean;
  error?: string;
  tokenInfo?: TokenInfo;
}

export interface TokenMetrics {
  validTokens: number;
  invalidTokens: number;
  revokedTokens: number;
  rejectedTokens: number;
  cacheHits: number;
  errors: number;
  totalTokens: number;
  successRate: string;
}

class TokenService {
  private tokenRefreshInterval: number | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeMultiTabSupport();
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

      // Démarrer le rafraîchissement automatique des tokens
      this.startTokenRefresh();
      
      this.isInitialized = true;
      console.log('TokenService - Service initialisé avec succès');
      return true;

    } catch (error) {
      console.error('TokenService - Erreur lors de l\'initialisation:', error);
      return false;
    }
  }

  /**
   * Démarre le rafraîchissement automatique des tokens
   */
  private startTokenRefresh(): void {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }

    // Rafraîchir le token toutes les 4 minutes (token valide 5 minutes)
    this.tokenRefreshInterval = setInterval(async () => {
      await this.refreshToken();
    }, 4 * 60 * 1000);

    console.log('TokenService - Rafraîchissement automatique des tokens démarré');
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
        if (result.valid) {
          console.log('TokenService - Token validé côté backend:', result);
          return result;
        } else {
          console.warn('TokenService - Token invalide côté backend:', result.error);
          return null;
        }
      } else {
        console.warn('TokenService - Erreur lors de la validation backend:', response.status);
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
  async cleanupBackendTokens(): Promise<boolean> {
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
        console.log('TokenService - Nettoyage backend terminé:', result);
        return true;
      } else {
        console.warn('TokenService - Erreur lors du nettoyage backend:', response.status);
        return false;
      }
    } catch (error) {
      console.error('TokenService - Erreur lors du nettoyage backend:', error);
      return false;
    }
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
   * Obtient les informations du token actuel
   */
  getCurrentTokenInfo(): TokenInfo | null {
    if (!keycloak.token) {
      return null;
    }

    try {
      // Décoder le token JWT (partie payload)
      const tokenParts = keycloak.token.split('.');
      if (tokenParts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(atob(tokenParts[1]));
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = payload.exp;
      const timeUntilExpiry = expiresAt - now;

      return {
        tokenId: keycloak.token.substring(0, 8) + '...' + keycloak.token.substring(keycloak.token.length - 4),
        subject: payload.sub || 'unknown',
        issuer: payload.iss || 'unknown',
        issuedAt: new Date(payload.iat * 1000).toISOString(),
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        isValid: timeUntilExpiry > 0,
        timeUntilExpiry: Math.max(0, timeUntilExpiry),
      };
    } catch (error) {
      console.error('TokenService - Erreur lors du décodage du token:', error);
      return null;
    }
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
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
    this.isInitialized = false;
    console.log('TokenService - Service réinitialisé');
  }

  /**
   * Obtient l'état d'initialisation
   */
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }
}

export default TokenService;
