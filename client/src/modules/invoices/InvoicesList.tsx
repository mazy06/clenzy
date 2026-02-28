import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, Chip, IconButton, Tooltip,
  MenuItem, Select, FormControl, InputLabel, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  CheckCircle as PaidIcon,
  Cancel as CancelIcon,
  Visibility as ViewIcon,
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

const CELL_SX = { fontSize: '0.8125rem', py: 1.25 } as const;
const HEAD_CELL_SX = { fontSize: '0.75rem', fontWeight: 700, py: 1, color: 'text.secondary' } as const;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '\u2014';

// ─── Component ──────────────────────────────────────────────────────────────

const InvoicesList: React.FC = () => {
  const { t } = useTranslation();
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

  return (
    <Box>
      <PageHeader
        title={t('invoices.title', 'Factures')}
        subtitle={t('invoices.subtitle', 'Gestion des factures et documents fiscaux')}
        backPath="/"
        showBackButton={false}
      />

      {/* ─── Filtres ─────────────────────────────────────────────────────── */}
      <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('common.status', 'Statut')}</InputLabel>
            <Select
              value={statusFilter}
              label={t('common.status', 'Statut')}
              onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
            >
              {STATUS_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            type="date"
            label={t('invoices.from', 'Du')}
            size="small"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <TextField
            type="date"
            label={t('invoices.to', 'Au')}
            size="small"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
        </Box>
      </Paper>

      {/* ─── Stats Cards ─────────────────────────────────────────────────── */}
      {stats && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          {[
            { label: t('invoices.stats.total', 'Total'), value: stats.total, color: 'text.primary' },
            { label: t('invoices.stats.draft', 'Brouillons'), value: stats.draft, color: INVOICE_STATUS_COLORS.DRAFT },
            { label: t('invoices.stats.issued', 'Emises'), value: stats.issued, color: INVOICE_STATUS_COLORS.ISSUED },
            { label: t('invoices.stats.paid', 'Payees'), value: stats.paid, color: INVOICE_STATUS_COLORS.PAID },
          ].map(s => (
            <Paper key={s.label} sx={{ p: 1.5, flex: 1, minWidth: 120, border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{s.label}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: s.color, fontSize: '1.1rem' }}>{s.value}</Typography>
            </Paper>
          ))}
          <Paper sx={{ p: 1.5, flex: 1, minWidth: 160, border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {t('invoices.stats.totalTtc', 'Total TTC')}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '1.1rem' }}>
              {formatCurrency(stats.totalTtc, stats.currency)}
            </Typography>
          </Paper>
        </Box>
      )}

      {/* ─── Table ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('invoices.loadError', 'Erreur lors du chargement des factures')}
        </Alert>
      ) : !invoices?.length ? (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5 }}>
          <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            {t('invoices.empty', 'Aucune facture trouvee')}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={HEAD_CELL_SX}>{t('invoices.columns.number', 'N\u00B0')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('invoices.columns.date', 'Date')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('invoices.columns.buyer', 'Client')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('invoices.columns.ht', 'HT')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('invoices.columns.tax', 'TVA')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('invoices.columns.ttc', 'TTC')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('common.status', 'Statut')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((inv: Invoice) => (
                <TableRow key={inv.id} hover>
                  <TableCell sx={CELL_SX}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                      {inv.invoiceNumber}
                    </Typography>
                  </TableCell>
                  <TableCell sx={CELL_SX}>{fmtDate(inv.invoiceDate)}</TableCell>
                  <TableCell sx={CELL_SX}>{inv.buyerName}</TableCell>
                  <TableCell sx={CELL_SX} align="right">{formatCurrency(inv.totalHt, inv.currency)}</TableCell>
                  <TableCell sx={CELL_SX} align="right">{formatCurrency(inv.totalTax, inv.currency)}</TableCell>
                  <TableCell sx={{ ...CELL_SX, fontWeight: 600 }} align="right">{formatCurrency(inv.totalTtc, inv.currency)}</TableCell>
                  <TableCell sx={CELL_SX}>
                    <Chip
                      label={STATUS_LABELS[inv.status]}
                      size="small"
                      sx={{
                        bgcolor: INVOICE_STATUS_COLORS[inv.status],
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 22,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={CELL_SX} align="right">
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
