import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  MenuItem,
  CircularProgress,
  Alert,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
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

/** Chip -soft : texte couleur + fond -soft (pilule/typo via th\u00e8me global MuiChip) */
const chipSoftSx = (fg: string, bg: string) => ({
  backgroundColor: bg,
  color: fg,
  '& .MuiChip-icon': { color: fg, marginLeft: '6px' },
});

/** Montants : display tabular-nums (jamais proportional) */
const moneySx = {
  fontFamily: 'var(--font-display)',
  fontVariantNumeric: 'tabular-nums',
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '\u2014';

// ─── Component ──────────────────────────────────────────────────────────────

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

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Determine le type de source : Reservation ou Intervention (accents palette Clenzy) */
  const getSourceType = (inv: Invoice) => {
    if (inv.reservationId) return { label: 'Reservation', icon: <Box component="span" sx={{ display: 'inline-flex', mr: 0.5 }}><HomeIcon size={14} strokeWidth={1.75} /></Box>, color: '#7BA3C2' };
    if (inv.interventionId) return { label: 'Intervention', icon: <Box component="span" sx={{ display: 'inline-flex', mr: 0.5 }}><BuildIcon size={14} strokeWidth={1.75} /></Box>, color: '#D4A574' };
    return null;
  };

  // ─── Common input sx (typo compacte — rayon/fond/focus via thème global) ──
  const inputSx = {
    '& .MuiOutlinedInput-root': { fontSize: '12.5px' },
    '& .MuiInputLabel-root': { fontSize: '12.5px' },
  };

  return (
    <Box>
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
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, mb: 2 }}>
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
        </Box>
      )}

      {/* ─── Filters (panneau hairline plat) ─────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          mb: 2,
          display: 'flex',
          gap: 1.5,
          flexWrap: 'wrap',
          alignItems: 'center',
          borderRadius: 'var(--radius-lg)',
          borderColor: 'var(--line)',
          bgcolor: 'var(--card)',
          boxShadow: 'none',
        }}
      >
        <TextField
          select
          size="small"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
          label={t('common.status', 'Statut')}
          sx={{ minWidth: 150, ...inputSx }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8125rem' }}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as InvoiceType | '')}
          label={t('invoices.type.label', 'Type')}
          sx={{ minWidth: 150, ...inputSx }}
        >
          {TYPE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8125rem' }}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          type="date"
          label={t('invoices.from', 'Du')}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 140, ...inputSx }}
        />
        <TextField
          size="small"
          type="date"
          label={t('invoices.to', 'Au')}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 140, ...inputSx }}
        />
        {hasActiveFilters && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<ClearIcon size={16} strokeWidth={1.75} />}
            onClick={handleClearFilters}
          >
            {t('payments.history.clearFilters')}
          </Button>
        )}
      </Paper>

      {/* ─── Table ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        /* Skeleton de table (carte hairline plate, lignes Skeleton) */
        <Paper
          variant="outlined"
          sx={{ borderRadius: 'var(--radius-lg)', borderColor: 'var(--line)', boxShadow: 'none', p: 2 }}
        >
          <Skeleton variant="text" width="30%" height={18} sx={{ mb: 1.5 }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={36} sx={{ borderRadius: 1, mb: 1 }} />
          ))}
        </Paper>
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
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            borderRadius: 'var(--radius-lg)',
            borderColor: 'var(--line)',
            boxShadow: 'none',
            '& .MuiTableCell-head': { py: 1.25, whiteSpace: 'nowrap' },
            '& .MuiTableCell-body': { py: 1.25 },
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('invoices.columns.number', 'N\u00B0')}</TableCell>
                <TableCell>{t('invoices.columns.date', 'Date')}</TableCell>
                <TableCell>{t('invoices.columns.type', 'Type')}</TableCell>
                <TableCell>{t('invoices.columns.buyer', 'Client')}</TableCell>
                <TableCell align="right">{t('invoices.columns.ht', 'HT')}</TableCell>
                <TableCell align="right">{t('invoices.columns.tax', 'TVA')}</TableCell>
                <TableCell align="right">{t('invoices.columns.ttc', 'TTC')}</TableCell>
                <TableCell>{t('common.status', 'Statut')}</TableCell>
                <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedInvoices.map((inv: Invoice) => {
                const source = getSourceType(inv);
                const statusToken = STATUS_TOKEN[inv.status] ?? STATUS_TOKEN.DRAFT;
                return (
                  <TableRow key={inv.id} data-highlight-id={String(inv.id)}>
                    {/* ─── N° + DUPLICATA badge ─── */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--ink)', ...moneySx }}>
                          {inv.invoiceNumber}
                        </Typography>
                        {inv.duplicateOfId && (
                          <Chip
                            label="DUP"
                            size="small"
                            sx={{
                              height: 18,
                              ...chipSoftSx('var(--info)', 'var(--info-soft)'),
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>

                    {/* ─── Date ─── */}
                    <TableCell sx={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(inv.invoiceDate)}</TableCell>

                    {/* ─── Type (Commission / Reservation / Intervention) ─── */}
                    <TableCell>
                      {inv.invoiceType === 'COMMISSION' ? (
                        <Chip
                          label={t('invoices.type.commission', 'Commission')}
                          size="small"
                          icon={<Box component="span" sx={{ display: 'inline-flex', mr: 0.5 }}><MoneyIcon size={14} strokeWidth={1.75} /></Box>}
                          sx={chipSoftSx(COMMISSION_COLOR, `${COMMISSION_COLOR}18`)}
                        />
                      ) : source ? (
                        <Chip
                          label={source.label}
                          size="small"
                          icon={source.icon}
                          sx={chipSoftSx(source.color, `${source.color}18`)}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ color: 'var(--muted)', fontSize: '12.5px' }}>
                          —
                        </Typography>
                      )}
                    </TableCell>

                    {/* ─── Client ─── */}
                    <TableCell sx={{ fontWeight: 600, color: 'var(--ink)' }}>{inv.buyerName}</TableCell>

                    {/* ─── Montants (display tabular-nums) ─── */}
                    <TableCell align="right" sx={moneySx}><Money value={inv.totalHt} from={inv.currency} /></TableCell>
                    <TableCell align="right" sx={moneySx}><Money value={inv.totalTax} from={inv.currency} /></TableCell>
                    <TableCell align="right" sx={{ ...moneySx, fontWeight: 600, color: 'var(--ink)' }}><Money value={inv.totalTtc} from={inv.currency} /></TableCell>

                    {/* ─── Statut (chip -soft sémantique) ─── */}
                    <TableCell>
                      <Chip
                        label={STATUS_LABELS[inv.status]}
                        size="small"
                        sx={chipSoftSx(statusToken.fg, statusToken.bg)}
                      />
                    </TableCell>

                    {/* ─── Actions ─── */}
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
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
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
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
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress thickness={3.5} sx={{ color: 'var(--accent)' }} />
            </Box>
          ) : pdfUrl ? (
            <object
              data={pdfUrl}
              type="application/pdf"
              width="100%"
              style={{ flex: 1, border: 'none', minHeight: 0 }}
            >
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'var(--muted)', mb: 2 }}>
                  {t('invoices.pdfNotSupported', 'Votre navigateur ne supporte pas la visualisation PDF.')}
                </Typography>
                <Button
                  variant="contained"
                  href={pdfUrl}
                  download="facture.pdf"
                  startIcon={<DownloadIcon />}
                >
                  {t('invoices.actions.downloadPdf', 'Telecharger PDF')}
                </Button>
              </Box>
            </object>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
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
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePdfDialog}>
            {t('common.close', 'Fermer')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoicesList;
