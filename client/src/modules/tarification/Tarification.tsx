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

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={t('tarification.title')}
        subtitle={t('tarification.subtitle')}
        iconBadge={<Euro />}
        backPath="/dashboard"
        actions={
          canEdit ? (
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
          ) : undefined
        }
      />

      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('tarification.readOnly')}
        </Alert>
      )}

      {/* ─── Tabs ──────────────────────────────────────────────────── */}
      <PageTabs
        options={TAB_DEFS.map((tab) => ({
          label: t(`tarification.tabs.${tab.key}`),
          icon: tab.icon,
        }))}
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
  );
}
