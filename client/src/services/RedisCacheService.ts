import { permissionsApi } from './api';

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
      const result = await permissionsApi.getRedisCache(userId);
      return result.permissions || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Met à jour les permissions dans Redis (via l'API backend)
   */
  public async updatePermissionsInRedis(userId: string, permissions: string[]): Promise<boolean> {
    try {
      await permissionsApi.updateRedisCache(userId, permissions);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Invalide le cache Redis pour un utilisateur (via l'API backend)
   */
  public async invalidateUserCache(userId: string): Promise<boolean> {
    try {
      await permissionsApi.invalidateRedisCache(userId);
      return true;
    } catch (error) {
      return false;
    }
  }


}

export default RedisCacheService;
