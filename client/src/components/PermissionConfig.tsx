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
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  Description as DescriptionIcon,
  EventNote as EventNoteIcon,
  TrendingUp as TrendingUpIcon,
  ExpandMore as ExpandMoreIcon,
  Payment as PaymentIcon,
  SettingsInputAntenna as ChannelsIcon,
  Chat as ChatIcon,
  MonitorHeart as MonitorIcon,
  Sync as SyncIcon,
  Speed as SpeedIcon,
  StorageRounded as DatabaseIcon,
  Receipt as TarificationIcon,
} from '../icons';
import PageHeader from './PageHeader';
import PageTabs from './PageTabs';
import { useAuth } from '../hooks/useAuth';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import PermissionEffectsDemo from './PermissionEffectsDemo';
import { permissionsApi } from '../services/api';

// ─── Role tabs config ────────────────────────────────────────────────────────

/** Ordre canonique des rôles (du plus privilégié au plus restreint). */
const ROLE_ORDER: string[] = [
  'SUPER_ADMIN',
  'SUPER_MANAGER',
  'SUPERVISOR',
  'TECHNICIAN',
  'HOUSEKEEPER',
  'HOST',
  'LAUNDRY',
  'EXTERIOR_TECH',
];

/** Trie une liste de rôles selon l'ordre canonique (rôles inconnus en dernier, alphabétique). */
function sortRoles(roles: string[]): string[] {
  return [...roles].sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a);
    const ib = ROLE_ORDER.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b);
  });
}

