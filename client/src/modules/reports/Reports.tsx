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
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <AssessmentIcon sx={{ fontSize: 24, color: 'primary.main', mr: 1.5 }} />
          <Typography variant="h6" component="h1" color="primary.main" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
            Rapports
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
          Générez et consultez les rapports de votre plateforme Clenzy
        </Typography>
      </Box>

      {/* Grille des sections de rapports */}
      <Grid container spacing={2}>
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
                avatar={<Box sx={{ fontSize: 20 }}>{section.icon}</Box>}
                title={section.title}
                subheader={section.description}
                titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600, sx: { fontSize: '0.95rem' } }}
                subheaderTypographyProps={{ variant: 'caption', sx: { fontSize: '0.7rem' } }}
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0, p: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    Permission: {section.permission}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    color={section.canView ? 'success.main' : 'text.disabled'}
                    sx={{ fontWeight: 600, fontSize: '0.7rem' }}
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
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'info.light', border: '1px solid', borderColor: 'info.main' }}>
          <Typography variant="body2" color="info.contrastText" sx={{ textAlign: 'center', fontSize: '0.85rem' }}>
            Vous n'avez actuellement aucune permission pour consulter les rapports. 
            Contactez votre administrateur pour obtenir les accès nécessaires.
          </Typography>
        </Paper>
      )}

      {/* Section de développement */}
      <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
        <Typography variant="subtitle1" gutterBottom color="text.secondary" sx={{ mb: 1, fontSize: '0.95rem', fontWeight: 600 }}>
          🚧 Module en développement
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          Ce module de rapports est actuellement en cours de développement. 
          Les fonctionnalités seront progressivement ajoutées selon vos besoins.
        </Typography>
      </Paper>
    </Box>
  );
};

export default Reports;
