import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  Chip,
  Alert
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Home,
  Build,
  Assignment,
  People,
  Settings,
  Add,
  TrendingUp,
  TrendingDown,
  Euro,
  Star,
  Notifications,
  CheckCircle,
  Warning
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';

const Dashboard: React.FC = () => {
  const { user, hasPermission } = useAuth();
  
  console.log('🔍 Dashboard - Rendu du composant Dashboard');

  // Vérifier les permissions pour déterminer le contenu à afficher
  const canViewProperties = hasPermission('properties:view');
  const canViewServiceRequests = hasPermission('service-requests:view');
  const canViewInterventions = hasPermission('interventions:view');
  const canViewTeams = hasPermission('teams:view');
  const canViewUsers = hasPermission('users:manage');
  const canViewSettings = hasPermission('settings:view');
  const canViewReports = hasPermission('reports:view');

  // Déterminer le type d'utilisateur pour personnaliser le contenu
  const isAdmin = user?.roles?.includes('ADMIN');
  const isManager = user?.roles?.includes('MANAGER');
  const isHost = user?.roles?.includes('HOST');
  const isTechnician = user?.roles?.includes('TECHNICIAN');
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER');
  const isSupervisor = user?.roles?.includes('SUPERVISOR');

  // Statistiques globales (ADMIN, MANAGER, SUPERVISOR)
  const globalStats = [
    {
      title: 'Propriétés actives',
      value: '24',
      icon: <Home color="primary" />,
      growth: '+12%',
      growthType: 'up'
    },
    {
      title: 'Demandes en cours',
      value: '8',
      icon: <Assignment color="secondary" />,
      growth: '~5%',
      growthType: 'down'
    },
    {
      title: 'Interventions du jour',
      value: '12',
      icon: <Build color="success" />,
      growth: '+8%',
      growthType: 'up'
    },
    {
      title: 'Revenus du mois',
      value: '€12,450',
      icon: <Euro color="warning" />,
      growth: '+15%',
      growthType: 'up'
    },
  ];

  // Statistiques pour les HOST (propriétaires)
  const hostStats = [
    {
      title: 'Mes propriétés',
      value: '3',
      icon: <Home color="primary" />,
      growth: '+1 cette année',
      growthType: 'up'
    },
    {
      title: 'Demandes en cours',
      value: '2',
      icon: <Assignment color="secondary" />,
      growth: '1 en attente',
      growthType: 'neutral'
    },
    {
      title: 'Interventions planifiées',
      value: '5',
      icon: <Build color="success" />,
      growth: '2 cette semaine',
      growthType: 'up'
    },
    {
      title: 'Coût mensuel',
      value: '€450',
      icon: <Euro color="warning" />,
      growth: '-8% vs mois dernier',
      growthType: 'down'
    },
  ];

  // Statistiques pour les TECHNICIAN/HOUSEKEEPER
  const workerStats = [
    {
      title: 'Interventions assignées',
      value: '8',
      icon: <Build color="primary" />,
      growth: '3 aujourd\'hui',
      growthType: 'up'
    },
    {
      title: 'Interventions terminées',
      value: '15',
      icon: <CheckCircle color="success" />,
      growth: 'Cette semaine',
      growthType: 'up'
    },
    {
      title: 'Temps de travail',
      value: '32h',
      icon: <Assignment color="info" />,
      growth: 'Cette semaine',
      growthType: 'neutral'
    },
    {
      title: 'Équipe',
      value: 'Équipe Alpha',
      icon: <People color="secondary" />,
      growth: 'Active',
      growthType: 'neutral'
    },
  ];

  // Choisir les statistiques appropriées
  const getStats = () => {
    if (isAdmin || isManager || isSupervisor) {
      return globalStats;
    } else if (isHost) {
      return hostStats;
    } else if (isTechnician || isHousekeeper) {
      return workerStats;
    }
    return globalStats; // Fallback
  };

  // Activités récentes selon le rôle
  const getRecentActivities = () => {
    if (isAdmin || isManager) {
      return [
        {
          type: 'Nettoyage terminé',
          property: 'Appartement 2B - 15 rue de la Paix, Paris',
          time: 'Il y a 2 heures',
          status: 'completed'
        },
        {
          type: 'Nouvelle demande de service (urgent)',
          property: 'Réparation climatisation - Villa Sunshine',
          time: 'Il y a 4 heures',
          status: 'urgent'
        }
      ];
    } else if (isHost) {
      return [
        {
          type: 'Intervention planifiée',
          property: 'Votre appartement - 25 rue Victor Hugo',
          time: 'Demain à 9h00',
          status: 'scheduled'
        },
        {
          type: 'Demande de service approuvée',
          property: 'Votre villa - Chemin des Oliviers',
          time: 'Il y a 1 jour',
          status: 'approved'
        }
      ];
    } else if (isTechnician || isHousekeeper) {
      return [
        {
          type: 'Intervention terminée',
          property: 'Appartement 3A - Résidence du Parc',
          time: 'Il y a 1 heure',
          status: 'completed'
        },
        {
          type: 'Nouvelle intervention assignée',
          property: 'Maison 15 - Avenue des Fleurs',
          time: 'Dans 2 heures',
          status: 'assigned'
        }
      ];
    }
    return [];
  };

  const stats = getStats();
  const recentActivities = getRecentActivities();

  // Titre et description personnalisés selon le rôle
  const getDashboardTitle = () => {
    if (isAdmin) return 'Tableau de bord Administrateur';
    if (isManager) return 'Tableau de bord Manager';
    if (isHost) return 'Tableau de bord Propriétaire';
    if (isTechnician) return 'Tableau de bord Technicien';
    if (isHousekeeper) return 'Tableau de bord Agent de ménage';
    if (isSupervisor) return 'Tableau de bord Superviseur';
    return 'Tableau de bord';
  };

  const getDashboardDescription = () => {
    if (isAdmin) return 'Vue d\'ensemble complète de la plateforme Clenzy';
    if (isManager) return 'Gestion des opérations et suivi des équipes';
    if (isHost) return 'Suivi de vos propriétés et demandes de service';
    if (isTechnician) return 'Vos interventions et planification de travail';
    if (isHousekeeper) return 'Vos tâches de nettoyage et planification';
    if (isSupervisor) return 'Supervision des équipes et interventions';
    return 'Vue d\'ensemble de votre activité';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" color="primary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <DashboardIcon fontSize="large" />
          {getDashboardTitle()}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {getDashboardDescription()}
        </Typography>
      </Box>

      {/* Métriques principales */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ mb: 2 }}>
                  {stat.icon}
                </Box>
                <Typography variant="h4" component="div" sx={{ mb: 1, fontWeight: 700 }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {stat.title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  {stat.growthType === 'up' ? (
                    <TrendingUp color="success" fontSize="small" />
                  ) : stat.growthType === 'down' ? (
                    <TrendingDown color="error" fontSize="small" />
                  ) : (
                    <Star color="info" fontSize="small" />
                  )}
                  <Typography 
                    variant="caption" 
                    color={stat.growthType === 'up' ? 'success.main' : stat.growthType === 'down' ? 'error.main' : 'info.main'}
                  >
                    {stat.growth}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Activités récentes */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Activités récentes
              </Typography>
              <List>
                {recentActivities.map((activity, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon>
                      {activity.status === 'completed' ? (
                        <CheckCircle color="success" />
                      ) : activity.status === 'urgent' ? (
                        <Warning color="error" />
                      ) : activity.status === 'scheduled' ? (
                        <Assignment color="info" />
                      ) : (
                        <Notifications color="primary" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={activity.type}
                      secondary={`${activity.property} • ${activity.time}`}
                    />
                    <Chip
                      label={activity.status}
                      size="small"
                      color={
                        activity.status === 'completed' ? 'success' :
                        activity.status === 'urgent' ? 'error' :
                        activity.status === 'scheduled' ? 'info' : 'default'
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Actions rapides selon le rôle */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Actions rapides
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {canViewProperties && (
                  <Button
                    variant="outlined"
                    startIcon={<Home />}
                    fullWidth
                    onClick={() => window.location.href = '/properties'}
                  >
                    {isHost ? 'Voir mes propriétés' : 'Gérer les propriétés'}
                  </Button>
                )}
                
                {canViewServiceRequests && (
                  <Button
                    variant="outlined"
                    startIcon={<Assignment />}
                    fullWidth
                    onClick={() => window.location.href = '/service-requests'}
                  >
                    {isHost ? 'Nouvelle demande' : 'Gérer les demandes'}
                  </Button>
                )}
                
                {canViewInterventions && (
                  <Button
                    variant="outlined"
                    startIcon={<Build />}
                    fullWidth
                    onClick={() => window.location.href = '/interventions'}
                  >
                    {isTechnician || isHousekeeper ? 'Mes interventions' : 'Gérer les interventions'}
                  </Button>
                )}
                
                {canViewTeams && (
                  <Button
                    variant="outlined"
                    startIcon={<People />}
                    fullWidth
                    onClick={() => window.location.href = '/teams'}
                  >
                    Gérer les équipes
                  </Button>
                )}
                
                {canViewUsers && (
                  <Button
                    variant="outlined"
                    startIcon={<People />}
                    fullWidth
                    onClick={() => window.location.href = '/users'}
                  >
                    Gérer les utilisateurs
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
