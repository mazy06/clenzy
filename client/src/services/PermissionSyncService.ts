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

    console.log('🔄 PermissionSyncService - Initialisation pour utilisateur:', user.id);
    
    this.currentUser = user;
    this.isInitialized = true;

    // Ajouter le listener pour les mises à jour
    this.adapter.addListener(this.handlePermissionUpdate.bind(this));
  }

  /**
   * Arrête le service de synchronisation
   */
  public shutdown(): void {
    console.log('🔄 PermissionSyncService - Arrêt du service');
    
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

    console.log('🔄 PermissionSyncService - Synchronisation immédiate demandée');
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
      console.warn('⚠️ PermissionSyncService - Aucun utilisateur connecté pour la synchronisation');
      return;
    }

    console.log('🔄 PermissionSyncService - Synchronisation après modification des permissions');
    
    try {
      const updatedPermissions = await this.adapter.forceSync(this.currentUser.id);
      
      // Émettre l'événement de mise à jour
      this.handlePermissionUpdate(updatedPermissions);
      
      console.log('✅ PermissionSyncService - Synchronisation réussie après modification');
    } catch (error) {
      console.error('❌ PermissionSyncService - Erreur lors de la synchronisation après modification:', error);
    }
  }

  /**
   * Gère les mises à jour de permissions reçues
   */
  private handlePermissionUpdate(permissions: string[]): void {
    console.log('🔄 PermissionSyncService - Mise à jour des permissions reçue:', permissions);
    
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
