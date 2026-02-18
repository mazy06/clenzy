import React, { useState } from 'react';
import {
  Box,
  Alert,
  Snackbar,
  CircularProgress,
  Button,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Save,
  Refresh,
  Devices,
  CleaningServices,
  Build,
  Yard,
  LocalLaundryService,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { useTarification } from '../../hooks/useTarification';
import PageHeader from '../../components/PageHeader';
import TabPMS from './TabPMS';
import TabEntretien from './TabEntretien';
import TabTravaux from './TabTravaux';
import TabExterieur from './TabExterieur';
import TabBlanchisserie from './TabBlanchisserie';

// ─── Tab config ──────────────────────────────────────────────────────────────

const TAB_DEFS = [
  { key: 'pms',           icon: <Devices fontSize="small" /> },
  { key: 'entretien',     icon: <CleaningServices fontSize="small" /> },
  { key: 'travaux',       icon: <Build fontSize="small" /> },
  { key: 'exterieur',     icon: <Yard fontSize="small" /> },
  { key: 'blanchisserie', icon: <LocalLaundryService fontSize="small" /> },
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
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              minHeight: 48,
              fontSize: '0.85rem',
            },
          }}
        >
          {TAB_DEFS.map((tab) => (
            <Tab
              key={tab.key}
              icon={tab.icon}
              iconPosition="start"
              label={t(`tarification.tabs.${tab.key}`)}
            />
          ))}
        </Tabs>

        {/* ─── Tab Content ───────────────────────────────────────────── */}
        <Box sx={{ p: 2 }}>
          {activeTab === 0 && (
            <TabPMS config={config} canEdit={canEdit} onUpdate={updateConfig} />
          )}
          {activeTab === 1 && (
            <TabEntretien config={config} teams={teams} canEdit={canEdit} onUpdate={updateConfig} />
          )}
          {activeTab === 2 && (
            <TabTravaux config={config} canEdit={canEdit} onUpdate={updateConfig} />
          )}
          {activeTab === 3 && (
            <TabExterieur config={config} canEdit={canEdit} onUpdate={updateConfig} />
          )}
          {activeTab === 4 && (
            <TabBlanchisserie config={config} canEdit={canEdit} onUpdate={updateConfig} />
          )}
        </Box>
      </Paper>

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
