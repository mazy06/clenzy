import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  EventNote as EventNoteIcon,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import { useReservations } from '../../hooks/useReservations';
import type { Reservation, ReservationStatus, ReservationSource } from '../../services/api/reservationsApi';
import { ReservationStatusChip, ReservationSourceBadge } from './ReservationStatusChip';
import ReservationDialog from '../../components/reservations/ReservationDialog';
import GuestProfileDialog from '../channels/GuestProfileDialog';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import ListSkeleton from '../../components/ListSkeleton';
import { FilterSearchBar } from '../../components/FilterSearchBar';

import { Money } from '../../components/Money';
import { useDynamicPageSize } from '../../hooks/useDynamicPageSize';
import { useHighlightParam, useHighlightTarget } from '../../hooks/useHighlight';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid var(--line)',
  boxShadow: 'none',
  borderRadius: 'var(--radius-lg)',
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

const formatPrice = (price: number | undefined, currency = 'EUR') => {
  if (price === undefined || price === null) return '-';
  return <Money value={price} from={currency} />;
};

// ─── Component ───────────────────────────────────────────────────────────────

const ReservationsList: React.FC = () => {
  const { t } = useTranslation();
  const { notify } = useNotification();

  const {
    reservations,
    isLoading,
    isError,
    error,
    filters,
    setFilter,
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

  // ─── Deep-link notification (?highlight=<reservationId>) ─────────
  const highlightId = useHighlightParam();
  const highlightApplied = useRef(false);
  useEffect(() => {
    if (!highlightId || isLoading || highlightApplied.current) return;
    const idx = filteredReservations.findIndex((r) => String(r.id) === highlightId);
    if (idx < 0) return;
    highlightApplied.current = true;
    setPage(Math.floor(idx / rowsPerPage));
  }, [highlightId, isLoading, filteredReservations, rowsPerPage]);

  useHighlightTarget(highlightId, !isLoading && filteredReservations.length > 0);

  // ─── Filter options for FilterSearchBar ─────────────────────────
  const statusOptions = useMemo(() => [
    { value: '', label: t('reservations.filters.allStatuses') },
    ...STATUS_OPTIONS.map((s) => ({ value: s, label: t(`reservations.status.${s}`) })),
  ], [t]);

  const sourceOptions = useMemo(() => [
    { value: '', label: t('reservations.filters.allSources') },
    ...SOURCE_OPTIONS.map((s) => ({ value: s, label: t(`reservations.source.${s}`) })),
  ], [t]);

  const actionButtons = (
    <Button
      variant="contained"
      size="small"
      startIcon={<AddIcon size={16} strokeWidth={2} />}
      onClick={handleCreate}
    >
      {t('reservations.create')}
    </Button>
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
          iconBadge={<EventNoteIcon />}
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
        <ListSkeleton rows={6} variant="row" />
      ) : filteredReservations.length === 0 ? (
        <EmptyState
          icon={<EventNoteIcon />}
          title={t('reservations.noReservations')}
          description="Ajoutez votre première réservation manuellement, ou laissez Baitly importer vos calendriers Airbnb / Booking automatiquement."
          action={(
            <Button variant="outlined" size="small" startIcon={<AddIcon size={16} strokeWidth={1.75} />} onClick={handleCreate}>
              {t('reservations.create')}
            </Button>
          )}
          tip="Astuce : configure un lien iCal une fois et les nouvelles réservations apparaissent ici dans la minute."
        />
      ) : (
        /* Data table */
        <Paper ref={tableContainerRef} sx={{ ...CARD_SX, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TableContainer sx={{ flex: 1, overflow: 'hidden' }}>
            <Table size="small">
              <TableHead>
                {/* Entêtes overline portées par le thème global (10.5px faint uppercase) */}
                <TableRow sx={{ '& th': { whiteSpace: 'nowrap' } }}>
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
                    data-highlight-id={String(r.id)}
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
                          '&:hover': { color: 'var(--accent)', textDecoration: 'underline' },
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
                      <Typography variant="body2" sx={{ fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                        {formatDate(r.checkIn)}
                      </Typography>
                      {r.checkInTime && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {r.checkInTime}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                        {formatDate(r.checkOut)}
                      </Typography>
                      {r.checkOutTime && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
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
                      {/* Montant : display (Space Grotesk) + tabular-nums (baseline §1 typo) */}
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          fontFamily: 'var(--font-display)',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--ink)',
                        }}
                      >
                        {formatPrice(r.totalPrice)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={t('reservations.edit')}>
                        <IconButton size="small" onClick={() => handleEdit(r)}>
                          <EditIcon size={18} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                      {r.status !== 'cancelled' && r.status !== 'checked_out' && (
                        <Tooltip title={t('reservations.cancel')}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleCancelClick(r)}
                          >
                            <CancelIcon size={18} strokeWidth={1.75} />
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
      <ReservationDialog
        open={formOpen}
        mode={editingReservation ? 'edit' : 'create'}
        reservation={editingReservation}
        onClose={() => {
          setFormOpen(false);
          setEditingReservation(null);
        }}
        onCreated={() => notify.success('Réservation créée')}
        onUpdated={() => notify.success('Réservation mise à jour')}
      />

      {/* Guest profile dialog */}
      <GuestProfileDialog
        guestId={selectedGuestId}
        open={guestDialogOpen}
        onClose={() => { setGuestDialogOpen(false); setSelectedGuestId(null); }}
      />

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        {/* Peau modale portée par le thème global (titre display + filets + pied surface-2) */}
        <DialogTitle>{t('reservations.cancel')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t('reservations.cancelConfirm')}
          </Typography>
          {cancelTarget && (
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
              {cancelTarget.guestName} · {cancelTarget.propertyName}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
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
