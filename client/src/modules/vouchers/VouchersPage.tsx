import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import { Alert as UiAlert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from '../../icons/glyphs';
import { Skeleton } from '../../components/ui';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Add, Refresh, LocalOffer } from '../../icons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import {
  useBookingVouchersList,
  useDeleteBookingVoucher,
  usePauseBookingVoucher,
  useResumeBookingVoucher,
} from '../../hooks/useBookingVouchers';
import type {
  BookingVoucher,
  VoucherStatus,
} from '../../services/api/bookingVouchersApi';
import VoucherAnalyticsPanel from './VoucherAnalyticsPanel';
import VoucherEditorDialog from './VoucherEditorDialog';
import compactHeaderActions from '../../components/compactHeaderActions';
import FilterChipRow from "../../components/FilterChipRow";
import PagePagination from "../../components/PagePagination";
import { useScreenSearch } from "../../components/ScreenChrome";
import VoucherOfferRow from "./VoucherOfferRow";
import { useIsMobile } from '../../hooks/use-mobile';
import "./baitlyVouchers.css";

type FilterMode = 'all' | VoucherStatus;

/**
 * Props pour le mode "embedded" : permet d'integrer la page comme tab d'un
 * autre PageHeader (cf. {@code PropertiesPage} qui l'utilise comme 3e tab
 * apres Propriétés et Prix dynamique). Quand {@code embedded === true},
 * la page ne rend PAS son propre {@code PageHeader} et porte ses actions
 * (boutons refresh + create) et ses filter chips dans les containers
 * fournis par le parent via React Portal.
 */
interface VouchersPageProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

/**
 * Page de gestion des {@link BookingVoucher} pour l'org courante.
 *
 * <h3>Architecture</h3>
 * Liste d’offres avec conditions dépliables et aperçu d’édition. Le statut
 * controle visuellement la disponibilite (chips colores). Les pause/resume
 * sont des actions inline rapides (raccourci sans full edit).
 */
