import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
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
  GroupAdd,
  ArrowForward
} from '@mui/icons-material';
import type { NavigateFunction } from 'react-router-dom';
import type { ActivityItem } from '../../hooks/useDashboardStats';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

interface DashboardActivityFeedProps {
  activities: ActivityItem[];
  loading: boolean;
  navigate: NavigateFunction;
  t: TranslationFn;
}

/** Get icon component based on the activity category and status */
const getActivityIcon = (activity: ActivityItem) => {
  switch (activity.category) {
    case 'property':
      return <HomeWork sx={{ fontSize: 16, color: 'primary.main' }} />;
    case 'service-request':
      return <RequestQuote sx={{ fontSize: 16, color: 'secondary.main' }} />;
    case 'intervention':
      if (activity.status === 'completed') {
        return <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />;
      } else if (activity.status === 'urgent' || activity.status === 'in_progress') {
        return <Build sx={{ fontSize: 16, color: 'warning.main' }} />;
      }
      return <Assignment sx={{ fontSize: 16, color: 'info.main' }} />;
    case 'user':
      return <PersonAdd sx={{ fontSize: 16, color: 'primary.main' }} />;
    case 'team':
      return <GroupAdd sx={{ fontSize: 16, color: 'secondary.main' }} />;
    default:
      return <Notifications sx={{ fontSize: 16, color: 'primary.main' }} />;
  }
};

/** Get the chip color based on the activity status */
const getStatusColor = (status: ActivityItem['status']): 'success' | 'error' | 'info' | 'warning' | 'default' => {
  switch (status) {
    case 'completed':
    case 'finished':
      return 'success';
    case 'urgent':
      return 'error';
    case 'scheduled':
    case 'approved':
      return 'info';
    case 'in_progress':
    case 'started':
      return 'warning';
    default:
      return 'default';
  }
};

const DashboardActivityFeed: React.FC<DashboardActivityFeedProps> = ({
  activities,
  loading,
  navigate,
  t
}) => {
  return (
    <Card>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            {t('dashboard.activityFeed.title')}
          </Typography>
          <Button
            variant="text"
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
            onClick={() => navigate('/dashboard/activities')}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              py: 0.25,
              px: 0.75,
              minWidth: 'auto',
            }}
          >
            {t('dashboard.activityFeed.viewAll')}
          </Button>
        </Box>

        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Skeleton variant="circular" width={28} height={28} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="70%" height={16} />
                <Skeleton variant="text" width="50%" height={12} />
              </Box>
            </Box>
          ))
        ) : activities.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2, fontSize: '0.75rem' }}>
            {t('dashboard.activityFeed.noActivity')}
          </Typography>
        ) : (
          <Box>
            {activities.slice(0, 5).map((activity, index, arr) => (
              <Box
                key={`${activity.id}-${index}`}
                sx={{
                  display: 'flex',
                  gap: 1,
                  position: 'relative',
                }}
              >
                {/* Timeline connector and icon */}
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: 'background.paper',
                      border: '1.5px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                  >
                    {getActivityIcon(activity)}
                  </Box>
                  {index < arr.length - 1 && (
                    <Box
                      sx={{
                        width: 1.5,
                        flex: 1,
                        bgcolor: 'divider',
                        minHeight: 12,
                      }}
                    />
                  )}
                </Box>

                {/* Activity content */}
                <Box sx={{ flex: 1, pb: index < arr.length - 1 ? 1 : 0, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {activity.type}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontSize: '0.625rem',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {activity.property} &bull; {activity.time}
                      </Typography>
                    </Box>
                    <Chip
                      label={activity.status}
                      size="small"
                      color={getStatusColor(activity.status)}
                      sx={{ fontSize: '0.5625rem', height: 16, flexShrink: 0, '& .MuiChip-label': { px: 0.75 } }}
                    />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardActivityFeed;
