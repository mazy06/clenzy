import React from 'react';
import {
  Box,
  Alert,
  Snackbar,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  Save,
  Refresh,
  Devices,
  CleaningServices,
  Build,
  Yard,
  LocalLaundryService,
  VolumeUp,
  Euro,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useTarification } from '../../hooks/useTarification';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTabKeyParam } from '../../components/tabKeyParam';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import TabPMS from './TabPMS';
import TabEntretien from './TabEntretien';
import TabTravaux from './TabTravaux';
import TabExterieur from './TabExterieur';
import TabBlanchisserie from './TabBlanchisserie';
import TabMonitoring from './TabMonitoring';

// ─── Tab config ──────────────────────────────────────────────────────────────

const TAB_DEFS = [
  { key: 'pms',           icon: <Devices /> },
  { key: 'entretien',     icon: <CleaningServices /> },
  { key: 'travaux',       icon: <Build /> },
  { key: 'exterieur',     icon: <Yard /> },
  { key: 'blanchisserie', icon: <LocalLaundryService /> },
  { key: 'monitoring',    icon: <VolumeUp /> },
] as const;

// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. tarificationTabMeta plus bas).

// ─── Component ───────────────────────────────────────────────────────────────

export default function Tarification() {
  const { t } = useTranslation();
  const {
    config,
    teams,
    isLoading,
    canEdit,
    isSaving,
    currencySymbol,
    updateConfig,
    saveConfig,
    resetConfig,
    snackbar,
    closeSnackbar,
  } = useTarification();

  // TAB_DEFS porte deja les `key` stables : on le passe directement au hook (URL ?tab=<key>).
  const [activeTab, setActiveTab] = useTabKeyParam(TAB_DEFS);

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

  // Source de verite des tabs — utilisee pour PageTabs ET pour la resolution
  // {title, subtitle} via resolveTabHeader (indexe par label).
  const tabs = TAB_DEFS.map((tab) => ({
    label: t(`tarification.tabs.${tab.key}`),
    icon: tab.icon,
  }));
  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const tarificationTabMeta: Record<string, TabHeaderMeta> = {
    [t('tarification.tabs.pms')]: {
      subtitle: t('tabHeaders.tarification.subtitle.pms', 'Configuration tarifaire des prestations PMS : abonnements, paliers et options.'),
    },
    [t('tarification.tabs.entretien')]: {
      subtitle: t('tabHeaders.tarification.subtitle.entretien', "Tarifs des prestations d'entretien et menage : forfaits, suppléments et coefficients."),
    },
    [t('tarification.tabs.travaux')]: {
      subtitle: t('tabHeaders.tarification.subtitle.travaux', 'Grille tarifaire des travaux et interventions techniques par typologie de chantier.'),
    },
    [t('tarification.tabs.exterieur')]: {
      subtitle: t('tabHeaders.tarification.subtitle.exterieur', 'Tarifs des prestations extérieures : jardinage, piscine, espaces verts.'),
    },
    [t('tarification.tabs.blanchisserie')]: {
      subtitle: t('tabHeaders.tarification.subtitle.blanchisserie', 'Tarification du linge : forfaits par type de pièce, lavage et livraison.'),
    },
    [t('tarification.tabs.monitoring')]: {
      subtitle: t('tabHeaders.tarification.subtitle.monitoring', 'Tarifs des offres de monitoring sonore (Minut, Roomonitor) propagés aux clients.'),
    },
  };
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.tarification.title', 'Configuration tarifaire'),
    t('tabHeaders.tarification.default', 'Gérez les coefficients de pondération, les prix de base et les abonnements'),
    tabs.map((tab) => tab.label),
    activeTab,
    tarificationTabMeta,
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <Box>
        <PageHeader
          title={title}
          subtitle={subtitle}
          iconBadge={<Euro />}
          backPath="/dashboard"
          actions={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {headerActionsPortal}
              {canEdit && (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Refresh />}
                    onClick={resetConfig}
                    disabled={isSaving}
                    title={t('tarification.reset')}
                  >
                    {t('tarification.reset')}
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                    onClick={saveConfig}
                    disabled={isSaving}
                    title={t('tarification.save')}
                  >
                    {t('tarification.save')}
                  </Button>
                </>
              )}
            </Box>
          }
        />

        {!canEdit && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('tarification.readOnly')}
          </Alert>
        )}

        {/* ─── Tabs ──────────────────────────────────────────────────── */}
        <PageTabs
          options={tabs}
          value={activeTab}
          onChange={setActiveTab}
        />

        {/* ─── Tab Content ───────────────────────────────────────────── */}
        <Box sx={{ pt: 1 }}>
          {activeTab === 0 && (
            <TabPMS config={config} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
          )}
          {activeTab === 1 && (
            <TabEntretien config={config} teams={teams} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
          )}
          {activeTab === 2 && (
            <TabTravaux
              items={config.travauxConfig || []}
              canEdit={canEdit}
              onItemsChange={(items) => updateConfig({ travauxConfig: items })}
              currencySymbol={currencySymbol}
              commission={(config.commissionConfigs || []).find((c) => c.category === 'travaux')}
              onCommissionChange={(updated) => {
                const configs = [...(config.commissionConfigs || [])];
                const idx = configs.findIndex((c) => c.category === 'travaux');
                if (idx >= 0) configs[idx] = updated; else configs.push(updated);
                updateConfig({ commissionConfigs: configs });
              }}
            />
          )}
          {activeTab === 3 && (
            <TabExterieur config={config} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
          )}
          {activeTab === 4 && (
            <TabBlanchisserie config={config} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
          )}
          {activeTab === 5 && (
            <TabMonitoring config={config} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
          )}
        </Box>

        {/* ─── Snackbar ────────────────────────────────────────────────── */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={closeSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={closeSnackbar} severity={snackbar.severity} variant="filled">
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </PageHeaderActionsProvider>
  );
}
