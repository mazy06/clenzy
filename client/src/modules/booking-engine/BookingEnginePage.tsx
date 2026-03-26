import React, { useState, useCallback, useRef } from 'react';
import { Box, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Add, Save, Visibility } from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import type { BookingEngineConfig } from '../../services/api/bookingEngineApi';
import BookingEngineListTab from './BookingEngineListTab';
import BookingEngineConfigTab from './BookingEngineConfigTab';
import type { BookingEngineConfigTabHandle } from './BookingEngineConfigTab';

const BookingEnginePage: React.FC = () => {
  const { t } = useTranslation();
  const [editConfig, setEditConfig] = useState<BookingEngineConfig | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const configTabRef = useRef<BookingEngineConfigTabHandle>(null);

  const isEditing = editConfig !== null || isCreateMode;

  const handleEdit = useCallback((config: BookingEngineConfig) => {
    setEditConfig(config);
    setIsCreateMode(false);
  }, []);

  const handleCreate = useCallback(() => {
    setEditConfig(null);
    setIsCreateMode(true);
  }, []);

  const handleBackToList = useCallback(() => {
    setEditConfig(null);
    setIsCreateMode(false);
  }, []);

  const headerActions = isEditing ? (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Tooltip title={t('bookingEngine.actions.preview', 'Aperçu')}>
        <IconButton size="small" onClick={() => configTabRef.current?.openPreview()} sx={{ bgcolor: 'action.hover' }}>
          <Visibility fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={isSaving ? t('bookingEngine.saving') : t('bookingEngine.save')}>
        <span>
          <IconButton
            size="small"
            onClick={() => configTabRef.current?.save()}
            disabled={isSaving}
            color="primary"
            sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
          >
            {isSaving ? <CircularProgress size={18} color="inherit" /> : <Save fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  ) : (
    <Tooltip title={t('bookingEngine.actions.newTemplate')}>
      <IconButton
        size="small"
        onClick={handleCreate}
        color="primary"
        sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}
      >
        <Add fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box>
      <PageHeader
        title={t('bookingEngine.title')}
        subtitle={t('bookingEngine.subtitle')}
        backPath={isEditing ? undefined : '/dashboard'}
        onBack={isEditing ? handleBackToList : undefined}
        backLabel={isEditing ? t('bookingEngine.actions.backToList') : undefined}
        actions={headerActions}
      />

      {isEditing ? (
        <BookingEngineConfigTab
          ref={configTabRef}
          config={isCreateMode ? null : editConfig}
          onBack={handleBackToList}
          onSavingChange={setIsSaving}
        />
      ) : (
        <BookingEngineListTab onEdit={handleEdit} onCreate={handleCreate} />
      )}
    </Box>
  );
};

export default BookingEnginePage;
