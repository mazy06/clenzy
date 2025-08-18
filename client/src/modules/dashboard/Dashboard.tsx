import React from 'react';
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
  Chip
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
  Warning
} from '@mui/icons-material';

const Dashboard: React.FC = () => {
  console.log('🔍 Dashboard - Rendu du composant Dashboard');

  const stats = [
    {
      title: 'Propriétés actives',
      value: '24',
      icon: <Home color="primary" />,
      growth: '+12%',
      growthType: 'up'
    },
    {
      title: 'Demandes en cours',
      value: '8',
      icon: <Assignment color="secondary" />,
      growth: '~5%',
      growthType: 'down'
    },
    {
      title: 'Interventions du jour',
      value: '12',
      icon: <Build color="success" />,
      growth: '+8%',
      growthType: 'up'
    },
    {
      title: 'Revenus du mois',
      value: '€12,450',
      icon: <Euro color="warning" />,
      growth: '+15%',
      growthType: 'up'
    },
  ];

  const recentActivities = [
    {
      type: 'Nettoyage terminé',
      property: 'Appartement 2B - 15 rue de la Paix, Paris',
      time: 'Il y a 2 heures',
      status: 'completed'
    },
    {
      type: 'Nouvelle demande de service (urgent)',
      property: 'Réparation climatisation - Villa Sunshine',
      time: 'Il y a 4 heures',
      status: 'urgent'
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" color="primary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <DashboardIcon fontSize="large" />
          Tableau de bord
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Vue d'ensemble de votre activité de gestion Airbnb
        </Typography>
      </Box>

      {/* Métriques principales */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                  {React.cloneElement(stat.icon, { sx: { fontSize: 40 } })}
                </Box>
                <Typography variant="h3" component="div" sx={{ mb: 1, fontWeight: 'bold' }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {stat.title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  {stat.growthType === 'up' ? (
                    <TrendingUp color="success" fontSize="small" />
                  ) : (
                    <TrendingDown color="error" fontSize="small" />
                  )}
                  <Typography
                    variant="caption"
                    color={stat.growthType === 'up' ? 'success.main' : 'error.main'}
                    sx={{ fontWeight: 'bold' }}
                  >
                    {stat.growth}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Actions rapides */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 3 }}>
          Actions rapides
        </Typography>
        <Grid container spacing={2}>
          <Grid item>
            <Button
              variant="contained"
              startIcon={<Add />}
              sx={{ minWidth: 150 }}
            >
              Nouvelle propriété
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<Add />}
              sx={{ minWidth: 150 }}
            >
              Nouvelle demande
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<Add />}
              sx={{ minWidth: 150 }}
            >
              Nouvelle équipe
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Activités récentes */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Activités récentes
            </Typography>
            <List>
              {recentActivities.map((activity, index) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemIcon>
                    {activity.status === 'completed' ? (
                      <CheckCircle color="success" />
                    ) : (
                      <Warning color="warning" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {activity.type}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {activity.property}
                        </Typography>
                      </Box>
                    }
                    secondary={activity.time}
                  />
                  {activity.status === 'urgent' && (
                    <Chip label="Urgent" color="error" size="small" />
                  )}
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Taux de satisfaction */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Taux de satisfaction
            </Typography>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                4.8
              </Typography>
              <Typography variant="h6" color="text.secondary">
                /5
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={96}
              sx={{ height: 8, borderRadius: 4, mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Basé sur 156 avis ce mois
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  color={star <= 4 ? "primary" : "disabled"}
                  sx={{ fontSize: 20 }}
                />
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
