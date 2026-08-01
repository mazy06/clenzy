import React from 'react';
import { Alert, AlertDescription } from './ui';
import { Info } from 'lucide-react';
import { Box, Card, CardContent, Typography, Grid } from '@mui/material';
import StatusChip from './StatusChip';
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
} from '../icons';

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
      <div>
        <Alert variant="info">
          <Info />
          <AlertDescription>Veuillez sélectionner un rôle pour voir la démonstration des effets</AlertDescription>
        </Alert>
      </div>
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
        return <DashboardIcon size={20} strokeWidth={1.75} />;
      case 'Propriétés':
        return <HomeIcon size={20} strokeWidth={1.75} />;
      case 'Demandes de Service':
        return <AssignmentIcon size={20} strokeWidth={1.75} />;
      case 'Interventions':
        return <BuildIcon size={20} strokeWidth={1.75} />;
      case 'Équipes':
        return <GroupIcon size={20} strokeWidth={1.75} />;
      case 'Utilisateurs':
        return <PersonIcon size={20} strokeWidth={1.75} />;
      case 'Paramètres':
        return <SettingsIcon size={20} strokeWidth={1.75} />;
      case 'Rapports':
        return <AssessmentIcon size={20} strokeWidth={1.75} />;
      default:
        return <InfoIcon size={20} strokeWidth={1.75} />;
    }
  };

  return (
    <div>
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
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 bg-[grey.100] rounded-[1px] flex items-center justify-center text-muted-foreground">
                      {getModuleIcon(menu.name)}
                    </div>
                    <div className="flex-1">
                      <h6 className="cn-text-h6 font-semibold text-foreground mb-0.5">
                        {menu.name}
                      </h6>
                      <p className="cn-text-body2 text-muted-foreground leading-[1.4]">
                        {menu.description}
                      </p>
                    </div>
                    <StatusChip
                      tone={status.accessible ? 'ok' : 'err'}
                      label={status.accessible ? 'Accessible' : 'Inaccessible'}
                      className="min-w-20 shrink-0 justify-center"
                    />
                  </div>
                  
                  {/* Permissions requises */}
                  <div className="p-2 bg-[grey.50] rounded-[1px] mb-3 border border-[grey.200]">
                    <span className="cn-text-caption text-muted-foreground font-medium block mb-0.5">
                      Permissions requises
                    </span>
                    <p className="cn-text-body2 text-foreground font-medium font-mono">
                      {menu.permissions.join(', ')}
                    </p>
                  </div>
                  
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
      <div className="mt-6">
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
              <h4 className="cn-text-h4 text-[var(--bui-success-ink)] font-bold mb-1.5">
                {rolePermissions.permissions.length}
              </h4>
              <p className="cn-text-body2 text-muted-foreground font-medium">
                Permissions actives
              </p>
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
              <p className="cn-text-body2 text-muted-foreground font-medium">
                {rolePermissions.isDefault ? 'Par défaut' : 'Modifié'}
              </p>
            </Card>
          </Grid>
        </Grid>
        
      </div>
    </div>
  );
};

export default PermissionEffectsDemo;
