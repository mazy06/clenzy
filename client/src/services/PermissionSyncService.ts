import PermissionAdapter, { SyncResponse } from './PermissionAdapter';
import { AuthUser } from '../hooks/useAuth';

export class PermissionSyncService {
  private static instance: PermissionSyncService;
  private adapter: PermissionAdapter;
  private currentUser: AuthUser | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    this.adapter = PermissionAdapter.getInstance();
  }

  public static getInstance(): PermissionSyncService {
    if (!PermissionSyncService.instance) {
      PermissionSyncService.instance = new PermissionSyncService();
    }
    return PermissionSyncService.instance;
  }

  /**
   * Initialise le service de synchronisation
   */
  public initialize(user: AuthUser): void {
    if (this.isInitialized && this.currentUser?.id === user.id) {
      return; // Déjà initialisé pour cet utilisateur
    }

    this.currentUser = user;
    this.isInitialized = true;

    // Ajouter le listener pour les mises à jour
    this.adapter.addListener(this.handlePermissionUpdate.bind(this));
  }

  /**
   * Arrête le service de synchronisation
   */
  public shutdown(): void {
    this.currentUser = null;
    this.isInitialized = false;
  }

  /**
   * Synchronise les permissions immédiatement
   */
  public async syncNow(): Promise<string[]> {
    if (!this.currentUser) {
      throw new Error('Service non initialisé');
    }

    return this.adapter.forceSync(this.currentUser.id);
  }

  /**
   * Vérifie si une synchronisation est nécessaire
   */
  public needsSync(): boolean {
    return this.adapter.shouldSync();
  }

  /**
   * Synchronise les permissions après une modification dans le menu Roles & Permissions
   */
  public async syncAfterPermissionUpdate(): Promise<void> {
    if (!this.currentUser) {
      return;
    }

    try {
      const updatedPermissions = await this.adapter.forceSync(this.currentUser.id);

      // Émettre l'événement de mise à jour
      this.handlePermissionUpdate(updatedPermissions);

    } catch (error) {
    }
  }

  /**
   * Gère les mises à jour de permissions reçues
   */
  private handlePermissionUpdate(permissions: string[]): void {
    // Émettre un événement personnalisé pour notifier l'application
    const event = new CustomEvent('permissions-updated', {
      detail: {
        userId: this.currentUser?.id,
        permissions,
        timestamp: Date.now()
      }
    });

    window.dispatchEvent(event);
  }

  /**
   * Obtient l'état actuel du service
   */
  public getStatus(): {
    isInitialized: boolean;
    currentUser: string | null;
    lastSync: number;
    needsSync: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      currentUser: this.currentUser?.id || null,
      lastSync: this.adapter['lastSync'],
      needsSync: this.needsSync()
    };
  }
}

export default PermissionSyncService;
