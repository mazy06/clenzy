import React, { useState, useEffect } from 'react';
import { cn } from '../utils/cn';
import StatusChip from './StatusChip';
import { Alert as UiAlert, AlertDescription } from './ui';
import { TriangleAlert, Info } from 'lucide-react';
import { Spinner } from './ui';
import { Box, Card, CardContent, Grid, Button, Alert, Snackbar, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
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
import { permissionsApi } from '../services/api/permissionsApi';

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

// Fonction pour obtenir le nom d'affichage du module
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

// Fonction pour obtenir l'icône appropriée pour chaque module
const getModuleIcon = (moduleName: string) => {
  const iconMap: { [key: string]: React.ReactNode } = {
    'Dashboard': <span className="inline-flex text-muted-foreground"><DashboardIcon size={20} strokeWidth={1.75} /></span>,
    'Propriétés': <span className="inline-flex text-muted-foreground"><HomeIcon size={20} strokeWidth={1.75} /></span>,
    'Demandes de Service': <span className="inline-flex text-muted-foreground"><AssignmentIcon size={20} strokeWidth={1.75} /></span>,
    'Interventions': <span className="inline-flex text-muted-foreground"><BuildIcon size={20} strokeWidth={1.75} /></span>,
    'Équipes': <span className="inline-flex text-muted-foreground"><GroupIcon size={20} strokeWidth={1.75} /></span>,
    'Portefeuilles': <span className="inline-flex text-muted-foreground"><BusinessIcon size={20} strokeWidth={1.75} /></span>,
    'Contact': <span className="inline-flex text-muted-foreground"><NotificationsIcon size={20} strokeWidth={1.75} /></span>,
    'Utilisateurs': <span className="inline-flex text-muted-foreground"><PersonIcon size={20} strokeWidth={1.75} /></span>,
    'Paramètres': <span className="inline-flex text-muted-foreground"><SettingsIcon size={20} strokeWidth={1.75} /></span>,
    'Rapports': <span className="inline-flex text-muted-foreground"><AssessmentIcon size={20} strokeWidth={1.75} /></span>,
    'Documents': <span className="inline-flex text-muted-foreground"><DescriptionIcon size={20} strokeWidth={1.75} /></span>,
    'Réservations': <span className="inline-flex text-muted-foreground"><EventNoteIcon size={20} strokeWidth={1.75} /></span>,
    'Prix Dynamiques': <span className="inline-flex text-muted-foreground"><TrendingUpIcon size={20} strokeWidth={1.75} /></span>,
    'Tarification': <span className="inline-flex text-muted-foreground"><TarificationIcon size={20} strokeWidth={1.75} /></span>,
    'Paiements': <span className="inline-flex text-muted-foreground"><PaymentIcon size={20} strokeWidth={1.75} /></span>,
    'Canaux': <span className="inline-flex text-muted-foreground"><ChannelsIcon size={20} strokeWidth={1.75} /></span>,
    'Messagerie': <span className="inline-flex text-muted-foreground"><ChatIcon size={20} strokeWidth={1.75} /></span>,
    'Monitoring': <span className="inline-flex text-muted-foreground"><MonitorIcon size={20} strokeWidth={1.75} /></span>,
    'Synchronisation': <span className="inline-flex text-muted-foreground"><SyncIcon size={20} strokeWidth={1.75} /></span>,
    'KPI Readiness': <span className="inline-flex text-muted-foreground"><SpeedIcon size={20} strokeWidth={1.75} /></span>,
    'Base de Données': <span className="inline-flex text-muted-foreground"><DatabaseIcon size={20} strokeWidth={1.75} /></span>,
  };
  return iconMap[moduleName] || <span className="inline-flex text-muted-foreground"><InfoIcon size={20} strokeWidth={1.75} /></span>;
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

  if (!user) {
    return (
      <div>
        <UiAlert variant="warning">
          <TriangleAlert />
          <AlertDescription>Aucun utilisateur connecté</AlertDescription>
        </UiAlert>
      </div>
    );
  }

  if (loading || loadingPermissions) {
    return (
      <div className="flex justify-center">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <UiAlert variant="destructive">
          <TriangleAlert />
          <AlertDescription>Erreur: {error}</AlertDescription>
        </UiAlert>
      </div>
    );
  }

  const rolePermissionSet = new Set(rolePermissions?.permissions ?? []);

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle={`Utilisateur: ${user.username} (${user.email}) - Rôle: ${user.roles.join(', ')}`}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          selectedRole && rolePermissions && (
            <div className="flex gap-1.5 items-center">
              <Button
                variant="outlined"
                size="small"
                color="warning"
                startIcon={<span className="inline-flex text-muted-foreground"><RefreshIcon size={20} strokeWidth={1.75} /></span>}
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
                startIcon={<span className="inline-flex text-muted-foreground"><StorageIcon size={20} strokeWidth={1.75} /></span>}
                onClick={async () => {
                  try {
                    await resetToInitialPermissions(selectedRole);
                    triggerGlobalRefresh();
                    setSaveNotification({
                      open: true,
                      message: 'Permissions réinitialisées aux valeurs initiales.',
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
                startIcon={<span className="inline-flex text-muted-foreground"><SaveIcon size={20} strokeWidth={1.75} /></span>}
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
                      message: 'Permissions sauvegardées.',
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
            </div>
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
            <div className="flex items-center gap-3 flex-wrap">
              <p className="cn-text-body2 text-muted-foreground">
                Rôle sélectionné : <strong>{selectedRole}</strong>
              </p>
              {rolePermissions && (
                <>
                  <p className="cn-text-body2 text-muted-foreground">
                    • {rolePermissions.permissions.length} permissions actives
                  </p>
                  <StatusChip
                    tone={rolePermissions.isDefault ? 'ok' : 'warn'}
                    label={rolePermissions.isDefault ? 'Par défaut' : 'Modifié'}
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résumé des permissions (chiffres clés) */}
      {selectedRole && rolePermissions && (
        <Card sx={{ mb: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <h6 className="cn-text-subtitle2 text-muted-foreground font-medium">
                  Résumé des permissions
                </h6>
              </div>
              
              <Grid container spacing={1}>
                <Grid item xs={3}>
                  <div className="text-center p-1.5">
                    <h6 className="cn-text-h6 text-[var(--info)] font-semibold mb-[3px]">
                      {allPermissions.length}
                    </h6>
                    <span className="cn-text-caption text-muted-foreground">
                      Total
                    </span>
                  </div>
                </Grid>
                
                <Grid item xs={3}>
                  <div className="text-center p-1.5">
                    <h6 className="cn-text-h6 text-[var(--bui-success-ink)] font-semibold mb-0.5">
                      {rolePermissions.permissions.length}
                    </h6>
                    <span className="cn-text-caption text-muted-foreground">
                      Actives
                    </span>
                  </div>
                </Grid>
                
                <Grid item xs={3}>
                  <div className="text-center p-1.5">
                    <h6 className="cn-text-h6 text-destructive font-semibold mb-0.5">
                      {allPermissions.filter(p => !rolePermissionSet.has(p)).length}
                    </h6>
                    <span className="cn-text-caption text-muted-foreground">
                      Inactives
                    </span>
                  </div>
                </Grid>

                <Grid item xs={3}>
                  <div className="text-center p-1.5">
                    <h6 className="cn-text-h6 text-[var(--bui-warning-ink)] font-semibold mb-0.5">
                      {Object.keys(permissionsByModule).filter(module => {
                        const modulePermissions = permissionsByModule[module as keyof typeof permissionsByModule];
                        return modulePermissions.some(permission => rolePermissionSet.has(permission));
                      }).length} / {Object.keys(permissionsByModule).length}
                    </h6>
                    <span className="cn-text-caption text-muted-foreground">
                      Menus accessibles
                    </span>
                  </div>
                </Grid>
              </Grid>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onglets pour la configuration et la démonstration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <div className="mb-3">
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
          </div>

          {/* Contenu de l'onglet Édition des Permissions */}
          {activeTab === 0 && selectedRole && rolePermissions && (
            <div role="tabpanel" id="tabpanel-0" aria-labelledby="tab-0">
              {/* Configuration des permissions par module */}
              <div className="mb-6">
                <h5 className="cn-text-h5 mb-[0.35em] font-semibold mb-4 text-foreground">
                  Permissions par Module
                </h5>
                
                {/* Instructions pour la modification des permissions */}
                <UiAlert variant="info" className="mb-4 text-[1rem]">
                  <Info />
                  <AlertDescription><strong>Mode modification :</strong>Cliquez sur les badges de permissions (chips) pour les activer/désactiver. 
                  Les permissions <strong>vertes</strong>sont actives, les permissions <strong>grises</strong>sont inactives.
                  Les modifications sont temporaires jusqu'à la sauvegarde. Utilisez le bouton <strong>"Sauvegarder"</strong>en haut de page pour persister les changements.</AlertDescription>
                </UiAlert>
                
                {/* Message si aucune permission n'est disponible */}
                {allPermissions.length === 0 && (
                  <UiAlert variant="warning" className="mb-4">
                    <TriangleAlert />
                    <AlertDescription>Aucune permission disponible. Veuillez vérifier que la base de données contient les permissions nécessaires.</AlertDescription>
                  </UiAlert>
                )}
                
                <div className="flex flex-col gap-0.5">
                  {Object.entries(permissionsByModule).map(([moduleName, permissions]) => {
                    const activeCount = permissions.filter(p => rolePermissionSet.has(p)).length;
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
                          <div className="p-0.5 bg-[grey.100] rounded-[0.5px] flex items-center justify-center">
                            {getModuleIcon(moduleName)}
                          </div>
                          <h6 className="cn-text-subtitle2 font-semibold flex-1">
                            {moduleName}
                          </h6>
                          <StatusChip
                            tone={allActive ? 'ok' : noneActive ? 'neutral' : 'accent'}
                            label={`${activeCount}/${permissions.length}`}
                            className="me-1 text-[0.72rem] tabular-nums"
                          />
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                          <div className="flex flex-col gap-1">
                            {permissions.map((permission) => {
                              const isActive = rolePermissionSet.has(permission);
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
                                  {/* Le survol jouait un `scale(1.05)` : la puce
                                      poussait ses voisines a chaque passage de
                                      souris. StatusChip attenue l'opacite, sans
                                      deplacer la ligne. */}
                                  <StatusChip
                                    tone={isActive ? 'ok' : 'neutral'}
                                    label={permission}
                                    pressed={isActive}
                                    onClick={() => togglePermission(permission)}
                                  />
                                  <div className="flex items-center gap-0.5 ms-auto">
                                    {isActive ? (
                                      <span className="inline-flex text-muted-foreground"><CheckCircleIcon size={16} strokeWidth={1.75} /></span>
                                    ) : (
                                      <span className="inline-flex text-muted-foreground"><ErrorIcon size={16} strokeWidth={1.75} /></span>
                                    )}
                                    <span
                                      className={cn(
                                        'cn-text-caption font-medium text-[0.7rem]',
                                        isActive ? 'text-[var(--ok)]' : 'text-[var(--muted)]',
                                      )}
                                    >
                                      {isActive ? 'Actif' : 'Inactif'}
                                    </span>
                                  </div>
                                </Box>
                              );
                            })}
                          </div>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* Contenu de l'onglet Démonstration des Effets */}
          {activeTab === 1 && selectedRole && rolePermissions && (
            <div role="tabpanel" id="tabpanel-1" aria-labelledby="tab-1">
              <PermissionEffectsDemo 
                selectedRole={selectedRole}
                rolePermissions={rolePermissions}
              />
            </div>
          )}


          {/* Message si aucun rôle n'est sélectionné */}
          {!selectedRole && (
            <div className="p-4 text-center">
              <p className="cn-text-body1 text-muted-foreground">
                Veuillez sélectionner un rôle pour commencer la configuration des permissions
              </p>
            </div>
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
    </div>
  );
};

export default PermissionConfig;

