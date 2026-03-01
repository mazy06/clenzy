/**
 * Enums de statuts partages web/mobile — synchronises avec le backend Java
 */

// ─── INTERVENTION STATUS ────────────────────────────────────────────────────

export enum InterventionStatus {
  PENDING = 'PENDING',
  AWAITING_VALIDATION = 'AWAITING_VALIDATION',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface StatusOption<T extends string> {
  value: T;
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

export const INTERVENTION_STATUS_OPTIONS: StatusOption<InterventionStatus>[] = [
  { value: InterventionStatus.PENDING, label: 'En attente', color: 'warning' },
  { value: InterventionStatus.AWAITING_VALIDATION, label: 'En attente de validation', color: 'warning' },
  { value: InterventionStatus.AWAITING_PAYMENT, label: 'En attente de paiement', color: 'warning' },
  { value: InterventionStatus.IN_PROGRESS, label: 'En cours', color: 'info' },
  { value: InterventionStatus.COMPLETED, label: 'Termine', color: 'success' },
  { value: InterventionStatus.CANCELLED, label: 'Annule', color: 'error' },
];

// ─── REQUEST STATUS ─────────────────────────────────────────────────────────

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export const REQUEST_STATUS_OPTIONS: StatusOption<RequestStatus>[] = [
  { value: RequestStatus.PENDING, label: 'En attente', color: 'warning' },
  { value: RequestStatus.APPROVED, label: 'Approuve', color: 'info' },
  { value: RequestStatus.IN_PROGRESS, label: 'En cours', color: 'primary' },
  { value: RequestStatus.COMPLETED, label: 'Termine', color: 'success' },
  { value: RequestStatus.CANCELLED, label: 'Annule', color: 'error' },
  { value: RequestStatus.REJECTED, label: 'Rejete', color: 'error' },
];

// ─── PROPERTY STATUS ────────────────────────────────────────────────────────

export enum PropertyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  ARCHIVED = 'ARCHIVED',
}

export const PROPERTY_STATUS_OPTIONS: StatusOption<PropertyStatus>[] = [
  { value: PropertyStatus.ACTIVE, label: 'Actif', color: 'success' },
  { value: PropertyStatus.INACTIVE, label: 'Inactif', color: 'default' },
  { value: PropertyStatus.UNDER_MAINTENANCE, label: 'En maintenance', color: 'warning' },
  { value: PropertyStatus.ARCHIVED, label: 'Archive', color: 'error' },
];

// ─── USER STATUS ────────────────────────────────────────────────────────────

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
  DELETED = 'DELETED',
}

export const USER_STATUS_OPTIONS: StatusOption<UserStatus>[] = [
  { value: UserStatus.ACTIVE, label: 'Actif', color: 'success' },
  { value: UserStatus.PENDING_VERIFICATION, label: 'En attente de verification', color: 'warning' },
  { value: UserStatus.SUSPENDED, label: 'Suspendu', color: 'warning' },
  { value: UserStatus.INACTIVE, label: 'Inactif', color: 'default' },
  { value: UserStatus.BLOCKED, label: 'Bloque', color: 'error' },
  { value: UserStatus.DELETED, label: 'Supprime', color: 'error' },
];

// ─── PRIORITY ───────────────────────────────────────────────────────────────

export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export const PRIORITY_OPTIONS: StatusOption<Priority>[] = [
  { value: Priority.LOW, label: 'Basse', color: 'success' },
  { value: Priority.NORMAL, label: 'Normale', color: 'info' },
  { value: Priority.HIGH, label: 'Elevee', color: 'warning' },
  { value: Priority.CRITICAL, label: 'Critique', color: 'error' },
];

// ─── INTERVENTION TYPE ──────────────────────────────────────────────────────

export enum InterventionType {
  CLEANING = 'CLEANING',
  EXPRESS_CLEANING = 'EXPRESS_CLEANING',
  DEEP_CLEANING = 'DEEP_CLEANING',
  WINDOW_CLEANING = 'WINDOW_CLEANING',
  FLOOR_CLEANING = 'FLOOR_CLEANING',
  KITCHEN_CLEANING = 'KITCHEN_CLEANING',
  BATHROOM_CLEANING = 'BATHROOM_CLEANING',
  PREVENTIVE_MAINTENANCE = 'PREVENTIVE_MAINTENANCE',
  EMERGENCY_REPAIR = 'EMERGENCY_REPAIR',
  ELECTRICAL_REPAIR = 'ELECTRICAL_REPAIR',
  PLUMBING_REPAIR = 'PLUMBING_REPAIR',
  HVAC_REPAIR = 'HVAC_REPAIR',
  APPLIANCE_REPAIR = 'APPLIANCE_REPAIR',
  GARDENING = 'GARDENING',
  EXTERIOR_CLEANING = 'EXTERIOR_CLEANING',
  PEST_CONTROL = 'PEST_CONTROL',
  DISINFECTION = 'DISINFECTION',
  RESTORATION = 'RESTORATION',
  OTHER = 'OTHER',
}

