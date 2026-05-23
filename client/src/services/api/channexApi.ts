/**
 * Channex API client (frontend).
 *
 * Endpoints backend : /api/integrations/channex/**
 * Acces : SUPER_ADMIN / SUPER_MANAGER uniquement (impact distribution OTAs).
 */
import apiClient from '../apiClient';

export type ChannexSyncStatus = 'PENDING' | 'ACTIVE' | 'ERROR' | 'DISABLED';

export interface ChannexMappingDto {
  id: string; // UUID
  organizationId: number;
  clenzyPropertyId: number;
  channexPropertyId: string;
  channexRoomTypeId: string;
  channexDefaultRatePlanId: string;
  syncStatus: ChannexSyncStatus;
  lastSyncAt: string | null; // ISO instant
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChannexConnectRequest {
  channexPropertyId: string;
  channexRoomTypeId: string;
  channexDefaultRatePlanId: string;
}

export interface ChannexSyncResult {
  success: boolean;
  message: string;
  availabilityUpdates: number;
  rateUpdates: number;
}

export const channexApi = {
  /** Liste tous les mappings Channex de l'organisation. */
  listMappings(): Promise<ChannexMappingDto[]> {
    return apiClient.get<ChannexMappingDto[]>('/integrations/channex/mappings');
  },

  /** Recupere le mapping d'une property specifique (404 si pas connectee). */
  async getMapping(clenzyPropertyId: number): Promise<ChannexMappingDto | null> {
    try {
      return await apiClient.get<ChannexMappingDto>(
        `/integrations/channex/properties/${clenzyPropertyId}/mapping`,
      );
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 404) return null;
      throw err;
    }
  },

  /**
   * Connecte une property Clenzy a Channex.
   * Cote backend : verifie l'existence de la property Channex, cree le mapping,
   * declenche un push initial 6 mois.
   */
  connect(clenzyPropertyId: number, request: ChannexConnectRequest): Promise<ChannexMappingDto> {
    return apiClient.post<ChannexMappingDto>(
      `/integrations/channex/properties/${clenzyPropertyId}/connect`,
      request,
    );
  },

  /** Deconnecte une property (mapping local supprime, property Channex preservee). */
  disconnect(clenzyPropertyId: number): Promise<void> {
    return apiClient.delete<void>(
      `/integrations/channex/properties/${clenzyPropertyId}/disconnect`,
    );
  },

  /**
   * Force un re-push complet d'une property (1 a 12 mois, defaut 6).
   * Utile pour recuperer un mapping en ERROR ou apres changement de prix.
   */
  resync(clenzyPropertyId: number, months: number = 6): Promise<ChannexSyncResult> {
    return apiClient.post<ChannexSyncResult>(
      `/integrations/channex/properties/${clenzyPropertyId}/resync`,
      undefined,
      { params: { months: String(months) } },
    );
  },
};

/** UI helpers : couleurs + labels par statut de sync. */
export const CHANNEX_STATUS_META: Record<
  ChannexSyncStatus,
  { label: string; color: string; description: string }
> = {
  PENDING: {
    label: 'En cours de configuration',
    color: '#D97706',
    description: 'Mapping cree, push initial en cours ou pas encore tente.',
  },
  ACTIVE: {
    label: 'Connectee',
    color: '#059669',
    description: 'Sync operationnelle, derniere mise a jour reussie.',
  },
  ERROR: {
    label: 'Erreur',
    color: '#EF4444',
    description: 'Derniere sync a echoue. Le scheduler retentera dans l\'heure.',
  },
  DISABLED: {
    label: 'Desactivee',
    color: '#6B7280',
    description: 'Sync manuellement desactivee. Cliquez sur "Resync" pour reactiver.',
  },
};