export default function VouchersPage({
  embedded = false,
  actionsContainer,
  filtersContainer,
}: VouchersPageProps = {}) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [editing, setEditing] = useState<BookingVoucher | null>(null);
  const [creating, setCreating] = useState(false);
  // Confirmation de suppression via Dialog (window.confirm est bloque
  // en iframe, non accessible, non i18n).
  const [pendingDelete, setPendingDelete] = useState<BookingVoucher | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const rowsPerPage = useIsMobile(640) ? 4 : 8;
  useScreenSearch(search, setSearch, t("vouchers.workspace.search"));
  useEffect(() => { setPage(0); }, [filter, search, rowsPerPage]);
  const { data: vouchers = [], isLoading, isFetching, error, refetch } = useBookingVouchersList();

  const pauseMutation = usePauseBookingVoucher();
  const resumeMutation = useResumeBookingVoucher();
  const deleteMutation = useDeleteBookingVoucher();

  const sortedVouchers = useMemo(() => {
    // ACTIVE en premier (operationnel), puis DRAFT, PAUSED, EXPIRED en dernier.
    const statusOrder: Record<VoucherStatus, number> = {
      ACTIVE: 0, DRAFT: 1, PAUSED: 2, EXPIRED: 3,
    };
    return vouchers.filter(v => (filter === "all" || v.status === filter) && [v.name,v.code,v.description].some(text => text?.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()))).sort((a, b) => {
      const so = statusOrder[a.status] - statusOrder[b.status];
      if (so !== 0) return so;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [vouchers, filter, search]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(sortedVouchers.length / rowsPerPage) - 1));
  const busy = pauseMutation.isPending || resumeMutation.isPending || deleteMutation.isPending;

  const handlePause = async (v: BookingVoucher) => {
    try {
      await pauseMutation.mutateAsync(v.id);
      notify.success(t('vouchers.pauseSuccess'));
    } catch (e: any) {
      notify.error(e?.message ?? t('vouchers.pauseError'));
    }
  };

  const handleResume = async (v: BookingVoucher) => {
    try {
      await resumeMutation.mutateAsync(v.id);
      notify.success(t('vouchers.resumeSuccess'));
    } catch (e: any) {
      notify.error(e?.message ?? t('vouchers.resumeError'));
    }
  };

  const handleDelete = (v: BookingVoucher) => {
    if (v.usageCount > 0) {
      notify.error(t('vouchers.deleteRefusedUsed', { count: v.usageCount }));
      return;
    }
    setPendingDelete(v);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    try {
      await deleteMutation.mutateAsync(target.id);
      setPendingDelete(null);
      notify.success(t('vouchers.deleteSuccess'));
    } catch (e: any) {
      notify.error(e?.message ?? t('vouchers.deleteError'));
    }
  };

  // Actions et filtres extraits pour pouvoir etre portales dans le
  // PageHeader du parent (mode embedded) ou rendus inline (mode standalone).
  const actions = (
    <div className="flex flex-row items-center gap-1.5">
      <Tooltip>
        {/* Declencheur = <span> natif : les primitives du kit ne transmettent
            pas de ref (React 18), le tooltip n'aurait pas d'ancre. */}
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label={t('common.refresh')}
              className="cursor-pointer"
            >
              <Refresh size={18} strokeWidth={1.75} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('common.refresh')}</TooltipContent>
      </Tooltip>
      <Button size="sm" onClick={() => setCreating(true)}>
        <Add size={16} strokeWidth={2} />
        {t('vouchers.createButton')}
      </Button>
    </div>
  );

  const filterBar = <FilterChipRow value={filter === "all" ? "" : filter} onChange={value => setFilter(value || "all")}
    allLabel={t("vouchers.filter.all")} allCount={vouchers.length}
    options={(["ACTIVE","DRAFT","PAUSED","EXPIRED"] as const).map(value => ({value,
      label:t("vouchers.filter."+value.toLowerCase()),color:"var(--bui-primary)",count:vouchers.filter(v=>v.status===value).length}))} />;

  return (
    <div className={cn(embedded ? 'p-0' : 'p-[18px]')}>
      {/* Mode standalone : on rend notre propre PageHeader. */}
      {!embedded && (
        <PageHeader
          title={t('vouchers.title')}
          subtitle={t('vouchers.subtitle')}
          actions={actions}
        />
      )}

      {/* Mode embedded : on porte actions + filter dans les slots du parent.
          Ternaire explicite pour eviter de passer le booleen false en children. */}
      {embedded && actionsContainer ? createPortal(compactHeaderActions(actions), actionsContainer) : null}
      {embedded && filtersContainer ? createPortal(filterBar, filtersContainer) : null}

      <div className={cn("baitly-vouchers-workspace", embedded ? "p-[18px]" : "p-0")}>
        <div className="baitly-vouchers-layout">
          <section className="baitly-vouchers-list">
            {(!embedded || !filtersContainer) && <div className="baitly-vouchers-filters">{filterBar}</div>}
            {error && <UiAlert variant="destructive"><TriangleAlert /><AlertDescription>{t("vouchers.loadError")}</AlertDescription><Button variant="outline" size="sm" onClick={()=>refetch()}>{t("common.refresh")}</Button></UiAlert>}
            {isLoading ? <div className="baitly-vouchers-loading" aria-busy="true">{Array.from({length:4},(_,i)=><Skeleton key={i} className="h-[180px] w-full" />)}</div> : !error && sortedVouchers.length === 0 ?
              <EmptyState icon={<LocalOffer />} title={t(vouchers.length ? "vouchers.workspace.noResults" : "vouchers.empty")}
                description={t(vouchers.length ? "vouchers.workspace.clearHint" : "vouchers.workspace.emptyHint")}
                action={<Button variant="outline" onClick={()=>{if(vouchers.length){setSearch("");setFilter("all");}else setCreating(true);}}>{t(vouchers.length ? "vouchers.workspace.clear" : "vouchers.createButton")}</Button>} /> :
              <div className="baitly-vouchers-offers">{sortedVouchers.slice(currentPage*rowsPerPage,(currentPage+1)*rowsPerPage).map(v=><VoucherOfferRow key={v.id} voucher={v} busy={busy}
                onEdit={()=>setEditing(v)} onPause={()=>handlePause(v)} onResume={()=>handleResume(v)} onDelete={()=>handleDelete(v)} />)}</div>}
            {!isLoading && !error && <PagePagination page={currentPage} onPageChange={setPage} count={sortedVouchers.length} rowsPerPage={rowsPerPage} />}
          </section>
          <aside className="baitly-vouchers-insights"><VoucherAnalyticsPanel /></aside>
        </div>
      </div>

      {(creating || editing) && (
        <VoucherEditorDialog
          voucher={editing}
          open={true}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            notify.success(t('vouchers.saveSuccess'));
          }}
        />
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && !deleteMutation.isPending && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('vouchers.deleteConfirmTitle', 'Supprimer ce voucher ?')}</DialogTitle>
            <DialogDescription>
              {pendingDelete && t('vouchers.deleteConfirm', { name: pendingDelete.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => setPendingDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              autoFocus
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
