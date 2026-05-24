import React, { useState } from 'react';
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

// ─── Metadata par tab (breadcrumb + subtitle) ────────────────────────────────
// Clef = LABEL traduit du tab (string stable face aux changements d'index visible).
const TARIFICATION_TAB_META: Record<string, TabHeaderMeta> = {
  'Abonnement PMS': {
    subtitle: 'Configuration tarifaire des prestations PMS : abonnements, paliers et options.',
  },
  'Entretien': {
    subtitle: "Tarifs des prestations d'entretien et menage : forfaits, suppléments et coefficients.",
  },
  'Travaux': {
    subtitle: 'Grille tarifaire des travaux et interventions techniques par typologie de chantier.',
  },
  'Extérieur': {
    subtitle: 'Tarifs des prestations extérieures : jardinage, piscine, espaces verts.',
  },
  'Blanchisserie': {
    subtitle: 'Tarification du linge : forfaits par type de pièce, lavage et livraison.',
  },
  'Monitoring': {
    subtitle: 'Tarifs des offres de monitoring sonore (Minut, Roomonitor) propagés aux clients.',
  },
};
const TARIFICATION_ROOT_TITLE = 'Configuration tarifaire';
const TARIFICATION_DEFAULT_SUBTITLE = 'Gérez les coefficients de pondération, les prix de base et les abonnements';

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

  const [activeTab, setActiveTab] = useState(0);

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

  // Source de verite des tabs — utilisee pour PageTabs ET pour la resolution
  // {title, subtitle} via resolveTabHeader (indexe par label).
  const tabs = TAB_DEFS.map((tab) => ({
    label: t(`tarification.tabs.${tab.key}`),
    icon: tab.icon,
  }));
  const { title, subtitle } = resolveTabHeader(
    TARIFICATION_ROOT_TITLE,
    TARIFICATION_DEFAULT_SUBTITLE,
    tabs.map((tab) => tab.label),
    activeTab,
    TARIFICATION_TAB_META,
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
                    sx={{ fontSize: '0.8125rem', py: 0.5, borderWidth: 1.5 }}
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
                    sx={{ fontSize: '0.8125rem', py: 0.5 }}
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
            <TabTravaux config={config} canEdit={canEdit} onUpdate={updateConfig} currencySymbol={currencySymbol} />
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
