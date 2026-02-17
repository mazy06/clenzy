import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Skeleton
} from '@mui/material';
import {
  Build,
  Assignment,
  Notifications,
  CheckCircle,
  HomeWork,
  RequestQuote,
  PersonAdd,
  GroupAdd
} from '@mui/icons-material';
import type { NavigateFunction } from 'react-router-dom';
import type { ActivityItem } from '../../hooks/useDashboardData';
import { PRIORITY_OPTIONS, Priority } from '../../types/statusEnums';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

interface DashboardRecentActivitiesProps {
  activities: ActivityItem[];
  loading: boolean;
  navigate: NavigateFunction;
  t: TranslationFn;
}

const DashboardRecentActivities: React.FC<DashboardRecentActivitiesProps> = ({ activities, loading, navigate, t }) => {
  return (
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
            // Skeleton loading pour les activites
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
          ) : activities.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.8125rem' }}>
              {t('dashboard.noRecentActivities')}
            </Typography>
          ) : (
            <List sx={{ py: 0 }}>
              {activities.map((activity, index) => (
                <ListItem
                  key={index}
                  sx={{
                    px: 0,
                    py: 1,
                    '&:not(:last-child)': {
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {(() => {
                      // Icones selon la categorie d'activite
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
                          {/* Construire le texte avec le badge de priorite */}
                          {(() => {
                            const urgentPattern = ` - ${activity.details.urgentLabel}`;
                            const parts = activity.type.split(urgentPattern);
                            if (parts.length === 2) {
                              // Determiner la couleur selon la priorite
                              const priorityValue = activity.details?.priority?.toUpperCase() || 'URGENT';

                              // Trouver l'option de priorite correspondante
                              const priorityOption = PRIORITY_OPTIONS.find(
                                opt => opt.value === priorityValue ||
                                (priorityValue === 'URGENT' && opt.value === Priority.CRITICAL)
                              ) || PRIORITY_OPTIONS.find(opt => opt.value === Priority.CRITICAL);

                              // Utiliser les valeurs de PRIORITY_OPTIONS pour la coherence
                              const badgeColor: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = priorityOption?.color || 'error';
                              const badgeLabel = priorityOption?.label || activity.details.urgentLabel || 'Urgent';

                              return (
                                <>
                                  <Box component="span">{parts[0]} - </Box>
                                  <Chip
                                    label={badgeLabel}
                                    size="small"
                                    variant="outlined"
                                    color={badgeColor}
                                    sx={{
                                      height: 22,
                                      fontSize: '0.6875rem',
                                      fontWeight: 600,
                                      borderWidth: 1.5,
                                      '& .MuiChip-label': { px: 0.75 },
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
                    variant="outlined"
                    sx={{ fontSize: '0.6875rem', height: 22, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
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
  );
};

export default DashboardRecentActivities;
