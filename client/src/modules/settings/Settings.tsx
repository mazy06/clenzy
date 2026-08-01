import React, { useState, useEffect, useRef } from 'react';
import { Alert as BuiAlert, AlertDescription } from '../../components/ui';
import { Info } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Button as UiButton,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  NativeSelect,
  NativeSelectOption,
  ToggleGroup,
  ToggleGroupItem,
} from '../../components/ui';
import {
  Notifications,
  Security,
  Person,
  Save,
  Refresh,
  Palette,
  Storage,
  TuneOutlined,
  LightMode,
  DarkMode,
  SettingsBrightness,
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
  Bolt,
} from '../../icons';
import { guestMessagingApi } from '../../services/api/guestMessagingApi';
import type { MessagingAutomationConfig } from '../../services/api/guestMessagingApi';
import { useWorkflowSettings } from '../../hooks/useWorkflowSettings';
import { useAuth } from '../../hooks/useAuth';
import { useThemeMode } from '../../hooks/useThemeMode';
import storageService, { STORAGE_KEYS } from '../../services/storageService';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useQueryClient } from '@tanstack/react-query';
import { useNotification } from '../../hooks/useNotification';
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
import AccountSecuritySection from './AccountSecuritySection';
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
        <div className="pt-3">{children}</div>
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
  const { notify } = useNotification();
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
  // L'ancien Snackbar naissait deja ouvert quand l'URL portait ?status=… : la
  // notification est donc tiree UNE fois au montage (garde par un ref, pas par
  // un etat : ce n'est pas une donnee de rendu), puis le parametre est purge —
  // ce que faisait auparavant le onClose du Snackbar.
  const oauthNotifiedRef = useRef(false);
  useEffect(() => {
    if (!isValidOauthStatus || oauthNotifiedRef.current) return;
    oauthNotifiedRef.current = true;
    if (oauthStatus === 'success') {
      notify.success(t('settings.integrations.pennylane.connectionSuccess'));
    } else {
      notify.error(t('settings.integrations.pennylane.connectionError'));
    }
    searchParams.delete('status');
    setSearchParams(searchParams, { replace: true });
  }, [isValidOauthStatus, oauthStatus, notify, t, searchParams, setSearchParams]);

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
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner className="size-10" />
      </div>
    );
  }

  // Si pas de permission, afficher un message informatif
  if (!canViewSettings) {
    return (
      <div className="p-4">
        <BuiAlert variant="info">
          <Info />
          <AlertDescription><h6 className="cn-text-h6 mb-[0.35em]">
            Accès non autorisé
          </h6><p className="cn-text-body1">
            Vous n'avez pas les permissions nécessaires pour accéder aux paramètres.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </p></AlertDescription>
        </BuiAlert>
      </div>
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

      notify.success('Paramètres sauvegardés avec succès');
      if (!isConfigureOrgDone) {
        completeStep('configure_org');
      }
    } catch {
      notify.error('Erreur lors de la sauvegarde des paramètres');
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
    notify.success('Paramètres réinitialisés');
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

  // Boutons du header : la sauvegarde est l'action principale de l'onglet
  // (default), « Réinitialiser » reste une secondaire a poids egal (outline).
  const headerActions = tabValue === tabIdx.general ? (
    <>
      <UiButton variant="outline" size="sm" onClick={handleReset} title="Réinitialiser">
        <Refresh size={14} strokeWidth={1.75} />
        Réinitialiser
      </UiButton>
      <UiButton size="sm" onClick={handleSave} title="Sauvegarder">
        <Save size={14} strokeWidth={1.75} />
        Sauvegarder
      </UiButton>
    </>
  ) : tabValue === tabIdx.notifications && notifRef.current?.hasChanges() ? (
    <UiButton
      size="sm"
      onClick={handleNotifSave}
      disabled={notifRef.current?.isSaving}
      title="Sauvegarder"
    >
      {notifRef.current?.isSaving ? (
        <Spinner className="size-3.5" />
      ) : (
        <Save size={14} strokeWidth={1.75} />
      )}
      {notifRef.current?.isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
    </UiButton>
  ) : tabValue === tabIdx.fiscal && hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']) ? (
    <UiButton
      size="sm"
      onClick={handleFiscalSave}
      disabled={fiscalRef.current?.isSaving || !fiscalRef.current?.hasChanges()}
      title={t('fiscal.profile.save', 'Enregistrer le profil fiscal')}
    >
      {fiscalRef.current?.isSaving ? (
        <Spinner className="size-3.5" />
      ) : (
        <Save size={14} strokeWidth={1.75} />
      )}
      {fiscalRef.current?.isSaving
        ? t('fiscal.profile.saving', 'Enregistrement...')
        : t('fiscal.profile.save', 'Enregistrer le profil fiscal')}
    </UiButton>
  ) : tabValue === tabIdx.payouts && hasAnyRole(['SUPER_ADMIN']) ? (
    <UiButton
      size="sm"
      onClick={handleReversementsSave}
      disabled={reversementsIsSaving || !reversementsHasChanges || !reversementsIsValid}
      title={t('settings.reversements.save', 'Enregistrer les paramètres')}
    >
      {reversementsIsSaving ? (
        <Spinner className="size-3.5" />
      ) : (
        <Save size={14} strokeWidth={1.75} />
      )}
      {reversementsIsSaving
        ? t('settings.reversements.saving', 'Enregistrement...')
        : t('settings.reversements.save', 'Enregistrer les paramètres')}
    </UiButton>
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

  // Titre = page courante SEULE : le chemin ("Paramètres › <label>") est porte
  // par le fil d'Ariane du PageHeader, ne pas le repeter dans le h1.
  // On indexe par label car tabValue est le visible-index (filtree par role).
  const activeTabLabel = visibleSettingsTabs[tabValue]?.label;
  const activeTabMeta = activeTabLabel ? settingsTabMeta[activeTabLabel] : undefined;
  const headerTitle = activeTabLabel && tabValue > 0 ? activeTabLabel : settingsRootTitle;
  const headerSubtitle = activeTabMeta?.subtitle ?? settingsDefaultSubtitle;

  // Actions : un tab a-t-il deja inline son bouton via headerActions (tab 1/4/8)
  // OU bien il portale via le slot ? Si headerActions est defini ET le slot est
  // utilise par un tab, on stack les deux. Sinon on prend ce qui existe.
  const combinedActions = (
    <div className="flex items-center gap-1.5">
      {headerActionsPortal}
      {headerActions}
    </div>
  );

  return (
    <SettingsHeaderProvider slot={headerActionsSlot}>
    <div>
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
        <div className="grid grid-cols-12 gap-3">

          {/* Mon compte */}
          <div className="col-span-12 min-[900px]:col-span-6">
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
              <FieldGroup className="gap-3">
                {/* Identite : ces quatre valeurs viennent de Keycloak et ne sont
                    JAMAIS modifiables ici. Les rendre en champs desactives
                    invitait a cliquer dans un formulaire qui n'accepte rien —
                    on les donne a lire, et la section n'expose plus que ce qui
                    se modifie vraiment. */}
                <div className="rounded-lg border border-border/70 bg-muted/30 px-2.5 py-2">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                    {[
                      { label: 'Prénom', value: user?.firstName },
                      { label: 'Nom', value: user?.lastName },
                      { label: "Nom d'utilisateur", value: user?.username },
                      { label: 'Email', value: user?.email },
                    ].map(({ label, value }) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-[0.68rem] uppercase tracking-[0.04em] text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="m-0 truncate text-[0.8125rem] text-foreground">
                          {value || <span className="text-muted-foreground">—</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <Field>
                  <FieldLabel htmlFor="settings-company-name">Nom de l'entreprise</FieldLabel>
                  <Input
                    id="settings-company-name"
                    value={settings.business.companyName}
                    onChange={(e) => handleSettingChange('business', 'companyName', e.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="settings-timezone">Fuseau horaire</FieldLabel>
                    <NativeSelect
                      id="settings-timezone"
                      className="w-full"
                      value={settings.business.timezone}
                      onChange={(e) => handleSettingChange('business', 'timezone', e.target.value)}
                    >
                      <NativeSelectOption value="Europe/Paris">Europe/Paris</NativeSelectOption>
                      <NativeSelectOption value="Europe/London">Europe/London</NativeSelectOption>
                      <NativeSelectOption value="America/New_York">America/New_York</NativeSelectOption>
                      <NativeSelectOption value="Asia/Tokyo">Asia/Tokyo</NativeSelectOption>
                    </NativeSelect>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="settings-currency">Devise</FieldLabel>
                    <NativeSelect
                      id="settings-currency"
                      className="w-full"
                      value={settings.business.currency}
                      onChange={(e) => handleSettingChange('business', 'currency', e.target.value)}
                    >
                      {CURRENCY_OPTIONS.map(c => (
                        <NativeSelectOption key={c.code} value={c.code}>{c.label}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="settings-language">Langue</FieldLabel>
                  <NativeSelect
                    id="settings-language"
                    className="w-full"
                    value={settings.business.language}
                    onChange={(e) => handleSettingChange('business', 'language', e.target.value)}
                  >
                    <NativeSelectOption value="fr">Français</NativeSelectOption>
                    <NativeSelectOption value="en">English</NativeSelectOption>
                    <NativeSelectOption value="ar">العربية</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </FieldGroup>
            </SettingsSection>
          </div>

          {/* Sécurité (changement de mot de passe via email Keycloak) */}
          <div className="col-span-12 min-[900px]:col-span-6">
            <AccountSecuritySection />
          </div>

          {/* Workflow */}
          <div className="col-span-12 min-[900px]:col-span-6">
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
                  <div className="flex items-center gap-0.5">
                    <Input
                      type="number"
                      value={workflowSettings.cancellationDeadlineHours}
                      onChange={(e) => updateWorkflowSettings({ cancellationDeadlineHours: parseInt(e.target.value) })}
                      min={0}
                      aria-label="Délai d'annulation en heures"
                      className="w-[72px] text-center font-semibold tabular-nums"
                    />
                    <p className="cn-text-body1 text-[0.72rem] text-muted-foreground font-semibold tracking-[0.02em]">
                      h
                    </p>
                  </div>
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
          </div>

          {/* Affichage */}
          <div className="col-span-12 min-[900px]:col-span-6">
            <SettingsSection
              title="Affichage"
              icon={Palette}
              accent="warm"
              description="Apparence, densité et préférences visuelles"
            >
              <div className="pb-2 border-b border-[var(--line)]">
                <p className="cn-text-body1 text-[0.8125rem] font-semibold text-foreground mb-0">
                  Apparence
                </p>
                <p className="cn-text-body1 text-[0.72rem] text-muted-foreground mb-1.5">
                  {themeMode === 'auto'
                    ? `Système (${isDark ? 'sombre' : 'clair'} détecté)`
                    : themeMode === 'dark'
                      ? 'Mode sombre'
                      : 'Mode clair'}
                </p>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  spacing={0}
                  value={themeMode}
                  // Radix renvoie '' quand on re-clique l'option active : sans ce
                  // garde-fou, l'apparence se retrouverait sans valeur.
                  onValueChange={(newMode) => {
                    if (!newMode) return;
                    handleSettingChange('display', 'theme', newMode);
                    setThemeMode(newMode as typeof themeMode);
                  }}
                  aria-label="Apparence"
                  className="w-full [&>*]:flex-1"
                >
                  <ToggleGroupItem value="light" className="gap-1.5 text-[0.78rem] font-semibold">
                    <LightMode size={14} strokeWidth={1.75} />
                    Clair
                  </ToggleGroupItem>
                  <ToggleGroupItem value="dark" className="gap-1.5 text-[0.78rem] font-semibold">
                    <DarkMode size={14} strokeWidth={1.75} />
                    Sombre
                  </ToggleGroupItem>
                  <ToggleGroupItem value="auto" className="gap-1.5 text-[0.78rem] font-semibold">
                    <SettingsBrightness size={14} strokeWidth={1.75} />
                    Système
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
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
          </div>

        </div>
      </TabPanel>

      {/* ─── Onglet Notifications ───────────────────────────────────────── */}
      <TabPanel value={tabValue} index={tabIdx.notifications}>
        <div className="flex flex-col gap-3">
          <NotificationPreferencesCard
            ref={notifRef}
            onChangeState={() => forceUpdate(n => n + 1)}
          />
          <MarketingPreferencesCard />
        </div>
      </TabPanel>

      {/* ─── Onglet Messagerie ────────────────────────────────────────── */}
      <TabPanel value={tabValue} index={tabIdx.messaging}>
        <div className="flex flex-col gap-6">
          {/* La config du provider WhatsApp (credentials Meta/OpenWA) est gérée
              par la plateforme depuis l'onglet Organisation. Le HOST voit ici un
              statut read-only + ses automatisations de messages voyageurs. */}
          <WhatsAppStatusBanner />
          {/* La messagerie automatique check-in/check-out est désormais gérée dans
              le hub Automatisations (source de vérité unique). */}
          <Item variant="muted">
            <ItemMedia variant="icon">
              <Bolt size={16} strokeWidth={1.75} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {t('messaging.automation.movedTitle', 'Messages automatiques (check-in / check-out)')}
              </ItemTitle>
              <ItemDescription>
                {t('messaging.automation.movedBody', 'La messagerie automatique est désormais gérée dans Automatisations, avec les autres règles.')}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <UiButton variant="outline" onClick={() => navigate('/automation-rules')}>
                {t('messaging.automation.movedCta', 'Ouvrir les automatisations')}
              </UiButton>
            </ItemActions>
          </Item>
        </div>
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
          <div className="mt-4" />
          <TaxRulesSection />
          <div className="mt-4" />
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
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 min-[900px]:col-span-6">
              <SepaDebtorSettings
                ref={sepaRef}
                onChangeState={() => forceUpdate(n => n + 1)}
              />
            </div>
            <div className="col-span-12 min-[900px]:col-span-6">
              <PayoutScheduleSettings
                ref={scheduleRef}
                onChangeState={() => forceUpdate(n => n + 1)}
              />
            </div>
          </div>
          <div className="mt-3">
            <OwnerPayoutSettings />
          </div>
        </TabPanel>
      )}

      {/* ─── Onglet Commodités OTA ─────────────────────────────────────── */}
      {hasAnyRole(['HOST', 'SUPERVISOR', 'SUPER_ADMIN', 'SUPER_MANAGER']) && (
        <TabPanel value={tabValue} index={tabIdx.amenitiesOta}>
          <AmenityMappingPage />
        </TabPanel>
      )}

    </div>
    </SettingsHeaderProvider>
  );
}
