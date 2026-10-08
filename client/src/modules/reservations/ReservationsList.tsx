import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, TriangleAlert } from '../../icons/glyphs';
import ModuleFirstUsePage from '../../components/first-use/ModuleFirstUsePage';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Spinner,
} from '../../components/ui';
import { Add as AddIcon, EventNote as EventNoteIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import { reservationsKeys, useReservations } from '../../hooks/useReservations';
import { usePropertiesList } from '../../hooks/usePropertiesList';
import { reservationsApi } from '../../services/api/reservationsApi';
import type { Reservation, ReservationStatus, ReservationSource } from '../../services/api/reservationsApi';
import ReservationDialog from '../../components/reservations/ReservationDialog';
import { RESERVATION_ART } from '../../components/reservations/reservationArtwork';
import GuestProfileDialog from '../channels/GuestProfileDialog';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import FilterChipRow from '../../components/baitly/FilterChipRow';
import { FilterSearchBar } from '../../components/FilterSearchBar';
import PagePagination from '../../components/PagePagination';
import { useDynamicPageSize } from '../../hooks/useDynamicPageSize';
import { useHighlightParam, useHighlightTarget } from '../../hooks/useHighlight';
import ReservationListItem from './ReservationListItem';
import ReservationDetailPanel from './ReservationDetailPanel';
import './reservationsWorkspace.css';

const STATUS_OPTIONS: ReservationStatus[] = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

const SOURCE_OPTIONS: ReservationSource[] = [
  'airbnb', 'booking', 'vrbo', 'expedia', 'agoda', 'hotels_com', 'hometogo', 'mabeet', 'rentelly', 'gathern', 'direct', 'other',
];

/** Une seule colonne en dessous : la liste, puis le détail avec un retour. */
const SINGLE_COLUMN_QUERY = '(max-width: 1023px)';

const ReservationsList: React.FC = () => {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const detailId = useId();

  // ─── Liste paginée côté serveur (audit perf 2026-07-21, P1-6) ─────
  // La page tient dans la hauteur de la colonne : pas de défilement, la
  // pagination prend le relais (même règle que l'espace Finances).
  const [page, setPage] = useState(0);
  const { containerRef: listRef, pageSize } = useDynamicPageSize({
    rowHeight: 69,
    headerHeight: 45,
    bottomChrome: 56,
    min: 4,
    max: 40,
  });
  useEffect(() => { setPage(0); }, [pageSize]);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

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
  } = useReservations({ pagination: { page, size: pageSize, search: debouncedSearch } });

  // Une requête pour toutes les vignettes : la liste des logements est déjà
  // en cache (60 s), partagée avec l'écran Propriétés.
  const { properties } = usePropertiesList();
  const propertyById = useMemo(() => new Map(properties.map((property) => [String(property.id), property])), [properties]);
  const photoOf = (reservation: Reservation) => {
    const property = propertyById.get(String(reservation.propertyId));
    return property?.imageUrl ?? property?.photoUrls?.[0];
  };

  // ─── Sélection ────────────────────────────────────────────────────
  // Les liens profonds (notifications, messagerie) arrivent en
  // `?highlight=<id>` : la réservation est ouverte même hors de la page
  // visible, chargée par son id.
  const highlightId = useHighlightParam();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  useEffect(() => {
    if (highlightId && /^\d+$/.test(highlightId)) setSelectedId(Number(highlightId));
  }, [highlightId]);
  useHighlightTarget(highlightId, !isLoading && reservations.length > 0);

  const inPage = reservations.find((reservation) => reservation.id === selectedId);
  const selectedQuery = useQuery({
    queryKey: [...reservationsKeys.all, 'detail', selectedId],
    queryFn: () => reservationsApi.getById(selectedId!),
    enabled: selectedId != null && !inPage && !isLoading,
    staleTime: 30_000,
    retry: false,
  });
  const selected = inPage ?? selectedQuery.data ?? null;
  const selectionPending = selectedId != null && !selected && (isLoading || selectedQuery.isFetching);

  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const handleSelect = useCallback((reservation: Reservation, button: HTMLButtonElement) => {
    trigger.current = button;
    setSelectedId(reservation.id);
    if (window.matchMedia?.(SINGLE_COLUMN_QUERY)?.matches) requestAnimationFrame(() => heading.current?.focus());
  }, []);
  const handleBack = useCallback(() => {
    setSelectedId(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }, []);

  // ─── Dialogues ────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [guestId, setGuestId] = useState<number | null>(null);

  const handleCreate = useCallback(() => {
    setEditingReservation(null);
    setFormOpen(true);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    try {
      await cancelReservation(cancelTarget.id);
      notify.success(t('reservationsWorkspace.toast.cancelled'));
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : t('reservations.cancelError'));
    } finally {
      setCancelTarget(null);
    }
  }, [cancelTarget, cancelReservation, notify, t]);

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
    const maxPage = Math.max(0, Math.ceil(totalElements / pageSize) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [isLoading, totalElements, pageSize, page]);

  const sourceOptions = useMemo(() => [
    { value: '', label: t('reservations.filters.allSources') },
    ...SOURCE_OPTIONS.map((source) => ({ value: source, label: t(`reservations.source.${source}`) })),
  ], [t]);

  const filterBar = (
    <FilterSearchBar
      bare
      searchTerm={searchTerm}
      onSearchChange={(value) => { setSearchTerm(value); setPage(0); }}
      searchPlaceholder={t('reservations.search', 'Rechercher une réservation...')}
      filters={{
        source: {
          value: filters.source ?? '',
          options: sourceOptions,
          onChange: (value) => handleFilterChange('source', (value || null) as ReservationSource | null),
          label: t('reservations.fields.source'),
        },
      }}
      counter={{ label: t('reservations.reservation', 'réservation'), count: totalElements, singular: '', plural: 's' }}
    />
  );

  const hasCriteria = !!debouncedSearch || !!filters.status || !!filters.source;
  const firstUse = !isLoading && !isError && totalElements === 0 && !hasCriteria;

  return (
    <>
      {/* Le bandeau du header déborde du rembourrage du conteneur (marges
          négatives) : il vit hors de la colonne, dont l'`overflow` le
          découperait. */}
      <div className="shrink-0">
        <PageHeader
          title={t('reservations.title')}
          subtitle={t('reservations.subtitle')}
          iconBadge={<EventNoteIcon />}
          backPath="/dashboard"
          showBackButton={false}
          actions={(
            <Button size="sm" onClick={handleCreate}>
              <AddIcon strokeWidth={2} />
              {t('reservations.create')}
            </Button>
          )}
          filters={filterBar}
        />
      </div>

      <div className="rsv-page">
        {isError && (
          <Alert variant="destructive" className="shrink-0">
            <TriangleAlert />
            <AlertDescription>{error ?? t('reservations.loadError')}</AlertDescription>
          </Alert>
        )}

        {firstUse ? (
          <EmptyState
            icon={<EventNoteIcon />}
            title={t('reservations.noReservations')}
            description={t('reservations.emptyHint')}
            action={(
              <Button variant="outline" size="sm" onClick={handleCreate}>
                <AddIcon strokeWidth={1.75} />
                {t('reservations.create')}
              </Button>
            )}
            tip={t('reservations.icalTip')}
          />
        ) : (
          <>
            <FilterChipRow
              className="rsv-statuses"
              allLabel={t('reservationsWorkspace.allStatuses')}
              value={filters.status ?? ''}
              onChange={(value) => handleFilterChange('status', (value || null) as ReservationStatus | null)}
              options={STATUS_OPTIONS.map((status) => ({ value: status, label: t(`reservations.status.${status}`), color: '' }))}
            />

            <section
              className="rsv-workspace"
              data-selected={selectedId != null}
              aria-label={t('reservations.title')}
            >
              <div className="rsv-workspace__list" ref={listRef}>
                <div className="rsv-workspace__list-head">
                  <span>{t('reservationsWorkspace.listTitle')}</span>
                  <span className="tabular-nums">{totalElements}</span>
                </div>
                {isLoading ? (
                  <div className="rsv-workspace__loading" role="status" aria-label={t('common.loading')}>
                    {[0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-14 w-full motion-reduce:animate-none" />)}
                  </div>
                ) : reservations.length ? (
                  <ul>
                    {reservations.map((reservation) => (
                      <ReservationListItem
                        key={reservation.id}
                        reservation={reservation}
                        photo={photoOf(reservation)}
                        active={reservation.id === selectedId}
                        detailId={detailId}
                        onSelect={handleSelect}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="rsv-workspace__empty">{t('reservationsWorkspace.noMatch')}</p>
                )}
                <div className="rsv-workspace__pagination">
                  <PagePagination
                    count={totalElements}
                    page={page}
                    onPageChange={setPage}
                    rowsPerPage={pageSize}
                    compact
                  />
                </div>
              </div>

              <div
                className="rsv-workspace__detail"
                data-status={selected?.status}
                id={detailId}
                role="region"
                aria-label={t('reservationsWorkspace.detailLabel')}
              >
                {selectedId != null && (
                  <Button variant="ghost" size="sm" className="rsv-workspace__back" onClick={handleBack}>
                    <ArrowLeft size={15} className="cn-rtl-flip" />
                    {t('reservationsWorkspace.back')}
                  </Button>
                )}
                {selected ? (
                  <ReservationDetailPanel
                    reservation={selected}
                    property={propertyById.get(String(selected.propertyId))}
                    headingRef={heading}
                    onEdit={() => { setEditingReservation(selected); setFormOpen(true); }}
                    onCancel={() => setCancelTarget(selected)}
                    onOpenGuest={selected.guestId ? () => setGuestId(selected.guestId ?? null) : undefined}
                  />
                ) : selectionPending ? (
                  <div className="rsv-workspace__loading" role="status" aria-label={t('common.loading')}>
                    <Skeleton className="h-14 w-2/3 motion-reduce:animate-none" />
                    <Skeleton className="h-24 w-full motion-reduce:animate-none" />
                    <Skeleton className="h-40 w-full motion-reduce:animate-none" />
                  </div>
                ) : (
                  <div className="rsv-workspace__intro">
                    <img src={RESERVATION_ART.reservation} alt="" width={88} height={88} />
                    <h2>{t(selectedQuery.isError ? 'reservationsWorkspace.notFoundTitle' : 'reservationsWorkspace.chooseTitle')}</h2>
                    <p>{t(selectedQuery.isError ? 'reservationsWorkspace.notFoundHint' : 'reservationsWorkspace.chooseHint')}</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <ReservationDialog
          open={formOpen}
          mode={editingReservation ? 'edit' : 'create'}
          reservation={editingReservation}
          onClose={() => {
            setFormOpen(false);
            setEditingReservation(null);
          }}
          onCreated={(created) => {
            notify.success(t('reservationsWorkspace.toast.created'));
            setSelectedId(created.id);
          }}
          onUpdated={() => notify.success(t('reservationsWorkspace.toast.updated'))}
        />

        <GuestProfileDialog guestId={guestId} open={guestId != null} onClose={() => setGuestId(null)} />

        <Dialog open={cancelTarget != null} onOpenChange={(next) => { if (!next && !isCancelling) setCancelTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('reservations.cancel')}</DialogTitle>
              <DialogDescription>{t('reservations.cancelConfirm')}</DialogDescription>
            </DialogHeader>
            {cancelTarget && (
              <p className="text-xs font-semibold text-foreground" dir="auto">
                {cancelTarget.guestName} · {cancelTarget.propertyName}
              </p>
            )}
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setCancelTarget(null)} disabled={isCancelling}>
                {t('reservationsWorkspace.cancelKeep')}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleConfirmCancel} disabled={isCancelling}>
                {isCancelling ? <Spinner className="size-[18px]" /> : null}
                {t('reservationsWorkspace.cancelConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default function ReservationsPage() {
  return <ModuleFirstUsePage module="reservations"><ReservationsList /></ModuleFirstUsePage>;
}
