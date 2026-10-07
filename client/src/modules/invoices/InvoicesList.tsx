import FinanceWorkspace from '../billing/components/FinanceWorkspace';
import { FinanceAmountKpis } from '../billing/components/FinanceKpis';
import React, { useState, useMemo } from 'react';
import StatusChip from '../../components/StatusChip';
import { Button, Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import {
  Alert,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '../../components/ui';
import { Field, FieldLabel, NativeSelect, NativeSelectOption } from '../../components/ui';
import {
  Receipt as ReceiptIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  CreditCard as PaidIcon,
  Cancel as CancelIcon,
  Clear as ClearIcon,
  AttachMoney as MoneyIcon,
  PictureAsPdf as PdfIcon,
  ContentCopy as DuplicateIcon,
  Warning as WarningIcon,
  Home as HomeIcon,
  Build as BuildIcon,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import StatTile from '../../components/baitly/StatTile';
import StatTileRow from '../../components/baitly/StatTileRow';
import FilterChipRow from '../../components/baitly/FilterChipRow';
import DateRangePicker from '../../components/baitly/DateRangePicker';
import ExportButton from '../../components/baitly/ExportButton';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useInvoices,
  useIssueInvoice,
  usePayInvoice,
  useCancelInvoice,
  useTemplateStatus,
  useDuplicateInvoice,
} from '../../hooks/useInvoices';
import { invoicesApi } from '../../services/api/invoicesApi';
import type { InvoiceStatus, InvoiceType, Invoice } from '../../services/api/invoicesApi';
import { Money } from '../../components/Money';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';
import { useHighlightParam, useHighlightTarget } from '../../hooks/useHighlight';
import { activeIntlLocale } from '../../utils/activeLocale';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyee',
  ISSUED: 'Emise',
  PAID: 'Payee',
  OVERDUE: 'En retard',
  CANCELLED: 'Annulee',
  CREDIT_NOTE: 'Avoir',
};

const TYPE_OPTIONS: { value: InvoiceType | ''; label: string }[] = [
  { value: '', label: 'Toutes' },
  { value: 'GUEST', label: 'S\u00e9jour' },
  { value: 'COMMISSION', label: 'Commission' },
];

/** Accent de la facture de commission (rose valid\u00e9 Baitly), distinct des couleurs de statut. */
const COMMISSION_COLOR = '#C97A7A';

/** Statut de facture \u2192 encre Baitly UI de sa puce de filtre. Toujours la variante
 *  `-ink` : la teinte vive plafonne \u00e0 ~2,2:1 en clair.
 *  Neutre (brouillon/annul\u00e9e) : pas de teinte s\u00e9mantique \u2014 repli muted-foreground. */
const STATUS_INK: Record<InvoiceStatus, string> = {
  DRAFT: 'var(--bui-muted-foreground)',
  SENT: 'var(--bui-info-ink)',
  ISSUED: 'var(--bui-warning-ink)',
  PAID: 'var(--bui-success-ink)',
  OVERDUE: 'var(--bui-destructive-ink)',
  CANCELLED: 'var(--bui-muted-foreground)',
  CREDIT_NOTE: 'var(--bui-info-ink)',
};

/** Statut → ton semantique du chip a point (dessin de la projection). */
const STATUS_TONE: Record<InvoiceStatus, 'ok' | 'warn' | 'err' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  SENT: 'info',
  ISSUED: 'warn',
  PAID: 'ok',
  OVERDUE: 'err',
  CANCELLED: 'neutral',
  CREDIT_NOTE: 'info',
};

/** Montants : display tabular-nums (jamais proportional) */
const MONEY_CLASS = 'font-[family-name:var(--font-display)] tabular-nums';

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(activeIntlLocale()) : '\u2014';

// ─── Component ──────────────────────────────────────────────────────────────

/** Determine le type de source : Reservation ou Intervention (accents palette Baitly) */
const getSourceType = (inv: Invoice) => {
  if (inv.reservationId) return { label: 'Reservation', icon: <span className="inline-flex me-0.5"><HomeIcon size={14} strokeWidth={1.75} /></span>, color: '#7BA3C2' };
  if (inv.interventionId) return { label: 'Intervention', icon: <span className="inline-flex me-0.5"><BuildIcon size={14} strokeWidth={1.75} /></span>, color: '#D4A574' };
  return null;
};

/**
 * Bouton-icone d'une ligne de tableau, muni de son infobulle.
 *
 * <p>Le `span` intermediaire n'est pas decoratif : `TooltipTrigger asChild`
 * transmet une ref, or les primitives du kit sont des fonctions simples qui
 * n'en acceptent pas. Il garde aussi l'infobulle vivante quand le bouton est
 * desactive.</p>
 */