export type InterventionTypeCategory = 'cleaning' | 'maintenance' | 'specialized' | 'other';

export interface InterventionTypeOption {
  value: InterventionType;
  label: string;
  category: InterventionTypeCategory;
  color: string;
}

export const INTERVENTION_TYPE_OPTIONS: InterventionTypeOption[] = [
  { value: InterventionType.CLEANING, label: 'Nettoyage', category: 'cleaning', color: 'success' },
  { value: InterventionType.EXPRESS_CLEANING, label: 'Nettoyage Express', category: 'cleaning', color: 'success' },
  { value: InterventionType.DEEP_CLEANING, label: 'Nettoyage en Profondeur', category: 'cleaning', color: 'success' },
  { value: InterventionType.WINDOW_CLEANING, label: 'Nettoyage des Vitres', category: 'cleaning', color: 'success' },
  { value: InterventionType.FLOOR_CLEANING, label: 'Nettoyage des Sols', category: 'cleaning', color: 'success' },
  { value: InterventionType.KITCHEN_CLEANING, label: 'Nettoyage de la Cuisine', category: 'cleaning', color: 'success' },
  { value: InterventionType.BATHROOM_CLEANING, label: 'Nettoyage des Sanitaires', category: 'cleaning', color: 'success' },
  { value: InterventionType.PREVENTIVE_MAINTENANCE, label: 'Maintenance Preventive', category: 'maintenance', color: 'warning' },
  { value: InterventionType.EMERGENCY_REPAIR, label: "Reparation d'Urgence", category: 'maintenance', color: 'warning' },
  { value: InterventionType.ELECTRICAL_REPAIR, label: 'Reparation Electrique', category: 'maintenance', color: 'warning' },
  { value: InterventionType.PLUMBING_REPAIR, label: 'Reparation Plomberie', category: 'maintenance', color: 'warning' },
  { value: InterventionType.HVAC_REPAIR, label: 'Reparation Climatisation', category: 'maintenance', color: 'warning' },
  { value: InterventionType.APPLIANCE_REPAIR, label: 'Reparation Electromenager', category: 'maintenance', color: 'warning' },
  { value: InterventionType.GARDENING, label: 'Jardinage', category: 'specialized', color: 'secondary' },
  { value: InterventionType.EXTERIOR_CLEANING, label: 'Nettoyage Exterieur', category: 'specialized', color: 'secondary' },
  { value: InterventionType.PEST_CONTROL, label: 'Desinsectisation', category: 'specialized', color: 'secondary' },
  { value: InterventionType.DISINFECTION, label: 'Desinfection', category: 'specialized', color: 'secondary' },
  { value: InterventionType.RESTORATION, label: 'Remise en Etat', category: 'specialized', color: 'secondary' },
  { value: InterventionType.OTHER, label: 'Autre', category: 'other', color: 'error' },
];

// ─── UTILITY ────────────────────────────────────────────────────────────────

export function findStatusOption<T extends string>(
  options: StatusOption<T>[],
  value: T,
): StatusOption<T> | undefined {
  return options.find((o) => o.value === value);
}

export function getStatusColor<T extends string>(
  options: StatusOption<T>[],
  value: T,
  defaultColor = 'default',
): string {
  return findStatusOption(options, value)?.color ?? defaultColor;
}

export function getStatusLabel<T extends string>(
  options: StatusOption<T>[],
  value: T,
  defaultLabel = 'Inconnu',
): string {
  return findStatusOption(options, value)?.label ?? defaultLabel;
}

export function getInterventionTypeOption(type: InterventionType): InterventionTypeOption | undefined {
  return INTERVENTION_TYPE_OPTIONS.find((o) => o.value === type);
}

export function getInterventionTypeLabel(type: InterventionType): string {
  return getInterventionTypeOption(type)?.label ?? type;
}

export function getInterventionTypesByCategory(category: InterventionTypeCategory): InterventionTypeOption[] {
  return INTERVENTION_TYPE_OPTIONS.filter((o) => o.category === category);
}
