import React from 'react';
import { Box, Typography, Card, CardContent, Grid, Button } from '@mui/material';
import { 
  Dashboard as DashboardIcon,
  Home as HomeIcon,
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  Group as GroupIcon,
  Assessment as AssessmentIcon,
  Person as PersonIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import {
  DashboardAccessDenied,
  PropertiesAccessDenied,
  ServiceRequestsAccessDenied,
  InterventionsAccessDenied,
  TeamsAccessDenied,
  ReportsAccessDenied,
  UsersAccessDenied,
  SettingsAccessDenied
} from './index';

const AccessDeniedDemo: React.FC = () => {
  const [selectedModule, setSelectedModule] = React.useState<string | null>(null);

  const modules = [
    {
      key: 'dashboard',
      name: 'Dashboard',
      icon: <DashboardIcon />,
      component: <DashboardAccessDenied />
    },
    {
      key: 'properties',
      name: 'Propriétés',
      icon: <HomeIcon />,
      component: <PropertiesAccessDenied />
    },
    {
      key: 'service-requests',
      name: 'Demandes de Service',
      icon: <AssignmentIcon />,
      component: <ServiceRequestsAccessDenied />
    },
    {
      key: 'interventions',
      name: 'Interventions',
      icon: <BuildIcon />,
      component: <InterventionsAccessDenied />
    },
    {
      key: 'teams',
      name: 'Équipes',
      icon: <GroupIcon />,
      component: <TeamsAccessDenied />
    },
    {
      key: 'reports',
      name: 'Rapports',
      icon: <AssessmentIcon />,
      component: <ReportsAccessDenied />
    },
    {
      key: 'users',
      name: 'Utilisateurs',
      icon: <PersonIcon />,
      component: <UsersAccessDenied />
    },
    {
      key: 'settings',
      name: 'Paramètres',
      icon: <SettingsIcon />,
      component: <SettingsAccessDenied />
    }
  ];

  if (selectedModule) {
    const module = modules.find(m => m.key === selectedModule);
    return (
      <Box sx={{ p: 2 }}>
        <Button 
          variant="outlined" 
          onClick={() => setSelectedModule(null)}
          sx={{ mb: 2 }}
        >
          ← Retour à la sélection
        </Button>
        {module?.component}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, textAlign: 'center' }}>
        Démonstration des Composants d'Accès Refusé
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', maxWidth: 800, mx: 'auto' }}>
        Sélectionnez un module pour voir le composant d'accès refusé correspondant. 
        Chaque composant affiche un message personnalisé avec des informations spécifiques au module.
      </Typography>

      <Grid container spacing={3}>
        {modules.map((module) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={module.key}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 3,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s ease-in-out'
                }
              }}
              onClick={() => setSelectedModule(module.key)}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ mb: 2, fontSize: 40, color: 'primary.main' }}>
                  {module.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {module.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Cliquez pour voir le composant d'accès refusé
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AccessDeniedDemo;
