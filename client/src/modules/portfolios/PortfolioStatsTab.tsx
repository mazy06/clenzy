import React from 'react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Grid, List, ListItem, ListItemText, ListItemIcon, Divider, Avatar, Chip } from '@mui/material';
import {
  Business,
  People,
  Group,
  Assignment,
  Schedule,
} from '../../icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { portfoliosApi, portfoliosKeys } from '../../services/api/portfoliosApi';
import { useTranslation } from '../../hooks/useTranslation';
import StatTile from '../../components/StatTile';

// ─── Couleurs d'accent des stat tiles (hex pour StatTile color prop) ─────────

const STAT_COLORS = {
  portfolios: '#6B8A9A',  // primary — bleu-gris
  clients:    '#4A9B8E',  // success — vert desature (palette validee)
  properties: '#7BA3C2',  // info — bleu desature (palette validee)
  members:    '#D4A574',  // warning — ambre desature (palette validee)
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
      <div className="flex justify-center items-center min-h-[200px]">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (statsQuery.isError) {
    return (
      <p className="cn-text-body1 text-destructive text-center py-6 text-[0.85rem]">
        {t('portfolios.errors.connectionError')}
      </p>
    );
  }

  if (!stats) {
    return (
      <p className="cn-text-body1 text-muted-foreground text-center py-6 text-[0.85rem]">
        {t('portfolios.statistics.noDataAvailable')}
      </p>
    );
  }

  return (
    <div>
      <h6 className="cn-text-subtitle1 font-semibold text-[0.95rem] mb-0.5">
        {t('portfolios.statistics.title')}
      </h6>
      <p className="cn-text-body2 text-muted-foreground text-[0.82rem] mb-4">
        {t('portfolios.subtitle')}
      </p>

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
          <Card className="gap-0 py-0 p-3.5 h-full">
            <h6 className="cn-text-subtitle1 font-semibold text-[0.9rem] mb-2">
              {t('portfolios.statistics.title')}
            </h6>
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
                            bgcolor: portfolio.isActive ? 'var(--accent-soft)' : 'var(--hover)',
                            color: portfolio.isActive ? 'var(--accent)' : 'var(--muted)',
                            borderRadius: '8px',
                          }}
                        >
                          <Business size={14} strokeWidth={1.75} />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <h6 className="cn-text-subtitle2 text-[0.82rem] font-semibold">
                            {portfolio.portfolioName}
                          </h6>
                        }
                        secondary={
                          <div className="flex gap-2 mt-0.5">
                            <span className="cn-text-caption text-muted-foreground text-[0.7rem]">
                              {portfolio.clientCount} client{portfolio.clientCount > 1 ? 's' : ''}
                            </span>
                            <span className="cn-text-caption text-muted-foreground text-[0.7rem]">
                              {portfolio.teamMemberCount} {t('portfolios.fields.members')}
                            </span>
                          </div>
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
              <p className="cn-text-body2 text-muted-foreground text-center py-4 text-[0.82rem]">
                {t('portfolios.statistics.noDataAvailable')}
              </p>
            )}
          </Card>
        </Grid>

        {/* Recent assignments */}
        <Grid item xs={12} md={6}>
          <Card className="gap-0 py-0 p-3.5 h-full">
            <h6 className="cn-text-subtitle1 font-semibold text-[0.9rem] mb-2">
              {t('portfolios.fields.associatedOn')}
            </h6>
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
                            bgcolor: assignment.type === 'CLIENT' ? 'var(--ok-soft)' : 'var(--info-soft)',
                            color: assignment.type === 'CLIENT' ? 'var(--ok)' : 'var(--info)',
                            borderRadius: '8px',
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
                          <h6 className="cn-text-subtitle2 text-[0.82rem] font-semibold">
                            {assignment.name}
                          </h6>
                        }
                        secondary={
                          <div>
                            <span className="cn-text-caption text-muted-foreground block text-[0.7rem]">
                              {assignment.portfolioName}
                            </span>
                            <div className="flex items-center gap-0.5 mt-0.5">
                              <span className="inline-flex text-muted-foreground"><Schedule size={12} strokeWidth={1.75} /></span>
                              <span className="cn-text-caption text-muted-foreground text-[0.65rem]">
                                {formatDate(assignment.assignedAt)}
                              </span>
                            </div>
                          </div>
                        }
                      />
                    </ListItem>
                    {index < Math.min(stats.recentAssignments.length, 5) - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <p className="cn-text-body2 text-muted-foreground text-center py-4 text-[0.82rem]">
                {t('portfolios.fields.noClientAssociated')}
              </p>
            )}
          </Card>
        </Grid>
      </Grid>
    </div>
  );
};

export default PortfolioStatsTab;
