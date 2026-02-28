import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, CardHeader, CardActionArea } from '@mui/material';
import {
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Euro as EuroIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Home as HomeIcon,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

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
      id: 'financial',
      title: t('reports.sections.financial.title'),
      icon: <EuroIcon color="primary" />,
      description: t('reports.sections.financial.description'),
      permission: 'reports:view',
      canView: permissions['reports:view'],
      route: '/reports/financial'
    },
    {
      id: 'interventions',
      title: t('reports.sections.interventions.title'),
      icon: <ScheduleIcon color="success" />,
      description: t('reports.sections.interventions.description'),
      permission: 'reports:view',
      canView: permissions['reports:view'],
      route: '/reports/interventions'
    },
    {
      id: 'teams',
      title: t('reports.sections.teams.title'),
      icon: <PeopleIcon color="info" />,
      description: t('reports.sections.teams.description'),
      permission: 'reports:view',
      canView: permissions['reports:view'],
      route: '/reports/teams'
    },
    {
      id: 'properties',
      title: t('reports.sections.properties.title'),
      icon: <HomeIcon color="warning" />,
      description: t('reports.sections.properties.description'),
      permission: 'reports:view',
      canView: permissions['reports:view'],
      route: '/reports/properties'
    },
    {
      id: 'fiscal',
      title: t('reports.sections.fiscal.title', 'Rapport Fiscal'),
      icon: <AccountBalanceIcon color="secondary" />,
      description: t('reports.sections.fiscal.description', 'TVA, taxes et declarations fiscales'),
      permission: 'reports:view',
      canView: permissions['reports:view'],
      route: '/reports/fiscal'
    }
  ];

  const handleCardClick = (section: typeof reportSections[0]) => {
    if (section.canView) {
      navigate(section.route);
    }
  };

  return (
    <Box>
      {/* En-tête */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <AssessmentIcon sx={{ fontSize: 24, color: 'primary.main', mr: 1.5 }} />
          <Typography variant="h6" component="h1" color="primary.main" sx={{ fontWeight: 600, fontSize: '1.25rem' }}>
            {t('reports.title')}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
          {t('reports.subtitle')}
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
              onClick={() => handleCardClick(section)}
            >
              <CardActionArea disabled={!section.canView}>
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
                      {t('reports.permission')}: {section.permission}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      color={section.canView ? 'success.main' : 'text.disabled'}
                      sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                    >
                      {section.canView ? t('reports.available') : t('reports.notAuthorized')}
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Message d'information */}
      {!permissions['reports:view'] && !permissions['interventions:view'] && !permissions['teams:view'] && !permissions['properties:view'] && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'info.light', border: '1px solid', borderColor: 'info.main' }}>
          <Typography variant="body2" color="info.contrastText" sx={{ textAlign: 'center', fontSize: '0.85rem' }}>
            {t('reports.noPermissions')}
          </Typography>
        </Paper>
      )}

      {/* Section de développement */}
      <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
        <Typography variant="subtitle1" gutterBottom color="text.secondary" sx={{ mb: 1, fontSize: '0.95rem', fontWeight: 600 }}>
          {t('reports.development.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          {t('reports.development.description')}
        </Typography>
      </Paper>
    </Box>
  );
};

export default Reports;
