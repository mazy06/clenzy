import React, { useState, useCallback } from 'react';
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
  TextField,
  MenuItem,
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
import { SPACING } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currencyUtils';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

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

function formatPrice(price: number | undefined, currency = 'EUR'): string {
  if (price === undefined || price === null) return '-';
  return formatCurrency(price, currency);
}

// ─── Component ───────────────────────────────────────────────────────────────

const ReservationsList: React.FC = () => {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const theme = useTheme();

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
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<number | null>(null);

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

  // ─── Pagination slice ────────────────────────────────────────────
  const paginatedReservations = reservations.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      {/* Header */}
      <PageHeader
        title={t('reservations.title')}
        subtitle={t('reservations.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            size="small"
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {t('reservations.create')}
          </Button>
        }
      />

      {/* Filters */}
      <Paper sx={{ ...CARD_SX, p: 1.5, mb: 1.5, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Status filter */}
        <TextField
          select
          size="small"
          label={t('reservations.fields.status')}
          value={filters.status ?? ''}
          onChange={(e) =>
            handleFilterChange('status', (e.target.value || null) as ReservationStatus | null)
          }
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">{t('reservations.filters.allStatuses')}</MenuItem>
          {STATUS_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {t(`reservations.status.${s}`)}
            </MenuItem>
          ))}
        </TextField>

        {/* Source filter */}
        <TextField
          select
          size="small"
          label={t('reservations.fields.source')}
          value={filters.source ?? ''}
          onChange={(e) =>
            handleFilterChange('source', (e.target.value || null) as ReservationSource | null)
          }
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">{t('reservations.filters.allSources')}</MenuItem>
          {SOURCE_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {t(`reservations.source.${s}`)}
            </MenuItem>
          ))}
        </TextField>

        {/* Date from */}
        <TextField
          size="small"
          type="date"
          label={t('reservations.fields.checkIn')}
          value={filters.from}
          onChange={(e) => handleFilterChange('from', e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />

        {/* Date to */}
        <TextField
          size="small"
          type="date"
          label={t('reservations.fields.checkOut')}
          value={filters.to}
          onChange={(e) => handleFilterChange('to', e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
      </Paper>

      {/* Error */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error ?? 'Erreur lors du chargement des reservations'}
        </Alert>
      )}

      {/* Loading */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : reservations.length === 0 ? (
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
        <Paper sx={CARD_SX}>
          <TableContainer>
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
            count={reservations.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            labelRowsPerPage="Lignes par page"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}-${to} sur ${count !== -1 ? count : `plus de ${to}`}`
            }
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