const RowAction: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ label, onClick, disabled, className, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          className={className}
          onClick={onClick}
        >
          {children}
        </Button>
      </span>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

interface InvoicesListProps {
  embedded?: boolean;
}

const InvoicesList: React.FC<InvoicesListProps> = ({ embedded = false }) => {
  const { t } = useTranslation();

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<InvoiceType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState(false);

  const handleDownloadPdf = async (id: number, invoiceNumber: string) => {
    setDownloadingId(id);
    setDownloadError(false);
    try {
      const blob = await invoicesApi.downloadPdf(id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      try {
        anchor.href = url;
        anchor.download = `${invoiceNumber}.pdf`;
        anchor.click();
      } finally { window.URL.revokeObjectURL(url); }
    } catch { setDownloadError(true); }
    finally { setDownloadingId(null); }
  };


  // Seule la periode reste un filtre serveur. Le statut passe cote client :
  // la rangee de chips de la projection affiche le compte de CHAQUE statut,
  // ce qu'un filtre serveur rendrait faux (il ne rapporterait que le statut
  // demande). Meme logique que le filtre par nature, deja client.
  const filters = useMemo(() => ({
    ...(dateFrom ? { from: dateFrom } : {}),
    ...(dateTo ? { to: dateTo } : {}),
  }), [dateFrom, dateTo]);

  const { data: invoices, isLoading, error } = useInvoices(filters);
  // Liste par nature (sejour / commission) — assiette des comptes de chips.
  const typedInvoices = useMemo(
    () => (invoices ?? []).filter((i) => !typeFilter || i.invoiceType === typeFilter),
    [invoices, typeFilter],
  );
  const displayedInvoices = useMemo(
    () => typedInvoices.filter((i) => !statusFilter || i.status === statusFilter),
    [typedInvoices, statusFilter],
  );
  // Deep-link notification (?highlight=<invoiceId>) — surligne la ligne ciblee.
  const highlightId = useHighlightParam();
  useHighlightTarget(highlightId, !isLoading && displayedInvoices.length > 0);

  const { data: templateStatus } = useTemplateStatus();
  const issueMutation = useIssueInvoice();
  const paymentMutation = usePayInvoice();
  const cancelMutation = useCancelInvoice();
  const duplicateMutation = useDuplicateInvoice();

  /** Ouvre le PDF du document genere (DocumentGeneration) dans un dialog */
  const handleViewDocumentPdf = async (generationId: number) => {
    setPdfLoading(true);
    setPdfDialogOpen(true);
    try {
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/documents/generations/${generationId}/download`;
      const token = getAccessToken();
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setPdfUrl(blobUrl);
    } catch {
      setPdfUrl(null);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleClosePdfDialog = () => {
    setPdfDialogOpen(false);
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  const handleClearFilters = () => {
    setStatusFilter('');
    setTypeFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = statusFilter || typeFilter || dateFrom || dateTo;

  // L'export de la projection, portale dans l'en-tete du hub Facturation
  // (pattern PageHeaderActionsContext). Exporte les lignes AFFICHEES.
  const headerActions = usePageHeaderActions(
    <ExportButton
      data={displayedInvoices.map((i) => ({
        number: i.invoiceNumber,
        date: fmtDate(i.invoiceDate),
        client: i.buyerName,
        ht: i.totalHt,
        tax: i.totalTax,
        ttc: i.totalTtc,
        status: STATUS_LABELS[i.status],
      }))}
      columns={[
        { key: 'number', label: t('invoices.columns.number', 'N°') },
        { key: 'date', label: t('invoices.columns.date', 'Date') },
        { key: 'client', label: t('invoices.columns.buyer', 'Client') },
        { key: 'ht', label: t('invoices.columns.ht', 'HT') },
        { key: 'tax', label: t('invoices.columns.tax', 'TVA') },
        { key: 'ttc', label: t('invoices.columns.ttc', 'TTC') },
        { key: 'status', label: t('common.status', 'Statut') },
      ]}
      fileName="factures"
      variant="menu"
    />,
  );

  // ─── Stats — les trois tuiles monetaires de la projection ────────────────
  // L'assiette est la liste par nature AVANT filtre de statut : cliquer un chip
  // filtre le tableau sans faire mentir les tuiles. Les comptes par statut
  // (brouillons, emises…) vivent desormais sur les chips, plus en tuiles.
  const stats = useMemo(() => {
    if (!invoices) return null;
    const list = typedInvoices;
    const somme = (pred: (i: Invoice) => boolean) =>
      list.filter(pred).reduce((sum, i) => sum + i.totalTtc, 0);
    const emis = somme(() => true);
    const encaisse = somme((i) => i.status === 'PAID');
    const enRetard = list.filter((i) => i.status === 'OVERDUE');
    const parStatut = Object.fromEntries(
      (Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((st) => [st, list.filter((i) => i.status === st).length]),
    ) as Record<InvoiceStatus, number>;
    const currency = list[0]?.currency ?? 'EUR';
    return {
      total: list.length,
      emis,
      encaisse,
      tauxEncaisse: emis > 0 ? Math.round((encaisse / emis) * 100) : 0,
      retardMontant: enRetard.reduce((sum, i) => sum + i.totalTtc, 0),
      retardNb: enRetard.length,
      parStatut,
      currency,
    };
  }, [invoices, typedInvoices]);

  return (
    <div>
      {!embedded && (
        <PageHeader
          title={t('invoices.title', 'Factures')}
          subtitle={t('invoices.subtitle', 'Gestion des factures et documents fiscaux')}
          iconBadge={<ReceiptIcon />}
          backPath="/"
          showBackButton={false}
        />
      )}

      {/* ─── Template warning ──────────────────────────────────────────── */}
      {/* Le look -soft hairline de l'ancien `sx` est deja le gabarit de la
          variante `warning` du kit : il ne reste que la taille de texte. */}
      {templateStatus && !templateStatus.hasTemplate && (
        <Alert variant="warning" className="mb-3 text-[12.5px]">
          <WarningIcon />
          <AlertDescription>
            {t(
              'invoices.noTemplateWarning',
              'Aucun template FACTURE actif configure. Les PDF ne seront pas generes automatiquement lors des paiements. Veuillez configurer un template dans les parametres.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {headerActions}

      {/* ─── KPIs — les trois tuiles monetaires de la projection ─────────── */}
      {stats && (
        <FinanceAmountKpis kind="invoices" records={displayedInvoices.map(row => ({ status: row.status, amount: row.totalTtc, currency: row.currency }))} />
      )}

      {/* ─── Chips de statut — comptes par statut, couleurs semantiques ──── */}
      {stats && (
        <FilterChipRow
          className="mb-3"
          allLabel={t('common.all', 'Toutes')}
          allCount={stats.total}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as InvoiceStatus | '')}
          options={(Object.keys(STATUS_LABELS) as InvoiceStatus[])
            .filter((st) => stats.parStatut[st] > 0)
            .map((st) => ({
              value: st,
              label: STATUS_LABELS[st],
              color: STATUS_INK[st],
              count: stats.parStatut[st],
            }))}
        />
      )}

      {/* ─── Filters (panneau hairline plat) ─────────────────────────────── */}
      {/* Le statut vit desormais dans la rangee de chips ci-dessus : ne
          restent ici que la nature et la periode. */}
      {/* `flex-row` explicite : la base du Card est flex-col, ou `items-center`
          devient un centrage horizontal des champs. */}
      <Card className="gap-0 py-0 p-2 mb-3 flex flex-row gap-2 flex-wrap items-end border-border bg-card">
        <Field className="w-auto min-w-[150px]">
          <FieldLabel htmlFor="invoices-filter-type">{t('invoices.type.label', 'Type')}</FieldLabel>
          <NativeSelect
            id="invoices-filter-type"
            className="w-full"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as InvoiceType | '')}
          >
            {TYPE_OPTIONS.map((opt) => (
              <NativeSelectOption key={opt.value} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <DateRangePicker
          startDate={dateFrom}
          endDate={dateTo}
          onChangeStart={setDateFrom}
          onChangeEnd={setDateTo}
        />
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            <ClearIcon size={16} strokeWidth={1.75} />
            {t('payments.history.clearFilters')}
          </Button>
        )}
      </Card>

      {/* ─── Table ───────────────────────────────────────────────────────── */}
      {downloadError && (
        <Alert variant="destructive" className="mb-3" role="alert">
          <AlertDescription>{t('invoices.downloadError', 'Le PDF n’a pas pu être téléchargé. Réessayez.')}</AlertDescription>
        </Alert>
      )}
      {paymentMutation.error && (
        <Alert variant="destructive" className="mb-3" role="alert">
          <WarningIcon />
          <AlertDescription>{paymentMutation.error.message}</AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        /* Skeleton de table (carte hairline plate, lignes Skeleton) */
        <Card className="gap-0 py-0 border-border p-3">
          <Skeleton className="mb-1.5 h-[18px] w-[30%] rounded-sm" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-1.5 h-9 rounded-md" />
          ))}
        </Card>
      ) : error ? (
        <Alert variant="destructive" className="mb-3 text-[12.5px]">
          <WarningIcon />
          <AlertDescription>
            {t('invoices.loadError', 'Erreur lors du chargement des factures')}
          </AlertDescription>
        </Alert>
      ) : !displayedInvoices.length ? (
        <EmptyState
          icon={<ReceiptIcon />}
          title={t('invoices.empty', 'Aucune facture trouvee')}
          variant="plain"
        />
      ) : (
        <FinanceWorkspace artwork="documents"  items={displayedInvoices.map((inv: Invoice) => {
                const source = getSourceType(inv);
                const original = invoices?.find(item => item.id === inv.originalInvoiceId);
                const creditNotes = invoices?.filter(item => item.originalInvoiceId === inv.id) ?? [];
                const documentLink = (id: number, number: string, label: string) => (
                  <Button variant="link" size="sm" className="h-auto min-h-9 whitespace-normal text-start tabular-nums"
                    disabled={downloadingId !== null} onClick={() => handleDownloadPdf(id, number)}
                    aria-label={label}>
                    <DownloadIcon size={15} aria-hidden="true" />{number}
                  </Button>
                );
                const linkedDocuments = [
                  ...(inv.originalInvoiceId ? [{
                    label: t('invoices.creditNote.original', 'Facture d’origine'),
                    value: documentLink(inv.originalInvoiceId, original?.invoiceNumber || `#${inv.originalInvoiceId}`,
                      t('invoices.creditNote.downloadOriginal', 'Télécharger la facture d’origine')),
                  }] : []),
                  ...creditNotes.map(note => ({
                    label: t('invoices.creditNote.linked', 'Avoir associé'),
                    value: documentLink(note.id, note.invoiceNumber,
                      t('invoices.creditNote.download', 'Télécharger l’avoir') + ' ' + note.invoiceNumber),
                  })),
                ];

                return (
                  { id: inv.id, identity: { interventionId: inv.interventionId, reservationId: inv.reservationId }, title: <>
                      <div className="flex items-center gap-1">
                        {/* Litteral et non `cn()` : tailwind-merge considere `font-[...]` et
                            `font-semibold` comme un meme groupe et supprimerait la police display. */}
                        <p className={`${MONEY_CLASS} text-[12.5px] font-semibold text-foreground`}>
                          {inv.invoiceNumber}
                        </p>
                        {inv.duplicateOfId && (
                          <StatusChip tone="info" size="sm" label="DUP" />
                        )}
                      </div>
                    </>, amount: <><Money value={inv.totalTtc} from={inv.currency} /></>, status: <>
                      <StatusChip tone={STATUS_TONE[inv.status]} label={STATUS_LABELS[inv.status]} dot size="sm" />
                    </>, subtitle: <>{inv.buyerName}</>, meta: <>{fmtDate(inv.invoiceDate)}</>, actions: <>
                      <div className="flex gap-0.5 justify-end">
                        {/* Voir PDF (document genere) */}
                        {inv.documentGenerationId && (
                          <RowAction
                            label={t('invoices.actions.viewPdf', 'Voir PDF')}
                            className="text-destructive-ink hover:bg-destructive-soft hover:text-destructive-ink"
                            onClick={() => handleViewDocumentPdf(inv.documentGenerationId!)}
                          >
                            <PdfIcon size={18} strokeWidth={1.75} />
                          </RowAction>
                        )}

                        {/* Emettre */}
                        {inv.status === 'DRAFT' && (
                          <RowAction
                            label={t('invoices.actions.issue', 'Emettre')}
                            className="text-primary hover:text-primary"
                            onClick={() => issueMutation.mutate(inv.id)}
                            disabled={issueMutation.isPending}
                          >
                            <SendIcon size={18} strokeWidth={1.75} />
                          </RowAction>
                        )}

                        {/* Ouvrir le règlement PSP ; seul son retour confirmé règle la facture. */}
                        {['SENT', 'ISSUED', 'OVERDUE'].includes(inv.status) && !inv.duplicateOfId && (
                          <RowAction
                            label={t('common.pay', 'Payer')}
                            className="text-primary hover:bg-primary-soft hover:text-primary"
                            onClick={() => paymentMutation.mutate(inv.id, { onSuccess: (url) => window.location.assign(url) })}
                            disabled={paymentMutation.isPending}
                          >
                            <PaidIcon size={18} strokeWidth={1.75} />
                          </RowAction>
                        )}

                        {/* Annuler */}
                        {(inv.status === 'DRAFT' || inv.status === 'ISSUED') && (
                          <RowAction
                            label={t('invoices.actions.cancel', 'Annuler')}
                            className="text-destructive-ink hover:bg-destructive-soft hover:text-destructive-ink"
                            onClick={() => cancelMutation.mutate(inv.id)}
                            disabled={cancelMutation.isPending}
                          >
                            <CancelIcon size={18} strokeWidth={1.75} />
                          </RowAction>
                        )}

                        {/* Duplicata */}
                        {(inv.status === 'ISSUED' || inv.status === 'PAID') && !inv.duplicateOfId && (
                          <RowAction
                            label={t('invoices.actions.duplicate', 'Generer duplicata')}
                            className="text-info-ink hover:bg-info-soft hover:text-info-ink"
                            onClick={() => duplicateMutation.mutate(inv.id)}
                            disabled={duplicateMutation.isPending}
                          >
                            <DuplicateIcon size={18} strokeWidth={1.75} />
                          </RowAction>
                        )}

                        {/* Telecharger PDF */}
                        <RowAction
                          label={t('invoices.actions.downloadPdf', 'Telecharger PDF')}
                          onClick={() => handleDownloadPdf(inv.id, inv.invoiceNumber)}
                          disabled={downloadingId !== null}
                        >
                          <DownloadIcon size={18} strokeWidth={1.75} />
                        </RowAction>
                      </div>
                    </>, fields: [...linkedDocuments, {label: <>{t('invoices.columns.date', 'Date')}</>, value: <>{fmtDate(inv.invoiceDate)}</>},{label: <>{t('invoices.columns.type', 'Type')}</>, value: <>
                      {inv.invoiceType === 'COMMISSION' ? (
                        <StatusChip tokens={{ color: COMMISSION_COLOR, bg: `${COMMISSION_COLOR}18` }} label={t('invoices.type.commission', 'Commission')} icon={<span className="inline-flex me-0.5"><MoneyIcon size={14} strokeWidth={1.75} /></span>} />
                      ) : source ? (
                        <StatusChip tokens={{ color: source.color, bg: `${source.color}18` }} label={source.label} icon={source.icon} />
                      ) : (
                        <p className="text-[12.5px] text-muted-foreground">
                          —
                        </p>
                      )}
                    </>},{label: <>{t('invoices.columns.buyer', 'Client')}</>, value: <>{inv.buyerName}</>},{label: <>{t('invoices.columns.ht', 'HT')}</>, value: <><Money value={inv.totalHt} from={inv.currency} /></>},{label: <>{t('invoices.columns.tax', 'TVA')}</>, value: <><Money value={inv.totalTax} from={inv.currency} /></>},{label: <>{t('invoices.columns.ttc', 'TTC')}</>, value: <><Money value={inv.totalTtc} from={inv.currency} /></>}],  }
                );
              })}  />
      )}

      {/* ─── PDF Preview Dialog ──────────────────────────────────────────── */}
      <Dialog open={pdfDialogOpen} onOpenChange={(open) => { if (!open) handleClosePdfDialog(); }}>
        <DialogContent className="flex h-[85vh] max-w-3xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {t('invoices.pdfPreview', 'Apercu du document')}
            </DialogTitle>
          </DialogHeader>
          {pdfLoading ? (
            <div className="flex justify-center items-center flex-1">
              <Spinner className="size-10 text-primary" />
            </div>
          ) : pdfUrl ? (
            <object
              data={pdfUrl}
              type="application/pdf"
              width="100%"
              style={{ flex: 1, border: 'none', minHeight: 0 }}
            >
              <div className="p-4 text-center">
                <p className="mb-3 text-xs text-muted-foreground">
                  {t('invoices.pdfNotSupported', 'Votre navigateur ne supporte pas la visualisation PDF.')}
                </p>
                <Button asChild>
                  <a href={pdfUrl} download="facture.pdf">
                    <DownloadIcon />
                    {t('invoices.actions.downloadPdf', 'Telecharger PDF')}
                  </a>
                </Button>
              </div>
            </object>
          ) : (
            <div className="p-4 text-center">
              <Alert variant="destructive" className="text-[12.5px]">
                <WarningIcon />
                <AlertDescription>
                  {t('invoices.pdfLoadError', 'Erreur lors du chargement du PDF')}
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={handleClosePdfDialog}>
              {t('common.close', 'Fermer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoicesList;
