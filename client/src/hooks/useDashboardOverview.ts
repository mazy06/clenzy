import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import type { AuthUser } from './useAuth';
import type { InterventionReportData, FinancialReportData } from '../services/api/reportsApi';
import type { DashboardPeriod } from '../modules/dashboard/DashboardDateFilter';

// ============================================================================
// Types — API entities
// ============================================================================

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

interface PaginatedResponse<T> {
  content?: T[];
}

interface ApiProperty {
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

interface ApiServiceRequest {
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

interface ApiIntervention {
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

interface ApiUser {
  id: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiTeam {
  id: number;
  name?: string;
  members?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

interface ManagerAssociations {
  teams?: Array<{ id: number }>;
  portfolios?: Array<{ id: number; properties?: Array<{ id: number }> }>;
  users?: Array<{ id: number }>;
}

// ============================================================================
// Public types (exported for consumers)
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

// ============================================================================
// Raw data type returned by the query
// ============================================================================

interface OverviewRawData {
  properties: ApiProperty[];
  serviceRequests: ApiServiceRequest[];
  interventions: ApiIntervention[];
  users: ApiUser[];
  teams: ApiTeam[];
  managerAssociations: ManagerAssociations | null;
}

// ============================================================================
// Helpers (pure functions)
// ============================================================================

function unwrapArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && 'content' in data) {
    const content = (data as { content: unknown }).content;
    if (Array.isArray(content)) return content as T[];
  }
  return [];
}

function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function formatGrowth(growth: number): { value: string; type: 'up' | 'down' | 'neutral' } {
  if (growth > 0) return { value: `+${growth}%`, type: 'up' };
  if (growth < 0) return { value: `${growth}%`, type: 'down' };
  return { value: '0%', type: 'neutral' };
}

function formatTimeAgo(date: Date, translationFn?: TranslationFn): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (translationFn) {
    if (diffDays > 0) return translationFn('dashboard.activities.timeAgo.days', { count: diffDays });
    if (diffHours > 0) return translationFn('dashboard.activities.timeAgo.hours', { count: diffHours });
    return translationFn('dashboard.activities.timeAgo.now');
  }

