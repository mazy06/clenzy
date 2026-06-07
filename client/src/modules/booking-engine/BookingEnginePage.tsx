import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  TextField,
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

const BookingEnginePage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
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
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Visibility size={14} strokeWidth={1.75} />}
        onClick={() => configTabRef.current?.openPreview()}
      >
        {t('bookingEngine.actions.preview', 'Aperçu')}
      </Button>
      <Button
        variant="contained"
        size="small"
        startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <Save size={14} strokeWidth={1.75} />}
        onClick={() => configTabRef.current?.save()}
        disabled={isSaving}
      >
        {isSaving ? t('bookingEngine.saving', 'Sauvegarde…') : t('bookingEngine.save', 'Sauvegarder')}
      </Button>
    </Box>
  ) : (
    <Button
      variant="contained"
      size="small"
      startIcon={<Add size={14} strokeWidth={1.75} />}
      onClick={handleCreate}
    >
      {t('bookingEngine.actions.newTemplate', 'Nouveau template')}
    </Button>
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

  const body = isEditing ? (
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
  );

  // Mode embarque (onglet du parent "Réservation & accueil") : pas de PageHeader
  // propre (le parent le fournit), les actions vivent dans une barre locale.
  if (embedded) {
    return (
      <Box>
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}
        >
          <Box sx={{ flex: 1 }}>{listFilters}</Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {isEditing ? (
              <Button variant="text" size="small" onClick={handleBackToList}>
                {t('bookingEngine.actions.backToList', 'Retour')}
              </Button>
            ) : null}
            {headerActions}
          </Box>
        </Box>
        {body}
      </Box>
    );
  }

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
      {body}
    </Box>
  );
};

export default BookingEnginePage;
