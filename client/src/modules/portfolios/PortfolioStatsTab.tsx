import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
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
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { portfoliosApi, portfoliosKeys } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
}

function StatCard({ icon, value, label, color }: StatCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        transition: 'all 0.2s ease-in-out',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(107, 138, 154, 0.1)' },
      }}
    >
      <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            sx={{
              bgcolor: `${color}`,
              width: 44,
              height: 44,
              opacity: 0.9,
            }}
          >
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h4" component="div" sx={{ fontWeight: 700, fontSize: '1.8rem', lineHeight: 1 }}>
              {value}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: '0.78rem', mt: 0.25 }}>
              {label}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

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

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<Business sx={{ fontSize: 22 }} />}
            value={stats.totalPortfolios}
            label={t('portfolios.statistics.portfolios')}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<People sx={{ fontSize: 22 }} />}
            value={stats.totalClients}
            label={t('portfolios.statistics.clients')}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<Assignment sx={{ fontSize: 22 }} />}
            value={stats.totalProperties}
            label={t('portfolios.statistics.properties')}
            color="info.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<Group sx={{ fontSize: 22 }} />}
            value={stats.totalTeamMembers}
            label={t('teams.members')}
            color="warning.main"
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
                          <Business sx={{ fontSize: 14 }} />
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
                            <People sx={{ fontSize: 14 }} />
                          ) : (
                            <Group sx={{ fontSize: 14 }} />
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
                              <Schedule sx={{ fontSize: 12, color: 'text.secondary' }} />
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
