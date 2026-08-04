import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Button, Spinner } from '../../components/ui';
import {
  Alert,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
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
import PagePagination from '../../components/PagePagination';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_CLASS = 'border border-solid border-[var(--line)] shadow-none rounded-[var(--radius-lg)] bg-[var(--card)]';

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
  'vrbo',
  'expedia',
  'agoda',
  'hotels_com',
  'hometogo',
  'mabeet',
  'rentelly',
  'gathern',
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

  // Recherche débouncée (300 ms) : évite une requête serveur par frappe.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // ─── Pagination serveur (audit perf 2026-07-21, P1-6) ────────────
  // Le serveur pagine, filtre (status/source en SQL) et cherche (guest,
  // code de confirmation, logement) ; le client ne slice plus.
  const {
    reservations,
    totalElements,
    isLoading,
    isError,
    error,
    filters,
    setFilter,
    cancelReservation,
    isCancelling,
  } = useReservations({
    pagination: { page, size: rowsPerPage, search: debouncedSearch },
  });

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

  // Si le total rétrécit (annulation du dernier élément d'une page), on
  // revient sur la dernière page valide.
  useEffect(() => {
    if (isLoading) return;
    const maxPage = Math.max(0, Math.ceil(totalElements / rowsPerPage) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [isLoading, totalElements, rowsPerPage, page]);

  // ─── Deep-link notification (?highlight=<reservationId>) ─────────
  // Pagination serveur : on ne connaît que la page courante, impossible de
  // calculer la page cible d'un id absent. Le highlight s'applique si la
  // réservation est visible sur la page courante (cas nominal : tri
  // checkIn ASC + fenêtre par défaut → les résas actives sont en tête).
  const highlightId = useHighlightParam();
  useHighlightTarget(highlightId, !isLoading && reservations.length > 0);

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
    <Button size="sm" onClick={handleCreate}>
      <AddIcon strokeWidth={2} />
      {t('reservations.create')}
    </Button>
  );

  const filterBar = (
    <FilterSearchBar
      bare
      searchTerm={searchTerm}
      onSearchChange={(v) => { setSearchTerm(v); setPage(0); }}
      searchPlaceholder={t('reservations.search', 'Rechercher une réservation...')}
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
        label: t('reservations.reservation', 'réservation'),
        count: totalElements,
        singular: '',
        plural: 's',
      }}
    />
  );

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header + Filters */}
      <div className="shrink-0">
        <PageHeader
          title={t('reservations.title')}
          subtitle={t('reservations.subtitle')}
          iconBadge={<EventNoteIcon />}
          backPath="/dashboard"
          showBackButton={false}
          actions={actionButtons}
          filters={filterBar}
        />
      </div>

      {/* Error */}
      {isError && (
        <Alert variant="destructive" className="mb-3 shrink-0">
          <TriangleAlert />
          <AlertDescription>{error ?? 'Erreur lors du chargement des reservations'}</AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {isLoading ? (
        <ListSkeleton rows={6} variant="row" />
      ) : totalElements === 0 ? (
        <EmptyState
          icon={<EventNoteIcon />}
          title={t('reservations.noReservations')}
          description="Ajoutez votre première réservation manuellement, ou laissez Baitly importer vos calendriers Airbnb / Booking automatiquement."
          action={(
            <Button variant="outline" size="sm" onClick={handleCreate}>
              <AddIcon strokeWidth={1.75} />
              {t('reservations.create')}
            </Button>
          )}
          tip="Astuce : configure un lien iCal une fois et les nouvelles réservations apparaissent ici dans la minute."
        />
      ) : (
        /* Data table */
        <div ref={tableContainerRef} className={cn(CARD_CLASS, 'flex-1 min-h-0 flex flex-col overflow-hidden')}>
          <div className="flex-1 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="[&_th]:whitespace-nowrap">
                  <TableHead>{t('reservations.fields.property')}</TableHead>
                  <TableHead>{t('reservations.fields.guestName')}</TableHead>
                  <TableHead>{t('reservations.fields.checkIn')}</TableHead>
                  <TableHead>{t('reservations.fields.checkOut')}</TableHead>
                  <TableHead>{t('reservations.fields.status')}</TableHead>
                  <TableHead>{t('reservations.fields.source')}</TableHead>
                  <TableHead className="text-end">{t('reservations.fields.totalPrice')}</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((r) => (
                  <TableRow
                    key={r.id}
                    data-highlight-id={String(r.id)}
                  >
                    <TableCell>
                      <p className="cn-text-body2 font-medium text-[0.82rem]">
                        {r.propertyName}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="cn-text-body2 text-[0.82rem] cursor-pointer hover:text-[var(--accent)] hover:decoration-[underline]" onClick={() => {
                          setSelectedGuestId(r.id);
                          setGuestDialogOpen(true);
                        }}>
                        {r.guestName}
                      </p>
                      <span className="cn-text-caption text-muted-foreground">
                        {r.guestCount} {r.guestCount > 1 ? 'voyageurs' : 'voyageur'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="cn-text-body2 text-[0.82rem] tabular-nums">
                        {formatDate(r.checkIn)}
                      </p>
                      {r.checkInTime && (
                        <span className="cn-text-caption text-muted-foreground tabular-nums">
                          {r.checkInTime}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="cn-text-body2 text-[0.82rem] tabular-nums">
                        {formatDate(r.checkOut)}
                      </p>
                      {r.checkOutTime && (
                        <span className="cn-text-caption text-muted-foreground tabular-nums">
                          {r.checkOutTime}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ReservationStatusChip status={r.status} />
                    </TableCell>
                    <TableCell>
                      <ReservationSourceBadge source={r.source} />
                    </TableCell>
                    <TableCell className="text-end">
                      {/* Montant : display (Space Grotesk) + tabular-nums (baseline §1 typo) */}
                      <p className="cn-text-body2 text-[0.82rem] font-semibold font-[family-name:var(--font-display)] tabular-nums text-[var(--ink)]">
                        {formatPrice(r.totalPrice)}
                      </p>
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {/* span : TooltipTrigger asChild pose une ref DOM que le
                              Button du kit (fonction, React 18) ne transmet pas. */}
                          <span className="inline-flex">
                            <Button variant="ghost" size="icon-sm" aria-label={t('reservations.edit')} onClick={() => handleEdit(r)}>
                              <EditIcon size={18} strokeWidth={1.75} />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{t('reservations.edit')}</TooltipContent>
                      </Tooltip>
                      {r.status !== 'cancelled' && r.status !== 'checked_out' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('reservations.cancel')}
                                onClick={() => handleCancelClick(r)}
                                className="text-[var(--err)] hover:text-[var(--err)]"
                              >
                                <CancelIcon size={18} strokeWidth={1.75} />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('reservations.cancel')}</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PagePagination
            count={totalElements}
            page={page}
            onPageChange={(newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
          />
        </div>
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
      <Dialog open={cancelDialogOpen} onOpenChange={(next) => { if (!next) setCancelDialogOpen(false); }}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('reservations.cancel')}</DialogTitle>
        </DialogHeader>
        <div>
          <p className="cn-text-body2">
            {t('reservations.cancelConfirm')}
          </p>
          {cancelTarget && (
            <p className="cn-text-body2 mt-1.5 font-semibold">
              {cancelTarget.guestName} · {cancelTarget.propertyName}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCancelDialogOpen(false)}
            disabled={isCancelling}
          >
            Non
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirmCancel}
            disabled={isCancelling}
          >
            {isCancelling ? <Spinner className="size-[18px]" /> : null}
            Oui, annuler
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReservationsList;
