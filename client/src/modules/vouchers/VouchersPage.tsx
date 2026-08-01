import React, { useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import StatusChip, { STATUS_TONES, type ToneTokens } from '../../components/StatusChip';
import { Alert as UiAlert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { createPortal } from 'react-dom';
// Snackbar + son Alert flottante restent MUI : changer le mecanisme de
// notification de la page depasse la migration des primitives.
import { Alert, Snackbar } from '@mui/material';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Add, Edit, Pause, PlayArrow as Play, Refresh, Delete as Trash, LocalOffer } from '../../icons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useBookingVouchersList,
  useDeleteBookingVoucher,
  usePauseBookingVoucher,
  useResumeBookingVoucher,
} from '../../hooks/useBookingVouchers';
import type {
  BookingVoucher,
  VoucherDiscountType,
  VoucherStatus,
} from '../../services/api/bookingVouchersApi';
import VoucherAnalyticsPanel from './VoucherAnalyticsPanel';
import VoucherEditorDialog from './VoucherEditorDialog';

// ─── Tokens Signature : chips -soft par statut ───────────────────────────────

/** Chip -soft (texte couleur + fond -soft) par statut de voucher. */
const STATUS_TOKENS: Record<VoucherStatus, ToneTokens> = {
  ACTIVE: STATUS_TONES.ok,
  PAUSED: STATUS_TONES.warn,
  DRAFT: STATUS_TONES.info,
  EXPIRED: { color: 'var(--muted)', bg: 'var(--field)' },
};

/**
 * Code voucher — pattern .fr-dip (IP mono de la messagerie) :
 * mono display, fond --field, r6.
 */
const CODE_CLASS =
  'inline-block font-[family-name:var(--font-display)] text-[11.5px] tracking-[0.04em] tabular-nums ' +
  'text-[var(--body)] bg-[var(--field)] border border-solid border-[var(--field-line)] ' +
  'rounded-[6px] px-2 py-[3px]';

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
 * Pattern table + dialog d'edition mutuelle (create/update). Le statut
 * controle visuellement la disponibilite (chips colores). Les pause/resume
 * sont des actions inline rapides (raccourci sans full edit).
 */
