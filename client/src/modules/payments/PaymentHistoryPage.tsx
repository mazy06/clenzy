import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  MoneyOff as MoneyOffIcon,
  Receipt as ReceiptIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  ReceiptLong as ReceiptLongIcon,
  Warning as WarningIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { paymentsApi } from '../../services/api/paymentsApi';
import type { PaymentRecord, PaymentSummary, HostOption } from '../../services/api/paymentsApi';
import apiClient from '../../services/apiClient';
import PageHeader from '../../components/PageHeader';
import DataFetchWrapper from '../../components/DataFetchWrapper';

// ─── Couleurs Clenzy ─────────────────────────────────────────────────────────
const C = {
  primary: '#6B8A9A',
  primaryLight: '#8BA3B3',
  primaryDark: '#5A7684',
  secondary: '#A6C0CE',
  success: '#4A9B8E',
  warning: '#D4A574',
  warningLight: '#E8C19A',
  error: '#C97A7A',
  info: '#7BA3C2',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  white: '#ffffff',
} as const;

const PaymentHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Role detection
  const isAdminOrManager = user?.roles?.some((r) => ['ADMIN', 'MANAGER'].includes(r)) ?? false;

  // Data state
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>({
    totalPaid: 0,
    totalPending: 0,
    totalRefunded: 0,
    transactionCount: 0,
  });
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Host filter (ADMIN/MANAGER)
  const [hostsList, setHostsList] = useState<HostOption[]>([]);
  const [hostFilter, setHostFilter] = useState<number | ''>('');

  // Loading / error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Payment processing state
  const [processingPayment, setProcessingPayment] = useState<number | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // ─── Load hosts list for ADMIN/MANAGER ──────────────────────────────────────

  useEffect(() => {
    if (isAdminOrManager) {
      paymentsApi.getHosts().then(setHostsList).catch(() => setHostsList([]));
    }
  }, [isAdminOrManager]);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [historyRes, summaryRes] = await Promise.all([
        paymentsApi.getHistory({
          page,
          size: rowsPerPage,
          status: statusFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          hostId: hostFilter || undefined,
        }),
        paymentsApi.getSummary(),
      ]);

      let records = historyRes.content;

      // Client-side search filter (API may not support text search)
      if (search.trim()) {
        const q = search.toLowerCase();
        records = records.filter(
          (r) =>
            r.interventionTitle.toLowerCase().includes(q) ||
            r.propertyName.toLowerCase().includes(q) ||
            (r.hostName && r.hostName.toLowerCase().includes(q))
        );
      }

      setPayments(records);
      setTotalElements(search.trim() ? records.length : historyRes.totalElements);
      setTotalPages(search.trim() ? Math.ceil(records.length / rowsPerPage) : historyRes.totalPages);
      setSummary(summaryRes);
    } catch {
      setError('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, statusFilter, dateFrom, dateTo, search, hostFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setHostFilter('');
    setPage(0);
  };

  const handlePay = async (payment: PaymentRecord) => {
    if (!payment.amount || payment.amount <= 0) {
      setPayError("Le montant n'est pas defini pour ce paiement");
      return;
    }

    try {
      setProcessingPayment(payment.interventionId);
      setPayError(null);

      const paymentData = await apiClient.post<{ url: string }>('/payments/create-session', {
        interventionId: payment.interventionId,
        amount: payment.amount,
      });

      window.location.href = paymentData.url;
    } catch (err: any) {
      setPayError(err.message || 'Erreur lors de la creation de la session de paiement');
      setProcessingPayment(null);
    }
  };

  const hasActiveFilters = search || statusFilter || dateFrom || dateTo || hostFilter;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusChip = (status: PaymentRecord['status']) => {
    const config: Record<string, { bg: string; color: string; label: string }> = {
      PAID: { bg: `${C.success}14`, color: C.success, label: t('payments.history.paid') },
      PENDING: { bg: `${C.warning}14`, color: C.warning, label: t('payments.history.pending') },
      PROCESSING: { bg: `${C.info}14`, color: C.info, label: t('payments.history.processing') },
      FAILED: { bg: `${C.error}14`, color: C.error, label: t('payments.history.failed') },
      REFUNDED: { bg: `${C.info}14`, color: C.info, label: t('payments.history.refunded') },
      CANCELLED: { bg: `${C.gray100}`, color: C.textSecondary, label: t('payments.history.cancelled') },
    };
    const c = config[status] || { bg: C.gray100, color: C.textSecondary, label: status };
    return (
      <Chip
        label={c.label}
        size="small"
        sx={{
          fontSize: '0.6875rem',
          height: 22,
          bgcolor: c.bg,
          color: c.color,
          fontWeight: 500,
          borderRadius: '6px',
        }}
      />
    );
  };

  /** Row styling for unpaid highlighting */
  const getRowSx = (status: PaymentRecord['status']) => {
    if (status === 'PENDING' || status === 'PROCESSING') {
      return {
        cursor: 'pointer',
        borderLeft: `3px solid ${C.warning}`,
        transition: 'background-color 0.15s ease',
        '&:hover': { bgcolor: 'rgba(107,138,154,0.04)' },
      };
    }
    if (status === 'FAILED') {
      return {
        cursor: 'pointer',
        borderLeft: `3px solid ${C.error}`,
        transition: 'background-color 0.15s ease',
        '&:hover': { bgcolor: 'rgba(107,138,154,0.04)' },
      };
    }
    return {
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
      '&:hover': { bgcolor: 'rgba(107,138,154,0.04)' },
    };
  };

  // ─── Summary cards ────────────────────────────────────────────────────────

  const totalDue = summary.totalPending;

  const summaryCards = isAdminOrManager
    ? [
        {
          label: t('payments.history.totalPaid'),
          value: formatCurrency(summary.totalPaid),
          color: C.success,
          icon: <CheckCircleIcon sx={{ fontSize: 20, color: C.success }} />,
        },
        {
          label: t('payments.history.totalPending'),
          value: formatCurrency(summary.totalPending),
          color: C.warning,
          icon: <HourglassEmptyIcon sx={{ fontSize: 20, color: C.warning }} />,
        },
        {
          label: t('payments.history.totalRefunded'),
          value: formatCurrency(summary.totalRefunded),
          color: C.info,
          icon: <MoneyOffIcon sx={{ fontSize: 20, color: C.info }} />,
        },
        {
          label: t('payments.history.transactions'),
          value: String(summary.transactionCount),
          color: C.primary,
          icon: <ReceiptIcon sx={{ fontSize: 20, color: C.primary }} />,
        },
      ]
    : [
        {
          label: t('payments.history.totalPaid'),
          value: formatCurrency(summary.totalPaid),
          color: C.success,
          icon: <CheckCircleIcon sx={{ fontSize: 20, color: C.success }} />,
        },
        {
          label: t('payments.history.totalDue'),
          value: formatCurrency(totalDue),
          color: totalDue > 0 ? C.error : C.warning,
          icon: <WarningIcon sx={{ fontSize: 20, color: totalDue > 0 ? C.error : C.warning }} />,
        },
        {
          label: t('payments.history.transactions'),
          value: String(summary.transactionCount),
          color: C.primary,
          icon: <ReceiptIcon sx={{ fontSize: 20, color: C.primary }} />,
        },
      ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <PageHeader
        title={t('payments.history.title')}
        subtitle={t('payments.history.subtitle')}
        backPath="/dashboard"
        showBackButton={true}
      />

      {payError && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: '8px', fontSize: '0.8125rem' }}
          onClose={() => setPayError(null)}
        >
          {payError}
        </Alert>
      )}

      {/* Summary cards */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        {summaryCards.map((card) => (
          <Card key={card.label} sx={{ flex: '1 1 180px', borderLeft: `4px solid ${card.color}` }}>
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

      {/* Filters */}
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
          size="small"
          placeholder={t('payments.history.search')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: C.textSecondary, fontSize: 18 }} />,
          }}
          sx={{
            minWidth: 200,
            flex: 1,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.8125rem',
              borderRadius: '8px',
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: C.primaryLight },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: C.primary },
            },
          }}
        />
        <TextField
          select
          size="small"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          sx={{
            minWidth: 150,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.8125rem',
              borderRadius: '8px',
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: C.primaryLight },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: C.primary },
            },
            '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
          }}
          label={t('payments.history.status')}
        >
          <MenuItem value="" sx={{ fontSize: '0.8125rem' }}>{t('payments.history.allStatuses')}</MenuItem>
          <MenuItem value="PAID" sx={{ fontSize: '0.8125rem' }}>{t('payments.history.paid')}</MenuItem>
          <MenuItem value="PENDING" sx={{ fontSize: '0.8125rem' }}>{t('payments.history.pending')}</MenuItem>
          <MenuItem value="PROCESSING" sx={{ fontSize: '0.8125rem' }}>{t('payments.history.processing')}</MenuItem>
          <MenuItem value="FAILED" sx={{ fontSize: '0.8125rem' }}>{t('payments.history.failed')}</MenuItem>
          <MenuItem value="REFUNDED" sx={{ fontSize: '0.8125rem' }}>{t('payments.history.refunded')}</MenuItem>
          <MenuItem value="CANCELLED" sx={{ fontSize: '0.8125rem' }}>{t('payments.history.cancelled')}</MenuItem>
        </TextField>

        {/* Host filter — ADMIN/MANAGER only */}
        {isAdminOrManager && (
          <TextField
            select
            size="small"
            value={hostFilter}
            onChange={(e) => { setHostFilter(e.target.value ? Number(e.target.value) : ''); setPage(0); }}
            sx={{
              minWidth: 180,
              '& .MuiOutlinedInput-root': {
                fontSize: '0.8125rem',
                borderRadius: '8px',
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: C.primaryLight },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: C.primary },
              },
              '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
            }}
            label={t('payments.history.filterByHost')}
          >
            <MenuItem value="" sx={{ fontSize: '0.8125rem' }}>{t('payments.history.allHosts')}</MenuItem>
            {hostsList.map((host) => (
              <MenuItem key={host.id} value={host.id} sx={{ fontSize: '0.8125rem' }}>
                {host.fullName}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          size="small"
          type="date"
          label={t('payments.history.dateFrom')}
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }}
          sx={{
            minWidth: 140,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.8125rem',
              borderRadius: '8px',
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: C.primaryLight },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: C.primary },
            },
            '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
          }}
        />
        <TextField
          size="small"
          type="date"
          label={t('payments.history.dateTo')}
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }}
          sx={{
            minWidth: 140,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.8125rem',
              borderRadius: '8px',
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: C.primaryLight },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: C.primary },
            },
            '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
          }}
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

      {/* Data table */}
      <DataFetchWrapper
        loading={loading}
        error={error}
        onRetry={loadData}
        isEmpty={payments.length === 0}
        emptyState={
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
                <ReceiptLongIcon sx={{ fontSize: 28, color: C.primary }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '0.9375rem', color: C.textPrimary, mb: 0.5 }}>
                {t('payments.history.noPayments')}
              </Typography>
              <Typography variant="body2" sx={{ color: C.textSecondary, fontSize: '0.8125rem' }}>
                {t('payments.history.noPaymentsDesc')}
              </Typography>
            </CardContent>
          </Card>
        }
      >
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
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('payments.history.date')}</TableCell>
                <TableCell>Nom Prenom</TableCell>
                <TableCell>{t('payments.history.intervention')}</TableCell>
                <TableCell>{t('payments.history.property')}</TableCell>
                <TableCell align="right">{t('payments.history.amount')}</TableCell>
                <TableCell>{t('payments.history.status')}</TableCell>
                <TableCell align="center">{t('payments.history.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((payment) => (
                <TableRow
                  key={payment.id}
                  sx={getRowSx(payment.status)}
                  onClick={() => navigate(`/interventions/${payment.interventionId}`)}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                      {formatDate(payment.transactionDate)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem', color: C.textPrimary }}>
                      {payment.hostName || '\u2014'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', color: C.textPrimary }}>
                      {payment.interventionTitle}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                      {payment.propertyName}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.875rem', color: C.warning }}>
                      {formatCurrency(payment.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(payment.status)}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <Tooltip title={t('payments.history.viewIntervention')}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/interventions/${payment.interventionId}`);
                          }}
                          sx={{ color: C.textSecondary, '&:hover': { color: C.primary } }}
                        >
                          <VisibilityIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      {(payment.status === 'PENDING' || payment.status === 'PROCESSING') && (
                        <Tooltip title="Payer cette intervention">
                          <span>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePay(payment);
                              }}
                              disabled={processingPayment === payment.interventionId}
                              sx={{
                                color: C.white,
                                bgcolor: C.primary,
                                width: 28,
                                height: 28,
                                '&:hover': { bgcolor: C.primaryDark },
                                '&:disabled': { bgcolor: C.primaryLight, color: C.white, opacity: 0.6 },
                              }}
                            >
                              {processingPayment === payment.interventionId ? (
                                <CircularProgress size={14} sx={{ color: C.white }} />
                              ) : (
                                <PaymentIcon sx={{ fontSize: 16 }} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={totalElements}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage={t('common.all') === 'Tous' ? 'Lignes par page' : 'Rows per page'}
            sx={{
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                fontSize: '0.8125rem',
                color: C.textSecondary,
              },
              '& .MuiTablePagination-select': {
                fontSize: '0.8125rem',
              },
            }}
          />
        </TableContainer>
      </DataFetchWrapper>
    </Box>
  );
};

export default PaymentHistoryPage;
