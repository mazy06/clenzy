import React from 'react';
import { Box, Card, CardContent, Typography, Chip, Grid, Alert } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Home as HomeIcon,
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Assessment as AssessmentIcon,
  Info as InfoIcon
} from '@mui/icons-material';

interface PermissionEffectsDemoProps {
  selectedRole?: string;
  rolePermissions?: {
    role: string;
    permissions: string[];
    isDefault: boolean;
  };
}

const PermissionEffectsDemo: React.FC<PermissionEffectsDemoProps> = ({ 
  selectedRole, 
  rolePermissions 
}) => {

  // Si aucun rôle n'est sélectionné, afficher un message
  if (!selectedRole || !rolePermissions) {
    return (
      <Box>
        <Alert severity="info">
          Veuillez sélectionner un rôle pour voir la démonstration des effets
        </Alert>
      </Box>
    );
  }

  // Fonction pour tester si une permission est active pour le rôle sélectionné
  const testPermission = (permission: string) => {
    return rolePermissions.permissions.includes(permission);
  };

  // Fonction pour obtenir l'état d'un menu selon les permissions
  const getMenuStatus = (menuName: string, requiredPermissions: string[]) => {
    const hasAccess = requiredPermissions.every(permission => testPermission(permission));
    return {
      accessible: hasAccess,
      status: hasAccess ? '✅ Accessible' : '❌ Inaccessible',
      color: hasAccess ? 'success' : 'error',
      reason: hasAccess ? 'Toutes les permissions requises sont accordées' : `Permissions manquantes: ${requiredPermissions.filter(p => !testPermission(p)).join(', ')}`
    };
  };

  const menuPermissions = [
    {
      name: 'Tableau de Bord',
      permissions: ['dashboard:view'],
      description: 'Vue d\'ensemble de l\'activité'
    },
    {
      name: 'Propriétés',
      permissions: ['properties:view'],
      description: 'Gestion des propriétés'
    },
    {
      name: 'Demandes de Service',
      permissions: ['service-requests:view'],
      description: 'Gestion des demandes de service'
    },
    {
      name: 'Interventions',
      permissions: ['interventions:view'],
      description: 'Gestion des interventions'
    },
    {
      name: 'Équipes',
      permissions: ['teams:view'],
      description: 'Gestion des équipes'
    },
    {
      name: 'Utilisateurs',
      permissions: ['users:manage'],
      description: 'Gestion des utilisateurs (Admin uniquement)'
    },
    {
      name: 'Paramètres',
      permissions: ['settings:view'],
      description: 'Configuration du système'
    },
    {
      name: 'Rapports',
      permissions: ['reports:view'],
      description: 'Génération de rapports'
    }
  ];

  // Helper function to get module icon
  const getModuleIcon = (moduleName: string) => {
    switch (moduleName) {
      case 'Tableau de Bord':
        return <DashboardIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      case 'Propriétés':
        return <HomeIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      case 'Demandes de Service':
        return <AssignmentIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      case 'Interventions':
        return <BuildIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      case 'Équipes':
        return <GroupIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      case 'Utilisateurs':
        return <PersonIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      case 'Paramètres':
        return <SettingsIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      case 'Rapports':
        return <AssessmentIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      default:
        return <InfoIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
    }
  };

  return (
    <Box>
      <Grid container spacing={2}>
        {menuPermissions.map((menu) => {
          const status = getMenuStatus(menu.name, menu.permissions);
          
          return (
            <Grid item xs={12} lg={6} key={menu.name}>
              <Card 
                variant="outlined" 
                sx={{ 
                  height: '100%',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 2,
                    borderColor: 'primary.main'
                  },
                  borderColor: status.accessible ? 'success.main' : 'grey.300',
                  borderWidth: 1,
                  bgcolor: 'background.paper'
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  {/* En-tête avec icône et statut */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box sx={{ 
                      p: 1, 
                      bgcolor: 'grey.100', 
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'text.secondary'
                    }}>
                      {getModuleIcon(menu.name)}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                        {menu.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                        {menu.description}
                      </Typography>
                    </Box>
                    <Chip
                      label={status.accessible ? 'Accessible' : 'Inaccessible'}
                      size="small"
                      color={status.accessible ? 'success' : 'error'}
                      variant="outlined"
                      sx={{ 
                        fontWeight: 500,
                        borderWidth: 1.5,
                        minWidth: 80
                      }}
                    />
                  </Box>
                  
                  {/* Permissions requises */}
                  <Box sx={{ 
                    p: 1.5, 
                    bgcolor: 'grey.50', 
                    borderRadius: 1, 
                    mb: 2,
                    border: '1px solid',
                    borderColor: 'grey.200'
                  }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}>
                      Permissions requises
                    </Typography>
                    <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                      {menu.permissions.join(', ')}
                    </Typography>
                  </Box>
                  
                  {/* Raison du statut */}
                  <Box sx={{ 
                    p: 1.5, 
                    bgcolor: status.accessible ? 'success.50' : 'error.50', 
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: status.accessible ? 'success.200' : 'error.200'
                  }}>
                    <Typography variant="caption" color={status.accessible ? 'success.dark' : 'error.dark'} sx={{ fontWeight: 500 }}>
                      {status.reason}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Résumé des accès */}
      <Box sx={{ mt: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card 
              variant="outlined" 
              sx={{ 
                p: 2.5, 
                textAlign: 'center',
                bgcolor: 'background.paper',
                borderColor: 'success.main',
                borderWidth: 1.5
              }}
            >
              <Typography variant="h4" color="success.main" sx={{ fontWeight: 700, mb: 1 }}>
                {rolePermissions.permissions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Permissions actives
              </Typography>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card 
              variant="outlined" 
              sx={{ 
                p: 2.5, 
                textAlign: 'center',
                bgcolor: 'background.paper',
                borderColor: rolePermissions.isDefault ? 'success.main' : 'warning.main',
                borderWidth: 1.5
              }}
            >
              <Typography variant="h4" color={rolePermissions.isDefault ? 'success.main' : 'warning.main'} sx={{ fontWeight: 700, mb: 1 }}>
                {rolePermissions.isDefault ? '✅' : '⚠️'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {rolePermissions.isDefault ? 'Par défaut' : 'Modifié'}
              </Typography>
            </Card>
          </Grid>
        </Grid>
        
      </Box>
    </Box>
  );
};

export default PermissionEffectsDemo;
