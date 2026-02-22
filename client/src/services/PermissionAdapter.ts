import { permissionsApi } from './api';

export interface PermissionUpdate {
  userId: string;
  permissions: string[];
  timestamp: number;
}

export interface SyncResponse {
  success: boolean;
  permissions: string[];
  lastUpdate: number;
}

export class PermissionAdapter {
  private static instance: PermissionAdapter;
  private syncInterval: number | null = null;
  private lastSync: number = 0;
  private listeners: ((permissions: string[]) => void)[] = [];

  private constructor() {}

  public static getInstance(): PermissionAdapter {
    if (!PermissionAdapter.instance) {
      PermissionAdapter.instance = new PermissionAdapter();
    }
    return PermissionAdapter.instance;
  }

  /**
   * Synchronise les permissions avec le backend
   */
  public async syncPermissions(userId: string): Promise<string[]> {
    try {
      const result = await permissionsApi.sync(userId);
      this.lastSync = Date.now();

      // Notifier tous les listeners
      this.notifyListeners(result.permissions);

      return result.permissions;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Vérifie si une synchronisation est nécessaire
   */
  public shouldSync(): boolean {
    // Toujours synchroniser quand demandé explicitement
    return true;
  }

  /**
   * Ajoute un listener pour les mises à jour de permissions
   */
  public addListener(callback: (permissions: string[]) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Supprime un listener
   */
  public removeListener(callback: (permissions: string[]) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notifie tous les listeners
   */
  private notifyListeners(permissions: string[]): void {
    this.listeners.forEach(listener => {
      try {
        listener(permissions);
      } catch (error) {
      }
    });
  }

  /**
   * Force une synchronisation immédiate
   */
  public async forceSync(userId: string): Promise<string[]> {
    this.lastSync = 0; // Force la synchronisation
    return this.syncPermissions(userId);
  }
}

export default PermissionAdapter;
