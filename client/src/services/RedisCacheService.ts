import { API_CONFIG } from '../config/api';

export class RedisCacheService {
  private static instance: RedisCacheService;

  private constructor() {}

  public static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  /**
   * Récupère les permissions depuis Redis (via l'API backend)
   */
  public async getPermissionsFromRedis(userId: string): Promise<string[]> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/permissions/redis/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        return result.permissions || [];
      }
      
      return [];
    } catch (error) {
      console.error('RedisCacheService - Erreur lors de la recuperation depuis Redis:', error);
      return [];
    }
  }

  /**
   * Met à jour les permissions dans Redis (via l'API backend)
   */
  public async updatePermissionsInRedis(userId: string, permissions: string[]): Promise<boolean> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/permissions/redis/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions }),
      });

      return response.ok;
    } catch (error) {
      console.error('RedisCacheService - Erreur lors de la mise a jour dans Redis:', error);
      return false;
    }
  }

  /**
   * Invalide le cache Redis pour un utilisateur (via l'API backend)
   */
  public async invalidateUserCache(userId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/permissions/redis/${userId}/invalidate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('RedisCacheService - Erreur lors de l invalidation du cache Redis:', error);
      return false;
    }
  }


}

export default RedisCacheService;
