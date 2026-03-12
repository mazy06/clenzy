import React, { useState, useCallback, useRef } from 'react';
import {
  Box, Tabs, Tab, Button, CircularProgress,
} from '@mui/material';
import {
  FormatListBulleted, Settings as SettingsIcon, Add, Save,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import type { BookingEngineConfig } from '../../services/api/bookingEngineApi';
import BookingEngineListTab from './BookingEngineListTab';
import BookingEngineConfigTab from './BookingEngineConfigTab';
import type { BookingEngineConfigTabHandle } from './BookingEngineConfigTab';

// ─── TabPanel ───────────────────────────────────────────────────────────────

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
      id={`booking-tabpanel-${index}`}
      aria-labelledby={`booking-tab-${index}`}
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
    id: `booking-tab-${index}`,
    'aria-controls': `booking-tabpanel-${index}`,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

const BookingEnginePage: React.FC = () => {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);
  const [editConfig, setEditConfig] = useState<BookingEngineConfig | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const configTabRef = useRef<BookingEngineConfigTabHandle>(null);

  const handleEdit = useCallback((config: BookingEngineConfig) => {
    setEditConfig(config);
    setIsCreateMode(false);
    setTabValue(1);
  }, []);

  const handleCreate = useCallback(() => {
    setEditConfig(null);
    setIsCreateMode(true);
    setTabValue(1);
  }, []);

  const handleBackToList = useCallback(() => {
    setEditConfig(null);
    setIsCreateMode(false);
    setTabValue(0);
  }, []);

  const handleSaveFromHeader = useCallback(() => {
    configTabRef.current?.save();
  }, []);

  // ─── Dynamic PageHeader props based on active tab ─────────────────
  const isOnConfigTab = tabValue === 1;

  const headerActions = isOnConfigTab ? (
    <Button
      variant="contained"
      startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <Save />}
      onClick={handleSaveFromHeader}
      disabled={isSaving}
      size="small"
      sx={{ textTransform: 'none', fontWeight: 600 }}
    >
      {isSaving ? t('bookingEngine.saving') : t('bookingEngine.save')}
    </Button>
  ) : (
    <Button
      variant="contained"
      startIcon={<Add />}
      onClick={handleCreate}
      size="small"
      sx={{ textTransform: 'none', fontWeight: 600 }}
    >
      {t('bookingEngine.actions.newTemplate')}
    </Button>
  );

  return (
    <Box>
      <PageHeader
        title={t('bookingEngine.title')}
        subtitle={t('bookingEngine.subtitle')}
        backPath={isOnConfigTab ? undefined : '/dashboard'}
        onBack={isOnConfigTab ? handleBackToList : undefined}
        backLabel={isOnConfigTab ? t('bookingEngine.actions.backToList') : undefined}
        actions={headerActions}
      />

      <Tabs
        value={tabValue}
        variant="fullWidth"
        onChange={(_e, v: number) => {
          // Empecher la navigation directe vers l'onglet Config sans contexte (edit ou create)
          if (v === 1 && !editConfig && !isCreateMode) {
            return;
          }
          setTabValue(v);
        }}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            minHeight: 42,
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
          },
        }}
      >
        <Tab
          icon={<FormatListBulleted sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={t('bookingEngine.tabs.list')}
          {...a11yProps(0)}
        />
        <Tab
          icon={<SettingsIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={t('bookingEngine.tabs.configuration')}
          {...a11yProps(1)}
        />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <BookingEngineListTab onEdit={handleEdit} onCreate={handleCreate} />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <BookingEngineConfigTab
          ref={configTabRef}
          config={isCreateMode ? null : editConfig}
          onBack={handleBackToList}
          onSavingChange={setIsSaving}
        />
      </TabPanel>
    </Box>
  );
};

export default BookingEnginePage;
