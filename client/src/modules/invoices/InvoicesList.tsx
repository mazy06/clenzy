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
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { useInvoices, useIssueInvoice, useMarkInvoicePaid, useCancelInvoice } from '../../hooks/useInvoices';
import { invoicesApi, INVOICE_STATUS_COLORS } from '../../services/api/invoicesApi';
import type { InvoiceStatus, Invoice } from '../../services/api/invoicesApi';
import { formatCurrency } from '../../utils/currencyUtils';

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

  const filters = useMemo(() => ({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateFrom ? { from: dateFrom } : {}),
    ...(dateTo ? { to: dateTo } : {}),
  }), [statusFilter, dateFrom, dateTo]);

  const { data: invoices, isLoading, error } = useInvoices(filters);
  const issueMutation = useIssueInvoice();
  const markPaidMutation = useMarkInvoicePaid();
  const cancelMutation = useCancelInvoice();

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
                <TableCell>{t('invoices.columns.buyer', 'Client')}</TableCell>
                <TableCell align="right">{t('invoices.columns.ht', 'HT')}</TableCell>
                <TableCell align="right">{t('invoices.columns.tax', 'TVA')}</TableCell>
                <TableCell align="right">{t('invoices.columns.ttc', 'TTC')}</TableCell>
                <TableCell>{t('common.status', 'Statut')}</TableCell>
                <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((inv: Invoice) => (
                <TableRow
                  key={inv.id}
                  hover
                  sx={{
                    cursor: 'default',
                    transition: 'background-color 0.15s ease',
                    '&:hover': { bgcolor: 'rgba(107,138,154,0.04)' },
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                      {inv.invoiceNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>{fmtDate(inv.invoiceDate)}</TableCell>
                  <TableCell>{inv.buyerName}</TableCell>
                  <TableCell align="right">{formatCurrency(inv.totalHt, inv.currency)}</TableCell>
                  <TableCell align="right">{formatCurrency(inv.totalTax, inv.currency)}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">{formatCurrency(inv.totalTtc, inv.currency)}</TableCell>
                  <TableCell>
                    <Chip
                      label={STATUS_LABELS[inv.status]}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: '0.6875rem',
                        height: 22,
                        fontWeight: 500,
                        borderWidth: 1.5,
                        borderColor: INVOICE_STATUS_COLORS[inv.status],
                        color: INVOICE_STATUS_COLORS[inv.status],
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default InvoicesList;