export default function VouchersPage({
  embedded = false,
  actionsContainer,
  filtersContainer,
}: VouchersPageProps = {}) {
  const { t, currentLanguage } = useTranslation();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [editing, setEditing] = useState<BookingVoucher | null>(null);
  const [creating, setCreating] = useState(false);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  // Confirmation de suppression via Dialog MUI (window.confirm est bloque
  // en iframe, non accessible, non i18n).
  const [pendingDelete, setPendingDelete] = useState<BookingVoucher | null>(null);

  const statusFilter = filter === 'all' ? undefined : filter;
  const { data: vouchers = [], isLoading, error, refetch } = useBookingVouchersList(statusFilter);

  const pauseMutation = usePauseBookingVoucher();
  const resumeMutation = useResumeBookingVoucher();
  const deleteMutation = useDeleteBookingVoucher();

  const sortedVouchers = useMemo(() => {
    // ACTIVE en premier (operationnel), puis DRAFT, PAUSED, EXPIRED en dernier.
    const statusOrder: Record<VoucherStatus, number> = {
      ACTIVE: 0, DRAFT: 1, PAUSED: 2, EXPIRED: 3,
    };
    return [...vouchers].sort((a, b) => {
      const so = statusOrder[a.status] - statusOrder[b.status];
      if (so !== 0) return so;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [vouchers]);

  const handlePause = async (v: BookingVoucher) => {
    try {
      await pauseMutation.mutateAsync(v.id);
      setSnackbar({ msg: t('vouchers.pauseSuccess'), severity: 'success' });
    } catch (e: any) {
      setSnackbar({ msg: e?.message ?? t('vouchers.pauseError'), severity: 'error' });
    }
  };

  const handleResume = async (v: BookingVoucher) => {
    try {
      await resumeMutation.mutateAsync(v.id);
      setSnackbar({ msg: t('vouchers.resumeSuccess'), severity: 'success' });
    } catch (e: any) {
      setSnackbar({ msg: e?.message ?? t('vouchers.resumeError'), severity: 'error' });
    }
  };

  const handleDelete = (v: BookingVoucher) => {
    if (v.usageCount > 0) {
      setSnackbar({
        msg: t('vouchers.deleteRefusedUsed', { count: v.usageCount }),
        severity: 'error',
      });
      return;
    }
    setPendingDelete(v);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteMutation.mutateAsync(target.id);
      setSnackbar({ msg: t('vouchers.deleteSuccess'), severity: 'success' });
    } catch (e: any) {
      setSnackbar({ msg: e?.message ?? t('vouchers.deleteError'), severity: 'error' });
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

  const filterBar = (
    <ToggleGroup
      type="single"
      value={filter}
      onValueChange={(v) => v && setFilter(v as FilterMode)}
      variant="outline"
      size="sm"
      spacing={0}
    >
      <ToggleGroupItem value="all">{t('vouchers.filter.all')}</ToggleGroupItem>
      <ToggleGroupItem value="ACTIVE">{t('vouchers.filter.active')}</ToggleGroupItem>
      <ToggleGroupItem value="DRAFT">{t('vouchers.filter.draft')}</ToggleGroupItem>
      <ToggleGroupItem value="PAUSED">{t('vouchers.filter.paused')}</ToggleGroupItem>
      <ToggleGroupItem value="EXPIRED">{t('vouchers.filter.expired')}</ToggleGroupItem>
    </ToggleGroup>
  );

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
      {embedded && actionsContainer ? createPortal(actions, actionsContainer) : null}
      {embedded && filtersContainer ? createPortal(filterBar, filtersContainer) : null}

      <div className={cn(embedded ? 'p-[18px]' : 'p-0')}>
        <VoucherAnalyticsPanel />

        {/* Mode standalone : filter inline sous l'analytics panel. */}
        {!embedded && <div className="mb-3">{filterBar}</div>}

        {error && (
          <UiAlert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{t('vouchers.loadError')}</AlertDescription>
          </UiAlert>
        )}

        {isLoading ? (
          <div className="flex justify-center p-9">
            <Spinner className="size-10" />
          </div>
        ) : sortedVouchers.length === 0 ? (
          <EmptyState
            icon={<LocalOffer />}
            title={t('vouchers.empty')}
            action={(
              <Button size="sm" onClick={() => setCreating(true)}>
                <Add size={16} strokeWidth={2} />
                {t('vouchers.createButton')}
              </Button>
            )}
          />
        ) : (
          <div className="overflow-x-auto rounded-[11px] bg-[var(--card)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('vouchers.table.name')}</TableHead>
                  <TableHead>{t('vouchers.table.code')}</TableHead>
                  <TableHead>{t('vouchers.table.type')}</TableHead>
                  <TableHead>{t('vouchers.table.discount')}</TableHead>
                  <TableHead>{t('vouchers.table.validity')}</TableHead>
                  <TableHead className="text-center">{t('vouchers.table.usage')}</TableHead>
                  <TableHead className="text-center">{t('vouchers.table.status')}</TableHead>
                  <TableHead className="text-end">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVouchers.map((v) => (
                  <VoucherRow
                    key={v.id}
                    voucher={v}
                    locale={currentLanguage}
                    onEdit={() => setEditing(v)}
                    onPause={() => handlePause(v)}
                    onResume={() => handleResume(v)}
                    onDelete={() => handleDelete(v)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <VoucherEditorDialog
          voucher={editing}
          open={true}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            setSnackbar({ msg: t('vouchers.saveSuccess'), severity: 'success' });
          }}
        />
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('vouchers.deleteConfirmTitle', 'Supprimer ce voucher ?')}</DialogTitle>
            <DialogDescription>
              {pendingDelete && t('vouchers.deleteConfirm', { name: pendingDelete.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              autoFocus
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)}>
            {snackbar.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </div>
  );
}

// ─── Row component ───────────────────────────────────────────────────────────

interface RowProps {
  voucher: BookingVoucher;
  locale: string;
  onEdit: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}

const VoucherRow: React.FC<RowProps> = ({ voucher, locale, onEdit, onPause, onResume, onDelete }) => {
  const { t } = useTranslation();
  // Cast pour s'aligner sur la signature `(key, opts?) => string`. Le retour
  // de i18next peut etre object | string mais nos usages sont tous string.
  const formatDiscount = makeFormatDiscount(t as unknown as (...args: any[]) => string);
  const v = voucher;
  const isAuto = v.type === 'AUTO_CAMPAIGN';
  const canPause = v.status === 'ACTIVE';
  const canResume = v.status === 'PAUSED';
  const canDelete = v.usageCount === 0;

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-[1.5px]">
          <p className="cn-text-body2 font-semibold">{v.name}</p>
          {v.description && (
            <span className="cn-text-caption text-muted-foreground text-[0.7rem]">
              {v.description.slice(0, 80)}{v.description.length > 80 ? '…' : ''}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {v.code ? (
          <span className={`cn-text-body2 ${CODE_CLASS}`}>
            {v.code}
          </span>
        ) : (
          <StatusChip label={t('vouchers.autoCampaign')} tokens={STATUS_TONES.info} className="text-[10.5px] font-bold" />
        )}
      </TableCell>
      <TableCell>
        <StatusChip
          label={isAuto ? t('vouchers.typeAuto') : t('vouchers.typeManual')}
          tokens={isAuto ? STATUS_TONES.info : { color: 'var(--muted)', bg: 'var(--field)' }}
          className="text-[10.5px] font-bold"
        />
      </TableCell>
      <TableCell>
        <p className="cn-text-body2 font-medium tabular-nums">
          {formatDiscount(v.discountType, v.discountValue)}
        </p>
      </TableCell>
      <TableCell>
        <span className="cn-text-caption text-muted-foreground">
          {formatValidity(v.validFrom, v.validUntil, locale)}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <p className="cn-text-body2 tabular-nums">
          {v.usageCount}
          {v.maxUsesTotal !== null && (
            <span className="cn-text-caption text-muted-foreground"> / {v.maxUsesTotal}</span>
          )}
        </p>
      </TableCell>
      <TableCell className="text-center">
        <StatusChip
          label={t(`vouchers.status.${v.status}`)}
          tokens={STATUS_TOKENS[v.status]}
          className="text-[10.5px] font-bold"
        />
      </TableCell>
      <TableCell className="text-end">
        <div className="flex flex-row justify-end gap-[3px]">
          {canPause && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button variant="ghost" size="icon-sm" onClick={onPause} aria-label={t('vouchers.pause')} className="cursor-pointer">
                    <Pause size={16} strokeWidth={1.75} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('vouchers.pause')}</TooltipContent>
            </Tooltip>
          )}
          {canResume && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button variant="ghost" size="icon-sm" onClick={onResume} aria-label={t('vouchers.resume')} className="cursor-pointer">
                    <Play size={16} strokeWidth={1.75} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('vouchers.resume')}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onEdit}
                  aria-label={t('common.edit')}
                  className="cursor-pointer hover:text-[var(--accent)]"
                >
                  <Edit size={16} strokeWidth={1.75} />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('common.edit')}</TooltipContent>
          </Tooltip>
          {canDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onDelete}
                    aria-label={t('common.delete')}
                    className="cursor-pointer hover:text-[var(--err)]"
                  >
                    <Trash size={16} strokeWidth={1.75} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('common.delete')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

// ─── Format helpers ──────────────────────────────────────────────────────────

/**
 * Format helper pour le discount selon le type. Le mot "nuit/nuits" passe par
 * une closure i18n pour eviter le hardcode FR (fix M4 review).
 *
 * Signature de {@code t} typee comme {@code (...args: any[]) => string} pour
 * accepter la signature i18next sans casser nos call-sites.
 */
function makeFormatDiscount(t: (...args: any[]) => string) {
  return (type: VoucherDiscountType, value: string): string => {
    const n = Number(value);
    if (type === 'PERCENTAGE') return `−${n}%`;
    if (type === 'FIXED_AMOUNT') return `−${n.toFixed(2).replace('.', ',')} €`;
    // FREE_NIGHTS : la pluralisation est gerée par i18n
    return `−${n} ${t('vouchers.editor.nights', { count: n })}`;
  };
}

function formatValidity(from: string | null, until: string | null, locale: string): string {
  // Utilise la langue active (FR/EN/AR) pour le formatage Intl, pas un hardcode.
  const df = new Intl.DateTimeFormat(locale, { dateStyle: 'short' });
  const fmt = (iso: string) => df.format(new Date(iso));
  if (from && until) return `${fmt(from)} → ${fmt(until)}`;
  if (until) return `→ ${fmt(until)}`;
  if (from) return `${fmt(from)} → ∞`;
  return '—';
}
