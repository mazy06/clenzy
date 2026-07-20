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
  Euro,
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
import { useSearchParams, useNavigate } from 'react-router-dom';
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
import { useTabKeyParam, tabIndexFromKey } from '../../components/tabKeyParam';
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
import WhatsAppStatusBanner from '../messaging/WhatsAppStatusBanner';
import FiscalProfileSection from './FiscalProfileSection';
import type { FiscalProfileHandle } from './FiscalProfileSection';
import SepaDebtorSettings, { type SepaDebtorHandle } from './SepaDebtorSettings';
import PayoutScheduleSettings, { type PayoutScheduleHandle } from './PayoutScheduleSettings';
import TaxRulesSection from './TaxRulesSection';
import TouristTaxSection from './TouristTaxSection';
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
import MyRatesSettings from './MyRatesSettings';
import MyProPayoutsSettings from './MyProPayoutsSettings';
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
  const navigate = useNavigate();

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
  // NB : settings:edit etait charge dans un etat jamais lu (aucun gating d'edition
  // cote UI aujourd'hui) — etat mort supprime ; le gating renvoie au backend.
  const [canViewSettings, setCanViewSettings] = useState(false);
  const [canViewAi, setCanViewAi] = useState(false);

  // ─── Onglets (source unique) + onglet actif resolu par CLE (URL ?tab=<key>) ──────────────
  // Defini ICI (avant la 1ere utilisation de tabValue par handleTabChange / headerActions).
  // La cle est STABLE face aux onglets masques par role, contrairement a l'index visible (qui
  // shifte selon le role). Cf. components/tabKeyParam.ts (useTabKeyParam / tabIndexFromKey).
  const settingsTabs = [
    { key: 'general', label: t('tabHeaders.settings.tabs.general', 'Général'), icon: <TuneOutlined />, hidden: false },
    { key: 'notifications', label: t('tabHeaders.settings.tabs.notifications', 'Notifications'), icon: <Notifications />, hidden: false },
    { key: 'messaging', label: t('tabHeaders.settings.tabs.messaging', 'Messagerie'), icon: <ChatBubbleOutline />, hidden: false },
    { key: 'my-payout', label: t('settings.myPayout.tabLabel', 'Reversements propriétaire'), icon: <AccountBalance />, hidden: !hasAnyRole(['HOST']) },
    { key: 'my-rates', label: t('settings.myRates.tabLabel', 'Mes tarifs'), icon: <Euro />, hidden: !hasAnyRole(['HOUSEKEEPER', 'TECHNICIAN']) },
    { key: 'my-payouts-pro', label: t('settings.myProPayouts.tabLabel', 'Mes versements de missions'), icon: <AccountBalance />, hidden: !hasAnyRole(['HOUSEKEEPER', 'TECHNICIAN']) },
    { key: 'ai', label: t('tabHeaders.settings.tabs.ai', 'IA'), icon: <SmartToy />, hidden: !canViewAi },
    { key: 'fiscal', label: t('tabHeaders.settings.tabs.fiscal', 'Fiscal'), icon: <AccountBalance />, hidden: !hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) },
    { key: 'organization', label: t('tabHeaders.settings.tabs.organization', 'Organisation'), icon: <GroupAdd />, hidden: !hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) },
    { key: 'payment', label: t('tabHeaders.settings.tabs.payment', 'Paiement'), icon: <Payment />, hidden: !hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) },
    { key: 'integrations', label: t('tabHeaders.settings.tabs.integrations', 'Intégrations'), icon: <Extension />, hidden: !hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) },
    { key: 'payouts', label: t('tabHeaders.settings.tabs.payouts', 'Reversements (plateforme)'), icon: <CalendarMonth />, hidden: !hasAnyRole(['SUPER_ADMIN']) },
    { key: 'amenities-ota', label: t('tabHeaders.settings.tabs.amenitiesOta', 'Commodités OTA'), icon: <LocalOffer />, hidden: !hasAnyRole(['HOST', 'SUPERVISOR', 'SUPER_ADMIN', 'SUPER_MANAGER']) },
  ];
  const visibleSettingsTabs = settingsTabs.filter((tab) => !tab.hidden);
  const [tabValue, setTabValue] = useTabKeyParam(settingsTabs);

  // ─── Index VISIBLE de chaque onglet, resolu par CLE stable ────────────────
  // tabValue est l'index VISIBLE (filtre par role) renvoye par useTabKeyParam,
  // pas l'index absolu dans settingsTabs. On ne PEUT donc PAS comparer tabValue
  // a un index code en dur (0/1/4/7/8…) ni indexer les TabPanel par index absolu :
  // ces constantes shiftent selon les onglets masques par role (HOST sans onglets
  // admin, SUPER_MANAGER sans Reversements, etc.) → onglets vides ou superposes.
  // On resout l'index visible de chaque onglet par sa cle (calcul trivial, pas de
  // memo : settingsTabs est recree a chaque render comme visibleSettingsTabs).
  const tabIdx = {
    general: tabIndexFromKey(settingsTabs, 'general'),
    notifications: tabIndexFromKey(settingsTabs, 'notifications'),
    messaging: tabIndexFromKey(settingsTabs, 'messaging'),
    myPayout: tabIndexFromKey(settingsTabs, 'my-payout'),
    myRates: tabIndexFromKey(settingsTabs, 'my-rates'),
    myPayoutsPro: tabIndexFromKey(settingsTabs, 'my-payouts-pro'),
    ai: tabIndexFromKey(settingsTabs, 'ai'),
    fiscal: tabIndexFromKey(settingsTabs, 'fiscal'),
    organization: tabIndexFromKey(settingsTabs, 'organization'),
    payment: tabIndexFromKey(settingsTabs, 'payment'),
    integrations: tabIndexFromKey(settingsTabs, 'integrations'),
    payouts: tabIndexFromKey(settingsTabs, 'payouts'),
    amenitiesOta: tabIndexFromKey(settingsTabs, 'amenities-ota'),
  };

  // TOUS les useState DOIVENT être déclarés AVANT les vérifications conditionnelles
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: false,
      sms: false,
    },
    business: {
      companyName: 'Baitly',
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
      const aiPermission = await hasPermissionAsync('ai:view');

      setCanViewSettings(viewPermission);
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

  // useTabKeyParam ecrit la cle de l'onglet actif dans l'URL (?tab=<key>), robuste au role.
  const handleTabChange = setTabValue;

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

  // Boutons du header : styles 100 % hérités du thème global Signature
  // (contained = contour accent, outlined = carte hairline) — aucun override local.
  const refinedOutlinedSx = undefined;
  const refinedContainedSx = undefined;

  const headerActions = tabValue === tabIdx.general ? (
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
  ) : tabValue === tabIdx.notifications && notifRef.current?.hasChanges() ? (
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
  ) : tabValue === tabIdx.fiscal && hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) ? (
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
  ) : tabValue === tabIdx.payouts && hasAnyRole(['SUPER_ADMIN']) ? (
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

  // settingsTabs + visibleSettingsTabs + tabValue sont definis plus haut (avant leur 1ere
  // utilisation par handleTabChange / headerActions). Cf. « Onglets (source unique) ».

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
    [t('settings.myPayout.tabLabel', 'Reversements propriétaire')]: {
      subtitle: t('tabHeaders.settings.subtitle.myPayout', 'Paramètres de vos virements bancaires : IBAN, fréquence, seuil minimum.'),
    },
    [t('settings.myRates.tabLabel', 'Mes tarifs')]: {
      subtitle: t('tabHeaders.settings.subtitle.myRates', 'Votre taux horaire, vos forfaits par logement et votre score qualité.'),
    },
    [t('settings.myProPayouts.tabLabel', 'Mes versements de missions')]: {
      subtitle: t('tabHeaders.settings.subtitle.myPayoutsPro', 'Compte de versement Stripe et historique de vos versements de missions.'),
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
    [t('tabHeaders.settings.tabs.payouts', 'Reversements (plateforme)')]: {
      subtitle: t('tabHeaders.settings.subtitle.payouts', 'Calendrier et règles de calcul des reversements aux propriétaires.'),
    },
    [t('tabHeaders.settings.tabs.amenitiesOta', 'Commodités OTA')]: {
      subtitle: t('tabHeaders.settings.subtitle.amenitiesOta', 'Mappez les équipements détectés sur vos listings OTA (Airbnb, Booking, etc.) vers le référentiel Baitly. Créez vos propres commodités si rien ne correspond.'),
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
          tabValue === tabIdx.integrations ? (
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
      <TabPanel value={tabValue} index={tabIdx.general}>
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
                iconColor="var(--accent)"
                title="Attribution automatique"
                description="Attribuer automatiquement les interventions"
                checked={workflowSettings.autoAssignInterventions}
                onChange={(v) => updateWorkflowSettings({ autoAssignInterventions: v })}
              />
              <SettingsToggleRow
                icon={Security}
                iconColor="var(--info)"
                title="Approbation requise"
                description="Demander approbation pour les modifications"
                checked={workflowSettings.requireApprovalForChanges}
                onChange={(v) => updateWorkflowSettings({ requireApprovalForChanges: v })}
              />
              <SettingsToggleRow
                icon={TrendingUp}
                iconColor="var(--ok)"
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
                        bgcolor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        borderColor: 'color-mix(in srgb, var(--accent) 38%, transparent)',
                        '&:hover': { bgcolor: 'var(--accent-soft)' },
                      },
                      '&:hover': { bgcolor: 'var(--hover)' },
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
                iconColor="var(--muted)"
                title="Mode compact"
                description="Réduire l'espacement des éléments"
                checked={settings.display.compactMode}
                onChange={(v) => handleSettingChange('display', 'compactMode', v)}
              />
              <SettingsToggleRow
                icon={Person}
                iconColor="var(--accent)"
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
                  iconColor="var(--err)"
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
                  iconColor="var(--info)"
                  title="Monitoring sonore Minut (démo)"
                  description="Simuler les données de capteurs de bruit dans le dashboard Analytics"
                  checked={noiseMonitoringEnabled}
                  onChange={setNoiseMonitoringEnabled}
                />
                <SettingsToggleRow
                  icon={BarChart}
                  iconColor="var(--ok)"
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
      <TabPanel value={tabValue} index={tabIdx.notifications}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <NotificationPreferencesCard
            ref={notifRef}
            onChangeState={() => forceUpdate(n => n + 1)}
          />
          <MarketingPreferencesCard />
        </Box>
      </TabPanel>

      {/* ─── Onglet Messagerie ────────────────────────────────────────── */}
      <TabPanel value={tabValue} index={tabIdx.messaging}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* La config du provider WhatsApp (credentials Meta/OpenWA) est gérée
              par la plateforme depuis l'onglet Organisation. Le HOST voit ici un
              statut read-only + ses automatisations de messages voyageurs. */}
          <WhatsAppStatusBanner />
          {/* La messagerie automatique check-in/check-out est désormais gérée dans
              le hub Automatisations (source de vérité unique). */}
          <Box
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 2, p: 2, borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--hairline)', backgroundColor: 'var(--field)',
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
                {t('messaging.automation.movedTitle', 'Messages automatiques (check-in / check-out)')}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mt: 0.5 }}>
                {t('messaging.automation.movedBody', 'La messagerie automatique est désormais gérée dans Automatisations, avec les autres règles.')}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={() => navigate('/automation-rules')}
              sx={{ flexShrink: 0 }}
            >
              {t('messaging.automation.movedCta', 'Ouvrir les automatisations')}
            </Button>
          </Box>
        </Box>
      </TabPanel>

      {/* ─── Onglet Mes reversements (HOST) ────────────────────────── */}
      {hasAnyRole(['HOST']) && (
        <TabPanel value={tabValue} index={tabIdx.myPayout}>
          <MyPayoutSettings />
        </TabPanel>
      )}

      {/* ─── Onglet Mes tarifs (HOUSEKEEPER / TECHNICIAN) ──────────── */}
      {hasAnyRole(['HOUSEKEEPER', 'TECHNICIAN']) && (
        <TabPanel value={tabValue} index={tabIdx.myRates}>
          <MyRatesSettings />
        </TabPanel>
      )}

      {/* ─── Onglet Mes versements (HOUSEKEEPER / TECHNICIAN) ─────────── */}
      {hasAnyRole(['HOUSEKEEPER', 'TECHNICIAN']) && (
        <TabPanel value={tabValue} index={tabIdx.myPayoutsPro}>
          <MyProPayoutsSettings />
        </TabPanel>
      )}

      {/* ─── Onglet IA (permission ai:view) ───────────────────────── */}
      {canViewAi && (
        <TabPanel value={tabValue} index={tabIdx.ai}>
          <AiSettingsSection />
        </TabPanel>
      )}

      {/* ─── Onglet Fiscal (ADMIN/MANAGER) ────────────────────────── */}
      {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
        <TabPanel value={tabValue} index={tabIdx.fiscal}>
          <FiscalProfileSection
            ref={fiscalRef}
            onChangeState={() => forceUpdate(n => n + 1)}
          />
          <Box sx={{ mt: 3 }} />
          <TaxRulesSection />
          <Box sx={{ mt: 3 }} />
          <TouristTaxSection canEdit={hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER'])} />
        </TabPanel>
      )}

      {/* ─── Onglet Organisation (ADMIN/MANAGER) ─────────────────────── */}
      {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
        <TabPanel value={tabValue} index={tabIdx.organization}>
          <OrganizationSection
            organizationId={user?.organizationId}
            organizationName={user?.organizationName}
          />
        </TabPanel>
      )}

      {/* ─── Onglet Paiement (ADMIN/MANAGER) ─────────────────────────── */}
      {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
        <TabPanel value={tabValue} index={tabIdx.payment}>
          <PaymentSettings />
        </TabPanel>
      )}

      {/* ─── Onglet Intégrations (ADMIN/MANAGER) ──────────────────────── */}
      {hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) && (
        <TabPanel value={tabValue} index={tabIdx.integrations}>
          <IntegrationsSection
            selectedCategoryId={integrationsCategoryId}
            selectedServiceId={integrationsServiceId}
          />
        </TabPanel>
      )}

      {/* ─── Onglet Reversements (SUPER_ADMIN) ──────────────────────────── */}
      {hasAnyRole(['SUPER_ADMIN']) && (
        <TabPanel value={tabValue} index={tabIdx.payouts}>
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
        <TabPanel value={tabValue} index={tabIdx.amenitiesOta}>
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