/** Icône associée à chaque rôle (fallback PersonIcon si non listé). */
const ROLE_ICONS: Record<string, React.ReactElement> = {
  SUPER_ADMIN:    <SecurityIcon />,
  SUPER_MANAGER:  <BusinessIcon />,
  SUPERVISOR:     <GroupIcon />,
  TECHNICIAN:     <BuildIcon />,
  HOUSEKEEPER:    <AssignmentIcon />,
  HOST:           <HomeIcon />,
  LAUNDRY:        <PersonIcon />,
  EXTERIOR_TECH:  <BuildIcon />,
};

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
      'reservations': 'Réservations',
      'pricing': 'Prix Dynamiques',
      'tarification': 'Tarification',
      'payments': 'Paiements',
      'channels': 'Canaux',
      'messaging': 'Messagerie',
      'monitoring': 'Monitoring',
      'sync': 'Synchronisation',
      'kpi': 'KPI Readiness',
      'database': 'Base de Données',
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
          'reservations:view', 'reservations:create', 'reservations:edit',
          'pricing:view', 'pricing:manage',
          'tarification:view', 'tarification:edit',
          'payments:view', 'payments:manage',
          'channels:view', 'channels:manage',
          'messaging:view', 'messaging:send',
          'monitoring:view',
          'sync:view', 'sync:manage',
          'kpi:view',
          'database:view', 'database:manage',
        ];
        setAllPermissions(defaultPermissions);
        setPermissionsByModule({
          'Dashboard': ['dashboard:view'],
          'Propriétés': ['properties:view', 'properties:create', 'properties:edit', 'properties:delete'],
          'Demandes de Service': ['service-requests:view', 'service-requests:create', 'service-requests:edit', 'service-requests:delete'],
          'Interventions': ['interventions:view', 'interventions:create', 'interventions:edit', 'interventions:delete'],
          'Réservations': ['reservations:view', 'reservations:create', 'reservations:edit'],
          'Prix Dynamiques': ['pricing:view', 'pricing:manage'],
          'Équipes': ['teams:view', 'teams:create', 'teams:edit', 'teams:delete'],
          'Portefeuilles': ['portfolios:view', 'portfolios:manage'],
          'Contact': ['contact:view', 'contact:send', 'contact:manage'],
          'Documents': ['documents:view', 'documents:create', 'documents:edit', 'documents:delete', 'documents:compliance'],
          'Rapports': ['reports:view', 'reports:generate', 'reports:download', 'reports:manage'],
          'Tarification': ['tarification:view', 'tarification:edit'],
          'Paiements': ['payments:view', 'payments:manage'],
          'Canaux': ['channels:view', 'channels:manage'],
          'Messagerie': ['messaging:view', 'messaging:send'],
          'Utilisateurs': ['users:manage'],
          'Paramètres': ['settings:view', 'settings:edit'],
          'Monitoring': ['monitoring:view'],
          'Synchronisation': ['sync:view', 'sync:manage'],
          'KPI Readiness': ['kpi:view'],
          'Base de Données': ['database:view', 'database:manage'],
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
      'Dashboard': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><DashboardIcon size={20} strokeWidth={1.75} /></Box>,
      'Propriétés': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><HomeIcon size={20} strokeWidth={1.75} /></Box>,
      'Demandes de Service': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><AssignmentIcon size={20} strokeWidth={1.75} /></Box>,
      'Interventions': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><BuildIcon size={20} strokeWidth={1.75} /></Box>,
      'Équipes': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><GroupIcon size={20} strokeWidth={1.75} /></Box>,
      'Portefeuilles': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><BusinessIcon size={20} strokeWidth={1.75} /></Box>,
      'Contact': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><NotificationsIcon size={20} strokeWidth={1.75} /></Box>,
      'Utilisateurs': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><PersonIcon size={20} strokeWidth={1.75} /></Box>,
      'Paramètres': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><SettingsIcon size={20} strokeWidth={1.75} /></Box>,
      'Rapports': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><AssessmentIcon size={20} strokeWidth={1.75} /></Box>,
      'Documents': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><DescriptionIcon size={20} strokeWidth={1.75} /></Box>,
      'Réservations': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><EventNoteIcon size={20} strokeWidth={1.75} /></Box>,
      'Prix Dynamiques': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><TrendingUpIcon size={20} strokeWidth={1.75} /></Box>,
      'Tarification': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><TarificationIcon size={20} strokeWidth={1.75} /></Box>,
      'Paiements': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><PaymentIcon size={20} strokeWidth={1.75} /></Box>,
      'Canaux': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><ChannelsIcon size={20} strokeWidth={1.75} /></Box>,
      'Messagerie': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><ChatIcon size={20} strokeWidth={1.75} /></Box>,
      'Monitoring': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><MonitorIcon size={20} strokeWidth={1.75} /></Box>,
      'Synchronisation': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><SyncIcon size={20} strokeWidth={1.75} /></Box>,
      'KPI Readiness': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><SpeedIcon size={20} strokeWidth={1.75} /></Box>,
      'Base de Données': <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><DatabaseIcon size={20} strokeWidth={1.75} /></Box>,
    };
    return iconMap[moduleName] || <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><InfoIcon size={20} strokeWidth={1.75} /></Box>;
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
                startIcon={<Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><RefreshIcon size={20} strokeWidth={1.75} /></Box>}
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
                startIcon={<Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><StorageIcon size={20} strokeWidth={1.75} /></Box>}
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
                startIcon={<Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><SaveIcon size={20} strokeWidth={1.75} /></Box>}
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

      {/* Sélection du rôle via tabs */}
      <PageTabs
        options={sortRoles(roles).map((role) => ({
          value: role,
          label: role,
          icon: ROLE_ICONS[role] ?? <PersonIcon />,
        }))}
        value={selectedRole ?? ''}
        onChange={(v) => setSelectedRole(v as string)}
        ariaLabel="Sélection du rôle"
      />

      {/* Résumé du rôle sélectionné */}
      {selectedRole && (
        <Card sx={{ mb: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
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
          </CardContent>
        </Card>
      )}

      {/* Résumé des permissions (chiffres clés) */}
      {selectedRole && rolePermissions && (
        <Card sx={{ mb: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <Box>
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
          </CardContent>
        </Card>
      )}

      {/* Onglets pour la configuration et la démonstration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <PageTabs
              options={[
                { label: 'Édition des Permissions', icon: <SettingsIcon />, disabled: !selectedRole || !rolePermissions },
                { label: 'Démonstration des Effets', icon: <SecurityIcon />, disabled: !selectedRole || !rolePermissions },
              ]}
              value={activeTab}
              onChange={setActiveTab}
              paper={false}
              mb={0}
              ariaLabel="Configuration des permissions"
            />
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
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {Object.entries(permissionsByModule).map(([moduleName, permissions]) => {
                    const activeCount = permissions.filter(p => rolePermissions.permissions.includes(p)).length;
                    const allActive = activeCount === permissions.length;
                    const noneActive = activeCount === 0;

                    return (
                      <Accordion
                        key={moduleName}
                        disableGutters
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: '8px !important',
                          '&:before': { display: 'none' },
                          boxShadow: 'none',
                          overflow: 'hidden',
                          '&.Mui-expanded': {
                            borderColor: 'primary.main',
                            boxShadow: 1,
                          },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          sx={{
                            minHeight: 48,
                            px: 2,
                            '& .MuiAccordionSummary-content': {
                              alignItems: 'center',
                              gap: 1.5,
                              my: 0.75,
                            },
                          }}
                        >
                          <Box sx={{
                            p: 0.5,
                            bgcolor: 'grey.100',
                            borderRadius: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {getModuleIcon(moduleName)}
                          </Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                            {moduleName}
                          </Typography>
                          <Chip
                            label={`${activeCount}/${permissions.length}`}
                            size="small"
                            color={allActive ? 'success' : noneActive ? 'default' : 'primary'}
                            variant="outlined"
                            sx={{ fontSize: '0.72rem', height: 22, mr: 1 }}
                          />
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                            {permissions.map((permission) => {
                              const isActive = rolePermissions.permissions.includes(permission);
                              return (
                                <Box
                                  key={permission}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    p: 1.25,
                                    borderRadius: 1,
                                    bgcolor: isActive ? 'success.light' : 'grey.50',
                                    border: '1px solid',
                                    borderColor: isActive ? 'success.main' : 'grey.200',
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
                                        boxShadow: 1,
                                      },
                                    }}
                                  />
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                                    {isActive ? (
                                      <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><CheckCircleIcon size={16} strokeWidth={1.75} /></Box>
                                    ) : (
                                      <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><ErrorIcon size={16} strokeWidth={1.75} /></Box>
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
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Box>
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

