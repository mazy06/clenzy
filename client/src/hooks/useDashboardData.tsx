import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import apiClient from '../services/apiClient';
import type { AuthUser } from './useAuth';
import type { InterventionReportData, FinancialReportData } from '../services/api/reportsApi';

// ============================================================================
// Types — API entities (inlined from useDashboardStats)
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
// Context type
// ============================================================================

interface DashboardDataContextType {
  // Stats KPI
  stats: DashboardStats | null;
  // Activities
  activities: ActivityItem[];
  // Charts
  charts: {
    interventionData: InterventionReportData | null;
    financialData: FinancialReportData | null;
  };
  // Widgets
  upcomingInterventions: UpcomingIntervention[];
  pendingPayments: PendingPaymentItem[];
  serviceRequests: ServiceRequestItem[];
  alerts: AlertItem[];
  // State
  loading: boolean;
  error: string | null;
  // Actions
  refreshAll: () => void;
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

// ─── Chart helpers (from reportsApi, made pure) ─────────────────────────────

const CHART_COLORS = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#ff9800',
  IN_PROGRESS: '#2196f3',
  COMPLETED: '#4caf50',
  CANCELLED: '#f44336',
  SCHEDULED: '#9c27b0',
  ON_HOLD: '#607d8b',
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
  // By status
  const statusGroups = groupBy(interventions, (i) => i.status || 'UNKNOWN');
  const byStatus = Object.entries(statusGroups).map(([status, items]) => ({
    name: status,
    value: items.length,
    color: STATUS_COLORS[status] || CHART_COLORS[0],
  }));

  // By type
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

  // By month (last 6 months)
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

  // By priority
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

// ─── Service request type labels ────────────────────────────────────────────

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

// ============================================================================
// Context
// ============================================================================

const DashboardDataContext = createContext<DashboardDataContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

interface DashboardDataProviderProps {
  children: React.ReactNode;
  userRole: string;
  user: AuthUser | null;
  t: TranslationFn;
  isAdmin: boolean;
  isManager: boolean;
  isHost: boolean;
}

export const DashboardDataProvider: React.FC<DashboardDataProviderProps> = ({
  children,
  userRole,
  user,
  t,
  isAdmin,
  isManager,
  isHost,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [charts, setCharts] = useState<{ interventionData: InterventionReportData | null; financialData: FinancialReportData | null }>({
    interventionData: null,
    financialData: null,
  });
  const [upcomingInterventions, setUpcomingInterventions] = useState<UpcomingIntervention[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentItem[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref for translation function to avoid re-triggering loadAll when `t` changes identity
  const tRef = useRef(t);
  tRef.current = t;

  const loadAll = useCallback(async () => {
    const t = tRef.current;
    setLoading(true);
    setError(null);

    try {
      // ── 1. Fetch ALL raw data in parallel (~5 requests) ──────────────
      const [propertiesData, requestsData, interventionsData, usersData, teamsData] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiProperty> | ApiProperty[]>('/properties', { params: { size: 1000 } }).catch(() => null),
        apiClient.get<PaginatedResponse<ApiServiceRequest> | ApiServiceRequest[]>('/service-requests', { params: { size: 1000 } }).catch(() => null),
        apiClient.get<PaginatedResponse<ApiIntervention> | ApiIntervention[]>('/interventions', { params: { size: 1000 } }).catch(() => null),
        apiClient.get<PaginatedResponse<ApiUser> | ApiUser[]>('/users', { params: { size: 1000 } }).catch(() => null),
        apiClient.get<PaginatedResponse<ApiTeam> | ApiTeam[]>('/teams', { params: { size: 1000 } }).catch(() => null),
      ]);

      const properties = unwrapArray<ApiProperty>(propertiesData);
      const requests = unwrapArray<ApiServiceRequest>(requestsData);
      const interventions = unwrapArray<ApiIntervention>(interventionsData);
      const users = unwrapArray<ApiUser>(usersData);
      const teams = unwrapArray<ApiTeam>(teamsData);

      // ── 2. Role-based filtering IDs ──────────────────────────────────
      let hostPropertyIds: number[] = [];
      let managerTeamIds: number[] = [];
      let managerUserIds: number[] = [];
      let managerPropertyIds: number[] = [];
      const currentUserId = user?.id ? parseInt(user.id) : null;

      if (userRole === 'HOST' && currentUserId) {
        hostPropertyIds = properties
          .filter((p) => p.ownerId === currentUserId)
          .map((p) => p.id);
      }

      if (userRole === 'MANAGER' && currentUserId) {
        try {
          const assocData = await apiClient.get<ManagerAssociations>(`/managers/${currentUserId}/associations`);
          if (assocData.teams) managerTeamIds = assocData.teams.map((team) => team.id);
          if (assocData.portfolios) {
            managerPropertyIds = assocData.portfolios
              .flatMap((portfolio) => portfolio.properties || [])
              .map((prop) => prop.id);
          }
          if (assocData.users) managerUserIds = assocData.users.map((u) => u.id);
        } catch {
          // ignore
        }
      }

      // ── 3. Compute Stats KPI ─────────────────────────────────────────
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

      const computedStats: DashboardStats = {
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

      // ── 4. Compute Activities ────────────────────────────────────────
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

      // ── 5. Compute Charts (pure, no API call) ────────────────────────
      const interventionChartData = computeInterventionCharts(interventions);
      const financialChartData = computeFinancialCharts(interventions);

      // ── 6. Compute Upcoming Interventions ────────────────────────────
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

      // ── 7. Compute Pending Payments ──────────────────────────────────
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

      // ── 8. Compute Service Requests (latest 4) ───────────────────────
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

      // ── 9. Compute Alerts ────────────────────────────────────────────
      const alertItems: AlertItem[] = [];

      // Urgent interventions (IN_PROGRESS or PENDING)
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

      // Awaiting validation (manager/admin)
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

      // Awaiting payment (host)
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

      // ── 10. Set all state ────────────────────────────────────────────
      setStats(computedStats);
      setActivities(sortedActivities);
      setCharts({ interventionData: interventionChartData, financialData: financialChartData });
      setUpcomingInterventions(upcoming);
      setPendingPayments(pending);
      setServiceRequests(latestRequests);
      setAlerts(alertItems);
    } catch (err) {
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [userRole, user, isAdmin, isManager, isHost]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const value = useMemo<DashboardDataContextType>(() => ({
    stats,
    activities,
    charts,
    upcomingInterventions,
    pendingPayments,
    serviceRequests,
    alerts,
    loading,
    error,
    refreshAll: loadAll,
  }), [stats, activities, charts, upcomingInterventions, pendingPayments, serviceRequests, alerts, loading, error, loadAll]);

  return React.createElement(DashboardDataContext.Provider, { value }, children);
};

// ============================================================================
// Hook
// ============================================================================

export function useDashboardData(): DashboardDataContextType {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error('useDashboardData must be used within a DashboardDataProvider');
  }
  return ctx;
}
