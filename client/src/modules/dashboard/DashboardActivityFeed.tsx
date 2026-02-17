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
import type { ActivityItem } from '../../hooks/useDashboardOverview';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

interface DashboardActivityFeedProps {
  activities: ActivityItem[];
  loading: boolean;
  navigate: NavigateFunction;
  t: TranslationFn;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const CARD_CONTENT_SX = {
  p: 1.25, '&:last-child': { pb: 1.25 },
  flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
} as const;

const SECTION_TITLE_SX = {
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'text.secondary',
} as const;

const VIEW_ALL_SX = {
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
  py: 0.25,
  px: 0.75,
  minWidth: 'auto',
  letterSpacing: '0.01em',
} as const;

const ICON_SIZE = 16;

const TIMELINE_DOT_SX = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1,
} as const;

const ITEM_TITLE_SX = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  lineHeight: 1.4,
  letterSpacing: '-0.01em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

const ITEM_SUB_SX = {
  fontSize: '0.6875rem',
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  letterSpacing: '0.01em',
} as const;

const STATUS_CHIP_SX = {
  fontSize: '0.625rem',
  height: 22,
  flexShrink: 0,
  borderWidth: 1,
  letterSpacing: '0.02em',
  textTransform: 'uppercase' as const,
  '& .MuiChip-label': { px: 0.625 },
} as const;

/** Get icon component based on the activity category and status */
const getActivityIcon = (activity: ActivityItem) => {
  switch (activity.category) {
    case 'property':
      return <HomeWork sx={{ fontSize: ICON_SIZE, color: 'primary.main' }} />;
    case 'service-request':
      return <RequestQuote sx={{ fontSize: ICON_SIZE, color: 'secondary.main' }} />;
    case 'intervention':
      if (activity.status === 'completed') {
        return <CheckCircle sx={{ fontSize: ICON_SIZE, color: 'success.main' }} />;
      } else if (activity.status === 'urgent' || activity.status === 'in_progress') {
        return <Build sx={{ fontSize: ICON_SIZE, color: 'warning.main' }} />;
      }
      return <Assignment sx={{ fontSize: ICON_SIZE, color: 'info.main' }} />;
    case 'user':
      return <PersonAdd sx={{ fontSize: ICON_SIZE, color: 'primary.main' }} />;
    case 'team':
      return <GroupAdd sx={{ fontSize: ICON_SIZE, color: 'secondary.main' }} />;
    default:
      return <Notifications sx={{ fontSize: ICON_SIZE, color: 'primary.main' }} />;
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

const DashboardActivityFeed: React.FC<DashboardActivityFeedProps> = React.memo(({
  activities,
  loading,
  navigate,
  t
}) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={CARD_CONTENT_SX}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={SECTION_TITLE_SX}>
            {t('dashboard.activityFeed.title')}
          </Typography>
          <Button
            variant="text"
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: 12 }} />}
            onClick={() => navigate('/dashboard/activities')}
            sx={VIEW_ALL_SX}
          >
            {t('dashboard.activityFeed.viewAll')}
          </Button>
        </Box>

        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 0.75, mb: 0.75 }}>
              <Skeleton variant="circular" width={26} height={26} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="70%" height={14} />
                <Skeleton variant="text" width="50%" height={10} />
              </Box>
            </Box>
          ))
        ) : activities.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2, fontSize: '0.75rem' }}>
            {t('dashboard.activityFeed.noActivity')}
          </Typography>
        ) : (
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {activities.slice(0, 4).map((activity, index, arr) => (
              <Box
                key={`${activity.id}-${index}`}
                sx={{ display: 'flex', gap: 0.75, position: 'relative' }}
              >
                {/* Timeline connector and icon */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <Box sx={TIMELINE_DOT_SX}>
                    {getActivityIcon(activity)}
                  </Box>
                  {index < arr.length - 1 && (
                    <Box sx={{ width: 1, flex: 1, bgcolor: 'divider', minHeight: 10 }} />
                  )}
                </Box>

                {/* Activity content */}
                <Box sx={{ flex: 1, pb: index < arr.length - 1 ? 0.5 : 0, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={ITEM_TITLE_SX}>
                        {activity.type}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={ITEM_SUB_SX}>
                        {activity.property} &bull; {activity.time}
                      </Typography>
                    </Box>
                    <Chip
                      label={activity.status}
                      size="small"
                      variant="outlined"
                      color={getStatusColor(activity.status)}
                      sx={STATUS_CHIP_SX}
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
});

DashboardActivityFeed.displayName = 'DashboardActivityFeed';

export default DashboardActivityFeed;
