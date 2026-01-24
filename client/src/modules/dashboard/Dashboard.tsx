import React, { useState, useEffect } from 'react';
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
  Alert,
  CardActionArea,
  Skeleton,
  CircularProgress
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
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import PageHeader from '../../components/PageHeader';
import { createSpacing } from '../../theme/spacing';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermissionAsync } = useAuth();
  
  // Utiliser directement les permissions de l'utilisateur (plus simple et plus rapide)
  const canViewProperties = user?.permissions?.includes('properties:view') || false;
  const canViewServiceRequests = user?.permissions?.includes('service-requests:view') || false;
  const canViewInterventions = user?.permissions?.includes('interventions:view') || false;
  const canViewTeams = user?.permissions?.includes('teams:view') || false;
  const canViewUsers = user?.permissions?.includes('users:manage') || false;
  const canViewSettings = user?.permissions?.includes('settings:view') || false;
  const canViewReports = user?.permissions?.includes('reports:view') || false;

  // Déterminer le type d'utilisateur pour personnaliser le contenu
  const isAdmin = user?.roles?.includes('ADMIN');
  const isManager = user?.roles?.includes('MANAGER');
  const isHost = user?.roles?.includes('HOST');
  const isTechnician = user?.roles?.includes('TECHNICIAN');
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER');
  const isSupervisor = user?.roles?.includes('SUPERVISOR');

  // Récupérer le rôle principal de l'utilisateur
  const getUserRole = () => {
    if (isAdmin) return 'ADMIN';
    if (isManager) return 'MANAGER';
    if (isSupervisor) return 'SUPERVISOR';
    if (isTechnician) return 'TECHNICIAN';
    if (isHousekeeper) return 'HOUSEKEEPER';
    if (isHost) return 'HOST';
    return 'USER';
  };

  const { stats, activities, loading, error, formatGrowth } = useDashboardStats(getUserRole());
  
  // Générer les statistiques dynamiques selon le rôle
  const getDynamicStats = () => {
    if (!stats) return [];

    if (isAdmin || isManager || isSupervisor) {
      // Statistiques globales (ADMIN, MANAGER, SUPERVISOR)
      return [
        {
          title: 'Propriétés actives',
          value: stats.properties.active.toString(),
          icon: <Home color="primary" />,
          growth: formatGrowth(stats.properties.growth),
          route: '/properties'
        },
        {
          title: 'Demandes en cours',
          value: stats.serviceRequests.pending.toString(),
          icon: <Assignment color="secondary" />,
          growth: formatGrowth(stats.serviceRequests.growth),
          route: '/service-requests'
        },
        {
          title: 'Interventions du jour',
          value: stats.interventions.today.toString(),
          icon: <Build color="success" />,
          growth: formatGrowth(stats.interventions.growth),
          route: '/interventions'
        },
        {
          title: 'Revenus du mois',
          value: '€0', // À implémenter plus tard
          icon: <Euro color="warning" />,
          growth: { value: '0%', type: 'neutral' },
          route: '/reports'
        },
      ];
    } else if (isHost) {
      // Statistiques pour les HOST (propriétaires)
      return [
        {
          title: 'Mes propriétés',
          value: stats.properties.active.toString(),
          icon: <Home color="primary" />,
          growth: formatGrowth(stats.properties.growth),
          route: '/properties'
        },
        {
          title: 'Mes demandes en cours',
          value: stats.serviceRequests.pending.toString(),
          icon: <Assignment color="secondary" />,
          growth: formatGrowth(stats.serviceRequests.growth),
          route: '/service-requests'
        },
        {
          title: 'Mes interventions planifiées',
          value: stats.interventions.today.toString(),
          icon: <Build color="success" />,
          growth: formatGrowth(stats.interventions.growth),
          route: '/interventions'
        },
        {
          title: 'Mes notifications',
          value: '0', // À implémenter plus tard
          icon: <Notifications color="info" />,
          growth: { value: '0%', type: 'neutral' },
          route: '/notifications'
        },
      ];
    } else if (isTechnician || isHousekeeper) {
      // Statistiques pour les TECHNICIAN/HOUSEKEEPER
      return [
        {
          title: 'Interventions assignées',
          value: stats.interventions.total.toString(),
          icon: <Build color="primary" />,
          growth: formatGrowth(stats.interventions.growth),
          route: '/interventions'
        },
        {
          title: 'Interventions terminées',
          value: '0', // À calculer plus tard
          icon: <CheckCircle color="success" />,
          growth: { value: '0%', type: 'neutral' },
          route: '/interventions'
        },
        {
          title: 'Temps de travail',
          value: '0h', // À calculer plus tard
          icon: <Assignment color="info" />,
          growth: { value: '0%', type: 'neutral' },
          route: '/reports'
        },
        {
          title: 'Équipe',
          value: 'Équipe', // À récupérer plus tard
          icon: <People color="secondary" />,
          growth: { value: 'Active', type: 'neutral' },
          route: '/teams'
        },
      ];
    }
    
    return [];
  };

  // Utiliser les activités dynamiques du hook
  const getRecentActivities = () => {
    return activities || [];
  };

  const dynamicStats = getDynamicStats();
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
    <Box>
      <PageHeader
        title={getDashboardTitle()}
        subtitle={getDashboardDescription()}
        backPath="/"
        showBackButton={false}
      />
      
      {/* Statistiques principales */}
      <Grid container spacing={3} sx={createSpacing.section()}>
        {loading ? (
          // Skeleton loading
          Array.from({ length: 4 }).map((_, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Skeleton variant="rectangular" width={48} height={48} sx={{ borderRadius: 1.5 }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" height={32} sx={{ mb: 0.5 }} />
                      <Skeleton variant="text" width="80%" height={16} sx={{ mb: 0.5 }} />
                      <Skeleton variant="text" width="40%" height={14} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : error ? (
          <Grid item xs={12}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          </Grid>
        ) : (
          dynamicStats.map((stat, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card 
                sx={{ 
                  height: '100%',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                  }
                }}
              >
                <CardActionArea onClick={() => navigate(stat.route)}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {/* Icône */}
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          minWidth: 48,
                          height: 48,
                          borderRadius: 1.5,
                          bgcolor: 'rgba(166, 192, 206, 0.1)',
                          '& .MuiSvgIcon-root': {
                            fontSize: 28,
                          }
                        }}
                      >
                        {stat.icon}
                      </Box>
                      
                      {/* Contenu principal */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="h5" 
                          component="div" 
                          sx={{ 
                            fontWeight: 700,
                            lineHeight: 1.2,
                            mb: 0.5,
                            fontSize: { xs: '1.25rem', sm: '1.5rem' }
                          }}
                        >
                          {stat.value}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          sx={{ 
                            fontSize: '0.75rem',
                            lineHeight: 1.2,
                            mb: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {stat.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {stat.growth.type === 'up' ? (
                            <TrendingUp color="success" sx={{ fontSize: 16 }} />
                          ) : stat.growth.type === 'down' ? (
                            <TrendingDown color="error" sx={{ fontSize: 16 }} />
                          ) : (
                            <Star color="info" sx={{ fontSize: 16 }} />
                          )}
                          <Typography 
                            variant="caption" 
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: stat.growth.type === 'up' 
                                ? 'success.main' 
                                : stat.growth.type === 'down' 
                                ? 'error.main' 
                                : 'text.secondary'
                            }}
                          >
                            {stat.growth.value}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Activités récentes */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={createSpacing.card()}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Activités récentes
                </Typography>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => navigate('/dashboard/activities')}
                  sx={{ textTransform: 'none' }}
                >
                  Voir toutes les activités
                </Button>
              </Box>
              {loading ? (
                // Skeleton loading pour les activités
                Array.from({ length: 3 }).map((_, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Skeleton variant="circular" width={24} height={24} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="60%" height={20} />
                        <Skeleton variant="text" width="40%" height={16} />
                      </Box>
                      <Skeleton variant="rectangular" width={60} height={24} />
                    </Box>
                  </Box>
                ))
              ) : recentActivities.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  Aucune activité récente
                </Typography>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Actions rapides selon le rôle */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={createSpacing.card()}>
              <Typography variant="h6" gutterBottom>
                Actions rapides
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {canViewProperties && (
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    fullWidth
                    onClick={() => navigate('/properties/new')}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      py: 1,
                      px: 1.5,
                      borderRadius: 1,
                      borderWidth: 1.5,
                      '&:hover': {
                        borderWidth: 1.5,
                        transform: 'translateY(-1px)',
                        boxShadow: 1,
                        transition: 'all 0.2s ease-in-out'
                      }
                    }}
                  >
                    Créer une propriété
                  </Button>
                )}

                {canViewServiceRequests && (
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    fullWidth
                    onClick={() => navigate('/service-requests/new')}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      py: 1,
                      px: 1.5,
                      borderRadius: 1,
                      borderWidth: 1.5,
                      '&:hover': {
                        borderWidth: 1.5,
                        transform: 'translateY(-1px)',
                        boxShadow: 1,
                        transition: 'all 0.2s ease-in-out'
                      }
                    }}
                  >
                    Créer une demande
                  </Button>
                )}

                {canViewInterventions && !isHost && (
                  <Button
                    variant="outlined"
                    startIcon={<Build />}
                    fullWidth
                    onClick={() => navigate('/interventions/new')}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      py: 1,
                      px: 1.5,
                      borderRadius: 1,
                      borderWidth: 1.5,
                      '&:hover': {
                        borderWidth: 1.5,
                        transform: 'translateY(-1px)',
                        boxShadow: 1,
                        transition: 'all 0.2s ease-in-out'
                      }
                    }}
                  >
                    Créer une intervention
                  </Button>
                )}

                {canViewTeams && !isHost && (
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    fullWidth
                    onClick={() => navigate('/teams/new')}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      py: 1,
                      px: 1.5,
                      borderRadius: 1,
                      borderWidth: 1.5,
                      '&:hover': {
                        borderWidth: 1.5,
                        transform: 'translateY(-1px)',
                        boxShadow: 1,
                        transition: 'all 0.2s ease-in-out'
                      }
                    }}
                  >
                    Créer une équipe
                  </Button>
                )}

                {canViewUsers && !isHost && (
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    fullWidth
                    onClick={() => navigate('/users/new')}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      py: 1,
                      px: 1.5,
                      borderRadius: 1,
                      borderWidth: 1.5,
                      '&:hover': {
                        borderWidth: 1.5,
                        transform: 'translateY(-1px)',
                        boxShadow: 1,
                        transition: 'all 0.2s ease-in-out'
                      }
                    }}
                  >
                    Créer un utilisateur
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
