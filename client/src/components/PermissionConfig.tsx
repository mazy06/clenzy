import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Tabs,
  Tab
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Save as SaveIcon,
  Security as SecurityIcon,
  Dashboard as DashboardIcon,
  Home as HomeIcon,
  Assignment as AssignmentIcon,
  Build as BuildIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Business as BusinessIcon,
  Notifications as NotificationsIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { useAuth } from '../hooks/useAuth';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import PermissionEffectsDemo from './PermissionEffectsDemo';
import { permissionsApi } from '../services/api';

const PermissionConfig: React.FC = () => {
  const { user } = useAuth();
  const {
    roles,
    selectedRole,
    setSelectedRole,
    rolePermissions,
    loading,
    error,
    togglePermission,
    resetRolePermissions,
    resetToInitialPermissions,
    saveRolePermissions,
    applyLocalChanges,
    loadRolePermissions,
  } = useRolePermissions();
  
  const { triggerGlobalRefresh } = usePermissionRefresh();
  
  // État pour les notifications
  const [saveNotification, setSaveNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // État pour l'onglet actif
  const [activeTab, setActiveTab] = useState(0);

  // Fonction pour gérer le changement d'onglet
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // État pour toutes les permissions disponibles
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [permissionsByModule, setPermissionsByModule] = useState<Record<string, string[]>>({});
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  // Fonction pour obtenir le nom d'affichage du module (doit être définie avant useEffect)
  const getModuleDisplayName = (module: string): string => {
    const moduleMap: Record<string, string> = {
      'dashboard': 'Dashboard',
      'properties': 'Propriétés',
      'service-requests': 'Demandes de Service',
      'interventions': 'Interventions',
      'teams': 'Équipes',
      'portfolios': 'Portefeuilles',
      'contact': 'Contact',
      'settings': 'Paramètres',
      'users': 'Utilisateurs',
      'reports': 'Rapports',
      'documents': 'Documents',
    };
    return moduleMap[module] || module.charAt(0).toUpperCase() + module.slice(1);
  };

  // Charger toutes les permissions disponibles depuis l'API
  useEffect(() => {
    const loadAllPermissions = async () => {
      try {
        setLoadingPermissions(true);

        const permissions = await permissionsApi.getAll();

        setAllPermissions(permissions);
        
        // Grouper les permissions par module
        const grouped: Record<string, string[]> = {};
        permissions.forEach((permission: string) => {
          const [module] = permission.split(':');
          const moduleName = getModuleDisplayName(module);
          if (!grouped[moduleName]) {
            grouped[moduleName] = [];
          }
          grouped[moduleName].push(permission);
        });
        
        // Trier les permissions dans chaque module
        Object.keys(grouped).forEach(module => {
          grouped[module].sort();
        });
        
        setPermissionsByModule(grouped);
      } catch (err) {
        // En cas d'erreur, utiliser les permissions par défaut
        const defaultPermissions = [
          'dashboard:view',
          'properties:view', 'properties:create', 'properties:edit', 'properties:delete',
          'service-requests:view', 'service-requests:create', 'service-requests:edit', 'service-requests:delete',
          'interventions:view', 'interventions:create', 'interventions:edit', 'interventions:delete',
          'teams:view', 'teams:create', 'teams:edit', 'teams:delete',
          'portfolios:view', 'portfolios:manage',
          'contact:view', 'contact:send', 'contact:manage',
          'settings:view', 'settings:edit',
          'users:manage',
          'reports:view', 'reports:generate', 'reports:download', 'reports:manage',
          'documents:view', 'documents:create', 'documents:edit', 'documents:delete', 'documents:compliance',
        ];
        setAllPermissions(defaultPermissions);
        setPermissionsByModule({
          'Dashboard': ['dashboard:view'],
          'Propriétés': ['properties:view', 'properties:create', 'properties:edit', 'properties:delete'],
          'Demandes de Service': ['service-requests:view', 'service-requests:create', 'service-requests:edit', 'service-requests:delete'],
          'Interventions': ['interventions:view', 'interventions:create', 'interventions:edit', 'interventions:delete'],
          'Équipes': ['teams:view', 'teams:create', 'teams:edit', 'teams:delete'],
          'Portefeuilles': ['portfolios:view', 'portfolios:manage'],
          'Contact': ['contact:view', 'contact:send', 'contact:manage'],
          'Paramètres': ['settings:view', 'settings:edit'],
          'Utilisateurs': ['users:manage'],
          'Rapports': ['reports:view', 'reports:generate', 'reports:download', 'reports:manage'],
          'Documents': ['documents:view', 'documents:create', 'documents:edit', 'documents:delete', 'documents:compliance'],
        });
      } finally {
        setLoadingPermissions(false);
      }
    };

    loadAllPermissions();
  }, []);

  // Fonction pour obtenir l'icône appropriée pour chaque module
  const getModuleIcon = (moduleName: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      'Dashboard': <DashboardIcon sx={{ color: 'text.secondary' }} />,
      'Propriétés': <HomeIcon sx={{ color: 'text.secondary' }} />,
      'Demandes de Service': <AssignmentIcon sx={{ color: 'text.secondary' }} />,
      'Interventions': <BuildIcon sx={{ color: 'text.secondary' }} />,
      'Équipes': <GroupIcon sx={{ color: 'text.secondary' }} />,
      'Portefeuilles': <BusinessIcon sx={{ color: 'text.secondary' }} />,
      'Contact': <NotificationsIcon sx={{ color: 'text.secondary' }} />,
      'Utilisateurs': <PersonIcon sx={{ color: 'text.secondary' }} />,
      'Paramètres': <SettingsIcon sx={{ color: 'text.secondary' }} />,
      'Rapports': <AssessmentIcon sx={{ color: 'text.secondary' }} />,
      'Documents': <DescriptionIcon sx={{ color: 'text.secondary' }} />
    };
    return iconMap[moduleName] || <InfoIcon sx={{ color: 'text.secondary' }} />;
  };

  if (!user) {
    return (
      <Box>
        <Alert severity="warning">
          Aucun utilisateur connecté
        </Alert>
      </Box>
    );
  }

  if (loading || loadingPermissions) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error">
          Erreur: {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Roles & Permissions"
        subtitle={`Utilisateur: ${user.username} (${user.email}) - Rôle: ${user.roles.join(', ')}`}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          selectedRole && rolePermissions && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                color="warning"
                startIcon={<RefreshIcon sx={{ color: 'text.secondary' }} />}
                onClick={async () => {
                  await resetRolePermissions(selectedRole);
                  triggerGlobalRefresh();
                }}
                disabled={rolePermissions.isDefault}
                title="Remet les permissions aux valeurs par défaut"
              >
                Réinitialiser
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<StorageIcon sx={{ color: 'text.secondary' }} />}
                onClick={async () => {
                  try {
                    await resetToInitialPermissions(selectedRole);
                    triggerGlobalRefresh();
                    setSaveNotification({
                      open: true,
                      message: 'Permissions réinitialisées aux valeurs initiales !',
                      severity: 'success'
                    });
                  } catch (error) {
                    setSaveNotification({
                      open: true,
                      message: 'Erreur lors de la réinitialisation aux valeurs initiales',
                      severity: 'error'
                    });
                  }
                }}
                disabled={loading}
                title="Remet les permissions aux valeurs initiales stockées en base de données"
              >
                Valeurs Initiales
              </Button>
              <Button
                variant="contained"
                size="small"
                color="primary"
                startIcon={<SaveIcon sx={{ color: 'text.secondary' }} />}
                onClick={async () => {
                  try {
                    await applyLocalChanges(selectedRole);
                    if (selectedRole) {
                      await loadRolePermissions(selectedRole);
                    }
                    triggerGlobalRefresh();
                    window.dispatchEvent(new CustomEvent('force-user-reload'));
                    setSaveNotification({
                      open: true,
                      message: 'Permissions sauvegardées avec succès !',
                      severity: 'success'
                    });
                  } catch (error) {
                    setSaveNotification({
                      open: true,
                      message: 'Erreur lors de la sauvegarde des permissions',
                      severity: 'error'
                    });
                  }
                }}
                disabled={loading || rolePermissions?.isDefault}
                title="Sauvegarder"
              >
                Sauvegarder
              </Button>
            </Box>
          )
        }
      />

      {/* Sélection du rôle et résumé des permissions */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 3 }}>
          {/* Section des rôles */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Rôles disponibles ({roles.length})
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {roles
                .sort((a, b) => {
                  // Ordre spécifique des rôles
                  const roleOrder = ['SUPER_ADMIN', 'SUPER_MANAGER', 'SUPERVISOR', 'TECHNICIAN', 'HOUSEKEEPER', 'HOST', 'LAUNDRY', 'EXTERIOR_TECH'];
                  const indexA = roleOrder.indexOf(a);
                  const indexB = roleOrder.indexOf(b);
                  return indexA - indexB;
                })
                .map((role) => (
                  <Chip
                    key={role}
                    label={role}
                    color={selectedRole === role ? 'primary' : 'default'}
                    variant={selectedRole === role ? 'filled' : 'outlined'}
                    onClick={() => setSelectedRole(role)}
                    size="small"
                    sx={{ 
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: selectedRole === role ? 600 : 400,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: 1
                      }
                    }}
                  />
                ))}
            </Box>

            {selectedRole && (
              <Box sx={{ 
                p: 2, 
                bgcolor: 'grey.50', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary">
                    Rôle sélectionné : <strong>{selectedRole}</strong>
                  </Typography>
                  {rolePermissions && (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        • {rolePermissions.permissions.length} permissions actives
                      </Typography>
                      <Chip 
                        label={rolePermissions.isDefault ? 'Par défaut' : 'Modifié'} 
                        size="small" 
                        color={rolePermissions.isDefault ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    </>
                  )}
                </Box>
              </Box>
            )}
          </Box>

          {/* Section du résumé des permissions */}
          {selectedRole && rolePermissions && (
            <Box sx={{ 
              pt: 1, 
              borderTop: '1px solid', 
              borderColor: 'divider'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Résumé des permissions
                </Typography>
              </Box>
              
              <Grid container spacing={1}>
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 1 }}>
                    <Typography variant="h6" color="info.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {allPermissions.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 1 }}>
                    <Typography variant="h6" color="success.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {rolePermissions.permissions.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Actives
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 1 }}>
                    <Typography variant="h6" color="error.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {allPermissions.filter(p => !rolePermissions.permissions.includes(p)).length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Inactives
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={3}>
                  <Box sx={{ textAlign: 'center', p: 1 }}>
                    <Typography variant="h6" color="warning.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {Object.keys(permissionsByModule).filter(module => {
                        const modulePermissions = permissionsByModule[module as keyof typeof permissionsByModule];
                        return modulePermissions.some(permission => rolePermissions.permissions.includes(permission));
                      }).length} / {Object.keys(permissionsByModule).length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Menus accessibles
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Onglets pour la configuration et la démonstration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="Configuration des permissions">
              <Tab 
                label="Édition des Permissions" 
                id="tab-0" 
                aria-controls="tabpanel-0"
                disabled={!selectedRole || !rolePermissions}
                icon={<SettingsIcon sx={{ color: 'text.secondary' }} />}
                iconPosition="start"
              />
              <Tab 
                label="Démonstration des Effets" 
                id="tab-1" 
                aria-controls="tabpanel-1"
                disabled={!selectedRole || !rolePermissions}
                icon={<SecurityIcon sx={{ color: 'text.secondary' }} />}
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {/* Contenu de l'onglet Édition des Permissions */}
          {activeTab === 0 && selectedRole && rolePermissions && (
            <Box role="tabpanel" id="tabpanel-0" aria-labelledby="tab-0">
              {/* Configuration des permissions par module */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3, color: 'text.primary' }}>
                  Permissions par Module
                </Typography>
                
                {/* Instructions pour la modification des permissions */}
                <Alert severity="info" sx={{ mb: 3, fontSize: '1rem' }}>
                  <strong>Mode modification :</strong> Cliquez sur les badges de permissions (chips) pour les activer/désactiver. 
                  Les permissions <strong>vertes</strong> sont actives, les permissions <strong>grises</strong> sont inactives.
                  Les modifications sont temporaires jusqu'à la sauvegarde. Utilisez le bouton <strong>"Sauvegarder"</strong> en haut de page pour persister les changements.
                </Alert>
                
                {/* Message si aucune permission n'est disponible */}
                {allPermissions.length === 0 && (
                  <Alert severity="warning" sx={{ mb: 3 }}>
                    Aucune permission disponible. Veuillez vérifier que la base de données contient les permissions nécessaires.
                  </Alert>
                )}
                
                <Grid container spacing={3}>
                  {Object.entries(permissionsByModule).map(([moduleName, permissions]) => (
                    <Grid item xs={12} lg={6} key={moduleName}>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          height: '100%',
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': {
                            borderColor: 'primary.main',
                            boxShadow: 1
                          }
                        }}
                      >
                        <CardContent sx={{ p: 2 }}>
                          {/* En-tête de la carte */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                            <Box sx={{ 
                              p: 0.5, 
                              bgcolor: 'grey.100', 
                              borderRadius: 0.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'text.secondary'
                            }}>
                              {getModuleIcon(moduleName)}
                            </Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', flex: 1 }}>
                              {moduleName}
                            </Typography>
                            <Chip 
                              label={`${permissions.filter(p => rolePermissions.permissions.includes(p)).length}/${permissions.length}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          </Box>
                          
                          {/* Liste des permissions */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {permissions.map((permission) => {
                              const isActive = rolePermissions.permissions.includes(permission);
                              return (
                                <Box 
                                  key={permission} 
                                  sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1.5,
                                    p: 1.5,
                                    borderRadius: 1,
                                    bgcolor: isActive ? 'success.light' : 'grey.50',
                                    border: `1px solid ${isActive ? 'success.main' : 'grey.200'}`
                                  }}
                                >
                                  <Chip
                                    label={permission}
                                    size="small"
                                    color={isActive ? 'success' : 'default'}
                                    variant={isActive ? 'filled' : 'outlined'}
                                    onClick={() => togglePermission(permission)}
                                    sx={{ 
                                      cursor: 'pointer',
                                      fontWeight: 500,
                                      transition: 'all 0.2s ease-in-out',
                                      '&:hover': {
                                        transform: 'scale(1.05)',
                                        boxShadow: 1
                                      }
                                    }}
                                  />
                                  <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 0.5,
                                    ml: 'auto'
                                  }}>
                                    {isActive ? (
                                      <CheckCircleIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                                    ) : (
                                      <ErrorIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                                    )}
                                    <Typography 
                                      variant="caption" 
                                      color={isActive ? 'success.main' : 'text.secondary'}
                                      sx={{ fontWeight: 500, fontSize: '0.7rem' }}
                                    >
                                      {isActive ? 'Actif' : 'Inactif'}
                                    </Typography>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>

            </Box>
          )}

          {/* Contenu de l'onglet Démonstration des Effets */}
          {activeTab === 1 && selectedRole && rolePermissions && (
            <Box role="tabpanel" id="tabpanel-1" aria-labelledby="tab-1">
              <PermissionEffectsDemo 
                selectedRole={selectedRole}
                rolePermissions={rolePermissions}
              />
            </Box>
          )}


          {/* Message si aucun rôle n'est sélectionné */}
          {!selectedRole && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Veuillez sélectionner un rôle pour commencer la configuration des permissions
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Notifications de sauvegarde */}
      <Snackbar
        open={saveNotification.open}
        autoHideDuration={6000}
        onClose={() => setSaveNotification(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSaveNotification(prev => ({ ...prev, open: false }))}
          severity={saveNotification.severity}
          sx={{ width: '100%' }}
        >
          {saveNotification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PermissionConfig;

