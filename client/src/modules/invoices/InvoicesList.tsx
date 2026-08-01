import React, { useState, useMemo } from 'react';
import StatusChip from '../../components/StatusChip';
import { Button, Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { IconButton, Tooltip, Alert, Skeleton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Field, FieldLabel, Input, NativeSelect, NativeSelectOption } from '../../components/ui';
import {
  Receipt as ReceiptIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  CheckCircle as PaidIcon,
  Cancel as CancelIcon,
  Clear as ClearIcon,
  HourglassEmpty as DraftIcon,
  AttachMoney as MoneyIcon,
  PictureAsPdf as PdfIcon,
  ContentCopy as DuplicateIcon,
  Warning as WarningIcon,
  Home as HomeIcon,
  Build as BuildIcon,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import StatTile from '../../components/StatTile';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useInvoices,
  useIssueInvoice,
  useMarkInvoicePaid,
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

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: InvoiceStatus | ''; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'SENT', label: 'Envoyee' },
  { value: 'ISSUED', label: 'Emise' },
  { value: 'PAID', label: 'Payee' },
  { value: 'OVERDUE', label: 'En retard' },
  { value: 'CANCELLED', label: 'Annulee' },
  { value: 'CREDIT_NOTE', label: 'Avoir' },
];

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

/** Accent de la facture de commission (rose valid\u00e9 Clenzy), distinct des couleurs de statut. */
const COMMISSION_COLOR = '#C97A7A';

/** Statuts de facture \u2192 tokens s\u00e9mantiques Signature (chips -soft : texte couleur + fond -soft).
 *  Neutre (brouillon/annul\u00e9e) : pas de token s\u00e9mantique d\u00e9di\u00e9 \u2014 repli muted/hover. */
const STATUS_TOKEN: Record<InvoiceStatus, { fg: string; bg: string }> = {
  DRAFT: { fg: 'var(--muted)', bg: 'var(--hover)' },
  SENT: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  ISSUED: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  PAID: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  OVERDUE: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  CANCELLED: { fg: 'var(--muted)', bg: 'var(--hover)' },
  CREDIT_NOTE: { fg: 'var(--info)', bg: 'var(--info-soft)' },
};

/** Montants : display tabular-nums (jamais proportional) */
const MONEY_CLASS = 'font-[family-name:var(--font-display)] tabular-nums';

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '\u2014';

// ─── Component ──────────────────────────────────────────────────────────────

const handleDownloadPdf = async (id: number, invoiceNumber: string) => {
  try {
    const blob = await invoicesApi.downloadPdf(id);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceNumber}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch {
    // Silently fail — could add snackbar
  }
};

