import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  Alert,
  Snackbar,
  CircularProgress,
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
  SmartToy,
  Extension,
  CalendarMonth,
  LocalOffer,
} from '../../icons';
import { guestMessagingApi } from '../../services/api/guestMessagingApi';
import type { MessagingAutomationConfig } from '../../services/api/guestMessagingApi';
import { useWorkflowSettings } from '../../hooks/useWorkflowSettings';
import { useNoiseMonitoring } from '../../hooks/useNoiseMonitoring';
import { useAuth } from '../../hooks/useAuth';
import { useThemeMode } from '../../hooks/useThemeMode';
import storageService, { STORAGE_KEYS, isMockEnabled } from '../../services/storageService';
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
import PageTabs from '../../components/PageTabs';
import { SettingsHeaderProvider, useSettingsHeaderActionsSlot } from './SettingsHeaderContext';

// Type re-export pour la metadata des tabs. Le mapping concret est construit
// dans le composant via {@code useMemo} pour pouvoir appeler {@code t()}.
interface SettingsTabMeta {
  /** Sous-titre affiche dans le PageHeader pour ce tab. */
  subtitle: string;
}
import NotificationPreferencesCard from './NotificationPreferencesCard';
import type { NotificationPreferencesHandle } from './NotificationPreferencesCard';
import MarketingPreferencesCard from './MarketingPreferencesCard';
import OrganizationSection from '../organization/OrganizationSection';
import MessagingAutomationSection from '../messaging/MessagingAutomationSection';
import WhatsAppProviderConfigSection from './WhatsAppProviderConfigSection';
import FiscalProfileSection from './FiscalProfileSection';
import type { FiscalProfileHandle } from './FiscalProfileSection';
import SepaDebtorSettings, { type SepaDebtorHandle } from './SepaDebtorSettings';
import PayoutScheduleSettings, { type PayoutScheduleHandle } from './PayoutScheduleSettings';
import TaxRulesSection from './TaxRulesSection';
import PaymentSettings from './PaymentSettings';
import AiSettingsSection from './AiSettingsSection';
import IntegrationsSection from './IntegrationsSection';
import IntegrationsHeader from './components/IntegrationsHeader';
import AmenityMappingPage from './amenity-mapping/AmenityMappingPage';
import {
  ALL_SERVICES,
  getDomIdForCategory,
  type ServiceIndexEntry,
} from '../../services/integrations/allServicesIndex';
import OwnerPayoutSettings from './OwnerPayoutSettings';
import MyPayoutSettings from './MyPayoutSettings';
import { CURRENCY_OPTIONS } from '../../utils/currencyUtils';
import SettingsSection from './components/SettingsSection';
import SettingsToggleRow from './components/SettingsToggleRow';
import { userAvatarSrc } from '../../services/api/usersApi';

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

  // ─── Etat tab Integrations (hoiste depuis IntegrationsSection) ──────────
  // Permet d'injecter la barre de recherche + filtre categorie dans le slot
  // {@code filters} du PageHeader (au lieu d'occuper l'espace sous les tabs).
  //
  // Deux niveaux de filtre cumulatifs :
  // - {@code integrationsCategoryId} : null = toutes les sections visibles ;
  //   sinon affichage de la seule section correspondante.
  // - {@code integrationsServiceId} : null = toutes les cards de la section
  //   visibles ; sinon on n'affiche que la card du service recherche.
  //
  // L'autocomplete renseigne les DEUX (categorie auto-derivee depuis le
  // service) ; le dropdown categorie ne touche QUE la categorie et reset le
  // service (l'utilisateur a explicitement change de scope).
  const [integrationsCategoryId, setIntegrationsCategoryId] = useState<string | null>(null);
  const [integrationsServiceId, setIntegrationsServiceId] = useState<string | null>(null);

  const handleIntegrationsCategoryChange = (categoryId: string | null) => {
    setIntegrationsCategoryId(categoryId);
    setIntegrationsServiceId(null);
  };

  // Quand l'utilisateur selectionne un service dans l'autocomplete, on veut
  // scroller vers la section correspondante. Le useEffect s'execute apres le
  // commit phase, donc le DOM est a jour quand on cherche l'element.
  const [pendingScrollDomId, setPendingScrollDomId] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingScrollDomId) return;
    const el = document.getElementById(pendingScrollDomId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setPendingScrollDomId(null);
  }, [pendingScrollDomId, integrationsCategoryId]);

  const handleIntegrationsServiceSelect = (service: ServiceIndexEntry | null) => {
    if (!service) {
      // Clic sur le X de l'autocomplete = retour a la vue complete : on reset
      // les DEUX filtres (service + categorie). Le filtre categorie avait ete
      // auto-derive lors de la selection, donc le clear de la recherche doit
      // logiquement annuler ce derive.
      setIntegrationsServiceId(null);
      setIntegrationsCategoryId(null);
      return;
    }
    // Auto-derive le filtre categorie depuis le service choisi. Resultat :
    // l'utilisateur voit UNIQUEMENT la section de la categorie + UNIQUEMENT
    // le service recherche dans cette section, ET le nom du service apparait
    // dans l'input de l'autocomplete (mode controle).
    setIntegrationsCategoryId(service.categoryId);
    setIntegrationsServiceId(service.id);
    const domId = getDomIdForCategory(service.categoryId);
    if (domId) {
      setPendingScrollDomId(domId);
    }
  };

  // Derive l'objet {@code ServiceIndexEntry} a partir de l'id pour le passer
  // en {@code value} a l'autocomplete (mode controle complet).
  const selectedIntegrationsService = integrationsServiceId
    ? ALL_SERVICES.find((s) => s.id === integrationsServiceId) ?? null
    : null;

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
  // Ref pour FiscalProfileSection (bouton Sauvegarder dans le PageHeader)
  const fiscalRef = useRef<FiscalProfileHandle>(null);
  // Refs pour l'onglet Reversements (bouton unifié dans le PageHeader)
  const sepaRef = useRef<SepaDebtorHandle>(null);
  const scheduleRef = useRef<PayoutScheduleHandle>(null);
  // Force re-render quand les sections enfants signalent un changement pour mettre à jour le bouton
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
    () => isMockEnabled('planning')
  );

  // Noise monitoring (Minut) mock
  const { enabled: noiseMonitoringEnabled, setEnabled: setNoiseMonitoringEnabled } = useNoiseMonitoring();

  // Analytics mock
  const [analyticsMock, setAnalyticsMock] = useState(
    () => isMockEnabled('analytics')
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

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader
  // (cf. SettingsHeaderContext + useSettingsHeaderActions dans le tab content).
  // /!\ DOIT etre declare AVANT les early returns pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = useSettingsHeaderActionsSlot();

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

  const handleTabChange = (newValue: number) => {
    setTabValue(newValue);
    setSearchParams(newValue === 0 ? {} : { tab: String(newValue) }, { replace: true });
  };

  const handleNotifSave = async () => {
    if (notifRef.current) {
      await notifRef.current.save();
      forceUpdate(n => n + 1);
    }
  };

  const handleFiscalSave = async () => {
    if (fiscalRef.current) {
      await fiscalRef.current.save();
      forceUpdate(n => n + 1);
    }
  };

  // Sauvegarde unifiée Reversements : SEPA + Calendrier en parallèle (seulement ceux qui ont changé)
  const handleReversementsSave = async () => {
    const promises: Promise<void>[] = [];
    if (sepaRef.current?.hasChanges() && sepaRef.current?.isValid()) {
      promises.push(sepaRef.current.save());
    }
    if (scheduleRef.current?.hasChanges() && scheduleRef.current?.isValid()) {
      promises.push(scheduleRef.current.save());
    }
    try {
      await Promise.all(promises);
    } finally {
      forceUpdate(n => n + 1);
    }
  };

  const reversementsHasChanges =
    (sepaRef.current?.hasChanges() ?? false) || (scheduleRef.current?.hasChanges() ?? false);
  const reversementsIsSaving =
    (sepaRef.current?.isSaving ?? false) || (scheduleRef.current?.isSaving ?? false);
  const reversementsIsValid =
    (sepaRef.current ? !sepaRef.current.hasChanges() || sepaRef.current.isValid() : true) &&
    (scheduleRef.current ? !scheduleRef.current.hasChanges() || scheduleRef.current.isValid() : true);

  // ─── Actions dynamiques selon l'onglet ────────────────────────────────────

  const refinedOutlinedSx = {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.78rem',
    letterSpacing: '0.01em',
    borderRadius: '8px',
    py: 0.625,
    px: 1.5,
    borderColor: 'divider',
    color: 'text.primary',
    '&:hover': {
      borderColor: 'rgba(107, 138, 154, 0.5)',
      backgroundColor: 'rgba(107, 138, 154, 0.06)',
    },
  };

  const refinedContainedSx = {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.78rem',
    letterSpacing: '0.01em',
    borderRadius: '8px',
    py: 0.625,
    px: 1.5,
    bgcolor: '#6B8A9A',
    boxShadow: 'none',
    '&:hover': { bgcolor: '#6B8A9A', filter: 'brightness(0.94)', boxShadow: 'none' },
    '&.Mui-disabled': { bgcolor: 'rgba(107, 138, 154, 0.4)', color: '#fff' },
  };

  const headerActions = tabValue === 0 ? (
    <>
      <Button
        variant="outlined"
        startIcon={<Refresh size={14} strokeWidth={1.75} />}
        onClick={handleReset}
        size="small"
        title="Réinitialiser"
        sx={refinedOutlinedSx}
      >
        Réinitialiser
      </Button>
      <Button
        variant="contained"
        disableElevation
        startIcon={<Save size={14} strokeWidth={1.75} />}
        onClick={handleSave}
        size="small"
        title="Sauvegarder"
        sx={refinedContainedSx}
      >
        Sauvegarder
      </Button>
    </>
  ) : tabValue === 1 && notifRef.current?.hasChanges() ? (
    <Button
      variant="contained"
      disableElevation
      startIcon={
        notifRef.current?.isSaving ? (
          <CircularProgress size={14} color="inherit" />
        ) : (
          <Save size={14} strokeWidth={1.75} />
        )
      }
      onClick={handleNotifSave}
      disabled={notifRef.current?.isSaving}
      size="small"
      title="Sauvegarder"
      sx={refinedContainedSx}
    >
      {notifRef.current?.isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
    </Button>
  ) : tabValue === 4 && hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) ? (
    <Button
      variant="contained"
      disableElevation
      startIcon={
        fiscalRef.current?.isSaving ? (
          <CircularProgress size={14} color="inherit" />
        ) : (
          <Save size={14} strokeWidth={1.75} />
        )
      }
      onClick={handleFiscalSave}
      disabled={fiscalRef.current?.isSaving || !fiscalRef.current?.hasChanges()}
      size="small"
      title={t('fiscal.profile.save', 'Enregistrer le profil fiscal')}
      sx={refinedContainedSx}
    >
      {fiscalRef.current?.isSaving
        ? t('fiscal.profile.saving', 'Enregistrement...')
        : t('fiscal.profile.save', 'Enregistrer le profil fiscal')}
    </Button>
  ) : tabValue === 8 && hasAnyRole(['SUPER_ADMIN']) ? (
    <Button
      variant="contained"
      disableElevation
      startIcon={
        reversementsIsSaving ? (
          <CircularProgress size={14} color="inherit" />
        ) : (
          <Save size={14} strokeWidth={1.75} />
        )
      }
      onClick={handleReversementsSave}
      disabled={reversementsIsSaving || !reversementsHasChanges || !reversementsIsValid}
      size="small"
      title={t('settings.reversements.save', 'Enregistrer les paramètres')}
      sx={refinedContainedSx}
    >
      {reversementsIsSaving
        ? t('settings.reversements.saving', 'Enregistrement...')
        : t('settings.reversements.save', 'Enregistrer les paramètres')}
    </Button>
  ) : undefined;

  // Construction de la liste des tabs UNE SEULE fois — utilisee pour PageTabs
  // ET pour resoudre le tab actif (via son label, stable face aux roles qui
  // cachent certains tabs).
  const settingsTabs = [
    { label: t('tabHeaders.settings.tabs.general', 'Général'), icon: <TuneOutlined />, hidden: false },
    { label: t('tabHeaders.settings.tabs.notifications', 'Notifications'), icon: <Notifications />, hidden: false },
    { label: t('tabHeaders.settings.tabs.messaging', 'Messagerie'), icon: <ChatBubbleOutline />, hidden: false },
    { label: t('settings.myPayout.tabLabel', 'Mes reversements'), icon: <AccountBalance />, hidden: !hasAnyRole(['HOST']) },
    { label: t('tabHeaders.settings.tabs.ai', 'IA'), icon: <SmartToy />, hidden: !canViewAi },
    { label: t('tabHeaders.settings.tabs.fiscal', 'Fiscal'), icon: <AccountBalance />, hidden: !hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) },
    { label: t('tabHeaders.settings.tabs.organization', 'Organisation'), icon: <GroupAdd />, hidden: !hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) },
    { label: t('tabHeaders.settings.tabs.payment', 'Paiement'), icon: <Payment />, hidden: !hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) },
    { label: t('tabHeaders.settings.tabs.integrations', 'Intégrations'), icon: <Extension />, hidden: !hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) },
    { label: t('tabHeaders.settings.tabs.payouts', 'Reversements'), icon: <CalendarMonth />, hidden: !hasAnyRole(['SUPER_ADMIN']) },
    { label: t('tabHeaders.settings.tabs.amenitiesOta', 'Commodités OTA'), icon: <LocalOffer />, hidden: !hasAnyRole(['HOST', 'SUPERVISOR', 'SUPER_ADMIN', 'SUPER_MANAGER']) },
  ];
  const visibleSettingsTabs = settingsTabs.filter((tab) => !tab.hidden);

  // Mapping label → subtitle traduit. Construit dynamiquement pour reagir au
  // changement de langue (les labels sont resolus via t() juste au-dessus).
  const settingsTabMeta: Record<string, SettingsTabMeta> = {
    [t('tabHeaders.settings.tabs.general', 'Général')]: {
      subtitle: t('tabHeaders.settings.subtitle.general', 'Identité, organisation, préférences régionales et affichage.'),
    },
    [t('tabHeaders.settings.tabs.notifications', 'Notifications')]: {
      subtitle: t('tabHeaders.settings.subtitle.notifications', "Configurez vos canaux (in-app, email, push) et la granularité par type d'événement."),
    },
    [t('tabHeaders.settings.tabs.messaging', 'Messagerie')]: {
      subtitle: t('tabHeaders.settings.subtitle.messaging', 'Automatisations de messages voyageurs (check-in, bienvenue, push tarification) et templates.'),
    },
    [t('settings.myPayout.tabLabel', 'Mes reversements')]: {
      subtitle: t('tabHeaders.settings.subtitle.myPayout', 'Paramètres de vos virements bancaires : IBAN, fréquence, seuil minimum.'),
    },
    [t('tabHeaders.settings.tabs.ai', 'IA')]: {
      subtitle: t('tabHeaders.settings.subtitle.ai', 'Connectez votre clé OpenAI/Anthropic ou utilisez le quota partagé. Modèles assignés par feature.'),
    },
    [t('tabHeaders.settings.tabs.fiscal', 'Fiscal')]: {
      subtitle: t('tabHeaders.settings.subtitle.fiscal', 'Profil fiscal de votre organisation : régime TVA, mentions légales, conformité NF 525 / ZATCA.'),
    },
    [t('tabHeaders.settings.tabs.organization', 'Organisation')]: {
      subtitle: t('tabHeaders.settings.subtitle.organization', 'Informations légales, branding, équipe et permissions de votre organisation.'),
    },
    [t('tabHeaders.settings.tabs.payment', 'Paiement')]: {
      subtitle: t('tabHeaders.settings.subtitle.payment', 'Fournisseurs de paiement (Stripe, PayPal, PayTabs, CMI…) et règles de répartition.'),
    },
    [t('tabHeaders.settings.tabs.integrations', 'Intégrations')]: {
      subtitle: t('tabHeaders.settings.subtitle.integrations', 'Connectez vos outils tiers : signature électronique, comptabilité, KYC, conformité légale, channels OTA.'),
    },
    [t('tabHeaders.settings.tabs.payouts', 'Reversements')]: {
      subtitle: t('tabHeaders.settings.subtitle.payouts', 'Calendrier et règles de calcul des reversements aux propriétaires.'),
    },
    [t('tabHeaders.settings.tabs.amenitiesOta', 'Commodités OTA')]: {
      subtitle: t('tabHeaders.settings.subtitle.amenitiesOta', 'Mappez les équipements détectés sur vos listings OTA (Airbnb, Booking, etc.) vers le référentiel Clenzy. Créez vos propres commodités si rien ne correspond.'),
    },
  };
  const settingsRootTitle = t('tabHeaders.settings.title', 'Paramètres');
  const settingsDefaultSubtitle = t('tabHeaders.settings.default', 'Configurez votre application selon vos préférences');

  // Breadcrumb : "Paramètres" (root = Général) ou "Paramètres › <label>" sinon.
  // On indexe par label car tabValue est le visible-index (filtree par role).
  const activeTabLabel = visibleSettingsTabs[tabValue]?.label;
  const activeTabMeta = activeTabLabel ? settingsTabMeta[activeTabLabel] : undefined;
  const headerTitle = activeTabLabel && tabValue > 0 ? `${settingsRootTitle} › ${activeTabLabel}` : settingsRootTitle;
  const headerSubtitle = activeTabMeta?.subtitle ?? settingsDefaultSubtitle;

  // Actions : un tab a-t-il deja inline son bouton via headerActions (tab 1/4/8)
  // OU bien il portale via le slot ? Si headerActions est defini ET le slot est
  // utilise par un tab, on stack les deux. Sinon on prend ce qui existe.
  const combinedActions = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {headerActionsPortal}
      {headerActions}
    </Box>
  );

  return (
    <SettingsHeaderProvider slot={headerActionsSlot}>
    <Box>
      {/* Header avec actions */}
      <PageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        iconBadge={<TuneOutlined />}
        backPath="/"
        showBackButton={false}
        actions={combinedActions}
        filters={
          tabValue === 7 ? (
            <IntegrationsHeader
              selectedCategoryId={integrationsCategoryId}
              onCategoryChange={handleIntegrationsCategoryChange}
              selectedService={selectedIntegrationsService}
              onSelectService={handleIntegrationsServiceSelect}
            />
          ) : undefined
        }
      />

      {/* Onglets — source unique settingsTabs (cf. resolution du headerTitle plus haut) */}
      <PageTabs
        options={settingsTabs}
        value={tabValue}
        onChange={handleTabChange}
        ariaLabel="settings-tabs"
      />

      {/* ─── Onglet Général ─────────────────────────────────────────────── */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>

          {/* Mon compte */}
          <Grid item xs={12} md={6}>
            <SettingsSection
              title="Mon compte"
              icon={Person}
              accent="primary"
              description="Identité, organisation et préférences régionales"
              avatar={{
                src: userAvatarSrc(user ?? undefined),
                initials: [user?.firstName?.[0], user?.lastName?.[0]]
                  .filter(Boolean)
                  .join('')
                  .toUpperCase() || user?.username?.[0]?.toUpperCase(),
                alt: user?.fullName || user?.username || 'Photo de profil',
              }}
            >
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Prénom"
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
            </SettingsSection>
          </Grid>

          {/* Workflow */}
          <Grid item xs={12} md={6}>
            <SettingsSection
              title="Workflow"
              icon={Storage}
              accent="accent"
              description="Règles d'orchestration des interventions et des prix"
            >
              <SettingsToggleRow
                title="Délai d'annulation"
                description="Temps limite pour annuler une demande approuvée"
                control={(
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TextField
                      type="number"
                      value={workflowSettings.cancellationDeadlineHours}
                      onChange={(e) => updateWorkflowSettings({ cancellationDeadlineHours: parseInt(e.target.value) })}
                      sx={{
                        width: 72,
                        '& input': { textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
                      }}
                      size="small"
                      inputProps={{ min: 0, 'aria-label': "Délai d'annulation en heures" }}
                    />
                    <Typography
                      sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 600, letterSpacing: '0.02em' }}
                    >
                      h
                    </Typography>
                  </Box>
                )}
              />
              <SettingsToggleRow
                icon={Person}
                iconColor="#6B8A9A"
                title="Attribution automatique"
                description="Attribuer automatiquement les interventions"
                checked={workflowSettings.autoAssignInterventions}
                onChange={(v) => updateWorkflowSettings({ autoAssignInterventions: v })}
              />
              <SettingsToggleRow
                icon={Security}
                iconColor="#7BA3C2"
                title="Approbation requise"
                description="Demander approbation pour les modifications"
                checked={workflowSettings.requireApprovalForChanges}
                onChange={(v) => updateWorkflowSettings({ requireApprovalForChanges: v })}
              />
              <SettingsToggleRow
                icon={TrendingUp}
                iconColor="#4A9B8E"
                title="Push automatique des prix"
                description="Pousser automatiquement les prix vers Airbnb (toutes les heures)"
                checked={autoPushPricingEnabled}
                onChange={handleToggleAutoPushPricing}
                divider={false}
              />
            </SettingsSection>
          </Grid>

          {/* Affichage */}
          <Grid item xs={12} md={6}>
            <SettingsSection
              title="Affichage"
              icon={Palette}
              accent="warm"
              description="Apparence, densité et préférences visuelles"
            >
              <Box sx={{ pb: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography
                  sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary', mb: 0.125 }}
                >
                  Apparence
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1 }}>
                  {themeMode === 'auto'
                    ? `Système (${isDark ? 'sombre' : 'clair'} détecté)`
                    : themeMode === 'dark'
                      ? 'Mode sombre'
                      : 'Mode clair'}
                </Typography>
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
                  sx={{
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      gap: 0.625,
                      py: 0.625,
                      borderColor: 'divider',
                      color: 'text.secondary',
                      '&.Mui-selected': {
                        bgcolor: '#D4A57418',
                        color: '#8A5A22',
                        borderColor: '#D4A57460',
                        '&:hover': { bgcolor: '#D4A57422' },
                      },
                      '&:hover': { bgcolor: 'rgba(212, 165, 116, 0.06)' },
                    },
                  }}
                >
                  <ToggleButton value="light">
                    <LightMode size={14} strokeWidth={1.75} />
                    Clair
                  </ToggleButton>
                  <ToggleButton value="dark">
                    <DarkMode size={14} strokeWidth={1.75} />
                    Sombre
                  </ToggleButton>
                  <ToggleButton value="auto">
                    <SettingsBrightness size={14} strokeWidth={1.75} />
                    Système
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <SettingsToggleRow
                icon={Storage}
                iconColor="#8A8378"
                title="Mode compact"
                description="Réduire l'espacement des éléments"
                checked={settings.display.compactMode}
                onChange={(v) => handleSettingChange('display', 'compactMode', v)}
              />
              <SettingsToggleRow
                icon={Person}
                iconColor="#6B8A9A"
                title="Afficher les avatars"
                description="Montrer les photos de profil des utilisateurs"
                checked={settings.display.showAvatars}
                onChange={(v) => handleSettingChange('display', 'showAvatars', v)}
                divider={false}
              />
            </SettingsSection>
          </Grid>

          {/* Développement (admin only) */}
          {(user.roles.includes('SUPER_ADMIN')) && (
            <Grid item xs={12} md={6}>
              <SettingsSection
                title="Développement"
                icon={BugReport}
                accent="danger"
                description="Données fictives et outils de démo (admin uniquement)"
              >
                <SettingsToggleRow
                  icon={BugReport}
                  iconColor="#C97A7A"
                  title="Données de démonstration (Planning)"
                  description="Afficher des réservations et interventions fictives dans le planning"
                  checked={planningMock}
                  onChange={(enabled) => {
                    setPlanningMock(enabled);
                    reservationsApi.setMockMode(enabled);
                    queryClient.invalidateQueries({ queryKey: planningKeys.all });
                  }}
                />
                <SettingsToggleRow
                  icon={VolumeUp}
                  iconColor="#7BA3C2"
                  title="Monitoring sonore Minut (démo)"
                  description="Simuler les données de capteurs de bruit dans le dashboard Analytics"
                  checked={noiseMonitoringEnabled}
                  onChange={setNoiseMonitoringEnabled}
                />
                <SettingsToggleRow
                  icon={BarChart}
                  iconColor="#4A9B8E"
                  title="Données de démonstration (Analytics)"
                  description="Afficher des KPIs, graphiques et recommandations avec des données fictives"
                  checked={analyticsMock}
                  onChange={(enabled) => {
                    setAnalyticsMock(enabled);
                    reservationsApi.setAnalyticsMockMode(enabled);
                    propertiesApi.setMockMode(enabled);
                    queryClient.invalidateQueries({ queryKey: ['analytics-reservations'] });
                    queryClient.invalidateQueries({ queryKey: ['analytics-properties'] });
                    queryClient.invalidateQueries({ queryKey: ['analytics-interventions'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
                    queryClient.invalidateQueries({ queryKey: planningKeys.all });
                  }}
                  divider={false}
                />
              </SettingsSection>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* ─── Onglet Notifications ───────────────────────────────────────── */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <NotificationPreferencesCard
            ref={notifRef}
            onChangeState={() => forceUpdate(n => n + 1)}
          />
          <MarketingPreferencesCard />
        </Box>
      </TabPanel>

      {/* ─── Onglet Messagerie ────────────────────────────────────────── */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Provider WhatsApp (Meta Cloud API ou OpenWA self-hosted) :
              section en premier car bloquante — sans provider configure,
              les automations ci-dessous n'envoient rien sur le canal WhatsApp. */}
          <WhatsAppProviderConfigSection />
          <MessagingAutomationSection />
        </Box>
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
          <FiscalProfileSection
            ref={fiscalRef}
            onChangeState={() => forceUpdate(n => n + 1)}
          />
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
          <IntegrationsSection
            selectedCategoryId={integrationsCategoryId}
            selectedServiceId={integrationsServiceId}
          />
        </TabPanel>
      )}

      {/* ─── Onglet Reversements (SUPER_ADMIN) ──────────────────────────── */}
      {hasAnyRole(['SUPER_ADMIN']) && (
        <TabPanel value={tabValue} index={8}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <SepaDebtorSettings
                ref={sepaRef}
                onChangeState={() => forceUpdate(n => n + 1)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <PayoutScheduleSettings
                ref={scheduleRef}
                onChangeState={() => forceUpdate(n => n + 1)}
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <OwnerPayoutSettings />
          </Box>
        </TabPanel>
      )}

      {/* ─── Onglet Commodités OTA ─────────────────────────────────────── */}
      {hasAnyRole(['HOST', 'SUPERVISOR', 'SUPER_ADMIN', 'SUPER_MANAGER']) && (
        <TabPanel value={tabValue} index={9}>
          <AmenityMappingPage />
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
    </SettingsHeaderProvider>
  );
}
