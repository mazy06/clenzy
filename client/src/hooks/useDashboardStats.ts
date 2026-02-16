import { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { reportsApi } from '../services/api';
import type { AuthUser } from './useAuth';

// ============================================================================
// API Response Interfaces
// ============================================================================

/** Translation function type used by i18n */
type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

/** Paginated API response wrapper */
interface PaginatedResponse<T> {
  content?: T[];
}

/** Property entity from the API */
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

/** Service request entity from the API */
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

/** Intervention entity from the API */
interface ApiIntervention {
  id: string;
  type: string;
  status: string;
  priority?: string;
  propertyId?: number;
  propertyName?: string;
  assignedToType?: string;
  assignedToId?: number;
  assignedToName?: string;
  scheduledDate?: string;
  createdAt?: string;
}

/** User entity from the API */
interface ApiUser {
  id: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Team entity from the API */
interface ApiTeam {
  id: number;
  name?: string;
  members?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

/** Manager associations response */
interface ManagerAssociations {
  teams?: Array<{ id: number }>;
  portfolios?: Array<{ id: number; properties?: Array<{ id: number }> }>;
  users?: Array<{ id: number }>;
}

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

export const useDashboardStats = (userRole?: string, user?: AuthUser | null, t?: TranslationFn, limitActivities?: number) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculer le pourcentage d'évolution
  const calculateGrowth = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Formater le pourcentage avec signe et couleur
  const formatGrowth = (growth: number): { value: string; type: 'up' | 'down' | 'neutral' } => {
    if (growth > 0) {
      return { value: `+${growth}%`, type: 'up' };
    } else if (growth < 0) {
      return { value: `${growth}%`, type: 'down' };
    } else {
      return { value: '0%', type: 'neutral' };
    }
  };

  // Charger les statistiques des propriétés
  const loadPropertiesStats = async (): Promise<{ active: number; total: number; previous: number }> => {
    try {
      const data = await apiClient.get<PaginatedResponse<ApiProperty> | ApiProperty[]>('/properties', { params: { size: 1000 } });
      const properties: ApiProperty[] = (data as PaginatedResponse<ApiProperty>).content || (data as ApiProperty[]) || [];

      // Compter les propriétés actives
      const active = properties.filter((p: ApiProperty) => p.status === 'ACTIVE').length;
      const total = properties.length;

      // Calculer les données précédentes : propriétés créées il y a plus de 30 jours
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const previous = properties.filter((p: ApiProperty) => {
        if (!p.createdAt) return false;
        const createdAt = new Date(p.createdAt);
        return createdAt < thirtyDaysAgo && p.status === 'ACTIVE';
      }).length;

      return { active, total, previous };
    } catch (err) {
      return { active: 0, total: 0, previous: 0 };
    }
  };

  // Charger les statistiques des demandes de service
  const loadServiceRequestsStats = async (): Promise<{ pending: number; total: number; previous: number }> => {
    try {
      const data = await apiClient.get<PaginatedResponse<ApiServiceRequest> | ApiServiceRequest[]>('/service-requests', { params: { size: 1000 } });
      const requests: ApiServiceRequest[] = (data as PaginatedResponse<ApiServiceRequest>).content || (data as ApiServiceRequest[]) || [];

      // Compter les demandes en cours
      const pending = requests.filter((r: ApiServiceRequest) =>
        ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(r.status || '')
      ).length;
      const total = requests.length;

      // Calculer les données précédentes : demandes en cours il y a 30 jours
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const previous = requests.filter((r: ApiServiceRequest) => {
        if (!r.createdAt) return false;
        const createdAt = new Date(r.createdAt);
        return createdAt < thirtyDaysAgo && ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(r.status || '');
      }).length;

      return { pending, total, previous };
    } catch (err) {
      return { pending: 0, total: 0, previous: 0 };
    }
  };

  // Charger les statistiques des interventions
  const loadInterventionsStats = async (): Promise<{ today: number; total: number; previous: number }> => {
    try {
      const data = await apiClient.get<PaginatedResponse<ApiIntervention> | ApiIntervention[]>('/interventions', { params: { size: 1000 } });
      const interventions: ApiIntervention[] = (data as PaginatedResponse<ApiIntervention>).content || (data as ApiIntervention[]) || [];

      // Compter les interventions d'aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayInterventions = interventions.filter((i: ApiIntervention) => {
        if (!i.scheduledDate) return false;
        const scheduledDate = new Date(i.scheduledDate);
        scheduledDate.setHours(0, 0, 0, 0);
        return scheduledDate.getTime() === today.getTime();
      }).length;

      const total = interventions.length;

      // Calculer les données précédentes : interventions du même jour il y a 30 jours
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const previous = interventions.filter((i: ApiIntervention) => {
        if (!i.scheduledDate) return false;
        const scheduledDate = new Date(i.scheduledDate);
        scheduledDate.setHours(0, 0, 0, 0);
        return scheduledDate.getTime() === thirtyDaysAgo.getTime();
      }).length;

      return { today: todayInterventions, total, previous };
    } catch (err) {
      return { today: 0, total: 0, previous: 0 };
    }
  };

  // Charger les activités récentes
  const loadRecentActivities = async (userRole?: string, currentUser?: AuthUser | null, translationFn?: TranslationFn, limit?: number): Promise<ActivityItem[]> => {
    try {
      // Combiner les données des différents endpoints pour créer des activités
      const [propertiesData, requestsData, interventionsData, usersData, teamsData] = await Promise.all([
        apiClient.get<PaginatedResponse<ApiProperty> | ApiProperty[]>('/properties', { params: { size: 1000 } }).catch(() => null),
        apiClient.get<PaginatedResponse<ApiServiceRequest> | ApiServiceRequest[]>('/service-requests', { params: { size: 1000 } }).catch(() => null),
        apiClient.get<PaginatedResponse<ApiIntervention> | ApiIntervention[]>('/interventions', { params: { size: 1000 } }).catch(() => null),
        apiClient.get<PaginatedResponse<ApiUser> | ApiUser[]>('/users', { params: { size: 1000 } }).catch(() => null),
        apiClient.get<PaginatedResponse<ApiTeam> | ApiTeam[]>('/teams', { params: { size: 1000 } }).catch(() => null),
      ]);

      const activities: ActivityItem[] = [];

      // Récupérer les IDs nécessaires pour le filtrage selon le rôle
      let hostPropertyIds: number[] = [];
      let managerTeamIds: number[] = [];
      let managerUserIds: number[] = [];
      let managerPropertyIds: number[] = [];
      let userTeamIds: number[] = [];
      const currentUserId = currentUser?.id ? parseInt(currentUser.id) : null;

      // Pour HOST : récupérer les IDs de ses propriétés
      if (userRole === 'HOST' && currentUserId) {
        if (propertiesData) {
          const properties: ApiProperty[] = (propertiesData as PaginatedResponse<ApiProperty>).content || (propertiesData as ApiProperty[]) || [];
          hostPropertyIds = properties
            .filter((p: ApiProperty) => p.ownerId === currentUserId)
            .map((p: ApiProperty) => p.id);
        }
      }

      // Pour MANAGER : récupérer les équipes, utilisateurs et propriétés gérés
      if (userRole === 'MANAGER' && currentUserId) {
        try {
          // Récupérer les associations du manager (portefeuilles, clients, propriétés, équipes, utilisateurs)
          const assocData = await apiClient.get<ManagerAssociations>(`/managers/${currentUserId}/associations`);
          // Récupérer les équipes
          if (assocData.teams) {
            managerTeamIds = assocData.teams.map((team) => team.id);
          }
          // Récupérer les propriétés via les portefeuilles
          if (assocData.portfolios) {
            managerPropertyIds = assocData.portfolios
              .flatMap((portfolio) => portfolio.properties || [])
              .map((prop) => prop.id);
          }
          // Récupérer les utilisateurs
          if (assocData.users) {
            managerUserIds = assocData.users.map((u) => u.id);
          }
        } catch (err) {
        }
      }

      // Pour HOUSEKEEPER/TECHNICIAN : récupérer les équipes de l'utilisateur
      // Note: Les interventions sont déjà filtrées par le backend selon le rôle,
      // donc on peut extraire les teamIds depuis les interventions filtrées
      if ((userRole === 'HOUSEKEEPER' || userRole === 'TECHNICIAN') && currentUserId) {
        // Les équipes seront extraites depuis les interventions filtrées par le backend
        // On laisse userTeamIds vide pour l'instant, le filtrage se fera via les interventions
      }

      // Ajouter les propriétés récemment créées
      if (propertiesData && (userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'HOST')) {
        const properties: ApiProperty[] = (propertiesData as PaginatedResponse<ApiProperty>).content || (propertiesData as ApiProperty[]) || [];

        // Filtrer selon le rôle
        let filteredProperties = properties;
        if (userRole === 'HOST') {
          // HOST : seulement ses propres propriétés
          filteredProperties = properties.filter((p: ApiProperty) =>
            hostPropertyIds.includes(p.id)
          );
        } else if (userRole === 'MANAGER') {
          // Manager : seulement les propriétés de ses portefeuilles
          filteredProperties = properties.filter((p: ApiProperty) =>
            managerPropertyIds.includes(p.id)
          );
        }
        // ADMIN : toutes les propriétés (déjà dans filteredProperties)

        // Pas de limite par catégorie, on prendra les 4 plus récentes toutes catégories confondues
        filteredProperties.forEach((prop: ApiProperty) => {
          activities.push({
            id: String(prop.id),
            type: t ? t('dashboard.activities.newPropertyCreated') : 'Nouvelle propriété créée',
            property: prop.name || (t ? t('properties.title') : 'Propriété'),
            time: formatTimeAgo(new Date(prop.createdAt || prop.updatedAt || ''), t),
            status: 'created',
            timestamp: prop.createdAt || prop.updatedAt || '',
            category: 'property',
            details: {
              address: prop.address,
              city: prop.city,
              type: prop.type
            }
          });
        });
      }

      // Ajouter les demandes de service récentes
      // Note: Le backend filtre déjà selon le rôle (HOST, HOUSEKEEPER, TECHNICIAN)
      // Pour MANAGER, on applique un filtrage supplémentaire côté frontend
      if (requestsData) {
        const requests: ApiServiceRequest[] = (requestsData as PaginatedResponse<ApiServiceRequest>).content || (requestsData as ApiServiceRequest[]) || [];

        // Filtrer selon le rôle (filtrage supplémentaire pour MANAGER uniquement)
        let filteredRequests = requests;
        if (userRole === 'MANAGER') {
          // MANAGER : demandes liées à ses portefeuilles ou créées par ses utilisateurs
          filteredRequests = requests.filter((req: ApiServiceRequest) =>
            managerPropertyIds.includes(req.propertyId || 0) ||
            managerUserIds.includes(req.userId || 0)
          );
        }
        // Pour HOST, HOUSEKEEPER, TECHNICIAN et ADMIN, le backend filtre déjà

        // Pas de limite par catégorie, on prendra les 4 plus récentes toutes catégories confondues
        filteredRequests.forEach((req: ApiServiceRequest) => {
          const serviceRequestLabel = t ? t('dashboard.activities.serviceRequest') : 'Demande de service';
          
          // Récupérer le type de service
          const serviceType = req.serviceType || req.type || 'N/A';
          
          // Mapper les types de service vers leurs labels français
          const serviceTypeMap: { [key: string]: string } = {
            'CLEANING': 'Nettoyage',
            'EXPRESS_CLEANING': 'Nettoyage Express',
            'DEEP_CLEANING': 'Nettoyage en Profondeur',
            'WINDOW_CLEANING': 'Nettoyage des Vitres',
            'FLOOR_CLEANING': 'Nettoyage des Sols',
            'KITCHEN_CLEANING': 'Nettoyage de la Cuisine',
            'BATHROOM_CLEANING': 'Nettoyage des Sanitaires',
            'PREVENTIVE_MAINTENANCE': 'Maintenance Préventive',
            'EMERGENCY_REPAIR': 'Réparation d\'Urgence',
            'ELECTRICAL_REPAIR': 'Réparation Électrique',
            'PLUMBING_REPAIR': 'Réparation Plomberie',
            'HVAC_REPAIR': 'Réparation Climatisation',
            'APPLIANCE_REPAIR': 'Réparation Électroménager',
            'GARDENING': 'Jardinage',
            'EXTERIOR_CLEANING': 'Nettoyage Extérieur',
            'PEST_CONTROL': 'Désinsectisation',
            'DISINFECTION': 'Désinfection',
            'RESTORATION': 'Remise en État',
            'OTHER': 'Autre'
          };
          
          // Formater le type de service pour l'affichage
          const serviceTypeLabel = serviceTypeMap[serviceType] || serviceType;
          
          // Construire le label avec le nouveau format : "Demande de service : Type - Urgence - Date"
          // Commencer avec "Demande de service : " (avec espace après les deux points)
          let activityType = `${serviceRequestLabel} : ${serviceTypeLabel}`;
          
          // Ajouter l'urgence si présente - utiliser la priorité réelle de la base de données
          const priority = req.priority?.toUpperCase() || 'NORMAL';
          const isUrgent = req.urgent || priority === 'URGENT' || priority === 'HIGH' || priority === 'CRITICAL';
          let urgentLabel = '';
          if (isUrgent) {
            // Utiliser le label correspondant à la priorité réelle de la base de données
            switch (priority) {
              case 'LOW':
                urgentLabel = t ? t('serviceRequests.priorities.low', { defaultValue: 'Basse' }) : 'Basse';
                break;
              case 'NORMAL':
                urgentLabel = t ? t('serviceRequests.priorities.normal', { defaultValue: 'Normale' }) : 'Normale';
                break;
              case 'HIGH':
                urgentLabel = t ? t('serviceRequests.priorities.high', { defaultValue: 'Élevée' }) : 'Élevée';
                break;
              case 'URGENT':
                urgentLabel = t ? t('serviceRequests.priorities.urgent', { defaultValue: 'Urgent' }) : 'Urgent';
                break;
              case 'CRITICAL':
                urgentLabel = t ? t('serviceRequests.priorities.critical', { defaultValue: 'Critique' }) : 'Critique';
                break;
              default:
                urgentLabel = t ? t('serviceRequests.priorities.urgent', { defaultValue: 'Urgent' }) : 'Urgent';
            }
            activityType += ` - ${urgentLabel}`;
          }
          
          // Ajouter la date planifiée si disponible
          if (req.desiredDate) {
            try {
              const plannedDate = new Date(req.desiredDate);
              const dateLabel = plannedDate.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
              activityType += ` - ${dateLabel}`;
            } catch (e) {
              // Si la date ne peut pas être parsée, ignorer
            }
          }
          
          // Stocker l'information d'urgence dans les détails pour l'affichage avec couleur
          const activityDetails: ActivityItem['details'] = {
            requestor: req.requestorName || (req.user ? `${req.user.firstName} ${req.user.lastName}` : undefined),
            priority: req.priority,
            title: req.title,
            serviceType: req.serviceType || req.type,
            urgent: isUrgent,
            urgentLabel: urgentLabel,
            desiredDate: req.desiredDate
          };
          
          activities.push({
            id: req.id,
            type: activityType,
            property: req.propertyName || req.property?.name || (t ? t('properties.title') : 'Propriété'),
            time: formatTimeAgo(new Date(req.createdAt), t),
            status: (req.status?.toLowerCase() || 'pending') as ActivityItem['status'],
            timestamp: req.createdAt,
            category: 'service-request',
            details: activityDetails
          });
        });
      }

      // Ajouter les interventions récentes
      if (interventionsData) {
        const interventions: ApiIntervention[] = (interventionsData as PaginatedResponse<ApiIntervention>).content || (interventionsData as ApiIntervention[]) || [];

        // Filtrer selon le rôle
        let filteredInterventions = interventions;
        if (userRole === 'HOST') {
          // HOST : seulement les interventions liées à ses propriétés
          filteredInterventions = interventions.filter((int: ApiIntervention) =>
            hostPropertyIds.includes(int.propertyId || 0)
          );
        } else if (userRole === 'MANAGER') {
          // MANAGER : interventions liées à ses portefeuilles ou assignées à ses équipes/utilisateurs
          filteredInterventions = interventions.filter((int: ApiIntervention) =>
            managerPropertyIds.includes(int.propertyId || 0) ||
            (int.assignedToType === 'team' && managerTeamIds.includes(int.assignedToId || 0)) ||
            (int.assignedToType === 'user' && managerUserIds.includes(int.assignedToId || 0))
          );
        } else if (userRole === 'HOUSEKEEPER' || userRole === 'TECHNICIAN') {
          // HOUSEKEEPER/TECHNICIAN : les interventions sont déjà filtrées par le backend
          // selon le rôle (voir InterventionService.search), donc on utilise directement
          // les interventions retournées
          filteredInterventions = interventions;
        }
        // ADMIN : toutes les interventions (déjà dans filteredInterventions)

        // Pas de limite par catégorie, on prendra les 4 plus récentes toutes catégories confondues
        filteredInterventions.forEach((int: ApiIntervention) => {
          const interventionLabel = t ? t('dashboard.activities.intervention') : 'Intervention';
          activities.push({
            id: int.id,
            type: `${interventionLabel} - ${int.type}`,
            property: int.propertyName || (t ? t('properties.title') : 'Propriété'),
            time: formatTimeAgo(new Date(int.scheduledDate || int.createdAt || ''), t),
            status: int.status.toLowerCase() as ActivityItem['status'],
            timestamp: int.scheduledDate || int.createdAt || '',
            category: 'intervention',
            details: {
              assignedTo: int.assignedToName,
              priority: int.priority
            }
          });
        });
      }

      // Pour les HOST, ne pas afficher les activités de création d'utilisateurs et d'équipes
      if (userRole !== 'HOST') {
        // Ajouter les nouveaux utilisateurs créés (seulement pour ADMIN et MANAGER)
        if ((userRole === 'ADMIN' || userRole === 'MANAGER') && usersData) {
          const users: ApiUser[] = (usersData as PaginatedResponse<ApiUser>).content || (usersData as ApiUser[]) || [];

          // Pour MANAGER : filtrer seulement les utilisateurs qu'il gère
          let filteredUsers = users;
          if (userRole === 'MANAGER') {
            filteredUsers = users.filter((u: ApiUser) =>
              managerUserIds.includes(u.id)
            );
          }

          // Pas de limite par catégorie, on prendra les 4 plus récentes toutes catégories confondues
          filteredUsers.forEach((apiUser: ApiUser) => {
            // Construire le nom complet avec prénom et nom
            const fullName = apiUser.firstName && apiUser.lastName
              ? `${apiUser.firstName} ${apiUser.lastName}`
              : apiUser.firstName || apiUser.lastName || '';
            const displayText = fullName
              ? `${fullName}${apiUser.email ? ` • ${apiUser.email}` : ''}`
              : apiUser.email || (t ? t('users.title') : 'Utilisateur');

            activities.push({
              id: String(apiUser.id),
              type: t ? t('dashboard.activities.newUserCreated') : 'Nouvel utilisateur créé',
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
                fullName: fullName
              }
            });
          });
        }

        // Ajouter les nouvelles équipes créées (seulement pour ADMIN et MANAGER)
        if ((userRole === 'ADMIN' || userRole === 'MANAGER') && teamsData) {
          const teams: ApiTeam[] = (teamsData as PaginatedResponse<ApiTeam>).content || (teamsData as ApiTeam[]) || [];

          // Pour MANAGER : filtrer seulement les équipes qu'il gère
          let filteredTeams = teams;
          if (userRole === 'MANAGER') {
            filteredTeams = teams.filter((teamItem: ApiTeam) =>
              managerTeamIds.includes(teamItem.id)
            );
          }

          // Pas de limite par catégorie, on prendra les 4 plus récentes toutes catégories confondues
          filteredTeams.forEach((team: ApiTeam) => {
            activities.push({
              id: String(team.id),
              type: t ? t('dashboard.activities.newTeamCreated') : 'Nouvelle équipe créée',
              property: team.name || (t ? t('teams.title') : 'Équipe'),
              time: formatTimeAgo(new Date(team.createdAt || team.updatedAt || ''), t),
              status: 'created',
              timestamp: team.createdAt || team.updatedAt || '',
              category: 'team',
              details: {
                members: team.members?.length || 0
              }
            });
          });
        }
      }

      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Limiter seulement si un limit est spécifié (pour le dashboard)
      // Si limit est défini et > 0, limiter à ce nombre, sinon retourner toutes les activités
      const result = (limit && limit > 0) ? sortedActivities.slice(0, limit) : sortedActivities;
      return result;
    } catch (err) {
      return [];
    }
  };

  // Formater le temps écoulé
  const formatTimeAgo = (date: Date, translationFn?: TranslationFn): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (translationFn) {
      if (diffDays > 0) {
        return translationFn('dashboard.activities.timeAgo.days', { count: diffDays });
      } else if (diffHours > 0) {
        return translationFn('dashboard.activities.timeAgo.hours', { count: diffHours });
      } else {
        return translationFn('dashboard.activities.timeAgo.now');
      }
    }

    // Fallback en français si pas de traduction
    if (diffDays > 0) {
      return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    } else {
      return 'À l\'instant';
    }
  };

  // Charger les statistiques de revenus via reportsApi
  const loadRevenueStats = async (): Promise<{ current: number; previous: number }> => {
    try {
      const financialData = await reportsApi.getFinancialStats();
      const monthly = financialData.monthlyFinancials || [];
      if (monthly.length === 0) return { current: 0, previous: 0 };

      // Current month revenue = last entry
      const current = monthly[monthly.length - 1]?.revenue || 0;
      // Previous month revenue = second to last entry
      const previous = monthly.length >= 2 ? (monthly[monthly.length - 2]?.revenue || 0) : 0;

      return { current, previous };
    } catch {
      return { current: 0, previous: 0 };
    }
  };

  // Charger toutes les statistiques
  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const [propertiesStats, requestsStats, interventionsStats, revenueStats] = await Promise.all([
        loadPropertiesStats(),
        loadServiceRequestsStats(),
        loadInterventionsStats(),
        loadRevenueStats(),
      ]);

      const activities = await loadRecentActivities(userRole, user, t, limitActivities);

      const dashboardStats: DashboardStats = {
        properties: {
          active: propertiesStats.active,
          total: propertiesStats.total,
          growth: calculateGrowth(propertiesStats.active, propertiesStats.previous),
        },
        serviceRequests: {
          pending: requestsStats.pending,
          total: requestsStats.total,
          growth: calculateGrowth(requestsStats.pending, requestsStats.previous),
        },
        interventions: {
          today: interventionsStats.today,
          total: interventionsStats.total,
          growth: calculateGrowth(interventionsStats.today, interventionsStats.previous),
        },
        revenue: {
          current: revenueStats.current,
          previous: revenueStats.previous,
          growth: calculateGrowth(revenueStats.current, revenueStats.previous),
        },
      };

      setStats(dashboardStats);
      setActivities(activities);
    } catch (err) {
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [userRole, limitActivities]); // Recharger quand le rôle ou la limite change

  return {
    stats,
    activities,
    loading,
    error,
    formatGrowth,
    refreshStats: loadStats,
  };
};
