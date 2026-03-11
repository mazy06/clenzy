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
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  useTheme,
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
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useInvoices,
  useIssueInvoice,
  useMarkInvoicePaid,
  useCancelInvoice,
  useTemplateStatus,
  useDuplicateInvoice,
} from '../../hooks/useInvoices';
import { invoicesApi, INVOICE_STATUS_COLORS } from '../../services/api/invoicesApi';
import type { InvoiceStatus, Invoice } from '../../services/api/invoicesApi';
import { formatCurrency } from '../../utils/currencyUtils';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../services/storageService';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: InvoiceStatus | ''; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'ISSUED', label: 'Emise' },
  { value: 'PAID', label: 'Payee' },
  { value: 'CANCELLED', label: 'Annulee' },
  { value: 'CREDIT_NOTE', label: 'Avoir' },
];

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Brouillon',
  ISSUED: 'Emise',
  PAID: 'Payee',
  CANCELLED: 'Annulee',
  CREDIT_NOTE: 'Avoir',
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '\u2014';

// ─── Component ──────────────────────────────────────────────────────────────

interface InvoicesListProps {
  embedded?: boolean;
}

const InvoicesList: React.FC<InvoicesListProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // ─── Theme-aware colours (aligned with PaymentHistoryPage) ─────────────
  const C = {
    primary: theme.palette.primary.main,
    primaryLight: isDark ? theme.palette.primary.light : '#8BA3B3',
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    info: theme.palette.info.main,
    error: theme.palette.error.main,
    textPrimary: theme.palette.text.primary,
    textSecondary: theme.palette.text.secondary,
    gray50: isDark ? theme.palette.grey[100] : '#F8FAFC',
    gray100: isDark ? theme.palette.grey[200] : '#F1F5F9',
    gray200: isDark ? theme.palette.grey[300] : '#E2E8F0',
  };

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
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
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = statusFilter || dateFrom || dateTo;

  // ─── Stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!invoices) return null;
    const total = invoices.length;
    const draft = invoices.filter(i => i.status === 'DRAFT').length;
    const issued = invoices.filter(i => i.status === 'ISSUED').length;
    const paid = invoices.filter(i => i.status === 'PAID').length;
    const totalTtc = invoices.reduce((sum, i) => sum + i.totalTtc, 0);
    const currency = invoices[0]?.currency ?? 'EUR';
    return { total, draft, issued, paid, totalTtc, currency };
  }, [invoices]);

  const summaryCards = stats
    ? [
        { label: t('invoices.stats.total', 'Total'), value: String(stats.total), color: C.primary, icon: <ReceiptIcon sx={{ fontSize: 20, color: C.primary }} /> },
        { label: t('invoices.stats.draft', 'Brouillons'), value: String(stats.draft), color: C.warning, icon: <DraftIcon sx={{ fontSize: 20, color: C.warning }} /> },
        { label: t('invoices.stats.issued', 'Emises'), value: String(stats.issued), color: C.info, icon: <SendIcon sx={{ fontSize: 20, color: C.info }} /> },
        { label: t('invoices.stats.paid', 'Payees'), value: String(stats.paid), color: C.success, icon: <PaidIcon sx={{ fontSize: 20, color: C.success }} /> },
        { label: t('invoices.stats.totalTtc', 'Total TTC'), value: formatCurrency(stats.totalTtc, stats.currency), color: C.primary, icon: <MoneyIcon sx={{ fontSize: 20, color: C.primary }} /> },
      ]
    : [];

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Determine le type de source : Reservation ou Intervention */
  const getSourceType = (inv: Invoice) => {
    if (inv.reservationId) return { label: 'Reservation', icon: <HomeIcon sx={{ fontSize: 14, mr: 0.5 }} />, color: C.info };
    if (inv.interventionId) return { label: 'Intervention', icon: <BuildIcon sx={{ fontSize: 14, mr: 0.5 }} />, color: C.warning };
    return null;
  };

  // ─── Common input sx ──────────────────────────────────────────────────
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      fontSize: '0.8125rem',
      borderRadius: '8px',
      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: C.primaryLight },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: C.primary },
    },
    '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
  };

  return (
    <Box>
      {!embedded && (
        <PageHeader
          title={t('invoices.title', 'Factures')}
          subtitle={t('invoices.subtitle', 'Gestion des factures et documents fiscaux')}
          backPath="/"
          showBackButton={false}
        />
      )}

      {/* ─── Template warning ──────────────────────────────────────────── */}
      {templateStatus && !templateStatus.hasTemplate && (
        <Alert
          severity="warning"
          icon={<WarningIcon sx={{ fontSize: 20 }} />}
          sx={{
            mb: 2,
            borderRadius: '10px',
            fontSize: '0.8125rem',
            '& .MuiAlert-message': { fontSize: '0.8125rem' },
          }}
        >
          {t(
            'invoices.noTemplateWarning',
            'Aucun template FACTURE actif configure. Les PDF ne seront pas generes automatiquement lors des paiements. Veuillez configurer un template dans les parametres.'
          )}
        </Alert>
      )}

      {/* ─── Summary cards ─────────────────────────────────────────────── */}
      {stats && (
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          {summaryCards.map((card) => (
            <Card key={card.label} sx={{ flex: '1 1 140px', borderLeft: `4px solid ${card.color}` }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: `${card.color}14`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {card.icon}
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.125rem', color: C.textPrimary, lineHeight: 1.2 }}>
                    {card.value}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.75rem', color: C.textSecondary }}>
                    {card.label}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* ─── Filters ─────────────────────────────────────────────────────── */}
      <Paper
        sx={{
          p: 1.5,
          mb: 2,
          display: 'flex',
          gap: 1.5,
          flexWrap: 'wrap',
          alignItems: 'center',
          borderRadius: '12px',
          boxShadow: '0 1px 4px rgba(107,138,154,0.10)',
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
            startIcon={<ClearIcon sx={{ fontSize: 16 }} />}
            onClick={handleClearFilters}
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              borderColor: C.gray200,
              color: C.textSecondary,
              borderRadius: '8px',
              '&:hover': { borderColor: C.primary, color: C.primary },
            }}
          >
            {t('payments.history.clearFilters')}
          </Button>
        )}
      </Paper>

      {/* ─── Table ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.8125rem' }}>
          {t('invoices.loadError', 'Erreur lors du chargement des factures')}
        </Alert>
      ) : !invoices?.length ? (
        <Card sx={{ borderRadius: '12px' }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                bgcolor: `${C.primary}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <ReceiptIcon sx={{ fontSize: 28, color: C.primary }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '0.9375rem', color: C.textPrimary, mb: 0.5 }}>
              {t('invoices.empty', 'Aucune facture trouvee')}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(107,138,154,0.10)',
            '& .MuiTableHead-root': {
              bgcolor: C.gray50,
            },
            '& .MuiTableCell-head': {
              fontWeight: 600,
              fontSize: '0.75rem',
              color: C.textSecondary,
              borderBottom: `2px solid ${C.gray200}`,
              py: 1.25,
              whiteSpace: 'nowrap',
            },
            '& .MuiTableCell-body': {
              fontSize: '0.8125rem',
              color: C.textPrimary,
              py: 1.25,
              borderBottom: `1px solid ${C.gray100}`,
            },
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
              {invoices.map((inv: Invoice) => {
                const source = getSourceType(inv);
                const statusColor = INVOICE_STATUS_COLORS[inv.status];
                return (
                  <TableRow
                    key={inv.id}
                    hover
                    sx={{
                      cursor: 'default',
                      transition: 'background-color 0.15s ease',
                      '&:hover': { bgcolor: 'rgba(107,138,154,0.04)' },
                    }}
                  >
                    {/* ─── N° + DUPLICATA badge ─── */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                          {inv.invoiceNumber}
                        </Typography>
                        {inv.duplicateOfId && (
                          <Chip
                            label="DUP"
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              bgcolor: '#f3e8ff',
                              color: '#7c3aed',
                              border: '1px solid #ddd6fe',
                              borderRadius: '4px',
                              '& .MuiChip-label': { px: 0.5 },
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>

                    {/* ─── Date ─── */}
                    <TableCell>{fmtDate(inv.invoiceDate)}</TableCell>

                    {/* ─── Type (Reservation / Intervention) ─── */}
                    <TableCell>
                      {source ? (
                        <Chip
                          label={source.label}
                          size="small"
                          icon={source.icon}
                          sx={{
                            height: 22,
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            bgcolor: `${source.color}14`,
                            color: source.color,
                            border: `1px solid ${source.color}30`,
                            borderRadius: '6px',
                            '& .MuiChip-label': { px: 0.75 },
                            '& .MuiChip-icon': { ml: 0.5, color: source.color },
                          }}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ color: C.textSecondary, fontSize: '0.75rem' }}>
                          —
                        </Typography>
                      )}
                    </TableCell>

                    {/* ─── Client ─── */}
                    <TableCell>{inv.buyerName}</TableCell>

                    {/* ─── Montants ─── */}
                    <TableCell align="right">{formatCurrency(inv.totalHt, inv.currency)}</TableCell>
                    <TableCell align="right">{formatCurrency(inv.totalTax, inv.currency)}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">{formatCurrency(inv.totalTtc, inv.currency)}</TableCell>

                    {/* ─── Statut ─── */}
                    <TableCell>
                      <Chip
                        label={STATUS_LABELS[inv.status]}
                        size="small"
                        sx={{
                          backgroundColor: `${statusColor}18`,
                          color: statusColor,
                          border: `1px solid ${statusColor}40`,
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          height: 24,
                          '& .MuiChip-label': { px: 1 },
                        }}
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
                              sx={{ color: '#e53935' }}
                              onClick={() => handleViewDocumentPdf(inv.documentGenerationId!)}
                            >
                              <PdfIcon sx={{ fontSize: 18 }} />
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
                              <SendIcon sx={{ fontSize: 18 }} />
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
                              <PaidIcon sx={{ fontSize: 18 }} />
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
                              <CancelIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Duplicata */}
                        {(inv.status === 'ISSUED' || inv.status === 'PAID') && !inv.duplicateOfId && (
                          <Tooltip title={t('invoices.actions.duplicate', 'Generer duplicata')}>
                            <IconButton
                              size="small"
                              sx={{ color: '#7c3aed' }}
                              onClick={() => duplicateMutation.mutate(inv.id)}
                              disabled={duplicateMutation.isPending}
                            >
                              <DuplicateIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Telecharger PDF */}
                        <Tooltip title={t('invoices.actions.downloadPdf', 'Telecharger PDF')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadPdf(inv.id, inv.invoiceNumber)}
                          >
                            <DownloadIcon sx={{ fontSize: 18 }} />
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
          sx: { borderRadius: '12px', height: '85vh' },
        }}
      >
        <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 600, py: 1.5 }}>
          {t('invoices.pdfPreview', 'Apercu du document')}
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {pdfLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : pdfUrl ? (
            <object
              data={pdfUrl}
              type="application/pdf"
              width="100%"
              style={{ flex: 1, border: 'none', minHeight: 0 }}
            >
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: C.textSecondary, mb: 2 }}>
                  {t('invoices.pdfNotSupported', 'Votre navigateur ne supporte pas la visualisation PDF.')}
                </Typography>
                <Button
                  variant="contained"
                  href={pdfUrl}
                  download="facture.pdf"
                  startIcon={<DownloadIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  {t('invoices.actions.downloadPdf', 'Telecharger PDF')}
                </Button>
              </Box>
            </object>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
                {t('invoices.pdfLoadError', 'Erreur lors du chargement du PDF')}
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button
            onClick={handleClosePdfDialog}
            sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
          >
            {t('common.close', 'Fermer')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoicesList;
