/**
 * Enums de statuts partagés pour assurer la cohérence entre frontend et backend
 * Ces enums doivent être synchronisés avec les enums Java côté backend
 */

// ============================================================================
// INTERVENTION STATUS
// ============================================================================
export enum InterventionStatus {
  PENDING = 'PENDING',
  AWAITING_VALIDATION = 'AWAITING_VALIDATION',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface InterventionStatusOption {
  value: InterventionStatus;
  label: string;
  labelKey: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: string;
}

export const INTERVENTION_STATUS_OPTIONS: InterventionStatusOption[] = [
  {
    value: InterventionStatus.PENDING,
    label: 'En attente',
    labelKey: 'statusOptions.intervention.PENDING',
    color: 'warning',
    icon: 'pending'
  },
  {
    value: InterventionStatus.AWAITING_VALIDATION,
    label: 'En attente de validation',
    labelKey: 'statusOptions.intervention.AWAITING_VALIDATION',
    color: 'warning',
    icon: 'pending_actions'
  },
  {
    value: InterventionStatus.AWAITING_PAYMENT,
    label: 'En attente de paiement',
    labelKey: 'statusOptions.intervention.AWAITING_PAYMENT',
    color: 'warning',
    icon: 'payment'
  },
  {
    value: InterventionStatus.IN_PROGRESS,
    label: 'En cours',
    labelKey: 'statusOptions.intervention.IN_PROGRESS',
    color: 'info',
    icon: 'play_arrow'
  },
  {
    value: InterventionStatus.COMPLETED,
    label: 'Terminé',
    labelKey: 'statusOptions.intervention.COMPLETED',
    color: 'success',
    icon: 'check_circle'
  },
  {
    value: InterventionStatus.CANCELLED,
    label: 'Annulé',
    labelKey: 'statusOptions.intervention.CANCELLED',
    color: 'error',
    icon: 'cancel'
  }
];

// ============================================================================
// REQUEST STATUS (Service Requests)
// ============================================================================
export enum RequestStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED'
}

export interface RequestStatusOption {
  value: RequestStatus;
  label: string;
  labelKey: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: string;
}

export const REQUEST_STATUS_OPTIONS: RequestStatusOption[] = [
  {
    value: RequestStatus.PENDING,
    label: 'En attente',
    labelKey: 'statusOptions.request.PENDING',
    color: 'warning',
    icon: 'pending'
  },
  {
    value: RequestStatus.ASSIGNED,
    label: 'Assignée',
    labelKey: 'statusOptions.request.ASSIGNED',
    color: 'secondary',
    icon: 'assignment_ind'
  },
  {
    value: RequestStatus.AWAITING_PAYMENT,
    label: 'Attente paiement',
    labelKey: 'statusOptions.request.AWAITING_PAYMENT',
    color: 'warning',
    icon: 'payment'
  },
  {
    value: RequestStatus.IN_PROGRESS,
    label: 'En cours',
    labelKey: 'statusOptions.request.IN_PROGRESS',
    color: 'primary',
    icon: 'play_arrow'
  },
  {
    value: RequestStatus.COMPLETED,
    label: 'Terminé',
    labelKey: 'statusOptions.request.COMPLETED',
    color: 'success',
    icon: 'check_circle'
  },
  {
    value: RequestStatus.CANCELLED,
    label: 'Annulé',
    labelKey: 'statusOptions.request.CANCELLED',
    color: 'error',
    icon: 'cancel'
  },
  {
    value: RequestStatus.REJECTED,
    label: 'Rejeté',
    labelKey: 'statusOptions.request.REJECTED',
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
  labelKey: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: string;
}

export const PROPERTY_STATUS_OPTIONS: PropertyStatusOption[] = [
  {
    value: PropertyStatus.ACTIVE,
    label: 'Actif',
    labelKey: 'statusOptions.property.ACTIVE',
    color: 'success',
    icon: 'check_circle'
  },
  {
    value: PropertyStatus.INACTIVE,
    label: 'Inactif',
    labelKey: 'statusOptions.property.INACTIVE',
    color: 'default',
    icon: 'pause_circle'
  },
  {
    value: PropertyStatus.UNDER_MAINTENANCE,
    label: 'En maintenance',
    labelKey: 'statusOptions.property.UNDER_MAINTENANCE',
    color: 'warning',
    icon: 'build'
  },
  {
    value: PropertyStatus.ARCHIVED,
    label: 'Archivé',
    labelKey: 'statusOptions.property.ARCHIVED',
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
  labelKey: string;
  description: string;
  descriptionKey: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: string;
}

export const USER_STATUS_OPTIONS: UserStatusOption[] = [
  {
    value: UserStatus.ACTIVE,
    label: 'Actif',
    labelKey: 'statusOptions.user.ACTIVE',
    description: 'Utilisateur actif et pouvant utiliser la plateforme',
    descriptionKey: 'statusOptions.userDesc.ACTIVE',
    color: 'success',
    icon: 'check_circle'
  },
  {
    value: UserStatus.PENDING_VERIFICATION,
    label: 'En attente de vérification',
    labelKey: 'statusOptions.user.PENDING_VERIFICATION',
    description: 'Compte en attente de vérification (email, téléphone)',
    descriptionKey: 'statusOptions.userDesc.PENDING_VERIFICATION',
    color: 'warning',
    icon: 'pending'
  },
  {
    value: UserStatus.SUSPENDED,
    label: 'Suspendu',
    labelKey: 'statusOptions.user.SUSPENDED',
    description: 'Compte suspendu temporairement',
    descriptionKey: 'statusOptions.userDesc.SUSPENDED',
    color: 'warning',
    icon: 'pause_circle'
  },
  {
    value: UserStatus.INACTIVE,
    label: 'Inactif',
    labelKey: 'statusOptions.user.INACTIVE',
    description: 'Compte désactivé par l\'utilisateur',
    descriptionKey: 'statusOptions.userDesc.INACTIVE',
    color: 'default',
    icon: 'block'
  },
  {
    value: UserStatus.BLOCKED,
    label: 'Bloqué',
    labelKey: 'statusOptions.user.BLOCKED',
    description: 'Compte bloqué pour violation des conditions',
    descriptionKey: 'statusOptions.userDesc.BLOCKED',
    color: 'error',
    icon: 'block'
  },
  {
    value: UserStatus.DELETED,
    label: 'Supprimé',
    labelKey: 'statusOptions.user.DELETED',
    description: 'Compte supprimé définitivement',
    descriptionKey: 'statusOptions.userDesc.DELETED',
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
  labelKey: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: string;
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: Priority.LOW,
    label: 'Basse',
    labelKey: 'statusOptions.priority.LOW',
    color: 'success',
    icon: 'low_priority'
  },
  {
    value: Priority.NORMAL,
    label: 'Normale',
    labelKey: 'statusOptions.priority.NORMAL',
    color: 'info',
    icon: 'remove'
  },
  {
    value: Priority.HIGH,
    label: 'Élevée',
    labelKey: 'statusOptions.priority.HIGH',
    color: 'warning',
    icon: 'priority_high'
  },
  {
    value: Priority.CRITICAL,
    label: 'Critique',
    labelKey: 'statusOptions.priority.CRITICAL',
    color: 'error',
    icon: 'error'
  }
];
