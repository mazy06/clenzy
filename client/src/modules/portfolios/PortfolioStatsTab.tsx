import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Business,
  People,
  Group,
  Euro,
  TrendingUp,
  Assignment,
  CheckCircle,
  Schedule,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import { useTranslation } from '../../hooks/useTranslation';

interface PortfolioStats {
  totalPortfolios: number;
  totalClients: number;
  totalProperties: number;
  totalTeamMembers: number;
  activePortfolios: number;
  inactivePortfolios: number;
  recentAssignments: Array<{
    id: number;
    type: 'CLIENT' | 'TEAM';
    name: string;
    portfolioName: string;
    assignedAt: string;
  }>;
  portfolioBreakdown: Array<{
    portfolioId: number;
    portfolioName: string;
    clientCount: number;
    teamMemberCount: number;
    isActive: boolean;
  }>;
}

const PortfolioStatsTab: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/portfolios/manager/${user.id}/stats`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        setError('Erreur lors du chargement des statistiques');
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Erreur chargement stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Alert severity="info">
        {t('portfolios.statistics.noDataAvailable')}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('portfolios.statistics.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('portfolios.subtitle')}
      </Typography>

      {/* Cartes de statistiques principales */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Business color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {stats.totalPortfolios}
                  </Typography>
                  <Typography color="text.secondary">
                    Portefeuilles
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <People color="success" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {stats.totalClients}
                  </Typography>
                  <Typography color="text.secondary">
                    {t('portfolios.statistics.clients')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Assignment color="info" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {stats.totalProperties}
                  </Typography>
                  <Typography color="text.secondary">
                    Propriétés
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Group color="warning" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {stats.totalTeamMembers}
                  </Typography>
                  <Typography color="text.secondary">
                    {t('teams.members')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Détail par portefeuille */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.statistics.title')}
            </Typography>
            <List>
              {stats.portfolioBreakdown.map((portfolio, index) => (
                <React.Fragment key={portfolio.portfolioId}>
                  <ListItem>
                    <ListItemIcon>
                      <Business color={portfolio.isActive ? 'primary' : 'disabled'} />
                    </ListItemIcon>
                    <ListItemText
                      primary={portfolio.portfolioName}
                      secondary={
                        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {portfolio.clientCount} client{portfolio.clientCount > 1 ? 's' : ''}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {portfolio.teamMemberCount} membre{portfolio.teamMemberCount > 1 ? 's' : ''}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < stats.portfolioBreakdown.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Assignations récentes */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.fields.associatedOn')}
            </Typography>
            {stats.recentAssignments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('portfolios.fields.noClientAssociated')}
              </Typography>
            ) : (
              <List>
                {stats.recentAssignments.slice(0, 5).map((assignment, index) => (
                  <React.Fragment key={assignment.id}>
                    <ListItem>
                      <ListItemIcon>
                        {assignment.type === 'CLIENT' ? (
                          <People color="success" />
                        ) : (
                          <Group color="info" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={assignment.name}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {assignment.portfolioName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(assignment.assignedAt)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < Math.min(stats.recentAssignments.length, 5) - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PortfolioStatsTab;