/** Determine le type de source : Reservation ou Intervention (accents palette Clenzy) */
const getSourceType = (inv: Invoice) => {
  if (inv.reservationId) return { label: 'Reservation', icon: <span className="inline-flex me-0.5"><HomeIcon size={14} strokeWidth={1.75} /></span>, color: '#7BA3C2' };
  if (inv.interventionId) return { label: 'Intervention', icon: <span className="inline-flex me-0.5"><BuildIcon size={14} strokeWidth={1.75} /></span>, color: '#D4A574' };
  return null;
};

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

  const filters = useMemo(() => ({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateFrom ? { from: dateFrom } : {}),
    ...(dateTo ? { to: dateTo } : {}),
  }), [statusFilter, dateFrom, dateTo]);

  const { data: invoices, isLoading, error } = useInvoices(filters);
  // Filtre par nature (séjour / commission) appliqué côté client sur la liste déjà chargée.
  const displayedInvoices = useMemo(
    () => (invoices ?? []).filter((i) => !typeFilter || i.invoiceType === typeFilter),
    [invoices, typeFilter],
  );
  // Deep-link notification (?highlight=<invoiceId>) — surligne la ligne ciblee.
  const highlightId = useHighlightParam();
  useHighlightTarget(highlightId, !isLoading && displayedInvoices.length > 0);

  const { data: templateStatus } = useTemplateStatus();
  const issueMutation = useIssueInvoice();
  const markPaidMutation = useMarkInvoicePaid();
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

  // ─── Stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!invoices) return null;
    const list = displayedInvoices;
    const total = list.length;
    const draft = list.filter(i => i.status === 'DRAFT').length;
    const issued = list.filter(i => i.status === 'ISSUED').length;
    const paid = list.filter(i => i.status === 'PAID').length;
    const totalTtc = list.reduce((sum, i) => sum + i.totalTtc, 0);
    const currency = list[0]?.currency ?? 'EUR';
    return { total, draft, issued, paid, totalTtc, currency };
  }, [invoices, displayedInvoices]);

  // KPI StatTile — couleurs = palette accents Clenzy validée
  const summaryCards = stats
    ? [
        { label: t('invoices.stats.total', 'Total'), value: String(stats.total), color: '#6B8A9A', icon: <ReceiptIcon /> },
        { label: t('invoices.stats.draft', 'Brouillons'), value: String(stats.draft), color: '#D4A574', icon: <DraftIcon /> },
        { label: t('invoices.stats.issued', 'Emises'), value: String(stats.issued), color: '#7BA3C2', icon: <SendIcon /> },
        { label: t('invoices.stats.paid', 'Payees'), value: String(stats.paid), color: '#4A9B8E', icon: <PaidIcon /> },
        { label: t('invoices.stats.totalTtc', 'Total TTC'), value: <Money value={stats.totalTtc} from={stats.currency} />, color: '#6B8A9A', icon: <MoneyIcon /> },
      ]
    : [];

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
      {templateStatus && !templateStatus.hasTemplate && (
        <Alert
          severity="warning"
          icon={<WarningIcon size={20} strokeWidth={1.75} />}
          sx={{
            mb: 2,
            // Alerte -soft hairline (pattern .rm-conflict)
            bgcolor: 'var(--warn-soft)',
            border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
            borderRadius: '12px',
            color: 'var(--body)',
            fontSize: '12.5px',
            '& .MuiAlert-icon': { color: 'var(--warn)' },
            '& .MuiAlert-message': { fontSize: '12.5px' },
          }}
        >
          {t(
            'invoices.noTemplateWarning',
            'Aucun template FACTURE actif configure. Les PDF ne seront pas generes automatiquement lors des paiements. Veuillez configurer un template dans les parametres.'
          )}
        </Alert>
      )}

      {/* ─── KPIs (StatTile baseline) ──────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-[repeat(auto-fit,_minmax(160px,_1fr))] gap-1.5 mb-3">
          {summaryCards.map((card) => (
            <StatTile
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
              color={card.color}
              loading={isLoading}
            />
          ))}
        </div>
      )}

      {/* ─── Filters (panneau hairline plat) ─────────────────────────────── */}
      <Card className="gap-0 py-0 p-2 mb-3 flex gap-2 flex-wrap items-center border-[var(--line)] bg-[var(--card)]">
        <Field className="w-auto min-w-[150px]">
          <FieldLabel htmlFor="invoices-filter-status">{t('common.status', 'Statut')}</FieldLabel>
          <NativeSelect
            id="invoices-filter-status"
            className="w-full"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
          >
            {STATUS_OPTIONS.map((opt) => (
              <NativeSelectOption key={opt.value} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
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
        <Field className="w-auto min-w-[140px]">
          <FieldLabel htmlFor="invoices-filter-from">{t('invoices.from', 'Du')}</FieldLabel>
          <Input
            id="invoices-filter-from"
            className="w-full"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </Field>
        <Field className="w-auto min-w-[140px]">
          <FieldLabel htmlFor="invoices-filter-to">{t('invoices.to', 'Au')}</FieldLabel>
          <Input
            id="invoices-filter-to"
            className="w-full"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </Field>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            <ClearIcon size={16} strokeWidth={1.75} />
            {t('payments.history.clearFilters')}
          </Button>
        )}
      </Card>

      {/* ─── Table ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        /* Skeleton de table (carte hairline plate, lignes Skeleton) */
        <Card className="gap-0 py-0 border-[var(--line)] p-3">
          <Skeleton variant="text" width="30%" height={18} sx={{ mb: 1.5 }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={36} sx={{ borderRadius: 1, mb: 1 }} />
          ))}
        </Card>
      ) : error ? (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            bgcolor: 'var(--err-soft)',
            border: '1px solid color-mix(in srgb, var(--err) 30%, transparent)',
            borderRadius: '12px',
            color: 'var(--body)',
            fontSize: '12.5px',
            '& .MuiAlert-icon': { color: 'var(--err)' },
          }}
        >
          {t('invoices.loadError', 'Erreur lors du chargement des factures')}
        </Alert>
      ) : !displayedInvoices.length ? (
        <EmptyState
          icon={<ReceiptIcon />}
          title={t('invoices.empty', 'Aucune facture trouvee')}
          variant="plain"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-solid border-[var(--line)] bg-[var(--card)]">
          {/* py-[7.5px] : le `sx` d'origine resserrait les cellules (py: 1.25) par
              rapport au gabarit du kit (6px en-tete / 8px corps). */}
          <Table className="[&_th]:py-[7.5px] [&_td]:py-[7.5px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('invoices.columns.number', 'N\u00B0')}</TableHead>
                <TableHead>{t('invoices.columns.date', 'Date')}</TableHead>
                <TableHead>{t('invoices.columns.type', 'Type')}</TableHead>
                <TableHead>{t('invoices.columns.buyer', 'Client')}</TableHead>
                <TableHead className="text-end">{t('invoices.columns.ht', 'HT')}</TableHead>
                <TableHead className="text-end">{t('invoices.columns.tax', 'TVA')}</TableHead>
                <TableHead className="text-end">{t('invoices.columns.ttc', 'TTC')}</TableHead>
                <TableHead>{t('common.status', 'Statut')}</TableHead>
                <TableHead className="text-end">{t('common.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedInvoices.map((inv: Invoice) => {
                const source = getSourceType(inv);
                const statusToken = STATUS_TOKEN[inv.status] ?? STATUS_TOKEN.DRAFT;
                return (
                  <TableRow key={inv.id} data-highlight-id={String(inv.id)}>
                    {/* ─── N° + DUPLICATA badge ─── */}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Litteral et non `cn()` : tailwind-merge considere `font-[...]` et
                            `font-semibold` comme un meme groupe et supprimerait la police display. */}
                        <p className={`cn-text-body2 ${MONEY_CLASS} text-[12.5px] font-semibold text-[var(--ink)]`}>
                          {inv.invoiceNumber}
                        </p>
                        {inv.duplicateOfId && (
                          <StatusChip tone="info" size="sm" label="DUP" />
                        )}
                      </div>
                    </TableCell>

                    {/* ─── Date ─── */}
                    <TableCell className="text-[var(--muted)] tabular-nums">{fmtDate(inv.invoiceDate)}</TableCell>

                    {/* ─── Type (Commission / Reservation / Intervention) ─── */}
                    <TableCell>
                      {inv.invoiceType === 'COMMISSION' ? (
                        <StatusChip tokens={{ color: COMMISSION_COLOR, bg: `${COMMISSION_COLOR}18` }} label={t('invoices.type.commission', 'Commission')} icon={<span className="inline-flex me-0.5"><MoneyIcon size={14} strokeWidth={1.75} /></span>} />
                      ) : source ? (
                        <StatusChip tokens={{ color: source.color, bg: `${source.color}18` }} label={source.label} icon={source.icon} />
                      ) : (
                        <p className="cn-text-body2 text-[var(--muted)] text-[12.5px]">
                          —
                        </p>
                      )}
                    </TableCell>

                    {/* ─── Client ─── */}
                    <TableCell className="font-semibold text-[var(--ink)]">{inv.buyerName}</TableCell>

                    {/* ─── Montants (display tabular-nums) ─── */}
                    <TableCell className={`text-end ${MONEY_CLASS}`}><Money value={inv.totalHt} from={inv.currency} /></TableCell>
                    <TableCell className={`text-end ${MONEY_CLASS}`}><Money value={inv.totalTax} from={inv.currency} /></TableCell>
                    <TableCell className={`text-end ${MONEY_CLASS} font-semibold text-[var(--ink)]`}><Money value={inv.totalTtc} from={inv.currency} /></TableCell>

                    {/* ─── Statut (chip -soft sémantique) ─── */}
                    <TableCell>
                      <StatusChip tokens={{ color: statusToken.fg, bg: statusToken.bg }} label={STATUS_LABELS[inv.status]} />
                    </TableCell>

                    {/* ─── Actions ─── */}
                    <TableCell className="text-end">
                      <div className="flex gap-0.5 justify-end">
                        {/* Voir PDF (document genere) */}
                        {inv.documentGenerationId && (
                          <Tooltip title={t('invoices.actions.viewPdf', 'Voir PDF')}>
                            <IconButton
                              size="small"
                              sx={{ color: 'var(--err)', '&:hover': { bgcolor: 'var(--err-soft)', color: 'var(--err)' } }}
                              onClick={() => handleViewDocumentPdf(inv.documentGenerationId!)}
                            >
                              <PdfIcon size={18} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Emettre */}
                        {inv.status === 'DRAFT' && (
                          <Tooltip title={t('invoices.actions.issue', 'Emettre')}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => issueMutation.mutate(inv.id)}
                              disabled={issueMutation.isPending}
                            >
                              <SendIcon size={18} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Marquer payee */}
                        {inv.status === 'ISSUED' && (
                          <Tooltip title={t('invoices.actions.markPaid', 'Marquer payee')}>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => markPaidMutation.mutate(inv.id)}
                              disabled={markPaidMutation.isPending}
                            >
                              <PaidIcon size={18} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Annuler */}
                        {(inv.status === 'DRAFT' || inv.status === 'ISSUED') && (
                          <Tooltip title={t('invoices.actions.cancel', 'Annuler')}>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => cancelMutation.mutate(inv.id)}
                              disabled={cancelMutation.isPending}
                            >
                              <CancelIcon size={18} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Duplicata */}
                        {(inv.status === 'ISSUED' || inv.status === 'PAID') && !inv.duplicateOfId && (
                          <Tooltip title={t('invoices.actions.duplicate', 'Generer duplicata')}>
                            <IconButton
                              size="small"
                              sx={{ color: 'var(--info)', '&:hover': { bgcolor: 'var(--info-soft)', color: 'var(--info)' } }}
                              onClick={() => duplicateMutation.mutate(inv.id)}
                              disabled={duplicateMutation.isPending}
                            >
                              <DuplicateIcon size={18} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Telecharger PDF */}
                        <Tooltip title={t('invoices.actions.downloadPdf', 'Telecharger PDF')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadPdf(inv.id, inv.invoiceNumber)}
                          >
                            <DownloadIcon size={18} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ─── PDF Preview Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={pdfDialogOpen}
        onClose={handleClosePdfDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { height: '85vh' },
        }}
      >
        <DialogTitle>
          {t('invoices.pdfPreview', 'Apercu du document')}
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {pdfLoading ? (
            <div className="flex justify-center items-center flex-1">
              <Spinner className="size-10 text-[var(--accent)]" />
            </div>
          ) : pdfUrl ? (
            <object
              data={pdfUrl}
              type="application/pdf"
              width="100%"
              style={{ flex: 1, border: 'none', minHeight: 0 }}
            >
              <div className="p-4 text-center">
                <p className="cn-text-body2 text-[var(--muted)] mb-3">
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
              <Alert
                severity="error"
                sx={{
                  bgcolor: 'var(--err-soft)',
                  border: '1px solid color-mix(in srgb, var(--err) 30%, transparent)',
                  borderRadius: '12px',
                  color: 'var(--body)',
                  fontSize: '12.5px',
                  '& .MuiAlert-icon': { color: 'var(--err)' },
                }}
              >
                {t('invoices.pdfLoadError', 'Erreur lors du chargement du PDF')}
              </Alert>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={handleClosePdfDialog}>
            {t('common.close', 'Fermer')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default InvoicesList;
