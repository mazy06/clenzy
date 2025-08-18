import keycloak from '../keycloak';

export interface TokenValidationResult {
  isValid: boolean;
  timeUntilExpiry: number;
  needsRefresh: boolean;
  error?: string;
}

export interface RefreshResult {
  success: boolean;
  newToken?: string;
  newRefreshToken?: string;
  error?: string;
  retryCount: number;
}

class TokenService {
  private refreshRetryCount = 0;
  private maxRetries = 3;
  private refreshThreshold = 300; // 5 minutes avant expiration
  private lastRefreshAttempt = 0;
  private refreshCooldown = 10000; // 10 secondes entre tentatives

  /**
   * Valide un token et détermine s'il a besoin d'être rafraîchi
   */
  validateToken(token: string): TokenValidationResult {
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = tokenData.exp - currentTime;

      return {
        isValid: timeUntilExpiry > 0,
        timeUntilExpiry,
        needsRefresh: timeUntilExpiry < this.refreshThreshold,
      };
    } catch (error) {
      return {
        isValid: false,
        timeUntilExpiry: 0,
        needsRefresh: true,
        error: 'Token parsing failed',
      };
    }
  }

  /**
   * Tente de rafraîchir le token avec retry intelligent
   */
  async refreshToken(): Promise<RefreshResult> {
    const now = Date.now();

    // Vérifier le cooldown pour éviter les tentatives trop fréquentes
    if (now - this.lastRefreshAttempt < this.refreshCooldown) {
      return {
        success: false,
        error: 'Refresh cooldown active',
        retryCount: this.refreshRetryCount,
      };
    }

    // Vérifier le nombre maximum de tentatives
    if (this.refreshRetryCount >= this.maxRetries) {
      return {
        success: false,
        error: 'Max retries exceeded',
        retryCount: this.refreshRetryCount,
      };
    }

    this.lastRefreshAttempt = now;
    this.refreshRetryCount++;

    try {
      console.log(`🔍 TokenService - Tentative de rafraîchissement ${this.refreshRetryCount}/${this.maxRetries}`);
      
      const refreshed = await keycloak.updateToken(30);
      
      if (refreshed) {
        console.log('🔍 TokenService - Token rafraîchi avec succès');
        this.refreshRetryCount = 0; // Reset du compteur en cas de succès
        
        return {
          success: true,
          newToken: keycloak.token || undefined,
          newRefreshToken: keycloak.refreshToken || undefined,
          retryCount: this.refreshRetryCount,
        };
      } else {
        console.log('🔍 TokenService - Échec du rafraîchissement');
        return {
          success: false,
          error: 'Keycloak refresh failed',
          retryCount: this.refreshRetryCount,
        };
      }
    } catch (error) {
      console.error('🔍 TokenService - Erreur lors du rafraîchissement:', error);
      
      // Analyser le type d'erreur pour déterminer la stratégie
      const errorMessage = this.analyzeError(error);
      
      return {
        success: false,
        error: errorMessage,
        retryCount: this.refreshRetryCount,
      };
    }
  }

  /**
   * Analyse l'erreur pour déterminer la stratégie de récupération
   */
  private analyzeError(error: any): string {
    if (error && typeof error === 'object') {
      // Erreur 400 - Token invalide ou expiré
      if (error.status === 400) {
        if (error.message && error.message.includes('Invalid token issuer')) {
          return 'TOKEN_ISSUER_MISMATCH'; // Problème de configuration
        }
        if (error.message && error.message.includes('Token expired')) {
          return 'TOKEN_EXPIRED'; // Token expiré
        }
        return 'TOKEN_INVALID'; // Autre problème de token
      }
      
      // Erreur 401 - Non autorisé
      if (error.status === 401) {
        return 'UNAUTHORIZED';
      }
      
      // Erreur réseau
      if (error.message && error.message.includes('Network Error')) {
        return 'NETWORK_ERROR';
      }
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Détermine si on doit tenter une reconnexion basée sur le type d'erreur
   */
  shouldAttemptReconnection(errorType: string): boolean {
    const recoverableErrors = ['NETWORK_ERROR', 'TOKEN_EXPIRED'];
    return recoverableErrors.includes(errorType);
  }

  /**
   * Tente une reconnexion complète
   */
  async attemptReconnection(): Promise<boolean> {
    try {
      console.log('🔍 TokenService - Tentative de reconnexion...');
      
      // Forcer une nouvelle authentification
      const reconnected = await keycloak.updateToken(0);
      
      if (reconnected) {
        console.log('🔍 TokenService - Reconnexion réussie');
        this.refreshRetryCount = 0; // Reset du compteur
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('🔍 TokenService - Échec de la reconnexion:', error);
      return false;
    }
  }

  /**
   * Reset du service (appelé après une déconnexion)
   */
  reset(): void {
    this.refreshRetryCount = 0;
    this.lastRefreshAttempt = 0;
  }

  /**
   * Obtient les statistiques du service
   */
  getStats() {
    return {
      refreshRetryCount: this.refreshRetryCount,
      maxRetries: this.maxRetries,
      lastRefreshAttempt: this.lastRefreshAttempt,
      refreshCooldown: this.refreshCooldown,
    };
  }
}

export const tokenService = new TokenService();
export default tokenService;
