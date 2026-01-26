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
  Warning,
  Security as SecurityIcon,
  Group as GroupIcon,
  AccountCircle as AccountIcon,
  HomeWork,
  RequestQuote,
  PersonAdd,
  GroupAdd
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import PageHeader from '../../components/PageHeader';
import { createSpacing } from '../../theme/spacing';
import { useTranslation } from '../../hooks/useTranslation';
import UpcomingInterventions from './UpcomingInterventions';
import InterventionStatusChart from './InterventionStatusChart';
import AlertsWidget from './AlertsWidget';
import ServiceRequestsWidget from './ServiceRequestsWidget';
import { PRIORITY_OPTIONS, Priority } from '../../types/statusEnums';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  
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
  const userRole = (() => {
    if (isAdmin) return 'ADMIN';
    if (isManager) return 'MANAGER';
    if (isSupervisor) return 'SUPERVISOR';
    if (isTechnician) return 'TECHNICIAN';
    if (isHousekeeper) return 'HOUSEKEEPER';
    if (isHost) return 'HOST';
    return 'USER';
  })();

  const { stats, activities, loading, error, formatGrowth } = useDashboardStats(userRole, user, t, 4); // Limite à 4 activités pour le dashboard
  
  // Générer les statistiques dynamiques selon le rôle et les permissions
  const getDynamicStats = () => {
    if (!stats) return [];

    if (isAdmin || isManager || isSupervisor) {
      // Statistiques globales (ADMIN, MANAGER, SUPERVISOR) - nécessitent les permissions correspondantes
      const adminStats = [];
      
      if (canViewProperties) {
        adminStats.push({
          title: t('dashboard.stats.activeProperties'),
          value: stats.properties.active.toString(),
          icon: <Home color="primary" />,
          growth: formatGrowth(stats.properties.growth),
          route: '/properties'
        });
      }
      
      if (canViewServiceRequests) {
        adminStats.push({
          title: t('dashboard.stats.pendingRequests'),
          value: stats.serviceRequests.pending.toString(),
          icon: <Assignment color="secondary" />,
          growth: formatGrowth(stats.serviceRequests.growth),
          route: '/service-requests'
        });
      }
      
      if (canViewInterventions) {
        adminStats.push({
          title: t('dashboard.stats.todayInterventions'),
          value: stats.interventions.today.toString(),
          icon: <Build color="success" />,
          growth: formatGrowth(stats.interventions.growth),
          route: '/interventions'
        });
      }
      
      if (canViewReports) {
        adminStats.push({
          title: t('dashboard.stats.monthlyRevenue'),
          value: '€0', // À implémenter plus tard
          icon: <Euro color="warning" />,
          growth: { value: '0%', type: 'neutral' },
          route: '/reports'
        });
      }
      
      return adminStats;
    } else if (isHost) {
      // Statistiques pour les HOST (propriétaires) - nécessitent les permissions correspondantes
      const hostStats = [];
      
      if (canViewProperties) {
        hostStats.push({
          title: t('dashboard.stats.myProperties'),
          value: stats.properties.active.toString(),
          icon: <Home color="primary" />,
          growth: formatGrowth(stats.properties.growth),
          route: '/properties'
        });
      }
      
      if (canViewServiceRequests) {
        hostStats.push({
          title: t('dashboard.stats.myPendingRequests'),
          value: stats.serviceRequests.pending.toString(),
          icon: <Assignment color="secondary" />,
          growth: formatGrowth(stats.serviceRequests.growth),
          route: '/service-requests'
        });
      }
      
      if (canViewInterventions) {
        hostStats.push({
          title: t('dashboard.stats.myScheduledInterventions'),
          value: stats.interventions.today.toString(),
          icon: <Build color="success" />,
          growth: formatGrowth(stats.interventions.growth),
          route: '/interventions'
        });
      }
      
      // Les notifications peuvent être affichées sans permission spécifique pour les HOST
      hostStats.push({
        title: t('dashboard.stats.myNotifications'),
        value: '0', // À implémenter plus tard
        icon: <Notifications color="info" />,
        growth: { value: '0%', type: 'neutral' },
        route: '/notifications'
      });
      
      return hostStats;
    } else if (isTechnician || isHousekeeper) {
      // Statistiques pour les TECHNICIAN/HOUSEKEEPER - nécessitent les permissions correspondantes
      const workerStats = [];
      
      if (canViewInterventions) {
        workerStats.push({
          title: t('dashboard.stats.assignedInterventions'),
          value: stats.interventions.total.toString(),
          icon: <Build color="primary" />,
          growth: formatGrowth(stats.interventions.growth),
          route: '/interventions'
        });
        
        workerStats.push({
          title: t('dashboard.stats.completedInterventions'),
          value: '0', // À calculer plus tard
          icon: <CheckCircle color="success" />,
          growth: { value: '0%', type: 'neutral' },
          route: '/interventions'
        });
      }
      
      if (canViewReports) {
        workerStats.push({
          title: t('dashboard.stats.workTime'),
          value: '0h', // À calculer plus tard
          icon: <Assignment color="info" />,
          growth: { value: '0%', type: 'neutral' },
          route: '/reports'
        });
      }
      
      if (canViewTeams) {
        workerStats.push({
          title: t('dashboard.stats.team'),
          value: t('dashboard.stats.team'), // À récupérer plus tard
          icon: <People color="secondary" />,
          growth: { value: 'Active', type: 'neutral' },
          route: '/teams'
        });
      }
      
      return workerStats;
    }
    
    return [];
  };

  // Utiliser les activités dynamiques du hook (déjà limitées à 4)
  const getRecentActivities = () => {
    const limited = activities || [];
    // S'assurer qu'on ne prend que 4 activités maximum dans le dashboard
    const finalActivities = limited.slice(0, 4);
    console.log('🔍 Dashboard - Activités:', {
      recuesDuHook: limited.length,
      limitees: finalActivities.length
    });
    return finalActivities;
  };

  const dynamicStats = getDynamicStats();
  const recentActivities = getRecentActivities();

  // Titre et description personnalisés selon le rôle
  const getDashboardTitle = () => {
    if (isAdmin) return t('dashboard.titleAdmin');
    if (isManager) return t('dashboard.titleManager');
    if (isHost) return t('dashboard.titleHost');
    if (isTechnician) return t('dashboard.titleTechnician');
    if (isHousekeeper) return t('dashboard.titleHousekeeper');
    if (isSupervisor) return t('dashboard.titleSupervisor');
    return t('dashboard.title');
  };

  const getDashboardDescription = () => {
    if (isAdmin) return t('dashboard.subtitleAdmin');
    if (isManager) return t('dashboard.subtitleManager');
    if (isHost) return t('dashboard.subtitleHost');
    if (isTechnician) return t('dashboard.subtitleTechnician');
    if (isHousekeeper) return t('dashboard.subtitleHousekeeper');
    if (isSupervisor) return t('dashboard.subtitleSupervisor');
    return t('dashboard.subtitle');
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
      <Grid container spacing={2} sx={{ mb: 2 }}> {/* spacing: 3 → 2, mb réduit */}
        {loading ? (
          // Skeleton loading
          Array.from({ length: 4 }).map((_, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Skeleton variant="rectangular" width={40} height={40} sx={{ borderRadius: 1 }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" height={24} sx={{ mb: 0.25 }} />
                      <Skeleton variant="text" width="80%" height={14} sx={{ mb: 0.25 }} />
                      <Skeleton variant="text" width="40%" height={12} />
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
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}> {/* p: 2 → 1.5 */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}> {/* gap: 2 → 1.5 */}
                      {/* Icône */}
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          minWidth: 40, // 48 → 40
                          height: 40, // 48 → 40
                          borderRadius: 1,
                          bgcolor: 'rgba(166, 192, 206, 0.1)',
                          '& .MuiSvgIcon-root': {
                            fontSize: 24, // 28 → 24
                          }
                        }}
                      >
                        {stat.icon}
                      </Box>
                      
                      {/* Contenu principal */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="h6" // h5 → h6
                          component="div" 
                          sx={{ 
                            fontWeight: 700,
                            lineHeight: 1.2,
                            mb: 0.25, // 0.5 → 0.25
                            fontSize: { xs: '1rem', sm: '1.125rem' } // Réduit
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
                            mb: 0.25, // 0.5 → 0.25
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {stat.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {stat.growth.type === 'up' ? (
                            <TrendingUp color="success" sx={{ fontSize: 14 }} />
                          ) : stat.growth.type === 'down' ? (
                            <TrendingDown color="error" sx={{ fontSize: 14 }} />
                          ) : (
                            <Star color="info" sx={{ fontSize: 14 }} />
                          )}
                          <Typography 
                            variant="caption" 
                            sx={{
                              fontSize: '0.6875rem',
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

      {/* Activités récentes - affichées seulement si l'utilisateur a au moins une permission */}
      {(canViewProperties || canViewServiceRequests || canViewInterventions || canViewTeams) && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                    {t('dashboard.recentActivities')}
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => navigate('/dashboard/activities')}
                    sx={{ 
                      textTransform: 'none',
                      fontSize: '0.8125rem',
                      py: 0.5,
                      px: 1
                    }}
                  >
                    {t('dashboard.viewAllActivities')}
                  </Button>
                </Box>
              {loading ? (
                // Skeleton loading pour les activités
                Array.from({ length: 3 }).map((_, index) => (
                  <Box key={index} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Skeleton variant="circular" width={20} height={20} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="60%" height={16} />
                        <Skeleton variant="text" width="40%" height={14} />
                      </Box>
                      <Skeleton variant="rectangular" width={50} height={20} />
                    </Box>
                  </Box>
                ))
              ) : recentActivities.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.8125rem' }}>
                  {t('dashboard.noRecentActivities')}
                </Typography>
              ) : (
                <List sx={{ py: 0 }}>
                  {recentActivities.map((activity, index) => (
                    <ListItem 
                      key={index} 
                      sx={{ 
                        px: 0,
                        py: 1, // Padding vertical réduit
                        '&:not(:last-child)': {
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {(() => {
                          // Icônes selon la catégorie d'activité
                          switch (activity.category) {
                            case 'property':
                              return <HomeWork color="primary" sx={{ fontSize: '20px' }} />;
                            case 'service-request':
                              return <RequestQuote color="secondary" sx={{ fontSize: '20px' }} />;
                            case 'intervention':
                              if (activity.status === 'completed') {
                                return <CheckCircle color="success" sx={{ fontSize: '20px' }} />;
                              } else if (activity.status === 'urgent' || activity.status === 'in_progress') {
                                return <Build color="warning" sx={{ fontSize: '20px' }} />;
                              } else {
                                return <Assignment color="info" sx={{ fontSize: '20px' }} />;
                              }
                            case 'user':
                              return <PersonAdd color="primary" sx={{ fontSize: '20px' }} />;
                            case 'team':
                              return <GroupAdd color="secondary" sx={{ fontSize: '20px' }} />;
                            default:
                              return <Notifications color="primary" sx={{ fontSize: '20px' }} />;
                          }
                        })()}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          activity.category === 'service-request' && activity.details?.urgent ? (
                            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              {/* Construire le texte avec le badge de priorité */}
                              {(() => {
                                const urgentPattern = ` - ${activity.details.urgentLabel}`;
                                const parts = activity.type.split(urgentPattern);
                                if (parts.length === 2) {
                                  // Déterminer la couleur selon la priorité
                                  const priorityValue = activity.details?.priority?.toUpperCase() || 'URGENT';
                                  
                                  // Trouver l'option de priorité correspondante
                                  const priorityOption = PRIORITY_OPTIONS.find(
                                    opt => opt.value === priorityValue || 
                                    (priorityValue === 'URGENT' && opt.value === Priority.CRITICAL)
                                  ) || PRIORITY_OPTIONS.find(opt => opt.value === Priority.CRITICAL);
                                  
                                  // Utiliser les valeurs de PRIORITY_OPTIONS pour la cohérence
                                  const badgeColor = priorityOption?.color || 'error';
                                  const badgeLabel = priorityOption?.label || activity.details.urgentLabel || 'Urgent';
                                  
                                  return (
                                    <>
                                      <Box component="span">{parts[0]} - </Box>
                                      <Chip
                                        label={badgeLabel}
                                        size="small"
                                        color={badgeColor as any}
                                        sx={{ 
                                          height: 20, 
                                          fontSize: '0.6875rem',
                                          fontWeight: 600
                                        }}
                                      />
                                      <Box component="span">{parts[1]}</Box>
                                    </>
                                  );
                                }
                                return activity.type;
                              })()}
                            </Box>
                          ) : (
                            activity.type
                          )
                        }
                        secondary={`${activity.property} • ${activity.time}`}
                        primaryTypographyProps={{
                          sx: { fontSize: '0.875rem', fontWeight: 500 }
                        }}
                        secondaryTypographyProps={{
                          sx: { fontSize: '0.75rem' }
                        }}
                      />
                      <Chip
                        label={activity.status}
                        size="small"
                        sx={{ fontSize: '0.6875rem', height: 20 }}
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

        {/* Actions rapides selon le rôle - affichées seulement si l'utilisateur a au moins une permission */}
        {(canViewProperties || canViewServiceRequests || canViewInterventions || canViewTeams || canViewUsers || canViewSettings) && (
          <Grid item xs={12} md={4}>
            <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1.5 }}>
                {t('dashboard.quickActions')}
              </Typography>
              
              {/* Tous les boutons sur deux colonnes */}
              <Grid container spacing={1.5}>
                {canViewProperties && (
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      startIcon={<Add sx={{ fontSize: '18px' }} />}
                      fullWidth
                      onClick={() => navigate('/properties/new')}
                      sx={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        py: 0.75,
                        px: 1.25,
                        borderRadius: 1,
                        borderWidth: 1.5,
                        fontSize: '0.8125rem',
                        minHeight: 36,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        '& .MuiButton-startIcon': {
                          marginRight: 0.75,
                          flexShrink: 0
                        },
                        '&:hover': {
                          borderWidth: 1.5,
                          transform: 'translateY(-1px)',
                          boxShadow: 1,
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                    >
                      {t('dashboard.createProperty')}
                    </Button>
                  </Grid>
                )}

                {canViewServiceRequests && (
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      startIcon={<Add sx={{ fontSize: '18px' }} />}
                      fullWidth
                      onClick={() => navigate('/service-requests/new')}
                      sx={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        py: 0.75,
                        px: 1.25,
                        borderRadius: 1,
                        borderWidth: 1.5,
                        fontSize: '0.8125rem',
                        minHeight: 36,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        '& .MuiButton-startIcon': {
                          marginRight: 0.75,
                          flexShrink: 0
                        },
                        '&:hover': {
                          borderWidth: 1.5,
                          transform: 'translateY(-1px)',
                          boxShadow: 1,
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                    >
                      {t('dashboard.createRequest')}
                    </Button>
                  </Grid>
                )}

                {canViewTeams && !isHost && (
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      startIcon={<Add sx={{ fontSize: '18px' }} />}
                      fullWidth
                      onClick={() => navigate('/teams/new')}
                      sx={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        py: 0.75,
                        px: 1.25,
                        borderRadius: 1,
                        borderWidth: 1.5,
                        fontSize: '0.8125rem',
                        minHeight: 36,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        '& .MuiButton-startIcon': {
                          marginRight: 0.75,
                          flexShrink: 0
                        },
                        '&:hover': {
                          borderWidth: 1.5,
                          transform: 'translateY(-1px)',
                          boxShadow: 1,
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                    >
                      {t('dashboard.createTeam')}
                    </Button>
                  </Grid>
                )}

                {canViewUsers && !isHost && (
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      startIcon={<Add sx={{ fontSize: '18px' }} />}
                      fullWidth
                      onClick={() => navigate('/users/new')}
                      sx={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        py: 0.75,
                        px: 1.25,
                        borderRadius: 1,
                        borderWidth: 1.5,
                        fontSize: '0.8125rem',
                        minHeight: 36,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        '& .MuiButton-startIcon': {
                          marginRight: 0.75,
                          flexShrink: 0
                        },
                        '&:hover': {
                          borderWidth: 1.5,
                          transform: 'translateY(-1px)',
                          boxShadow: 1,
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                    >
                      {t('dashboard.createUser')}
                    </Button>
                  </Grid>
                )}

                {canViewTeams && (
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      startIcon={<GroupIcon sx={{ fontSize: '18px' }} />}
                      fullWidth
                      onClick={() => navigate('/teams')}
                      sx={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        py: 0.75,
                        px: 1.25,
                        borderRadius: 1,
                        borderWidth: 1.5,
                        fontSize: '0.8125rem',
                        minHeight: 36,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        '& .MuiButton-startIcon': {
                          marginRight: 0.75,
                          flexShrink: 0
                        },
                        '&:hover': {
                          borderWidth: 1.5,
                          transform: 'translateY(-1px)',
                          boxShadow: 1,
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                    >
                      {t('dashboard.manageTeams')}
                    </Button>
                  </Grid>
                )}

                {canViewSettings && (
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      startIcon={<Settings sx={{ fontSize: '18px' }} />}
                      fullWidth
                      onClick={() => navigate('/settings')}
                      sx={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        py: 0.75,
                        px: 1.25,
                        borderRadius: 1,
                        borderWidth: 1.5,
                        fontSize: '0.8125rem',
                        minHeight: 36,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        '& .MuiButton-startIcon': {
                          marginRight: 0.75,
                          flexShrink: 0
                        },
                        '&:hover': {
                          borderWidth: 1.5,
                          transform: 'translateY(-1px)',
                          boxShadow: 1,
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                    >
                      {t('dashboard.systemSettings')}
                    </Button>
                  </Grid>
                )}

                {isAdmin && (
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      startIcon={<SecurityIcon sx={{ fontSize: '18px' }} />}
                      fullWidth
                      onClick={() => navigate('/admin/monitoring')}
                      sx={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        py: 0.75,
                        px: 1.25,
                        borderRadius: 1,
                        borderWidth: 1.5,
                        fontSize: '0.8125rem',
                        minHeight: 36,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        '& .MuiButton-startIcon': {
                          marginRight: 0.75,
                          flexShrink: 0
                        },
                        '&:hover': {
                          borderWidth: 1.5,
                          transform: 'translateY(-1px)',
                          boxShadow: 1,
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                    >
                      {t('dashboard.tokenMonitoring')}
                    </Button>
                  </Grid>
                )}

                {canViewUsers && (
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      startIcon={<AccountIcon sx={{ fontSize: '18px' }} />}
                      fullWidth
                      onClick={() => navigate('/users')}
                      sx={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        py: 0.75,
                        px: 1.25,
                        borderRadius: 1,
                        borderWidth: 1.5,
                        fontSize: '0.8125rem',
                        minHeight: 36,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        '& .MuiButton-startIcon': {
                          marginRight: 0.75,
                          flexShrink: 0
                        },
                        '&:hover': {
                          borderWidth: 1.5,
                          transform: 'translateY(-1px)',
                          boxShadow: 1,
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                    >
                      {t('dashboard.userManagement')}
                    </Button>
                  </Grid>
                )}
              </Grid>

              {/* Boutons Create Intervention et Manage Permissions en une seule colonne à la fin */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.5 }}>
                {/* Seuls les ADMIN et MANAGER peuvent créer des interventions manuellement */}
                {canViewInterventions && (isAdmin || isManager) && (
                  <Button
                    variant="outlined"
                    startIcon={<Build sx={{ fontSize: '18px' }} />}
                    fullWidth
                    onClick={() => navigate('/interventions/new')}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      py: 0.75,
                      px: 1.25,
                      borderRadius: 1,
                      borderWidth: 1.5,
                      fontSize: '0.8125rem',
                      minHeight: 36,
                      '&:hover': {
                        borderWidth: 1.5,
                        transform: 'translateY(-1px)',
                        boxShadow: 1,
                        transition: 'all 0.2s ease-in-out'
                      }
                    }}
                  >
                    {t('dashboard.createIntervention')}
                  </Button>
                )}

                {isAdmin && (
                  <Button
                    variant="outlined"
                    startIcon={<SecurityIcon sx={{ fontSize: '18px' }} />}
                    fullWidth
                    onClick={() => navigate('/permissions-test')}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      py: 0.75,
                      px: 1.25,
                      borderRadius: 1,
                      borderWidth: 1.5,
                      fontSize: '0.8125rem',
                      minHeight: 36,
                      '&:hover': {
                        borderWidth: 1.5,
                        transform: 'translateY(-1px)',
                        boxShadow: 1,
                        transition: 'all 0.2s ease-in-out'
                      }
                    }}
                  >
                    {t('dashboard.managePermissions')}
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        )}
        </Grid>
      )}

      {(canViewInterventions || canViewServiceRequests || isAdmin || isManager) && (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          {/* Interventions à venir - nécessite interventions:view */}
          {canViewInterventions && (
            <Grid item xs={12} md={6}>
              <UpcomingInterventions />
            </Grid>
          )}

          {/* Demandes de service - nécessite service-requests:view */}
          {canViewServiceRequests && (
            <Grid item xs={12} md={6}>
              <ServiceRequestsWidget />
            </Grid>
          )}

          {/* Alertes - nécessite interventions:view pour les alertes d'interventions */}
          {canViewInterventions && (
            <Grid item xs={12} md={12}>
              <AlertsWidget />
            </Grid>
          )}
        </Grid>
      )}

      {/* Message si l'utilisateur n'a aucune permission */}
      {!canViewProperties && !canViewServiceRequests && !canViewInterventions && !canViewTeams && !canViewUsers && !canViewSettings && !canViewReports && (
        <Card sx={{ mt: 2 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {t('dashboard.noPermissions')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.noPermissionsMessage')}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Dashboard;
