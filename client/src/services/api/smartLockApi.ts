import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SmartLockBrand = 'TUYA' | 'NUKI' | 'TTLOCK' | 'YALE' | 'SIMULATION';

/** Origine du code : PMS le génère et le pousse à la serrure, ou la serrure le génère. */
export type SmartLockAccessCodeMode = 'PMS_GENERATED' | 'LOCK_GENERATED';

export interface SmartLockDeviceDto {
  id: number;
  name: string;
  propertyId: number;
  propertyName: string;
  roomName: string | null;
  externalDeviceId: string | null;
  brand: SmartLockBrand;
  accessCodeMode: SmartLockAccessCodeMode;
  status: string;
  lockState: string;
  batteryLevel: number | null;
  /** Connectivité réelle (vrai flag Tuya). null = jamais synchronisé. */
  online: boolean | null;
  createdAt: string;
}

export interface CreateSmartLockDeviceDto {
  name: string;
  propertyId: number;
  roomName?: string;
  externalDeviceId?: string;
  brand?: SmartLockBrand;
  accessCodeMode?: SmartLockAccessCodeMode;
}

export interface SmartLockStatusDto {
  locked: boolean;
  batteryLevel: number;
  online: boolean;
}

export interface SmartLockAccessCodeDto {
  id: number;
  deviceId: number;
  reservationId: number | null;
  /** PIN — visible seulement pour les rôles autorisés (endpoint role-gate). */
  code: string | null;
  name: string | null;
  validFrom: string | null;
  validUntil: string | null;
  status: string;
  source: string;
  createdAt: string;
}

/**
 * Un code qui n'est plus en vigueur : sa trace, jamais sa valeur — un code
 * révoqué, expiré ou en échec n'ouvre plus rien, le backend ne transporte donc
 * pas son PIN.
 */
export interface SmartLockPastCodeDto {
  id: number;
  reservationId: number | null;
  name: string | null;
  validFrom: string | null;
  validUntil: string | null;
  /** ACTIVE | REVOKED | EXPIRED | FAILED */
  status: string;
  /** AUTO_RESERVATION | MANUAL */
  source: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface SmartLockAccessCodeEventDto {
  id: number;
  codeId: number | null;
  reservationId: number | null;
  /** CODE_GENERATED | CODE_REVOKED | CODE_EXPIRED | CODE_DELIVERED | DELIVERY_FAILED | GENERATION_FAILED */
  eventType: string;
  source: string;
  actorName: string | null;
  /** Motif lisible — ne contient jamais de PIN (contrat backend). */
  notes: string | null;
  createdAt: string;
}

/**
 * Séjour en cours sur le logement de la serrure — ses dates, rien de plus.
 * Régénérer un code révoque celui du voyageur présent : l'écran doit pouvoir
 * le dire avant.
 */
export interface SmartLockOngoingStayDto {
  reservationId: number;
  checkIn: string;
  checkOut: string;
}

/** Code en vigueur + codes passés + journal, pour UNE serrure. */
export interface SmartLockAccessCodeHistoryDto {
  current: SmartLockAccessCodeDto | null;
  past: SmartLockPastCodeDto[];
  events: SmartLockAccessCodeEventDto[];
  ongoingStay: SmartLockOngoingStayDto | null;
}

export interface RotateAccessCodeRequest {
  validFrom?: string;
  validUntil?: string;
  reservationId?: number;
}

// ─── Smart Lock API ─────────────────────────────────────────────────────────

export const smartLockApi = {
  /** Liste des serrures connectees de l'utilisateur */
  getAll() {
    return apiClient.get<SmartLockDeviceDto[]>('/smart-locks');
  },

  /**
   * Une serrure, dans son dernier etat CONNU EN BASE.
   *
   * A distinguer de `getStatus`, qui interroge le fabricant en direct : une
   * fiche qui s'ouvre ne doit ni attendre Tuya ni echouer quand il se tait.
   */
  getById(id: number) {
    return apiClient.get<SmartLockDeviceDto>(`/smart-locks/${id}`);
  },

  /** Creer une nouvelle serrure */
  create(data: CreateSmartLockDeviceDto) {
    return apiClient.post<SmartLockDeviceDto>('/smart-locks', data);
  },

  /** Supprimer une serrure */
  delete(id: number) {
    return apiClient.delete(`/smart-locks/${id}`);
  },

  /** Changer l'origine du code d'accès (PMS pousse / serrure génère) d'une serrure existante. */
  updateAccessCodeMode(id: number, mode: SmartLockAccessCodeMode) {
    return apiClient.patch<SmartLockDeviceDto>(`/smart-locks/${id}/access-code-mode`, { mode });
  },

  /** Statut live d'une serrure (locked/unlocked, batterie, online) */
  getStatus(id: number) {
    return apiClient.get<SmartLockStatusDto>(`/smart-locks/${id}/status`);
  },

  /** Verrouiller une serrure */
  lock(id: number) {
    return apiClient.post<{ status: string; message: string }>(`/smart-locks/${id}/lock`);
  },

  /** Deverrouiller une serrure */
  unlock(id: number) {
    return apiClient.post<{ status: string; message: string }>(`/smart-locks/${id}/unlock`);
  },

  /** Code d'accès courant d'une serrure (corps vide si aucun — 204). */
  getAccessCode(id: number) {
    return apiClient.get<SmartLockAccessCodeDto | ''>(`/smart-locks/${id}/access-code`);
  },

  /**
   * État COMPLET des codes d'une serrure : code en vigueur, codes passés, journal
   * des évènements (générations, envois au voyageur, échecs, révocations).
   *
   * Préférer cet appel à `getAccessCode` dès qu'on a besoin de dire POURQUOI il
   * n'y a pas de code : `getAccessCode` ne sait répondre que « aucun ».
   */
  getAccessCodeHistory(id: number) {
    return apiClient.get<SmartLockAccessCodeHistoryDto>(`/smart-locks/${id}/access-codes`);
  },

  /** Régénère / change le code d'accès (révoque l'actif + en génère un nouveau, déclenche un event). */
  rotateAccessCode(id: number, body?: RotateAccessCodeRequest) {
    return apiClient.post<SmartLockAccessCodeDto>(`/smart-locks/${id}/access-code/rotate`, body ?? {});
  },

  /** Révoque le code d'accès courant. */
  revokeAccessCode(id: number) {
    return apiClient.delete(`/smart-locks/${id}/access-code`);
  },
};
