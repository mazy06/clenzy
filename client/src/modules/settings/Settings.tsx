import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Alert,
  Snackbar,
  CircularProgress,
  Tabs,
  Tab,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Notifications,
  Security,
  Person,
  Save,
  Refresh,
  Palette,
  Storage,
  TuneOutlined,
  BugReport,
  LightMode,
  DarkMode,
  SettingsBrightness,
  VolumeUp,
  BarChart,
  GroupAdd,
  ChatBubbleOutline,
  TrendingUp,
  AccountBalance,
  Payment,
  AutoAwesome,
  Extension,
  CalendarMonth,
} from '../../icons';
import { guestMessagingApi } from '../../services/api/guestMessagingApi';
import type { MessagingAutomationConfig } from '../../services/api/guestMessagingApi';
import { useWorkflowSettings } from '../../hooks/useWorkflowSettings';
import { useNoiseMonitoring } from '../../hooks/useNoiseMonitoring';
import { useAuth } from '../../hooks/useAuth';
import { useThemeMode } from '../../hooks/useThemeMode';
import storageService, { STORAGE_KEYS } from '../../services/storageService';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useQueryClient } from '@tanstack/react-query';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { organizationsApi } from '../../services/api/organizationsApi';
import { reservationsApi } from '../../services/api/reservationsApi';
import { propertiesApi } from '../../services/api/propertiesApi';
import { planningKeys } from '../../hooks/useDashboardPlanning';
import PageHeader from '../../components/PageHeader';
import NotificationPreferencesCard from './NotificationPreferencesCard';
import type { NotificationPreferencesHandle } from './NotificationPreferencesCard';
import OrganizationSection from '../organization/OrganizationSection';
import MessagingAutomationSection from '../messaging/MessagingAutomationSection';
import FiscalProfileSection from './FiscalProfileSection';
import TaxRulesSection from './TaxRulesSection';
import PaymentSettings from './PaymentSettings';
import AiSettingsSection from './AiSettingsSection';
import IntegrationsSection from './IntegrationsSection';
import PayoutScheduleSettings from './PayoutScheduleSettings';
import OwnerPayoutSettings from './OwnerPayoutSettings';
import SepaDebtorSettings from './SepaDebtorSettings';
import MyPayoutSettings from './MyPayoutSettings';
import { CURRENCY_OPTIONS } from '../../utils/currencyUtils';

// ─── TabPanel ─────────────────────────────────────────────────────────────────

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>{children}</Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

