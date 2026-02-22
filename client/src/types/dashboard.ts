/**
 * Shared dashboard types used across useDashboardOverview, useDashboardStats, and useDashboardData.
 *
 * These types were previously duplicated in each hook; this file is now the single source of truth.
 */

// ============================================================================
// Translation helper
// ============================================================================

/** Translation function type used by i18n */
export type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

// ============================================================================
// API entity types (internal to dashboard hooks)
// ============================================================================

/** Paginated API response wrapper */
export interface DashboardPaginatedResponse<T> {
  content?: T[];
}

/** Property entity from the API */
export interface ApiProperty {
  id: number;
  name?: string;
  status: string;
  ownerId?: number;
  address?: string;
  city?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Service request entity from the API */
export interface ApiServiceRequest {
  id: string;
  title?: string;
  status?: string;
  serviceType?: string;
  type?: string;
  priority?: string;
  urgent?: boolean;
  desiredDate?: string;
  propertyId?: number;
  propertyName?: string;
  property?: { name?: string };
  userId?: number;
  requestorName?: string;
  user?: { firstName?: string; lastName?: string };
  createdAt: string;
}

/** Intervention entity from the API */
export interface ApiIntervention {
  id: string;
  title?: string;
  type: string;
  status: string;
  priority?: string;
  propertyId?: number;
  propertyName?: string;
  property?: { name?: string };
  assignedToType?: string;
  assignedToId?: number;
  assignedToName?: string;
  scheduledDate?: string;
  createdAt?: string;
  estimatedCost?: number;
  actualCost?: number;
}

/** User entity from the API */
export interface ApiUser {
  id: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Team entity from the API */
export interface ApiTeam {
  id: number;
  name?: string;
  members?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

/** Manager associations response */
export interface ManagerAssociations {
  teams?: Array<{ id: number }>;
  portfolios?: Array<{ id: number; properties?: Array<{ id: number }> }>;
  users?: Array<{ id: number }>;
}

// ============================================================================
// Public types (consumed by dashboard widgets & pages)
// ============================================================================

export interface DashboardStats {
  properties: {
    active: number;
    total: number;
    growth: number;
  };
  serviceRequests: {
    pending: number;
    total: number;
    growth: number;
  };
  interventions: {
    today: number;
    total: number;
    growth: number;
  };
  revenue: {
    current: number;
    previous: number;
    growth: number;
  };
}

export interface ActivityItem {
  id: string;
  type: string;
  property: string;
  time: string;
  status: 'completed' | 'urgent' | 'scheduled' | 'pending' | 'approved' | 'created' | 'started' | 'finished' | 'in_progress';
  timestamp: string;
  category: 'property' | 'service-request' | 'intervention' | 'user' | 'team';
  details?: {
    address?: string;
    city?: string;
    type?: string;
    requestor?: string;
    priority?: string;
    assignedTo?: string;
    role?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    members?: number;
    urgent?: boolean;
    urgentLabel?: string;
    serviceType?: string;
    title?: string;
    desiredDate?: string;
  };
}

export interface UpcomingIntervention {
  id: number;
  title: string;
  property: string;
  scheduledDate: string;
  status: string;
  priority: string;
}

export interface PendingPaymentItem {
  id: number;
  title: string;
  property: string;
  estimatedCost: number | null;
  scheduledDate: string;
}

export interface ServiceRequestItem {
  id: string;
  title: string;
  propertyName: string;
  status: string;
  priority: string;
  dueDate: string;
  createdAt: string;
}

export interface AlertItem {
  id: number;
  type: 'urgent' | 'payment' | 'validation' | 'overdue';
  title: string;
  description: string;
  count?: number;
  route: string;
}
