import React from 'react';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Business,
  People,
  Group,
  Assignment,
  Schedule,
} from '../../icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { portfoliosApi, portfoliosKeys } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';
import StatTile from '../../components/StatTile';

// ─── Couleurs d'accent des stat tiles (hex pour StatTile color prop) ─────────

const STAT_COLORS = {
  portfolios: '#6B8A9A',  // primary — bleu-gris
  clients:    '#10b981',  // success — vert
  properties: '#0288d1',  // info — bleu
  members:    '#f59e0b',  // warning — orange
} as const;

// ─── Main component ──────────────────────────────────────────────────────────

const PortfolioStatsTab: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const statsQuery = useQuery({
    queryKey: portfoliosKeys.stats(user?.id ?? ''),
    queryFn: () => portfoliosApi.getStatsByManager(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const stats = statsQuery.data;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (statsQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (statsQuery.isError) {
    return (
      <Typography color="error" sx={{ textAlign: 'center', py: 4, fontSize: '0.85rem' }}>
        {t('portfolios.errors.connectionError')}
      </Typography>
    );
  }

  if (!stats) {
    return (
      <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4, fontSize: '0.85rem' }}>
        {t('portfolios.statistics.noDataAvailable')}
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>
        {t('portfolios.statistics.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mb: 3 }}>
        {t('portfolios.subtitle')}
      </Typography>

      {/* Stat tiles (primitive partagée) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            icon={<Business />}
            value={stats.totalPortfolios}
            label={t('portfolios.statistics.portfolios')}
            color={STAT_COLORS.portfolios}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            icon={<People />}
            value={stats.totalClients}
            label={t('portfolios.statistics.clients')}
            color={STAT_COLORS.clients}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            icon={<Assignment />}
            value={stats.totalProperties}
            label={t('portfolios.statistics.properties')}
            color={STAT_COLORS.properties}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatTile
            icon={<Group />}
            value={stats.totalTeamMembers}
            label={t('teams.members')}
            color={STAT_COLORS.members}
          />
        </Grid>
      </Grid>

      {/* Detail sections */}
      <Grid container spacing={2}>
        {/* Portfolio breakdown */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1.5 }}>
              {t('portfolios.statistics.title')}
            </Typography>
            {stats.portfolioBreakdown.length > 0 ? (
              <List disablePadding>
                {stats.portfolioBreakdown.map((portfolio, index) => (
                  <React.Fragment key={portfolio.portfolioId}>
                    <ListItem disableGutters sx={{ py: 1 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Avatar
                          sx={{
                            width: 28,
                            height: 28,
                            bgcolor: portfolio.isActive ? 'primary.main' : 'grey.400',
                          }}
                        >
                          <Business size={14} strokeWidth={1.75} />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            {portfolio.portfolioName}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              {portfolio.clientCount} client{portfolio.clientCount > 1 ? 's' : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              {portfolio.teamMemberCount} {t('portfolios.fields.members')}
                            </Typography>
                          </Box>
                        }
                      />
                      <Chip
                        label={portfolio.isActive ? t('portfolios.teamManagement.active') : t('portfolios.teamManagement.inactive')}
                        size="small"
                        color={portfolio.isActive ? 'success' : 'default'}
                        sx={{ height: 20, fontSize: '0.6rem' }}
                      />
                    </ListItem>
                    {index < stats.portfolioBreakdown.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3, fontSize: '0.82rem' }}>
                {t('portfolios.statistics.noDataAvailable')}
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Recent assignments */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1.5 }}>
              {t('portfolios.fields.associatedOn')}
            </Typography>
            {stats.recentAssignments.length > 0 ? (
              <List disablePadding>
                {stats.recentAssignments.slice(0, 5).map((assignment, index) => (
                  <React.Fragment key={assignment.id}>
                    <ListItem disableGutters sx={{ py: 1 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Avatar
                          sx={{
                            width: 28,
                            height: 28,
                            bgcolor: assignment.type === 'CLIENT' ? 'success.main' : 'info.main',
                          }}
                        >
                          {assignment.type === 'CLIENT' ? (
                            <People size={14} strokeWidth={1.75} />
                          ) : (
                            <Group size={14} strokeWidth={1.75} />
                          )}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            {assignment.name}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                              {assignment.portfolioName}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                              <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Schedule size={12} strokeWidth={1.75} /></Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                {formatDate(assignment.assignedAt)}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < Math.min(stats.recentAssignments.length, 5) - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3, fontSize: '0.82rem' }}>
                {t('portfolios.fields.noClientAssociated')}
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PortfolioStatsTab;