export default function Settings() {
  const { user, hasPermissionAsync, hasAnyRole } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { completeStep, steps } = useOnboarding();
  const isConfigureOrgDone = steps.find((s) => s.key === 'configure_org')?.completed ?? false;
  const { preferences, updatePreferences, isSaving: isSavingPrefs } = useUserPreferences();
  const { settings: workflowSettings, updateSettings: updateWorkflowSettings } = useWorkflowSettings();
  const { mode: themeMode, setMode: setThemeMode, isDark } = useThemeMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'integrations' ? 7 : parseInt(tabParam || '0', 10);
  const [tabValue, setTabValue] = useState(isNaN(initialTab) ? 0 : initialTab);

  // OAuth callback status handling
  const oauthStatus = searchParams.get('status');
  const isValidOauthStatus = oauthStatus === 'success' || oauthStatus === 'error';
  const [oauthSnackbar, setOauthSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: isValidOauthStatus,
    message: oauthStatus === 'success'
      ? t('settings.integrations.pennylane.connectionSuccess')
      : oauthStatus === 'error'
        ? t('settings.integrations.pennylane.connectionError')
        : '',
    severity: oauthStatus === 'error' ? 'error' : 'success',
  });

  // Ref pour NotificationPreferencesCard
  const notifRef = useRef<NotificationPreferencesHandle>(null);
  // Force re-render quand les notifications changent pour mettre à jour le bouton
  const [, forceUpdate] = useState(0);

  // Vérifier les permissions pour les paramètres
  const [canViewSettings, setCanViewSettings] = useState(false);
  const [canEditSettings, setCanEditSettings] = useState(false);
  const [canViewAi, setCanViewAi] = useState(false);

  // TOUS les useState DOIVENT être déclarés AVANT les vérifications conditionnelles
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: false,
      sms: false,
    },
    business: {
      companyName: 'Clenzy',
      timezone: 'Europe/Paris',
      currency: 'EUR',
      language: 'fr',
    },
    display: {
      theme: 'light',
      compactMode: false,
      showAvatars: true,
    },
  });

  // Sync display settings from localStorage (pure UI preferences — stay in localStorage)
  useEffect(() => {
    const saved = storageService.getJSON<typeof settings>(STORAGE_KEYS.SETTINGS);
    if (saved) {
      setSettings(prev => ({
        ...prev,
        display: {
          ...(saved.display ?? prev.display),
          theme: themeMode,
        },
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        display: { ...prev.display, theme: themeMode },
      }));
    }
  }, [themeMode]);

  // Sync business & notification settings from BDD (source of truth)
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        email: preferences.notifyEmail,
        push: preferences.notifyPush,
        sms: preferences.notifySms,
      },
      business: {
        ...prev.business,
        timezone: preferences.timezone,
        currency: preferences.currency,
        language: preferences.language,
      },
    }));
  }, [preferences]);

  // Sync companyName from Organization entity
  useEffect(() => {
    const orgId = user?.organizationId;
    if (!orgId) return;
    organizationsApi.getById(orgId).then((org) => {
      if (org?.name) {
        setSettings(prev => ({
          ...prev,
          business: { ...prev.business, companyName: org.name },
        }));
      }
    }).catch(() => { /* ignore */ });
  }, [user?.organizationId]);

  const [planningMock, setPlanningMock] = useState(
    () => localStorage.getItem(STORAGE_KEYS.PLANNING_MOCK) === 'true'
  );

  // Noise monitoring (Minut) mock
  const { enabled: noiseMonitoringEnabled, setEnabled: setNoiseMonitoringEnabled } = useNoiseMonitoring();

  // Analytics mock
  const [analyticsMock, setAnalyticsMock] = useState(
    () => localStorage.getItem(STORAGE_KEYS.ANALYTICS_MOCK) === 'true'
  );

  // Auto-push pricing global toggle
  const [autoPushPricingEnabled, setAutoPushPricingEnabled] = useState(false);

  useEffect(() => {
    guestMessagingApi.getConfig()
      .then((cfg) => setAutoPushPricingEnabled(cfg.autoPushPricingEnabled))
      .catch(() => {});
  }, []);

  const handleToggleAutoPushPricing = async (enabled: boolean) => {
    setAutoPushPricingEnabled(enabled);
    try {
      await guestMessagingApi.updateConfig({ autoPushPricingEnabled: enabled });
    } catch {
      setAutoPushPricingEnabled(!enabled); // revert on error
    }
  };

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Vérifier les permissions au chargement
  useEffect(() => {
    const checkPermissions = async () => {
      const viewPermission = await hasPermissionAsync('settings:view');
      const editPermission = await hasPermissionAsync('settings:edit');
      const aiPermission = await hasPermissionAsync('ai:view');

      setCanViewSettings(viewPermission);
      setCanEditSettings(editPermission);
      setCanViewAi(aiPermission);
    };

    checkPermissions();
  }, [hasPermissionAsync]);

  // Attendre que l'utilisateur soit complètement chargé APRÈS tous les hooks
  if (!user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Si pas de permission, afficher un message informatif
  if (!canViewSettings) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>
            Accès non autorisé
          </Typography>
          <Typography variant="body1">
            Vous n'avez pas les permissions nécessaires pour accéder aux paramètres.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const handleSettingChange = (category: string, setting: string, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [setting]: value,
      },
    }));
  };

  const handleSave = async () => {
    try {
      // 1. Display settings → localStorage (pure UI, per-device)
      storageService.setJSON(STORAGE_KEYS.SETTINGS, { display: settings.display });

      // 2. Business & notification preferences → BDD (source of truth)
      await updatePreferences({
        timezone: settings.business.timezone,
        currency: settings.business.currency,
        language: settings.business.language,
        notifyEmail: settings.notifications.email,
        notifyPush: settings.notifications.push,
        notifySms: settings.notifications.sms,
      });

      // 3. Company name → Organization entity
      const orgId = user?.organizationId;
      if (orgId) {
        try {
          await organizationsApi.update(orgId, { name: settings.business.companyName });
        } catch { /* non-blocking */ }
      }

      // 4. Invalidate onboarding auto-checks
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'me'] });

      setSnackbarMessage('Paramètres sauvegardés avec succès');
      setSnackbarOpen(true);
      if (!isConfigureOrgDone) {
        completeStep('configure_org');
      }
    } catch {
      setSnackbarMessage('Erreur lors de la sauvegarde des paramètres');
      setSnackbarOpen(true);
    }
  };

  const handleReset = async () => {
    const defaultSettings = {
      notifications: { email: true, push: false, sms: false },
      business: { companyName: '', timezone: 'Europe/Paris', currency: 'EUR', language: 'fr' },
      display: { theme: 'light' as const, compactMode: false, showAvatars: true },
    };
    setSettings(defaultSettings);
    storageService.setJSON(STORAGE_KEYS.SETTINGS, { display: defaultSettings.display });
    // Reset BDD preferences too
    try {
      await updatePreferences({
        timezone: 'Europe/Paris',
        currency: 'EUR',
        language: 'fr',
        notifyEmail: true,
        notifyPush: false,
        notifySms: false,
      });
    } catch { /* ignore */ }
    setSnackbarMessage('Paramètres réinitialisés');
    setSnackbarOpen(true);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setSearchParams(newValue === 0 ? {} : { tab: String(newValue) }, { replace: true });
  };

  const handleNotifSave = async () => {
    if (notifRef.current) {
      await notifRef.current.save();
      forceUpdate(n => n + 1);
    }
  };

  // ─── Actions dynamiques selon l'onglet ────────────────────────────────────

  const headerActions = tabValue === 0 ? (
    <>
      <Button
        variant="outlined"
        startIcon={<Refresh />}
        onClick={handleReset}
        size="small"
        title="Réinitialiser"
      >
        Réinitialiser
      </Button>
      <Button
        variant="contained"
        startIcon={<Save />}
        onClick={handleSave}
        size="small"
        title="Sauvegarder"
      >
        Sauvegarder
      </Button>
    </>
  ) : tabValue === 1 && notifRef.current?.hasChanges() ? (
    <Button
      variant="contained"
      startIcon={notifRef.current?.isSaving ? <CircularProgress size={16} color="inherit" /> : <Save />}
      onClick={handleNotifSave}
      disabled={notifRef.current?.isSaving}
      size="small"
      title="Sauvegarder"
    >
      {notifRef.current?.isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
    </Button>
  ) : undefined;

  return (
    <Box>
      {/* Header avec actions */}
      <PageHeader
        title="Paramètres"
        subtitle="Configurez votre application selon vos préférences"
        iconBadge={<TuneOutlined />}
        backPath="/"
        showBackButton={false}
        actions={headerActions}
      />

      {/* Onglets */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="settings-tabs"
          sx={{
            minHeight: 42,
            '& .MuiTab-root': {
              minHeight: 42,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
            },
          }}
        >
          <Tab
            icon={<TuneOutlined size={18} strokeWidth={1.75} />}
            iconPosition="start"
            label="Général"
            {...a11yProps(0)}
          />
          <Tab
            icon={<Notifications size={18} strokeWidth={1.75} />}
            iconPosition="start"
            label="Notifications"
            {...a11yProps(1)}
          />
          <Tab
            icon={<ChatBubbleOutline size={18} strokeWidth={1.75} />}
            iconPosition="start"
            label="Messagerie"
            {...a11yProps(2)}
          />
          {hasAnyRole(['HOST']) && (
            <Tab
              icon={<AccountBalance size={18} strokeWidth={1.75} />}
              iconPosition="start"
              label={t('settings.myPayout.tabLabel', 'Mes reversements')}
              {...a11yProps(3)}
            />
          )}
          {canViewAi && (
            <Tab
              icon={<AutoAwesome size={18} strokeWidth={1.75} />}
              iconPosition="start"
              label="IA"
              {...a11yProps(3)}
            />
          )}
          {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
            <Tab
              icon={<AccountBalance size={18} strokeWidth={1.75} />}
              iconPosition="start"
              label="Fiscal"
              {...a11yProps(4)}
            />
          )}
          {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
            <Tab
              icon={<GroupAdd size={18} strokeWidth={1.75} />}
              iconPosition="start"
              label="Organisation"
              {...a11yProps(5)}
            />
          )}
          {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
            <Tab
              icon={<Payment size={18} strokeWidth={1.75} />}
              iconPosition="start"
              label="Paiement"
              {...a11yProps(6)}
            />
          )}
          {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
            <Tab
              icon={<Extension size={18} strokeWidth={1.75} />}
              iconPosition="start"
              label="Intégrations"
              {...a11yProps(7)}
            />
          )}
          {hasAnyRole(['SUPER_ADMIN']) && (
            <Tab
              icon={<CalendarMonth size={18} strokeWidth={1.75} />}
              iconPosition="start"
              label="Reversements"
              {...a11yProps(8)}
            />
          )}
        </Tabs>
      </Box>

      {/* ─── Onglet Général ─────────────────────────────────────────────── */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>

          {/* Mon compte */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'secondary.main' }}><Person size={20} strokeWidth={1.75} /></Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                  Mon compte
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Prenom"
                    value={user?.firstName || ''}
                    disabled
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nom"
                    value={user?.lastName || ''}
                    disabled
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nom d'utilisateur"
                    value={user?.username || ''}
                    disabled
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={user?.email || ''}
                    disabled
                    size="small"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nom de l'entreprise"
                    value={settings.business.companyName}
                    onChange={(e) => handleSettingChange('business', 'companyName', e.target.value)}
                    size="small"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Fuseau horaire"
                    value={settings.business.timezone}
                    onChange={(e) => handleSettingChange('business', 'timezone', e.target.value)}
                    select
                    size="small"
                    SelectProps={{ native: true }}
                  >
                    <option value="Europe/Paris">Europe/Paris</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Devise"
                    value={settings.business.currency}
                    onChange={(e) => handleSettingChange('business', 'currency', e.target.value)}
                    select
                    size="small"
                    SelectProps={{ native: true }}
                  >
                    {CURRENCY_OPTIONS.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Langue"
                    value={settings.business.language}
                    onChange={(e) => handleSettingChange('business', 'language', e.target.value)}
                    select
                    size="small"
                    SelectProps={{ native: true }}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </TextField>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Workflow */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'secondary.main' }}><Storage size={20} strokeWidth={1.75} /></Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                  Workflow
                </Typography>
              </Box>

              <List>
                <ListItem>
                  <ListItemText
                    primary="Délai d'annulation (heures)"
                    secondary="Temps limite pour annuler une demande approuvée"
                  />
                  <TextField
                    type="number"
                    value={workflowSettings.cancellationDeadlineHours}
                    onChange={(e) => updateWorkflowSettings({ cancellationDeadlineHours: parseInt(e.target.value) })}
                    sx={{ width: 80 }}
                    size="small"
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Person />
                  </ListItemIcon>
                  <ListItemText
                    primary="Attribution automatique"
                    secondary="Attribuer automatiquement les interventions"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={workflowSettings.autoAssignInterventions}
                      onChange={(e) => updateWorkflowSettings({ autoAssignInterventions: e.target.checked })}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Security />
                  </ListItemIcon>
                  <ListItemText
                    primary="Approbation requise"
                    secondary="Demander approbation pour les modifications"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={workflowSettings.requireApprovalForChanges}
                      onChange={(e) => updateWorkflowSettings({ requireApprovalForChanges: e.target.checked })}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <TrendingUp />
                  </ListItemIcon>
                  <ListItemText
                    primary="Push automatique des prix"
                    secondary="Pousser automatiquement les prix vers Airbnb (toutes les heures)"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={autoPushPricingEnabled}
                      onChange={(e) => handleToggleAutoPushPricing(e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </Paper>
          </Grid>

          {/* Affichage */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'secondary.main' }}><Palette size={20} strokeWidth={1.75} /></Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                  Affichage
                </Typography>
              </Box>

              <List>
                <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1.5, py: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Palette size={20} strokeWidth={1.75} /></Box>
                    <ListItemText
                      primary="Apparence"
                      secondary={
                        themeMode === 'auto'
                          ? `Système (${isDark ? 'sombre' : 'clair'} détecté)`
                          : themeMode === 'dark'
                            ? 'Mode sombre'
                            : 'Mode clair'
                      }
                      sx={{ m: 0 }}
                    />
                  </Box>
                  <ToggleButtonGroup
                    value={themeMode}
                    exclusive
                    onChange={(_e, newMode) => {
                      if (newMode !== null) {
                        handleSettingChange('display', 'theme', newMode);
                        setThemeMode(newMode);
                      }
                    }}
                    size="small"
                    fullWidth
                    sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontSize: '0.8125rem', gap: 0.75, py: 0.75 } }}
                  >
                    <ToggleButton value="light">
                      <LightMode size={18} strokeWidth={1.75} />
                      Clair
                    </ToggleButton>
                    <ToggleButton value="dark">
                      <DarkMode size={18} strokeWidth={1.75} />
                      Sombre
                    </ToggleButton>
                    <ToggleButton value="auto">
                      <SettingsBrightness size={18} strokeWidth={1.75} />
                      Système
                    </ToggleButton>
                  </ToggleButtonGroup>
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Storage />
                  </ListItemIcon>
                  <ListItemText
                    primary="Mode compact"
                    secondary="Réduire l'espacement des éléments"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={settings.display.compactMode}
                      onChange={(e) => handleSettingChange('display', 'compactMode', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Person />
                  </ListItemIcon>
                  <ListItemText
                    primary="Afficher les avatars"
                    secondary="Montrer les photos de profil des utilisateurs"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={settings.display.showAvatars}
                      onChange={(e) => handleSettingChange('display', 'showAvatars', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </Paper>
          </Grid>

          {/* Développement (admin only) */}
          {(user.roles.includes('SUPER_ADMIN')) && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'warning.main' }}><BugReport size={20} strokeWidth={1.75} /></Box>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                    Développement
                  </Typography>
                </Box>

                <List>
                  <ListItem>
                    <ListItemIcon>
                      <BugReport />
                    </ListItemIcon>
                    <ListItemText
                      primary="Données de démonstration (Planning)"
                      secondary="Afficher des réservations et interventions fictives dans le planning"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        edge="end"
                        checked={planningMock}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setPlanningMock(enabled);
                          reservationsApi.setMockMode(enabled);
                          // Invalider tout le cache planning pour refresh immédiat
                          queryClient.invalidateQueries({ queryKey: planningKeys.all });
                        }}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <VolumeUp />
                    </ListItemIcon>
                    <ListItemText
                      primary="Monitoring sonore Minut (démo)"
                      secondary="Simuler les données de capteurs de bruit dans le dashboard Analytics"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        edge="end"
                        checked={noiseMonitoringEnabled}
                        onChange={(e) => setNoiseMonitoringEnabled(e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <BarChart />
                    </ListItemIcon>
                    <ListItemText
                      primary="Données de démonstration (Analytics)"
                      secondary="Afficher des KPIs, graphiques et recommandations avec des données fictives"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        edge="end"
                        checked={analyticsMock}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setAnalyticsMock(enabled);
                          reservationsApi.setAnalyticsMockMode(enabled);
                          propertiesApi.setMockMode(enabled);
                          // Invalider tous les caches analytics + overview + planning pour refresh immédiat
                          queryClient.invalidateQueries({ queryKey: ['analytics-reservations'] });
                          queryClient.invalidateQueries({ queryKey: ['analytics-properties'] });
                          queryClient.invalidateQueries({ queryKey: ['analytics-interventions'] });
                          queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
                          queryClient.invalidateQueries({ queryKey: planningKeys.all });
                        }}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </Paper>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* ─── Onglet Notifications ───────────────────────────────────────── */}
      <TabPanel value={tabValue} index={1}>
        <NotificationPreferencesCard
          ref={notifRef}
          onChangeState={() => forceUpdate(n => n + 1)}
        />
      </TabPanel>

      {/* ─── Onglet Messagerie ────────────────────────────────────────── */}
      <TabPanel value={tabValue} index={2}>
        <MessagingAutomationSection />
      </TabPanel>

      {/* ─── Onglet Mes reversements (HOST) ────────────────────────── */}
      {hasAnyRole(['HOST']) && (
        <TabPanel value={tabValue} index={3}>
          <MyPayoutSettings />
        </TabPanel>
      )}

      {/* ─── Onglet IA (permission ai:view) ───────────────────────── */}
      {canViewAi && (
        <TabPanel value={tabValue} index={3}>
          <AiSettingsSection />
        </TabPanel>
      )}

      {/* ─── Onglet Fiscal (ADMIN/MANAGER) ────────────────────────── */}
      {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
        <TabPanel value={tabValue} index={4}>
          <FiscalProfileSection />
          <Box sx={{ mt: 3 }} />
          <TaxRulesSection />
        </TabPanel>
      )}

      {/* ─── Onglet Organisation (ADMIN/MANAGER) ─────────────────────── */}
      {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
        <TabPanel value={tabValue} index={5}>
          <OrganizationSection
            organizationId={user?.organizationId}
            organizationName={user?.organizationName}
          />
        </TabPanel>
      )}

      {/* ─── Onglet Paiement (ADMIN/MANAGER) ─────────────────────────── */}
      {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
        <TabPanel value={tabValue} index={6}>
          <PaymentSettings />
        </TabPanel>
      )}

      {/* ─── Onglet Intégrations (ADMIN/MANAGER) ──────────────────────── */}
      {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
        <TabPanel value={tabValue} index={7}>
          <IntegrationsSection />
        </TabPanel>
      )}

      {/* ─── Onglet Reversements (SUPER_ADMIN) ──────────────────────────── */}
      {hasAnyRole(['SUPER_ADMIN']) && (
        <TabPanel value={tabValue} index={8}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <SepaDebtorSettings />
            </Grid>
            <Grid item xs={12} md={6}>
              <PayoutScheduleSettings />
            </Grid>
          </Grid>
          <Box sx={{ mt: 4 }} />
          <OwnerPayoutSettings />
        </TabPanel>
      )}

      {/* Snackbar de confirmation */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* OAuth callback snackbar */}
      <Snackbar
        open={oauthSnackbar.open}
        autoHideDuration={6000}
        onClose={() => {
          setOauthSnackbar(prev => ({ ...prev, open: false }));
          // Clean URL params
          searchParams.delete('status');
          setSearchParams(searchParams, { replace: true });
        }}
      >
        <Alert
          onClose={() => {
            setOauthSnackbar(prev => ({ ...prev, open: false }));
            searchParams.delete('status');
            setSearchParams(searchParams, { replace: true });
          }}
          severity={oauthSnackbar.severity}
          sx={{ width: '100%' }}
        >
          {oauthSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
