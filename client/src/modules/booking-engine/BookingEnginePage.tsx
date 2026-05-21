import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { Add, Save, Visibility, EventNote, Search as SearchIcon } from '../../icons';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import type { BookingEngineConfig } from '../../services/api/bookingEngineApi';
import BookingEngineListTab from './BookingEngineListTab';
import BookingEngineConfigTab from './BookingEngineConfigTab';
import type { BookingEngineConfigTabHandle } from './BookingEngineConfigTab';
import { semanticToHex, softChipSx } from '../../utils/statusUtils';

const BookingEnginePage: React.FC = () => {
  const { t } = useTranslation();
  const [editConfig, setEditConfig] = useState<BookingEngineConfig | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const configTabRef = useRef<BookingEngineConfigTabHandle>(null);

  const isEditing = editConfig !== null || isCreateMode;

  // ── List filtering — owned by the page so the search + count chip can live in the
  // ── PageHeader `filters` slot. The list tab still owns the data fetching.
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [filteredCount, setFilteredCount] = useState(0);

  const showListFilters = !isEditing && totalCount != null && totalCount > 0;

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

  const listFilters = showListFilters ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
      <TextField
        size="small"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('bookingEngine.list.searchPlaceholder', 'Rechercher par nom, organisation ou clé')}
        sx={{ width: { xs: 200, md: 320 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon size={16} strokeWidth={1.75} />
            </InputAdornment>
          ),
        }}
      />
      <Chip
        label={`${filteredCount} template${filteredCount > 1 ? 's' : ''}`}
        size="small"
        sx={softChipSx(semanticToHex('primary'))}
      />
    </Box>
  ) : undefined;

  return (
    <Box>
      <PageHeader
        title={t('bookingEngine.title')}
        subtitle={t('bookingEngine.subtitle')}
        iconBadge={<EventNote />}
        backPath={isEditing ? undefined : '/dashboard'}
        onBack={isEditing ? handleBackToList : undefined}
        backLabel={isEditing ? t('bookingEngine.actions.backToList') : undefined}
        filters={listFilters}
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
        <BookingEngineListTab
          onEdit={handleEdit}
          onCreate={handleCreate}
          search={search}
          onTotalCountChange={setTotalCount}
          onFilteredCountChange={setFilteredCount}
        />
      )}
    </Box>
  );
};

export default BookingEnginePage;
