import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, CardHeader, IconButton } from '@mui/material';
import { 
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Euro as EuroIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';

const Reports: React.FC = () => {
  const { user, hasPermissionAsync } = useAuth();

  // États pour les permissions
  const [permissions, setPermissions] = useState({
    'reports:view': false,
    'interventions:view': false,
    'teams:view': false,
    'properties:view': false
  });

  // Vérifier toutes les permissions au chargement
  useEffect(() => {
    const checkAllPermissions = async () => {
      const perms = await Promise.all([
        hasPermissionAsync('reports:view'),
        hasPermissionAsync('interventions:view'),
        hasPermissionAsync('teams:view'),
        hasPermissionAsync('properties:view')
      ]);
      
      setPermissions({
        'reports:view': perms[0],
        'interventions:view': perms[1],
        'teams:view': perms[2],
        'properties:view': perms[3]
      });
    };
    
    checkAllPermissions();
  }, [hasPermissionAsync]);

  const reportSections = [
    {
      title: 'Rapports Financiers',
      icon: <EuroIcon color="primary" />,
      description: 'Revenus, coûts et analyses financières',
      permission: 'reports:view',
      canView: permissions['reports:view'],
      route: '/reports/financial'
    },
    {
      title: 'Rapports d\'Interventions',
      icon: <ScheduleIcon color="success" />,
      description: 'Planification, suivi et performance des interventions',
      permission: 'interventions:view',
      canView: permissions['interventions:view'],
      route: '/reports/interventions'
    },
    {
      title: 'Rapports d\'Équipes',
      icon: <PeopleIcon color="info" />,
      description: 'Performance, disponibilités et planning des équipes',
      permission: 'teams:view',
      canView: permissions['teams:view'],
      route: '/reports/teams'
    },
    {
      title: 'Rapports de Propriétés',
      icon: <HomeIcon color="warning" />,
      description: 'État, maintenance et coûts des propriétés',
      permission: 'properties:view',
      canView: permissions['properties:view'],
      route: '/reports/properties'
    }
  ];

  return (
    <Box>
      {/* En-tête */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AssessmentIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
          <Typography variant="h4" component="h1" color="primary.main" sx={{ fontWeight: 600 }}>
            Rapports
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Générez et consultez les rapports de votre plateforme Clenzy
        </Typography>
      </Box>

      {/* Grille des sections de rapports */}
      <Grid container spacing={3}>
        {reportSections.map((section, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card 
              sx={{ 
                height: '100%',
                opacity: section.canView ? 1 : 0.5,
                cursor: section.canView ? 'pointer' : 'not-allowed',
                '&:hover': section.canView ? {
                  boxShadow: 3,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s ease-in-out'
                } : {}
              }}
            >
              <CardHeader
                avatar={section.icon}
                title={section.title}
                subheader={section.description}
                titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                subheaderTypographyProps={{ variant: 'body2' }}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Permission: {section.permission}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    color={section.canView ? 'success.main' : 'text.disabled'}
                    sx={{ fontWeight: 600 }}
                  >
                    {section.canView ? 'Disponible' : 'Non autorisé'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Message d'information */}
      {!permissions['reports:view'] && !permissions['interventions:view'] && !permissions['teams:view'] && !permissions['properties:view'] && (
        <Paper sx={{ p: 3, mt: 4, bgcolor: 'info.light', border: '1px solid', borderColor: 'info.main' }}>
          <Typography variant="body1" color="info.contrastText" sx={{ textAlign: 'center' }}>
            Vous n'avez actuellement aucune permission pour consulter les rapports. 
            Contactez votre administrateur pour obtenir les accès nécessaires.
          </Typography>
        </Paper>
      )}

      {/* Section de développement */}
      <Paper sx={{ p: 3, mt: 4, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
        <Typography variant="h6" gutterBottom color="text.secondary">
          🚧 Module en développement
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ce module de rapports est actuellement en cours de développement. 
          Les fonctionnalités seront progressivement ajoutées selon vos besoins.
        </Typography>
      </Paper>
    </Box>
  );
};

export default Reports;
