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
  };
}

export const useDashboardStats = () => {
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
        
        // Pour l'instant, on simule les données précédentes (à remplacer par l'API)
        const previous = Math.max(0, total - Math.floor(Math.random() * 5));
        
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
        
        // Pour l'instant, on simule les données précédentes
        const previous = Math.max(0, total - Math.floor(Math.random() * 3));
        
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
        const todayInterventions = interventions.filter((i: any) => {
          if (!i.scheduledDate) return false;
          const scheduledDate = new Date(i.scheduledDate);
          return scheduledDate.toDateString() === today.toDateString();
        }).length;
        
        const total = interventions.length;
        
        // Pour l'instant, on simule les données précédentes
        const previous = Math.max(0, total - Math.floor(Math.random() * 4));
        
        return { today: todayInterventions, total, previous };
      }
      return { today: 0, total: 0, previous: 0 };
    } catch (err) {
      console.error('Erreur chargement interventions:', err);
      return { today: 0, total: 0, previous: 0 };
    }
  };

  // Charger les activités récentes
  const loadRecentActivities = async (): Promise<ActivityItem[]> => {
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
        
        properties.slice(0, 2).forEach((prop: any) => {
          activities.push({
            id: prop.id,
            type: 'Nouvelle propriété créée',
            property: prop.name || 'Propriété',
            time: formatTimeAgo(new Date(prop.createdAt || prop.updatedAt)),
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
        
        requests.slice(0, 2).forEach((req: any) => {
          activities.push({
            id: req.id,
            type: `Demande de service - ${req.type}`,
            property: req.propertyName || 'Propriété',
            time: formatTimeAgo(new Date(req.createdAt)),
            status: req.status.toLowerCase(),
            timestamp: req.createdAt,
            category: 'service-request',
            details: {
              requestor: req.requestorName,
              priority: req.priority
            }
          });
        });
      }

      // Ajouter les interventions récentes
      if (interventionsRes.ok) {
        const interventionsData = await interventionsRes.json();
        const interventions = interventionsData.content || interventionsData || [];
        
        interventions.slice(0, 2).forEach((int: any) => {
          activities.push({
            id: int.id,
            type: `Intervention - ${int.type}`,
            property: int.propertyName || 'Propriété',
            time: formatTimeAgo(new Date(int.scheduledDate || int.createdAt)),
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

      // Ajouter les nouveaux utilisateurs créés
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const users = usersData.content || usersData || [];
        
        users.slice(0, 1).forEach((user: any) => {
          activities.push({
            id: user.id,
            type: 'Nouvel utilisateur créé',
            property: `${user.firstName} ${user.lastName}`,
            time: formatTimeAgo(new Date(user.createdAt)),
            status: 'created',
            timestamp: user.createdAt,
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
            type: 'Nouvelle équipe créée',
            property: team.name || 'Équipe',
            time: formatTimeAgo(new Date(team.createdAt)),
            status: 'created',
            timestamp: team.createdAt,
            category: 'team',
            details: {
              members: team.members?.length || 0,
              type: team.type
            }
          });
        });
      }

      // Trier par timestamp et limiter à 5 activités
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
    } catch (err) {
      console.error('Erreur chargement activités:', err);
      return [];
    }
  };

  // Formater le temps écoulé
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

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

      const activities = await loadRecentActivities();

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
  }, []);

  return {
    stats,
    activities,
    loading,
    error,
    formatGrowth,
    refreshStats: loadStats,
  };
};