  if (diffDays > 0) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  if (diffHours > 0) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  return "À l'instant";
}

// ─── Chart helpers ───────────────────────────────────────────────────────────

const CHART_COLORS = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#D4A574',
  AWAITING_PAYMENT: '#E8B87A',
  IN_PROGRESS: '#6B8A9A',
  COMPLETED: '#4A9B8E',
  CANCELLED: '#C97A7A',
  SCHEDULED: '#8B7EC8',
  ON_HOLD: '#94A3B8',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#4caf50',
  MEDIUM: '#ff9800',
  HIGH: '#f44336',
  URGENT: '#9c27b0',
};

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getMonthLabel(d));
  }
  return months;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function computeInterventionCharts(interventions: ApiIntervention[]): InterventionReportData {
  const statusGroups = groupBy(interventions, (i) => i.status || 'UNKNOWN');
  const byStatus = Object.entries(statusGroups).map(([status, items]) => ({
    name: status,
    value: items.length,
    color: STATUS_COLORS[status] || CHART_COLORS[0],
  }));

  const typeGroups = groupBy(interventions, (i) => {
    const t = (i.type || '').toUpperCase();
    if (t.includes('CLEANING')) return 'Nettoyage';
    if (t.includes('REPAIR') || t.includes('MAINTENANCE')) return 'Maintenance';
    if (t.includes('GARDENING') || t.includes('PEST') || t.includes('DISINFECTION') || t.includes('RESTORATION') || t.includes('EXTERIOR')) return 'Specialise';
    return 'Autre';
  });
  const byType = Object.entries(typeGroups).map(([type, items], idx) => ({
    name: type,
    value: items.length,
    color: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  const months = getLast6Months();
  const byMonth = months.map((month) => {
    const monthInterventions = interventions.filter((i) => {
      const d = new Date(i.scheduledDate || i.createdAt || '');
      return getMonthLabel(d) === month;
    });
    return {
      month,
      total: monthInterventions.length,
      completed: monthInterventions.filter((i) => i.status === 'COMPLETED').length,
      pending: monthInterventions.filter((i) => i.status === 'PENDING' || i.status === 'SCHEDULED').length,
    };
  });

  const priorityGroups = groupBy(interventions, (i) => i.priority || 'MEDIUM');
  const byPriority = Object.entries(priorityGroups).map(([priority, items]) => ({
    name: priority,
    value: items.length,
    color: PRIORITY_COLORS[priority] || CHART_COLORS[0],
  }));

  return { byStatus, byType, byMonth, byPriority };
}

function computeFinancialCharts(interventions: ApiIntervention[]): FinancialReportData {
  const months = getLast6Months();
  const monthlyFinancials = months.map((month) => {
    const monthInterventions = interventions.filter((i) => {
      const d = new Date(i.scheduledDate || i.createdAt || '');
      return getMonthLabel(d) === month;
    });
    const expenses = monthInterventions.reduce(
      (sum, i) => sum + (i.actualCost || i.estimatedCost || 0),
      0
    );
    const revenue = expenses * 1.3;
    return {
      month,
      revenue: Math.round(revenue),
      expenses: Math.round(expenses),
      profit: Math.round(revenue - expenses),
    };
  });

  const typeGroups = groupBy(interventions, (i) => {
    const t = (i.type || '').toUpperCase();
    if (t.includes('CLEANING')) return 'Nettoyage';
    if (t.includes('REPAIR') || t.includes('MAINTENANCE')) return 'Maintenance';
    if (t.includes('GARDENING') || t.includes('PEST') || t.includes('DISINFECTION') || t.includes('RESTORATION') || t.includes('EXTERIOR')) return 'Specialise';
    return 'Autre';
  });
  const costBreakdown = Object.entries(typeGroups).map(([type, items], idx) => ({
    name: type,
    value: Math.round(items.reduce((sum, i) => sum + (i.actualCost || i.estimatedCost || 0), 0)),
    color: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  return { monthlyFinancials, costBreakdown };
}

// ─── Service request type labels ─────────────────────────────────────────────

const SERVICE_TYPE_MAP: Record<string, string> = {
  CLEANING: 'Nettoyage',
  EXPRESS_CLEANING: 'Nettoyage Express',
  DEEP_CLEANING: 'Nettoyage en Profondeur',
  WINDOW_CLEANING: 'Nettoyage des Vitres',
  FLOOR_CLEANING: 'Nettoyage des Sols',
  KITCHEN_CLEANING: 'Nettoyage de la Cuisine',
  BATHROOM_CLEANING: 'Nettoyage des Sanitaires',
  PREVENTIVE_MAINTENANCE: 'Maintenance Préventive',
  EMERGENCY_REPAIR: "Réparation d'Urgence",
  ELECTRICAL_REPAIR: 'Réparation Électrique',
  PLUMBING_REPAIR: 'Réparation Plomberie',
  HVAC_REPAIR: 'Réparation Climatisation',
  APPLIANCE_REPAIR: 'Réparation Électroménager',
  GARDENING: 'Jardinage',
  EXTERIOR_CLEANING: 'Nettoyage Extérieur',
  PEST_CONTROL: 'Désinsectisation',
  DISINFECTION: 'Désinfection',
  RESTORATION: 'Remise en État',
  OTHER: 'Autre',
};

// ─── Period helpers ──────────────────────────────────────────────────────────

function periodToDays(period: DashboardPeriod): number {
  switch (period) {
    case 'week': return 7;
    case 'month': return 30;
    case 'quarter': return 90;
    case 'year': return 365;
    default: return 30;
  }
}

function filterByPeriod<T>(items: T[], dateAccessor: (item: T) => string | undefined, periodDays: number): T[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);
  return items.filter((item) => {
    const dateStr = dateAccessor(item);
    if (!dateStr) return false;
    return new Date(dateStr) >= cutoff;
  });
}

// ============================================================================
// Query keys (exported for cross-module invalidation)
// ============================================================================

export const overviewKeys = {
  all: ['dashboard-overview'] as const,
  raw: (userRole: string, userId: string | undefined, period: DashboardPeriod) =>
    [...overviewKeys.all, 'raw', userRole, userId, period] as const,
};

// ============================================================================
// Fetch function (pure, no hooks)
// ============================================================================

async function fetchOverviewRawData(
  userRole: string,
  userId: string | undefined,
): Promise<OverviewRawData> {
  const [propertiesData, requestsData, interventionsData, usersData, teamsData] = await Promise.all([
    apiClient.get<PaginatedResponse<ApiProperty> | ApiProperty[]>('/properties', { params: { size: 1000 } }).catch(() => null),
    apiClient.get<PaginatedResponse<ApiServiceRequest> | ApiServiceRequest[]>('/service-requests', { params: { size: 1000 } }).catch(() => null),
    apiClient.get<PaginatedResponse<ApiIntervention> | ApiIntervention[]>('/interventions', { params: { size: 1000 } }).catch(() => null),
    apiClient.get<PaginatedResponse<ApiUser> | ApiUser[]>('/users', { params: { size: 1000 } }).catch(() => null),
    apiClient.get<PaginatedResponse<ApiTeam> | ApiTeam[]>('/teams', { params: { size: 1000 } }).catch(() => null),
  ]);

  // Fetch manager associations if needed
  let managerAssociations: ManagerAssociations | null = null;
  if (userRole === 'MANAGER' && userId) {
    try {
      managerAssociations = await apiClient.get<ManagerAssociations>(`/managers/${userId}/associations`);
    } catch {
      // ignore
    }
  }

  return {
    properties: unwrapArray<ApiProperty>(propertiesData),
    serviceRequests: unwrapArray<ApiServiceRequest>(requestsData),
    interventions: unwrapArray<ApiIntervention>(interventionsData),
    users: unwrapArray<ApiUser>(usersData),
    teams: unwrapArray<ApiTeam>(teamsData),
    managerAssociations,
  };
}

// ============================================================================
// Hook params
// ============================================================================

interface UseDashboardOverviewParams {
  userRole: string;
  user: AuthUser | null;
  t: TranslationFn;
  isAdmin: boolean;
  isManager: boolean;
  isHost: boolean;
  period?: DashboardPeriod;
}

// ============================================================================
// Context type (same interface as old useDashboardData)
// ============================================================================

export interface DashboardOverviewData {
  stats: DashboardStats | null;
  activities: ActivityItem[];
  charts: {
    interventionData: InterventionReportData | null;
    financialData: FinancialReportData | null;
  };
  upcomingInterventions: UpcomingIntervention[];
  pendingPayments: PendingPaymentItem[];
  serviceRequests: ServiceRequestItem[];
  alerts: AlertItem[];
  loading: boolean;
  error: string | null;
  refreshAll: () => void;
}

// ============================================================================
// Main hook
// ============================================================================

export function useDashboardOverview({
  userRole,
  user,
  t,
  isAdmin,
  isManager,
  isHost,
  period = 'month',
}: UseDashboardOverviewParams): DashboardOverviewData {
  const queryClient = useQueryClient();
  const currentUserId = user?.id ? String(user.id) : undefined;

  // ── Single query for all raw data ────────────────────────────────────────
  const rawQuery = useQuery<OverviewRawData>({
    queryKey: overviewKeys.raw(userRole, currentUserId, period),
    queryFn: () => fetchOverviewRawData(userRole, currentUserId),
    enabled: !!user,
    staleTime: 60_000, // 1 minute
  });

  const rawData = rawQuery.data;

  // ── Derive all computed data from raw ────────────────────────────────────
  const computed = useMemo(() => {
    if (!rawData) {
      return {
        stats: null,
        activities: [] as ActivityItem[],
        charts: { interventionData: null, financialData: null },
        upcomingInterventions: [] as UpcomingIntervention[],
        pendingPayments: [] as PendingPaymentItem[],
        serviceRequests: [] as ServiceRequestItem[],
        alerts: [] as AlertItem[],
      };
    }

    const { managerAssociations } = rawData;

    // ── 1. Filter by period ────────────────────────────────────────────
    const days = periodToDays(period);
    const properties = rawData.properties; // Properties not time-filtered
    const requests = filterByPeriod(rawData.serviceRequests, (r) => r.createdAt, days);
    const interventions = filterByPeriod(rawData.interventions, (i) => i.scheduledDate || i.createdAt || undefined, days);
    const users = filterByPeriod(rawData.users, (u) => u.createdAt || u.updatedAt || undefined, days);
    const teams = filterByPeriod(rawData.teams, (teamItem) => teamItem.createdAt || teamItem.updatedAt || undefined, days);

    // ── 2. Role-based filtering IDs ────────────────────────────────────
    let hostPropertyIds: number[] = [];
    let managerTeamIds: number[] = [];
    let managerUserIds: number[] = [];
    let managerPropertyIds: number[] = [];
    const parsedUserId = user?.id ? parseInt(user.id) : null;

    if (userRole === 'HOST' && parsedUserId) {
      hostPropertyIds = properties
        .filter((p) => p.ownerId === parsedUserId)
        .map((p) => p.id);
    }

    if (userRole === 'MANAGER' && managerAssociations) {
      if (managerAssociations.teams) managerTeamIds = managerAssociations.teams.map((team) => team.id);
      if (managerAssociations.portfolios) {
        managerPropertyIds = managerAssociations.portfolios
          .flatMap((portfolio) => portfolio.properties || [])
          .map((prop) => prop.id);
      }
      if (managerAssociations.users) managerUserIds = managerAssociations.users.map((u) => u.id);
    }

    // ── 3. Compute Stats KPI ───────────────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeProperties = properties.filter((p) => p.status === 'ACTIVE').length;
    const previousActiveProperties = properties.filter((p) => {
      if (!p.createdAt) return false;
      return new Date(p.createdAt) < thirtyDaysAgo && p.status === 'ACTIVE';
    }).length;

    const pendingRequests = requests.filter((r) =>
      ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(r.status || '')
    ).length;
    const previousPendingRequests = requests.filter((r) => {
      if (!r.createdAt) return false;
      return new Date(r.createdAt) < thirtyDaysAgo && ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(r.status || '');
    }).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayInterventions = interventions.filter((i) => {
      if (!i.scheduledDate) return false;
      const sd = new Date(i.scheduledDate);
      sd.setHours(0, 0, 0, 0);
      return sd.getTime() === today.getTime();
    }).length;
    const thirtyDaysAgoDate = new Date(today);
    thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);
    const previousTodayInterventions = interventions.filter((i) => {
      if (!i.scheduledDate) return false;
      const sd = new Date(i.scheduledDate);
      sd.setHours(0, 0, 0, 0);
      return sd.getTime() === thirtyDaysAgoDate.getTime();
    }).length;

    // Revenue from intervention costs
    const months = getLast6Months();
    const monthlyFinancialsForRevenue = months.map((month) => {
      const monthInts = interventions.filter((i) => {
        const d = new Date(i.scheduledDate || i.createdAt || '');
        return getMonthLabel(d) === month;
      });
      const expenses = monthInts.reduce((sum, i) => sum + (i.actualCost || i.estimatedCost || 0), 0);
      return { revenue: Math.round(expenses * 1.3) };
    });
    const currentRevenue = monthlyFinancialsForRevenue[monthlyFinancialsForRevenue.length - 1]?.revenue || 0;
    const previousRevenue = monthlyFinancialsForRevenue.length >= 2 ? (monthlyFinancialsForRevenue[monthlyFinancialsForRevenue.length - 2]?.revenue || 0) : 0;

    const stats: DashboardStats = {
      properties: {
        active: activeProperties,
        total: properties.length,
        growth: calculateGrowth(activeProperties, previousActiveProperties),
      },
      serviceRequests: {
        pending: pendingRequests,
        total: requests.length,
        growth: calculateGrowth(pendingRequests, previousPendingRequests),
      },
      interventions: {
        today: todayInterventions,
        total: interventions.length,
        growth: calculateGrowth(todayInterventions, previousTodayInterventions),
      },
      revenue: {
        current: currentRevenue,
        previous: previousRevenue,
        growth: calculateGrowth(currentRevenue, previousRevenue),
      },
    };

    // ── 4. Compute Activities ──────────────────────────────────────────
    const activityItems: ActivityItem[] = [];

    // Properties
    if (userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'HOST') {
      let filteredProps = properties;
      if (userRole === 'HOST') filteredProps = properties.filter((p) => hostPropertyIds.includes(p.id));
      else if (userRole === 'MANAGER') filteredProps = properties.filter((p) => managerPropertyIds.includes(p.id));

      filteredProps.forEach((prop) => {
        activityItems.push({
          id: String(prop.id),
          type: t('dashboard.activities.newPropertyCreated'),
          property: prop.name || t('properties.title'),
          time: formatTimeAgo(new Date(prop.createdAt || prop.updatedAt || ''), t),
          status: 'created',
          timestamp: prop.createdAt || prop.updatedAt || '',
          category: 'property',
          details: { address: prop.address, city: prop.city, type: prop.type },
        });
      });
    }

    // Service requests
    {
      let filteredReqs = requests;
      if (userRole === 'MANAGER') {
        filteredReqs = requests.filter((req) =>
          managerPropertyIds.includes(req.propertyId || 0) || managerUserIds.includes(req.userId || 0)
        );
      }

      filteredReqs.forEach((req) => {
        const serviceRequestLabel = t('dashboard.activities.serviceRequest');
        const serviceType = req.serviceType || req.type || 'N/A';
        const serviceTypeLabel = SERVICE_TYPE_MAP[serviceType] || serviceType;
        let activityType = `${serviceRequestLabel} : ${serviceTypeLabel}`;

        const priority = req.priority?.toUpperCase() || 'NORMAL';
        const isUrgent = req.urgent || priority === 'URGENT' || priority === 'HIGH' || priority === 'CRITICAL';
        let urgentLabel = '';
        if (isUrgent) {
          switch (priority) {
            case 'LOW': urgentLabel = t('serviceRequests.priorities.low', { defaultValue: 'Basse' }); break;
            case 'NORMAL': urgentLabel = t('serviceRequests.priorities.normal', { defaultValue: 'Normale' }); break;
            case 'HIGH': urgentLabel = t('serviceRequests.priorities.high', { defaultValue: 'Élevée' }); break;
            case 'URGENT': urgentLabel = t('serviceRequests.priorities.urgent', { defaultValue: 'Urgent' }); break;
            case 'CRITICAL': urgentLabel = t('serviceRequests.priorities.critical', { defaultValue: 'Critique' }); break;
            default: urgentLabel = t('serviceRequests.priorities.urgent', { defaultValue: 'Urgent' });
          }
          activityType += ` - ${urgentLabel}`;
        }

        if (req.desiredDate) {
          try {
            const plannedDate = new Date(req.desiredDate);
            const dateLabel = plannedDate.toLocaleDateString('fr-FR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            activityType += ` - ${dateLabel}`;
          } catch {
            // ignore
          }
        }

        activityItems.push({
          id: req.id,
          type: activityType,
          property: req.propertyName || req.property?.name || t('properties.title'),
          time: formatTimeAgo(new Date(req.createdAt), t),
          status: (req.status?.toLowerCase() || 'pending') as ActivityItem['status'],
          timestamp: req.createdAt,
          category: 'service-request',
          details: {
            requestor: req.requestorName || (req.user ? `${req.user.firstName} ${req.user.lastName}` : undefined),
            priority: req.priority,
            title: req.title,
            serviceType: req.serviceType || req.type,
            urgent: isUrgent,
            urgentLabel,
            desiredDate: req.desiredDate,
          },
        });
      });
    }

    // Interventions
    {
      let filteredInts = interventions;
      if (userRole === 'HOST') {
        filteredInts = interventions.filter((int) => hostPropertyIds.includes(int.propertyId || 0));
      } else if (userRole === 'MANAGER') {
        filteredInts = interventions.filter((int) =>
          managerPropertyIds.includes(int.propertyId || 0) ||
          (int.assignedToType === 'team' && managerTeamIds.includes(int.assignedToId || 0)) ||
          (int.assignedToType === 'user' && managerUserIds.includes(int.assignedToId || 0))
        );
      }

      filteredInts.forEach((int) => {
        const interventionLabel = t('dashboard.activities.intervention');
        activityItems.push({
          id: int.id,
          type: `${interventionLabel} - ${int.type}`,
          property: int.propertyName || t('properties.title'),
          time: formatTimeAgo(new Date(int.scheduledDate || int.createdAt || ''), t),
          status: int.status.toLowerCase() as ActivityItem['status'],
          timestamp: int.scheduledDate || int.createdAt || '',
          category: 'intervention',
          details: { assignedTo: int.assignedToName, priority: int.priority },
        });
      });
    }

    // Users (admin/manager only, not for HOST)
    if (userRole !== 'HOST' && (userRole === 'ADMIN' || userRole === 'MANAGER')) {
      let filteredUsers = users;
      if (userRole === 'MANAGER') filteredUsers = users.filter((u) => managerUserIds.includes(u.id));

      filteredUsers.forEach((apiUser) => {
        const fullName = apiUser.firstName && apiUser.lastName
          ? `${apiUser.firstName} ${apiUser.lastName}`
          : apiUser.firstName || apiUser.lastName || '';
        const displayText = fullName
          ? `${fullName}${apiUser.email ? ` • ${apiUser.email}` : ''}`
          : apiUser.email || t('users.title');

        activityItems.push({
          id: String(apiUser.id),
          type: t('dashboard.activities.newUserCreated'),
          property: displayText,
          time: formatTimeAgo(new Date(apiUser.createdAt || apiUser.updatedAt || ''), t),
          status: 'created',
          timestamp: apiUser.createdAt || apiUser.updatedAt || '',
          category: 'user',
          details: {
            role: apiUser.role,
            email: apiUser.email,
            firstName: apiUser.firstName,
            lastName: apiUser.lastName,
            fullName,
          },
        });
      });
    }

    // Teams (admin/manager only, not for HOST)
    if (userRole !== 'HOST' && (userRole === 'ADMIN' || userRole === 'MANAGER')) {
      let filteredTeams = teams;
      if (userRole === 'MANAGER') filteredTeams = teams.filter((teamItem) => managerTeamIds.includes(teamItem.id));

      filteredTeams.forEach((team) => {
        activityItems.push({
          id: String(team.id),
          type: t('dashboard.activities.newTeamCreated'),
          property: team.name || t('teams.title'),
          time: formatTimeAgo(new Date(team.createdAt || team.updatedAt || ''), t),
          status: 'created',
          timestamp: team.createdAt || team.updatedAt || '',
          category: 'team',
          details: { members: team.members?.length || 0 },
        });
      });
    }

    const sortedActivities = activityItems
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // ── 5. Charts ──────────────────────────────────────────────────────
    const interventionChartData = computeInterventionCharts(interventions);
    const financialChartData = computeFinancialCharts(interventions);

    // ── 6. Upcoming Interventions ──────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const upcoming = interventions
      .filter((i) => {
        if (!i.scheduledDate) return false;
        return new Date(i.scheduledDate) >= todayStart;
      })
      .sort((a, b) => new Date(a.scheduledDate || '').getTime() - new Date(b.scheduledDate || '').getTime())
      .slice(0, 4)
      .map((item) => ({
        id: typeof item.id === 'string' ? parseInt(item.id) : item.id as unknown as number,
        title: item.title || item.type,
        property: item.property?.name || item.propertyName || 'N/A',
        scheduledDate: item.scheduledDate || '',
        status: item.status,
        priority: item.priority || 'NORMAL',
      }));

    // ── 7. Pending Payments ────────────────────────────────────────────
    const pending = interventions
      .filter((i) => i.status === 'AWAITING_PAYMENT')
      .sort((a, b) => new Date(a.scheduledDate || '').getTime() - new Date(b.scheduledDate || '').getTime())
      .slice(0, 4)
      .map((item) => ({
        id: typeof item.id === 'string' ? parseInt(item.id) : item.id as unknown as number,
        title: item.title || item.type,
        property: item.property?.name || item.propertyName || 'N/A',
        estimatedCost: item.estimatedCost ?? null,
        scheduledDate: item.scheduledDate || '',
      }));

    // ── 8. Service Requests (latest 4) ─────────────────────────────────
    const latestRequests = [...requests]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4)
      .map((item) => ({
        id: item.id.toString(),
        title: item.title || '',
        propertyName: item.property?.name || item.propertyName || 'Propriete inconnue',
        status: item.status || 'PENDING',
        priority: item.priority?.toLowerCase() || 'normal',
        dueDate: item.desiredDate || '',
        createdAt: item.createdAt || '',
      }));

    // ── 9. Alerts ──────────────────────────────────────────────────────
    const alertItems: AlertItem[] = [];

    const urgentInterventions = interventions.filter(
      (i) => i.priority === 'URGENT' && (i.status === 'IN_PROGRESS' || i.status === 'PENDING')
    );
    if (urgentInterventions.length > 0) {
      alertItems.push({
        id: 1,
        type: 'urgent',
        title: t('dashboard.urgentInterventions'),
        description: `${urgentInterventions.length} ${t('dashboard.interventionsRequireAttention')}`,
        count: urgentInterventions.length,
        route: '/interventions?priority=URGENT',
      });
    }

    if (isManager || isAdmin) {
      const awaitingValidation = interventions.filter((i) => i.status === 'AWAITING_VALIDATION');
      if (awaitingValidation.length > 0) {
        alertItems.push({
          id: 2,
          type: 'validation',
          title: t('dashboard.interventionsPendingValidation'),
          description: `${awaitingValidation.length} ${t('dashboard.interventionsAwaitingValidation')}`,
          count: awaitingValidation.length,
          route: '/interventions/pending-validation',
        });
      }
    }

    if (isHost) {
      const awaitingPayment = interventions.filter((i) => i.status === 'AWAITING_PAYMENT');
      if (awaitingPayment.length > 0) {
        alertItems.push({
          id: 3,
          type: 'payment',
          title: t('dashboard.interventionsPendingPayment'),
          description: `${awaitingPayment.length} ${t('dashboard.interventionsAwaitingPayment')}`,
          count: awaitingPayment.length,
          route: '/interventions/pending-payment',
        });
      }
    }

    return {
      stats,
      activities: sortedActivities,
      charts: { interventionData: interventionChartData, financialData: financialChartData },
      upcomingInterventions: upcoming,
      pendingPayments: pending,
      serviceRequests: latestRequests,
      alerts: alertItems,
    };
  }, [rawData, period, userRole, user, isAdmin, isManager, isHost, t]);

  // ── Refresh function ─────────────────────────────────────────────────────
  const refreshAll = useMemo(
    () => () => {
      queryClient.invalidateQueries({ queryKey: overviewKeys.all });
    },
    [queryClient],
  );

  return {
    ...computed,
    loading: rawQuery.isLoading,
    error: rawQuery.isError ? 'Erreur lors du chargement des statistiques' : null,
    refreshAll,
  };
}
