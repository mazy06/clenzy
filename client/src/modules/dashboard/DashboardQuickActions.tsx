import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button
} from '@mui/material';
import {
  Add,
  Settings,
  Build,
  Security as SecurityIcon,
  Group as GroupIcon,
  AccountCircle as AccountIcon
} from '@mui/icons-material';
import type { NavigateFunction } from 'react-router-dom';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

// ─── Stable sx constants ────────────────────────────────────────────────────

const CARD_CONTENT_SX = { p: 1.25, '&:last-child': { pb: 1.25 } } as const;

const SECTION_TITLE_SX = {
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'text.secondary',
  mb: 0.75,
} as const;

/** Common button style shared across all quick action buttons */
const quickActionButtonSx = {
  justifyContent: 'flex-start',
  textAlign: 'left',
  py: 0.375,
  px: 1,
  borderRadius: 1,
  borderWidth: 1,
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  minHeight: 30,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '& .MuiButton-startIcon': {
    marginRight: 0.5,
    flexShrink: 0,
    '& .MuiSvgIcon-root': { fontSize: '16px' },
  },
  '&:hover': {
    borderWidth: 1,
    backgroundColor: 'rgba(107, 138, 154, 0.06)',
  },
} as const;

interface DashboardQuickActionsProps {
  canViewProperties: boolean;
  canViewServiceRequests: boolean;
  canViewInterventions: boolean;
  canViewTeams: boolean;
  canViewUsers: boolean;
  canViewSettings: boolean;
  isAdmin: boolean | undefined;
  isManager: boolean | undefined;
  isHost: boolean | undefined;
  navigate: NavigateFunction;
  t: TranslationFn;
}

const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = React.memo(({
  canViewProperties,
  canViewServiceRequests,
  canViewInterventions,
  canViewTeams,
  canViewUsers,
  canViewSettings,
  isAdmin,
  isManager,
  isHost,
  navigate,
  t
}) => {
  // Ne rien afficher si aucune permission
  if (!canViewProperties && !canViewServiceRequests && !canViewInterventions && !canViewTeams && !canViewUsers && !canViewSettings) {
    return null;
  }

  return (
    <Card>
      <CardContent sx={CARD_CONTENT_SX}>
        <Typography variant="subtitle2" sx={SECTION_TITLE_SX}>
          {t('dashboard.quickActions')}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375, overflow: 'auto' }}>
          {canViewProperties && (
            <Button
              variant="outlined"
              startIcon={<Add />}
              fullWidth
              onClick={() => navigate('/properties/new')}
              sx={quickActionButtonSx}
            >
              {t('dashboard.createProperty')}
            </Button>
          )}

          {canViewServiceRequests && (
            <Button
              variant="outlined"
              startIcon={<Add />}
              fullWidth
              onClick={() => navigate('/service-requests/new')}
              sx={quickActionButtonSx}
            >
              {t('dashboard.createRequest')}
            </Button>
          )}

          {canViewTeams && !isHost && (
            <Button
              variant="outlined"
              startIcon={<Add />}
              fullWidth
              onClick={() => navigate('/teams/new')}
              sx={quickActionButtonSx}
            >
              {t('dashboard.createTeam')}
            </Button>
          )}

          {canViewUsers && !isHost && (
            <Button
              variant="outlined"
              startIcon={<Add />}
              fullWidth
              onClick={() => navigate('/users/new')}
              sx={quickActionButtonSx}
            >
              {t('dashboard.createUser')}
            </Button>
          )}

          {canViewTeams && (
            <Button
              variant="outlined"
              startIcon={<GroupIcon />}
              fullWidth
              onClick={() => navigate('/teams')}
              sx={quickActionButtonSx}
            >
              {t('dashboard.manageTeams')}
            </Button>
          )}

          {canViewSettings && (
            <Button
              variant="outlined"
              startIcon={<Settings />}
              fullWidth
              onClick={() => navigate('/settings')}
              sx={quickActionButtonSx}
            >
              {t('dashboard.systemSettings')}
            </Button>
          )}

          {isAdmin && (
            <Button
              variant="outlined"
              startIcon={<SecurityIcon />}
              fullWidth
              onClick={() => navigate('/admin/monitoring')}
              sx={quickActionButtonSx}
            >
              {t('dashboard.tokenMonitoring')}
            </Button>
          )}

          {canViewUsers && (
            <Button
              variant="outlined"
              startIcon={<AccountIcon />}
              fullWidth
              onClick={() => navigate('/users')}
              sx={quickActionButtonSx}
            >
              {t('dashboard.userManagement')}
            </Button>
          )}

          {canViewInterventions && (isAdmin || isManager) && (
            <Button
              variant="outlined"
              startIcon={<Build />}
              fullWidth
              onClick={() => navigate('/interventions/new')}
              sx={quickActionButtonSx}
            >
              {t('dashboard.createIntervention')}
            </Button>
          )}

          {isAdmin && (
            <Button
              variant="outlined"
              startIcon={<SecurityIcon />}
              fullWidth
              onClick={() => navigate('/permissions-test')}
              sx={quickActionButtonSx}
            >
              {t('dashboard.managePermissions')}
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
});

DashboardQuickActions.displayName = 'DashboardQuickActions';

export default DashboardQuickActions;
