import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { paymentsApi } from '../../services/api/paymentsApi';
import type { PaymentRecord, PaymentSummary, HostOption } from '../../services/api/paymentsApi';
import PageHeader from '../../components/PageHeader';
import DataFetchWrapper from '../../components/DataFetchWrapper';

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
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusChip = (status: PaymentRecord['status']) => {
    const config: Record<string, { color: 'success' | 'warning' | 'error' | 'info' | 'default'; label: string }> = {
      PAID: { color: 'success', label: t('payments.history.paid') },
      PENDING: { color: 'warning', label: t('payments.history.pending') },
      PROCESSING: { color: 'info', label: t('payments.history.processing') },
      FAILED: { color: 'error', label: t('payments.history.failed') },
      REFUNDED: { color: 'info', label: t('payments.history.refunded') },
      CANCELLED: { color: 'default', label: t('payments.history.cancelled') },
    };
    const c = config[status] || { color: 'default' as const, label: status };
    return <Chip label={c.label} color={c.color} size="small" />;
  };

  /** Row styling for unpaid highlighting */
  const getRowSx = (status: PaymentRecord['status']) => {
    if (status === 'PENDING' || status === 'PROCESSING') {
      return {
        cursor: 'pointer',
        borderLeft: '4px solid #ff9800',
        backgroundColor: 'rgba(255, 152, 0, 0.04)',
      };
    }
    if (status === 'FAILED') {
      return {
        cursor: 'pointer',
        borderLeft: '4px solid #f44336',
        backgroundColor: 'rgba(244, 67, 54, 0.04)',
      };
    }
    return { cursor: 'pointer' };
  };

  // ─── Summary cards ────────────────────────────────────────────────────────

  const totalDue = summary.totalPending;

  const summaryCards = isAdminOrManager
    ? [
        {
          label: t('payments.history.totalPaid'),
          value: formatCurrency(summary.totalPaid),
          color: '#4caf50',
          icon: <CheckCircleIcon sx={{ fontSize: 28, color: '#4caf50' }} />,
        },
        {
          label: t('payments.history.totalPending'),
          value: formatCurrency(summary.totalPending),
          color: '#ff9800',
          icon: <HourglassEmptyIcon sx={{ fontSize: 28, color: '#ff9800' }} />,
        },
        {
          label: t('payments.history.totalRefunded'),
          value: formatCurrency(summary.totalRefunded),
          color: '#2196f3',
          icon: <MoneyOffIcon sx={{ fontSize: 28, color: '#2196f3' }} />,
        },
        {
          label: t('payments.history.transactions'),
          value: String(summary.transactionCount),
          color: '#9c27b0',
          icon: <ReceiptIcon sx={{ fontSize: 28, color: '#9c27b0' }} />,
        },
      ]
    : [
        // HOST view: Total paid, Total due (orange/red), Transactions
        {
          label: t('payments.history.totalPaid'),
          value: formatCurrency(summary.totalPaid),
          color: '#4caf50',
          icon: <CheckCircleIcon sx={{ fontSize: 28, color: '#4caf50' }} />,
        },
        {
          label: t('payments.history.totalDue'),
          value: formatCurrency(totalDue),
          color: totalDue > 0 ? '#f44336' : '#ff9800',
          icon: <WarningIcon sx={{ fontSize: 28, color: totalDue > 0 ? '#f44336' : '#ff9800' }} />,
        },
        {
          label: t('payments.history.transactions'),
          value: String(summary.transactionCount),
          color: '#9c27b0',
          icon: <ReceiptIcon sx={{ fontSize: 28, color: '#9c27b0' }} />,
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

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} md={isAdminOrManager ? 3 : 4} key={card.label}>
            <Card
              sx={{
                borderLeft: `4px solid ${card.color}`,
                height: '100%',
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
                {card.icon}
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.2 }}>
                    {card.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    {card.label}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder={t('payments.history.search')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
          }}
          sx={{ minWidth: 220, flex: 1 }}
        />
        <TextField
          select
          size="small"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          sx={{ minWidth: 160 }}
          label={t('payments.history.status')}
        >
          <MenuItem value="">{t('payments.history.allStatuses')}</MenuItem>
          <MenuItem value="PAID">{t('payments.history.paid')}</MenuItem>
          <MenuItem value="PENDING">{t('payments.history.pending')}</MenuItem>
          <MenuItem value="PROCESSING">{t('payments.history.processing')}</MenuItem>
          <MenuItem value="FAILED">{t('payments.history.failed')}</MenuItem>
          <MenuItem value="REFUNDED">{t('payments.history.refunded')}</MenuItem>
          <MenuItem value="CANCELLED">{t('payments.history.cancelled')}</MenuItem>
        </TextField>

        {/* Host filter — ADMIN/MANAGER only */}
        {isAdminOrManager && (
          <TextField
            select
            size="small"
            value={hostFilter}
            onChange={(e) => { setHostFilter(e.target.value ? Number(e.target.value) : ''); setPage(0); }}
            sx={{ minWidth: 200 }}
            label={t('payments.history.filterByHost')}
          >
            <MenuItem value="">{t('payments.history.allHosts')}</MenuItem>
            {hostsList.map((host) => (
              <MenuItem key={host.id} value={host.id}>
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
          sx={{ minWidth: 150 }}
        />
        <TextField
          size="small"
          type="date"
          label={t('payments.history.dateTo')}
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        {hasActiveFilters && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={handleClearFilters}
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
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <ReceiptLongIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('payments.history.noPayments')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('payments.history.noPaymentsDesc')}
            </Typography>
          </Paper>
        }
      >
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('payments.history.date')}</TableCell>
                {isAdminOrManager && <TableCell>{t('payments.history.hostColumn')}</TableCell>}
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
                  hover
                  sx={getRowSx(payment.status)}
                  onClick={() => navigate(`/interventions/${payment.interventionId}`)}
                >
                  <TableCell>{formatDate(payment.transactionDate)}</TableCell>
                  {isAdminOrManager && (
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {payment.hostName || '—'}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {payment.interventionTitle}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{payment.propertyName}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      {formatCurrency(payment.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(payment.status)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={t('payments.history.viewIntervention')}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/interventions/${payment.interventionId}`);
                        }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
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
          />
        </TableContainer>
      </DataFetchWrapper>
    </Box>
  );
};

export default PaymentHistoryPage;
