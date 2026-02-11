import React from 'react';
import {
  Box,
  Typography,
  Grid,
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

/** Common button style shared across all quick action buttons */
const quickActionButtonSx = {
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
} as const;

/** Simplified button style for full-width buttons (no text truncation props) */
const fullWidthButtonSx = {
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

const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
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
                  sx={quickActionButtonSx}
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
                  sx={quickActionButtonSx}
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
                  sx={quickActionButtonSx}
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
                  sx={quickActionButtonSx}
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
                  sx={quickActionButtonSx}
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
                  sx={quickActionButtonSx}
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
                  sx={quickActionButtonSx}
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
                  sx={quickActionButtonSx}
                >
                  {t('dashboard.userManagement')}
                </Button>
              </Grid>
            )}

            {/* Seuls les ADMIN et MANAGER peuvent créer des interventions manuellement */}
            {canViewInterventions && (isAdmin || isManager) && (
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  startIcon={<Build sx={{ fontSize: '18px' }} />}
                  fullWidth
                  onClick={() => navigate('/interventions/new')}
                  sx={quickActionButtonSx}
                >
                  {t('dashboard.createIntervention')}
                </Button>
              </Grid>
            )}

            {isAdmin && (
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  startIcon={<SecurityIcon sx={{ fontSize: '18px' }} />}
                  fullWidth
                  onClick={() => navigate('/permissions-test')}
                  sx={quickActionButtonSx}
                >
                  {t('dashboard.managePermissions')}
                </Button>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    </Grid>
  );
};

export default DashboardQuickActions;
