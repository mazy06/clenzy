import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import { useReservations } from '../../hooks/useReservations';
import type { Reservation, ReservationStatus, ReservationSource } from '../../services/api/reservationsApi';
import type { CreateReservationData, UpdateReservationData } from '../../services/api/reservationsApi';
import { ReservationStatusChip, ReservationSourceBadge } from './ReservationStatusChip';
import ReservationFormDialog from './ReservationFormDialog';
import GuestProfileDialog from '../channels/GuestProfileDialog';
import PageHeader from '../../components/PageHeader';
import { FilterSearchBar } from '../../components/FilterSearchBar';

import { useCurrency } from '../../hooks/useCurrency';
import { useDynamicPageSize } from '../../hooks/useDynamicPageSize';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

const STATUS_OPTIONS: ReservationStatus[] = [
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
];

const SOURCE_OPTIONS: ReservationSource[] = [
  'airbnb',
  'booking',
  'direct',
  'other',
];

// ─── Date formatting helper ──────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────────────────────

const ReservationsList: React.FC = () => {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const theme = useTheme();
  const { convertAndFormat } = useCurrency();

  const formatPrice = (price: number | undefined, currency = 'EUR'): string => {
    if (price === undefined || price === null) return '-';
    return convertAndFormat(price, currency);
  };

  const {
    reservations,
    isLoading,
    isError,
    error,
    filters,
    setFilter,
    createReservation,
    isCreating,
    updateReservation,
    isUpdating,
    cancelReservation,
    isCancelling,
  } = useReservations();

  // ─── Local UI state ──────────────────────────────────────────────
  const [page, setPage] = useState(0);
  const { containerRef: tableContainerRef, pageSize: rowsPerPage } = useDynamicPageSize({
    rowHeight: 49,
    headerHeight: 42,
    bottomChrome: 72,
    min: 5,
    max: 50,
  });
  useEffect(() => { setPage(0); }, [rowsPerPage]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ─── Handlers ────────────────────────────────────────────────────

  const handleCreate = useCallback(() => {
    setEditingReservation(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((reservation: Reservation) => {
    setEditingReservation(reservation);
    setFormOpen(true);
  }, []);

  const handleCancelClick = useCallback((reservation: Reservation) => {
    setCancelTarget(reservation);
    setCancelDialogOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    async (data: CreateReservationData | UpdateReservationData) => {
      if (editingReservation) {
        await updateReservation({ id: editingReservation.id, data: data as UpdateReservationData });
        notify.success('Reservation mise a jour');
      } else {
        await createReservation(data as CreateReservationData);
        notify.success('Reservation creee');
      }
    },
    [editingReservation, updateReservation, createReservation, notify],
  );

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    try {
      await cancelReservation(cancelTarget.id);
      notify.success('Reservation annulee');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'annulation';
      notify.error(msg);
    } finally {
      setCancelDialogOpen(false);
      setCancelTarget(null);
    }
  }, [cancelTarget, cancelReservation, notify]);

  // Reset page when filters change
  const handleFilterChange = useCallback(
    <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => {
      setPage(0);
      setFilter(key, value);
    },
    [setFilter],
  );

  // ─── Search filter ───────────────────────────────────────────────
  const filteredReservations = useMemo(() => {
    if (!searchTerm.trim()) return reservations;
    const term = searchTerm.toLowerCase();
    return reservations.filter((r) =>
      r.guestName?.toLowerCase().includes(term) ||
      r.propertyName?.toLowerCase().includes(term) ||
      r.confirmationCode?.toLowerCase().includes(term)
    );
  }, [reservations, searchTerm]);

  // ─── Pagination slice ────────────────────────────────────────────
  const paginatedReservations = filteredReservations.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  // ─── Filter options for FilterSearchBar ─────────────────────────
  const statusOptions = useMemo(() => [
    { value: '', label: t('reservations.filters.allStatuses') },
    ...STATUS_OPTIONS.map((s) => ({ value: s, label: t(`reservations.status.${s}`) })),
  ], [t]);

  const sourceOptions = useMemo(() => [
    { value: '', label: t('reservations.filters.allSources') },
    ...SOURCE_OPTIONS.map((s) => ({ value: s, label: t(`reservations.source.${s}`) })),
  ], [t]);

  const iconButtonSx = {
    p: 0.5,
    borderRadius: 1,
    border: '1px solid',
    borderColor: 'divider',
    color: 'text.secondary',
    '&:hover': { bgcolor: 'rgba(107,138,154,0.08)', borderColor: 'primary.main', color: 'primary.main' },
    '& .MuiSvgIcon-root': { fontSize: 18 },
  } as const;

  const actionButtons = (
    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
      <Tooltip title={t('reservations.create')}>
        <IconButton
          size="small"
          onClick={handleCreate}
          sx={{ ...iconButtonSx, color: 'primary.main', borderColor: 'primary.main', bgcolor: 'rgba(107,138,154,0.06)' }}
        >
          <AddIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );

  const filterBar = (
    <FilterSearchBar
      bare
      searchTerm={searchTerm}
      onSearchChange={(v) => { setSearchTerm(v); setPage(0); }}
      searchPlaceholder={t('reservations.search') || 'Rechercher une réservation...'}
      filters={{
        status: {
          value: filters.status ?? '',
          options: statusOptions,
          onChange: (v) => handleFilterChange('status', (v || null) as ReservationStatus | null),
          label: t('reservations.fields.status'),
        },
        source: {
          value: filters.source ?? '',
          options: sourceOptions,
          onChange: (v) => handleFilterChange('source', (v || null) as ReservationSource | null),
          label: t('reservations.fields.source'),
        },
      }}
      counter={{
        label: t('reservations.reservation') || 'réservation',
        count: filteredReservations.length,
        singular: '',
        plural: 's',
      }}
    />
  );

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Header + Filters */}
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title={t('reservations.title')}
          subtitle={t('reservations.subtitle')}
          backPath="/dashboard"
          showBackButton={false}
          actions={actionButtons}
          filters={filterBar}
        />
      </Box>

      {/* Error */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2, flexShrink: 0 }}>
          {error ?? 'Erreur lors du chargement des reservations'}
        </Alert>
      )}

      {/* Loading */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : filteredReservations.length === 0 ? (
        /* Empty state */
        <Paper sx={{ ...CARD_SX, p: 4, textAlign: 'center' }}>
          <EventNoteIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('reservations.noReservations')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ajoutez votre premiere reservation ou importez vos calendriers depuis le planning.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} size="small">
            {t('reservations.create')}
          </Button>
        </Paper>
      ) : (
        /* Data table */
        <Paper ref={tableContainerRef} sx={{ ...CARD_SX, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TableContainer sx={{ flex: 1, overflow: 'hidden' }}>
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      color: theme.palette.text.secondary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                      whiteSpace: 'nowrap',
                    },
                  }}
                >
                  <TableCell>{t('reservations.fields.property')}</TableCell>
                  <TableCell>{t('reservations.fields.guestName')}</TableCell>
                  <TableCell>{t('reservations.fields.checkIn')}</TableCell>
                  <TableCell>{t('reservations.fields.checkOut')}</TableCell>
                  <TableCell>{t('reservations.fields.status')}</TableCell>
                  <TableCell>{t('reservations.fields.source')}</TableCell>
                  <TableCell align="right">{t('reservations.fields.totalPrice')}</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedReservations.map((r) => (
                  <TableRow
                    key={r.id}
                    hover
                    sx={{ '&:last-child td': { borderBottom: 0 } }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.82rem' }}>
                        {r.propertyName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                        }}
                        onClick={() => {
                          setSelectedGuestId(r.id);
                          setGuestDialogOpen(true);
                        }}
                      >
                        {r.guestName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {r.guestCount} {r.guestCount > 1 ? 'voyageurs' : 'voyageur'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                        {formatDate(r.checkIn)}
                      </Typography>
                      {r.checkInTime && (
                        <Typography variant="caption" color="text.secondary">
                          {r.checkInTime}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                        {formatDate(r.checkOut)}
                      </Typography>
                      {r.checkOutTime && (
                        <Typography variant="caption" color="text.secondary">
                          {r.checkOutTime}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <ReservationStatusChip status={r.status} />
                    </TableCell>
                    <TableCell>
                      <ReservationSourceBadge source={r.source} />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.82rem' }}>
                        {formatPrice(r.totalPrice)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={t('reservations.edit')}>
                        <IconButton size="small" onClick={() => handleEdit(r)}>
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      {r.status !== 'cancelled' && r.status !== 'checked_out' && (
                        <Tooltip title={t('reservations.cancel')}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleCancelClick(r)}
                          >
                            <CancelIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredReservations.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[]}
            labelDisplayedRows={({ from, to, count }) =>
              `${from}-${to} sur ${count !== -1 ? count : `plus de ${to}`}`
            }
            sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider' }}
          />
        </Paper>
      )}

      {/* Create/Edit dialog */}
      <ReservationFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingReservation(null);
        }}
        onSubmit={handleFormSubmit}
        reservation={editingReservation}
        isSubmitting={isCreating || isUpdating}
      />

      {/* Guest profile dialog */}
      <GuestProfileDialog
        guestId={selectedGuestId}
        open={guestDialogOpen}
        onClose={() => { setGuestDialogOpen(false); setSelectedGuestId(null); }}
      />

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle sx={{ pb: 1 }}>{t('reservations.cancel')}</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography variant="body2">
            {t('reservations.cancelConfirm')}
          </Typography>
          {cancelTarget && (
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
              {cancelTarget.guestName} - {cancelTarget.propertyName}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button
            onClick={() => setCancelDialogOpen(false)}
            size="small"
            disabled={isCancelling}
          >
            Non
          </Button>
          <Button
            onClick={handleConfirmCancel}
            color="error"
            variant="contained"
            size="small"
            disabled={isCancelling}
          >
            {isCancelling ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            Oui, annuler
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReservationsList;
