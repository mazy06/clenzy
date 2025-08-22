/**
 * Enums de statuts partagés pour assurer la cohérence entre frontend et backend
 * Ces enums doivent être synchronisés avec les enums Java côté backend
 */

// ============================================================================
// INTERVENTION STATUS
// ============================================================================
export enum InterventionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface InterventionStatusOption {
  value: InterventionStatus;
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: string;
}

export const INTERVENTION_STATUS_OPTIONS: InterventionStatusOption[] = [
  {
    value: InterventionStatus.PENDING,
    label: 'En attente',
    color: 'warning',
    icon: 'pending'
  },
  {
    value: InterventionStatus.IN_PROGRESS,
    label: 'En cours',
    color: 'info',
    icon: 'play_arrow'
  },
  {
    value: InterventionStatus.COMPLETED,
    label: 'Terminé',
    color: 'success',
    icon: 'check_circle'
  },
  {
    value: InterventionStatus.CANCELLED,
    label: 'Annulé',
    color: 'error',
    icon: 'cancel'
  }
];

// ============================================================================
// REQUEST STATUS (Service Requests)
// ============================================================================
export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED'
}

export interface RequestStatusOption {
  value: RequestStatus;
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: string;
}

export const REQUEST_STATUS_OPTIONS: RequestStatusOption[] = [
  {
    value: RequestStatus.PENDING,
    label: 'En attente',
    color: 'warning',
    icon: 'pending'
  },
  {
    value: RequestStatus.APPROVED,
    label: 'Approuvé',
    color: 'info',
    icon: 'thumb_up'
  },
  {
    value: RequestStatus.IN_PROGRESS,
    label: 'En cours',
    color: 'primary',
    icon: 'play_arrow'
  },
  {
    value: RequestStatus.COMPLETED,
    label: 'Terminé',
    color: 'success',
    icon: 'check_circle'
  },
  {
    value: RequestStatus.CANCELLED,
    label: 'Annulé',
    color: 'error',
    icon: 'cancel'
  },
  {
    value: RequestStatus.REJECTED,
    label: 'Rejeté',
    color: 'error',
    icon: 'thumb_down'
  }
];

// ============================================================================
// PROPERTY STATUS
// ============================================================================
export enum PropertyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  ARCHIVED = 'ARCHIVED'
}

export interface PropertyStatusOption {
  value: PropertyStatus;
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: string;
}

export const PROPERTY_STATUS_OPTIONS: PropertyStatusOption[] = [
  {
    value: PropertyStatus.ACTIVE,
    label: 'Actif',
    color: 'success',
    icon: 'check_circle'
  },
  {
    value: PropertyStatus.INACTIVE,
    label: 'Inactif',
    color: 'default',
    icon: 'pause_circle'
  },
  {
    value: PropertyStatus.UNDER_MAINTENANCE,
    label: 'En maintenance',
    color: 'warning',
    icon: 'build'
  },
  {
    value: PropertyStatus.ARCHIVED,
    label: 'Archivé',
    color: 'error',
    icon: 'archive'
  }
];

// ============================================================================
// USER STATUS
// ============================================================================
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
  DELETED = 'DELETED'
}

export interface UserStatusOption {
  value: UserStatus;
  label: string;
  description: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: string;
}

export const USER_STATUS_OPTIONS: UserStatusOption[] = [
  {
    value: UserStatus.ACTIVE,
    label: 'Actif',
    description: 'Utilisateur actif et pouvant utiliser la plateforme',
    color: 'success',
    icon: 'check_circle'
  },
  {
    value: UserStatus.PENDING_VERIFICATION,
    label: 'En attente de vérification',
    description: 'Compte en attente de vérification (email, téléphone)',
    color: 'warning',
    icon: 'pending'
  },
  {
    value: UserStatus.SUSPENDED,
    label: 'Suspendu',
    description: 'Compte suspendu temporairement',
    color: 'warning',
    icon: 'pause_circle'
  },
  {
    value: UserStatus.INACTIVE,
    label: 'Inactif',
    description: 'Compte désactivé par l\'utilisateur',
    color: 'default',
    icon: 'block'
  },
  {
    value: UserStatus.BLOCKED,
    label: 'Bloqué',
    description: 'Compte bloqué pour violation des conditions',
    color: 'error',
    icon: 'block'
  },
  {
    value: UserStatus.DELETED,
    label: 'Supprimé',
    description: 'Compte supprimé définitivement',
    color: 'error',
    icon: 'delete_forever'
  }
];

// ============================================================================
// PRIORITY LEVELS
// ============================================================================
export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface PriorityOption {
  value: Priority;
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: string;
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: Priority.LOW,
    label: 'Basse',
    color: 'success',
    icon: 'low_priority'
  },
  {
    value: Priority.NORMAL,
    label: 'Normale',
    color: 'info',
    icon: 'remove'
  },
  {
    value: Priority.HIGH,
    label: 'Élevée',
    color: 'warning',
    icon: 'priority_high'
  },
  {
    value: Priority.CRITICAL,
    label: 'Critique',
    color: 'error',
    icon: 'error'
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
export class StatusUtils {
  /**
   * Trouve une option de statut par sa valeur
   */
  static findStatusOption<T extends string>(
    statusOptions: Array<{ value: T; label: string; color: string; icon: string }>,
    value: T
  ) {
    return statusOptions.find(option => option.value === value);
  }

  /**
   * Obtient la couleur d'un statut
   */
  static getStatusColor<T extends string>(
    statusOptions: Array<{ value: T; color: string }>,
    value: T,
    defaultColor: string = 'default'
  ) {
    const option = statusOptions.find(opt => opt.value === value);
    return option?.color || defaultColor;
  }

  /**
   * Obtient le label d'un statut
   */
  static getStatusLabel<T extends string>(
    statusOptions: Array<{ value: T; label: string }>,
    value: T,
    defaultValue: string = 'Inconnu'
  ) {
    const option = statusOptions.find(opt => opt.value === value);
    return option?.label || defaultValue;
  }

  /**
   * Obtient l'icône d'un statut
   */
  static getStatusIcon<T extends string>(
    statusOptions: Array<{ value: T; icon: string }>,
    value: T,
    defaultIcon: string = 'help'
  ) {
    const option = statusOptions.find(opt => opt.value === value);
    return option?.icon || defaultIcon;
  }
}
