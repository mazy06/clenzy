import { useState, useEffect } from 'react';
import { API_CONFIG } from '../config/api';

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
  status: 'completed' | 'urgent' | 'scheduled' | 'pending' | 'approved' | 'created' | 'started' | 'finished';
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
    members?: number;
    urgent?: boolean;
    urgentLabel?: string;
    serviceType?: string;
    title?: string;
    desiredDate?: string;
  };
}

export const useDashboardStats = (userRole?: string, t?: (key: string, options?: any) => string) => {
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
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/properties`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const properties = data.content || data || [];
        
        // Compter les propriétés actives
        const active = properties.filter((p: any) => p.status === 'ACTIVE').length;
        const total = properties.length;
        
        // Calculer les données précédentes : propriétés créées il y a plus de 30 jours
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const previous = properties.filter((p: any) => {
          if (!p.createdAt) return false;
          const createdAt = new Date(p.createdAt);
          return createdAt < thirtyDaysAgo && p.status === 'ACTIVE';
        }).length;
        
        return { active, total, previous };
      }
      return { active: 0, total: 0, previous: 0 };
    } catch (err) {
      console.error('Erreur chargement propriétés:', err);
      return { active: 0, total: 0, previous: 0 };
    }
  };

  // Charger les statistiques des demandes de service
  const loadServiceRequestsStats = async (): Promise<{ pending: number; total: number; previous: number }> => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/service-requests`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const requests = data.content || data || [];
        
        // Compter les demandes en cours
        const pending = requests.filter((r: any) => 
          ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(r.status)
        ).length;
        const total = requests.length;
        
        // Calculer les données précédentes : demandes en cours il y a 30 jours
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const previous = requests.filter((r: any) => {
          if (!r.createdAt) return false;
          const createdAt = new Date(r.createdAt);
          return createdAt < thirtyDaysAgo && ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(r.status);
        }).length;
        
        return { pending, total, previous };
      }
      return { pending: 0, total: 0, previous: 0 };
    } catch (err) {
      console.error('Erreur chargement demandes:', err);
      return { pending: 0, total: 0, previous: 0 };
    }
  };

  // Charger les statistiques des interventions
  const loadInterventionsStats = async (): Promise<{ today: number; total: number; previous: number }> => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const interventions = data.content || data || [];
        
        // Compter les interventions d'aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayInterventions = interventions.filter((i: any) => {
          if (!i.scheduledDate) return false;
          const scheduledDate = new Date(i.scheduledDate);
          scheduledDate.setHours(0, 0, 0, 0);
          return scheduledDate.getTime() === today.getTime();
        }).length;
        
        const total = interventions.length;
        
        // Calculer les données précédentes : interventions du même jour il y a 30 jours
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const previous = interventions.filter((i: any) => {
          if (!i.scheduledDate) return false;
          const scheduledDate = new Date(i.scheduledDate);
          scheduledDate.setHours(0, 0, 0, 0);
          return scheduledDate.getTime() === thirtyDaysAgo.getTime();
        }).length;
        
        return { today: todayInterventions, total, previous };
      }
      return { today: 0, total: 0, previous: 0 };
    } catch (err) {
      console.error('Erreur chargement interventions:', err);
      return { today: 0, total: 0, previous: 0 };
    }
  };

  // Charger les activités récentes
  const loadRecentActivities = async (userRole?: string, translationFn?: (key: string, options?: any) => string): Promise<ActivityItem[]> => {
    try {
      // Combiner les données des différents endpoints pour créer des activités
      const [propertiesRes, requestsRes, interventionsRes, usersRes, teamsRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/api/properties`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}` },
        }),
        fetch(`${API_CONFIG.BASE_URL}/api/service-requests`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}` },
        }),
        fetch(`${API_CONFIG.BASE_URL}/api/interventions`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}` },
        }),
        fetch(`${API_CONFIG.BASE_URL}/api/users`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}` },
        }),
        fetch(`${API_CONFIG.BASE_URL}/api/teams`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}` },
        }),
      ]);

      const activities: ActivityItem[] = [];

      // Ajouter les propriétés récemment créées
      if (propertiesRes.ok) {
        const propertiesData = await propertiesRes.json();
        const properties = propertiesData.content || propertiesData || [];
        
        // Pour les HOST, filtrer seulement leurs propriétés
        let filteredProperties = properties;
        if (userRole === 'HOST') {
          // TODO: Filtrer par propriétés du HOST connecté
          // Pour l'instant, on prend toutes les propriétés (à adapter selon l'API)
          filteredProperties = properties;
        }
        
        filteredProperties.slice(0, 2).forEach((prop: any) => {
          activities.push({
            id: prop.id,
            type: t ? t('dashboard.activities.newPropertyCreated') : 'Nouvelle propriété créée',
            property: prop.name || (t ? t('properties.title') : 'Propriété'),
            time: formatTimeAgo(new Date(prop.createdAt || prop.updatedAt), t),
            status: 'created',
            timestamp: prop.createdAt || prop.updatedAt,
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
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        const requests = requestsData.content || requestsData || [];
        
        // Pour les HOST, filtrer seulement leurs demandes de service
        let filteredRequests = requests;
        if (userRole === 'HOST') {
          // TODO: Filtrer par propriétés du HOST connecté
          // Pour l'instant, on prend toutes les demandes (à adapter selon l'API)
          filteredRequests = requests;
        }
        
        filteredRequests.slice(0, 2).forEach((req: any) => {
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
          
          // Ajouter l'urgence si présente
          const isUrgent = req.urgent || req.priority === 'URGENT' || req.priority === 'HIGH' || req.priority === 'CRITICAL';
          let urgentLabel = '';
          if (isUrgent) {
            // Utiliser directement "Urgent" en français ou essayer de traduire
            urgentLabel = 'Urgent';
            if (t) {
              // Essayer la clé qui existe dans les fichiers de traduction
              const translated = t('serviceRequests.priorities.urgent', { defaultValue: 'Urgent' });
              // Si la traduction retourne quelque chose de valide (pas la clé elle-même)
              if (translated && translated !== 'serviceRequests.priorities.urgent') {
                urgentLabel = translated;
              }
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
          const activityDetails: any = {
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
            status: req.status?.toLowerCase() || 'pending',
            timestamp: req.createdAt,
            category: 'service-request',
            details: activityDetails
          });
        });
      }

      // Ajouter les interventions récentes
      if (interventionsRes.ok) {
        const interventionsData = await interventionsRes.json();
        const interventions = interventionsData.content || interventionsData || [];
        
        // Pour les HOST, filtrer seulement leurs interventions
        let filteredInterventions = interventions;
        if (userRole === 'HOST') {
          // TODO: Filtrer par propriétés du HOST connecté
          // Pour l'instant, on prend toutes les interventions (à adapter selon l'API)
          filteredInterventions = interventions;
        }
        
        filteredInterventions.slice(0, 2).forEach((int: any) => {
          const interventionLabel = t ? t('dashboard.activities.intervention') : 'Intervention';
          activities.push({
            id: int.id,
            type: `${interventionLabel} - ${int.type}`,
            property: int.propertyName || (t ? t('properties.title') : 'Propriété'),
            time: formatTimeAgo(new Date(int.scheduledDate || int.createdAt), t),
            status: int.status.toLowerCase(),
            timestamp: int.scheduledDate || int.createdAt,
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
        // Ajouter les nouveaux utilisateurs créés
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const users = usersData.content || usersData || [];
          
          users.slice(0, 1).forEach((user: any) => {
            activities.push({
              id: user.id,
              type: t ? t('dashboard.activities.newUserCreated') : 'Nouvel utilisateur créé',
              property: user.email || (t ? t('users.title') : 'Utilisateur'),
              time: formatTimeAgo(new Date(user.createdAt || user.updatedAt), t),
              status: 'created',
              timestamp: user.createdAt || user.updatedAt,
              category: 'user',
              details: {
                role: user.role,
                email: user.email
              }
            });
          });
        }

        // Ajouter les nouvelles équipes créées
        if (teamsRes.ok) {
          const teamsData = await teamsRes.json();
          const teams = teamsData.content || teamsData || [];
          
          teams.slice(0, 1).forEach((team: any) => {
            activities.push({
              id: team.id,
              type: t ? t('dashboard.activities.newTeamCreated') : 'Nouvelle équipe créée',
              property: team.name || (t ? t('teams.title') : 'Équipe'),
              time: formatTimeAgo(new Date(team.createdAt || team.updatedAt), t),
              status: 'created',
              timestamp: team.createdAt || team.updatedAt,
              category: 'team',
              details: {
                members: team.members?.length || 0
              }
            });
          });
        }
      }

      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
    } catch (err) {
      console.error('Erreur chargement activités:', err);
      return [];
    }
  };

  // Formater le temps écoulé
  const formatTimeAgo = (date: Date, translationFn?: (key: string, options?: any) => string): string => {
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

  // Charger toutes les statistiques
  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const [propertiesStats, requestsStats, interventionsStats] = await Promise.all([
        loadPropertiesStats(),
        loadServiceRequestsStats(),
        loadInterventionsStats(),
      ]);

      const activities = await loadRecentActivities(userRole);

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
          current: 0, // À implémenter plus tard
          previous: 0,
          growth: 0,
        },
      };

      setStats(dashboardStats);
      setActivities(activities);
    } catch (err) {
      console.error('Erreur chargement statistiques:', err);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [userRole]); // Recharger quand le rôle change

  return {
    stats,
    activities,
    loading,
    error,
    formatGrowth,
    refreshStats: loadStats,
  };
};
