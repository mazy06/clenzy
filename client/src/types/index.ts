/**
 * Point d'entrée centralisé pour tous les types du domaine.
 *
 * Réexporte les types depuis les services API (source de vérité)
 * + ajoute les types utilitaires partagés.
 *
 * @usage
 * import type { Intervention, User, Property, Team, ServiceRequest } from '../types';
 * import type { ChipColor, AssignmentType } from '../types';
 */

// ─── Types domaine (depuis services/api) ───────────────────────────────────

export type {
  Intervention,
  InterventionFormData,
  InterventionListParams,
} from '../services/api/interventionsApi';

export type {
  User,
  UserFormData,
} from '../services/api/usersApi';

export type {
  Property,
  PropertyFormData,
} from '../services/api/propertiesApi';

export type {
  Team,
  TeamMember,
  TeamFormData,
} from '../services/api/teamsApi';

export type {
  ServiceRequest,
  ServiceRequestFormData,
} from '../services/api/serviceRequestsApi';

export type {
  ContactMessage,
  ContactFormData,
  Recipient,
} from '../services/api/contactApi';

export type {
  PaymentSession,
  PaymentSessionStatus,
} from '../services/api/paymentsApi';

export type {
  PortfolioStats,
  ManagerAssociations,
} from '../services/api/portfoliosApi';

export type {
  RolePermissions,
} from '../services/api/permissionsApi';

export type { AuthUser } from '../services/api/authApi';

// ─── Enums et options de statut ────────────────────────────────────────────

export {
  InterventionStatus,
  INTERVENTION_STATUS_OPTIONS,
  RequestStatus,
  REQUEST_STATUS_OPTIONS,
  PropertyStatus,
  PROPERTY_STATUS_OPTIONS,
  UserStatus,
  USER_STATUS_OPTIONS,
  Priority,
  PRIORITY_OPTIONS,
  StatusUtils,
} from './statusEnums';

export type {
  InterventionStatusOption,
  RequestStatusOption,
  PropertyStatusOption,
  UserStatusOption,
  PriorityOption,
} from './statusEnums';

// ─── Types d'intervention ──────────────────────────────────────────────────

export {
  InterventionType,
  INTERVENTION_TYPE_OPTIONS,
  InterventionTypeUtils,
} from './interventionTypes';

export type {
  InterventionTypeOption,
} from './interventionTypes';

// ─── Types utilitaires partagés ────────────────────────────────────────────

/** Type couleur Chip MUI */
export type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

/** Type d'assignation */
export type AssignmentType = 'user' | 'team';

/** État de pagination générique */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/** Réponse paginée générique */
export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * Extraire le tableau depuis une réponse API qui peut être :
 * - un tableau directement : T[]
 * - une réponse paginée Spring Data : { content: T[] }
 *
 * Remplace le pattern `(data as any).content || data` à travers le codebase.
 */
export function extractApiList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'content' in data) {
    const paginated = data as { content: unknown };
    if (Array.isArray(paginated.content)) return paginated.content as T[];
  }
  return [];
}

/** Options de filtre générique pour les listes */
export interface FilterOption {
  value: string;
  label: string;
}

/** État de confirmation modale */
export interface ConfirmationState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

// ─── Types API Client ──────────────────────────────────────────────────────

export type { ApiError, RequestOptions } from '../services/apiClient';
