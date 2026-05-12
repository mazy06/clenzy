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
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  MoneyOff as MoneyOffIcon,
  Receipt as ReceiptIcon,
  ReceiptLong as ReceiptLongIcon,
  Warning as WarningIcon,
  Payment as PaymentIcon,
  AutoAwesome as SparkleIcon,
  Hotel as HotelIcon,
  Assignment as AssignmentIcon,
  Send as SendIcon,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { paymentsApi } from '../../services/api/paymentsApi';
import type { PaymentRecord, PaymentSummary, HostOption } from '../../services/api/paymentsApi';
import { reservationsApi } from '../../services/api/reservationsApi';
import PageHeader from '../../components/PageHeader';
import { FilterSearchBar } from '../../components/FilterSearchBar';
import DataFetchWrapper from '../../components/DataFetchWrapper';
import PaymentCheckoutModal from '../../components/PaymentCheckoutModal';
import { useCurrency } from '../../hooks/useCurrency';

interface PaymentHistoryPageProps {
  embedded?: boolean;
}

const PaymentHistoryPage: React.FC<PaymentHistoryPageProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // ─── Couleurs Clenzy (theme-aware) ──────────────────────────────────────────
  const C = {
    primary: theme.palette.primary.main,
    primaryLight: isDark ? theme.palette.primary.light : '#8BA3B3',
    primaryDark: isDark ? theme.palette.primary.dark : '#5A7684',
    secondary: theme.palette.secondary.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    warningLight: isDark ? theme.palette.warning.light : '#E8C19A',
    error: theme.palette.error.main,
    info: theme.palette.info.main,
    textPrimary: theme.palette.text.primary,
    textSecondary: theme.palette.text.secondary,
    gray50: isDark ? theme.palette.grey[100] : '#F8FAFC',
    gray100: isDark ? theme.palette.grey[200] : '#F1F5F9',
    gray200: isDark ? theme.palette.grey[300] : '#E2E8F0',
    white: isDark ? theme.palette.background.paper : '#ffffff',
  };

  // Role detection
  const isAdminOrManager = user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) ?? false;

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

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<PaymentRecord | null>(null);

  // Payment processing state (kept for compatibility)
  const [processingPayment, setProcessingPayment] = useState<number | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Send payment link state (reservations)
  const [sendingPaymentLink, setSendingPaymentLink] = useState<number | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDialogTarget, setEmailDialogTarget] = useState<PaymentRecord | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  // Refund state
  const [refundingPayment, setRefundingPayment] = useState<number | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<PaymentRecord | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);

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
            (r.description || '').toLowerCase().includes(q) ||
            (r.propertyName || '').toLowerCase().includes(q) ||
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

  const handlePay = (payment: PaymentRecord) => {
    if (!payment.amount || payment.amount <= 0) {
      setPayError("Le montant n'est pas defini pour ce paiement");
      return;
    }
    setPayError(null);
    setPaymentTarget(payment);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentModalOpen(false);
    setPaymentTarget(null);
    loadData(); // Recharger la liste apres paiement
  };

  const openEmailDialog = (payment: PaymentRecord) => {
    setEmailDialogTarget(payment);
    setEmailInput(payment.guestEmail || '');
    setEmailError(null);
    setEmailDialogOpen(true);
  };

  const handleSendPaymentLink = (payment: PaymentRecord) => {
    if (!payment.guestEmail) {
      // Pas d'email connu → ouvrir la modale de saisie
      openEmailDialog(payment);
    } else {
      // Email disponible → envoyer directement
      doSendPaymentLink(payment, payment.guestEmail);
    }
  };

  const doSendPaymentLink = async (payment: PaymentRecord, email?: string) => {
    try {
      setSendingPaymentLink(payment.referenceId);
      setPayError(null);
      await reservationsApi.sendPaymentLink(payment.referenceId, email || undefined);
      setEmailDialogOpen(false);
      setEmailDialogTarget(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi du lien de paiement";
      // Fallback : si l'erreur concerne l'email manquant, ouvrir la modale
      if (!emailDialogOpen && msg.toLowerCase().includes('email')) {
        openEmailDialog(payment);
      } else if (emailDialogOpen) {
        setEmailError(msg);
      } else {
        setPayError(msg);
      }
    } finally {
      setSendingPaymentLink(null);
    }
  };

  const handleEmailDialogConfirm = () => {
    if (!emailDialogTarget) return;
    const trimmed = emailInput.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Veuillez saisir une adresse email valide');
      return;
    }
    setEmailError(null);
    doSendPaymentLink(emailDialogTarget, trimmed);
  };

  const handleRefundClick = (payment: PaymentRecord) => {
    setRefundTarget(payment);
    setRefundDialogOpen(true);
    setRefundError(null);
  };

  const handleRefundConfirm = async () => {
    if (!refundTarget) return;
    try {
      setRefundingPayment(refundTarget.referenceId);
      setRefundError(null);
      await paymentsApi.refund(refundTarget.referenceId);
      setRefundDialogOpen(false);
      setRefundTarget(null);
      loadData(); // Recharger la liste
    } catch (err: unknown) {
      setRefundError(err instanceof Error ? err.message : 'Erreur lors du remboursement');
    } finally {
      setRefundingPayment(null);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const { convertAndFormat } = useCurrency();

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

  // ── Unified color system — everything keyed off payment status ──────────
  const STATUS_HEX: Record<string, string> = {
    PAID: '#4A9B8E',
    PENDING: '#ED6C02',
    PROCESSING: '#0288d1',
    FAILED: '#d32f2f',
    REFUNDED: '#7B61FF',
    CANCELLED: '#757575',
  };

  const STATUS_LABEL: Record<string, string> = {
    PAID: t('payments.history.paid'),
    PENDING: t('payments.history.pending'),
    PROCESSING: t('payments.history.processing'),
    FAILED: t('payments.history.failed'),
    REFUNDED: t('payments.history.refunded'),
    CANCELLED: t('payments.history.cancelled'),
  };

  /** Resolved hex for a given payment status */
  const statusColor = (status: string) => STATUS_HEX[status] || '#757575';

  /** Shared chip styling — used by both Type and Status chips */
  const chipSx = (hex: string) => ({
    backgroundColor: `${hex}18`,
    color: hex,
    border: `1px solid ${hex}40`,
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '0.75rem',
    height: 24,
    '& .MuiChip-icon': { color: hex },
    '& .MuiChip-label': { px: 1 },
  });

  const getStatusChip = (status: PaymentRecord['status']) => (
    <Chip label={STATUS_LABEL[status] || status} size="small" sx={chipSx(statusColor(status))} />
  );

  const getTypeChip = (payment: PaymentRecord) => {
    const hex = statusColor(payment.status); // same color as status
    if (payment.type === 'RESERVATION') {
      return (
        <Chip
          icon={<HotelIcon size={14} strokeWidth={1.75} />}
          label="Reservation"
          size="small"
          sx={chipSx(hex)}
        />
      );
    }
    if (payment.type === 'SERVICE_REQUEST') {
      return (
        <Chip
          icon={<AssignmentIcon size={14} strokeWidth={1.75} />}
          label="Demande"
          size="small"
          sx={chipSx(hex)}
        />
      );
    }
    return (
      <Chip
        icon={<SparkleIcon size={14} strokeWidth={1.75} />}
        label="Intervention"
        size="small"
        sx={chipSx(hex)}
      />
    );
  };

  /** Row styling — left border color matches payment status */
  const getRowSx = (status: PaymentRecord['status']) => ({
    cursor: 'pointer',
    borderLeft: `3px solid ${statusColor(status)}`,
    transition: 'background-color 0.15s ease',
    '&:hover': { bgcolor: 'rgba(107,138,154,0.04)' },
  });

  // ─── Summary cards ────────────────────────────────────────────────────────

  const totalDue = summary.totalPending;

  const summaryCards = isAdminOrManager
    ? [
        {
          label: t('payments.history.totalPaid'),
          value: convertAndFormat(summary.totalPaid, 'EUR'),
          color: C.success,
          icon: <Box component="span" sx={{ display: 'inline-flex', color: C.success }}><CheckCircleIcon size={20} strokeWidth={1.75} /></Box>,
        },
        {
          label: t('payments.history.totalPending'),
          value: convertAndFormat(summary.totalPending, 'EUR'),
          color: C.warning,
          icon: <Box component="span" sx={{ display: 'inline-flex', color: C.warning }}><HourglassEmptyIcon size={20} strokeWidth={1.75} /></Box>,
        },
        {
          label: t('payments.history.totalRefunded'),
          value: convertAndFormat(summary.totalRefunded, 'EUR'),
          color: C.info,
          icon: <Box component="span" sx={{ display: 'inline-flex', color: C.info }}><MoneyOffIcon size={20} strokeWidth={1.75} /></Box>,
        },
        {
          label: t('payments.history.transactions'),
          value: String(summary.transactionCount),
          color: C.primary,
          icon: <Box component="span" sx={{ display: 'inline-flex', color: C.primary }}><ReceiptIcon size={20} strokeWidth={1.75} /></Box>,
        },
      ]
    : [
        {
          label: t('payments.history.totalPaid'),
          value: convertAndFormat(summary.totalPaid, 'EUR'),
          color: C.success,
          icon: <Box component="span" sx={{ display: 'inline-flex', color: C.success }}><CheckCircleIcon size={20} strokeWidth={1.75} /></Box>,
        },
        {
          label: t('payments.history.totalDue'),
          value: convertAndFormat(totalDue, 'EUR'),
          color: totalDue > 0 ? C.error : C.warning,
          icon: <Box component="span" sx={{ display: 'inline-flex', color: totalDue > 0 ? C.error : C.warning }}><WarningIcon size={20} strokeWidth={1.75} /></Box>,
        },
        {
          label: t('payments.history.transactions'),
          value: String(summary.transactionCount),
          color: C.primary,
          icon: <Box component="span" sx={{ display: 'inline-flex', color: C.primary }}><ReceiptIcon size={20} strokeWidth={1.75} /></Box>,
        },
      ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header + Filters */}
      {!embedded && (
        <PageHeader
          title={t('payments.history.title')}
          subtitle={t('payments.history.subtitle')}
          iconBadge={<ReceiptLongIcon />}
          backPath="/dashboard"
          showBackButton={true}
          filters={
            <FilterSearchBar
              bare
              searchTerm={search}
              onSearchChange={(v) => { setSearch(v); setPage(0); }}
              searchPlaceholder={t('payments.history.search')}
              filters={{
                status: {
                  value: statusFilter,
                  options: [
                    { value: '', label: t('payments.history.allStatuses') },
                    { value: 'PAID', label: t('payments.history.paid') },
                    { value: 'PENDING', label: t('payments.history.pending') },
                    { value: 'PROCESSING', label: t('payments.history.processing') },
                    { value: 'FAILED', label: t('payments.history.failed') },
                    { value: 'REFUNDED', label: t('payments.history.refunded') },
                    { value: 'CANCELLED', label: t('payments.history.cancelled') },
                  ],
                  onChange: (v) => { setStatusFilter(v); setPage(0); },
                  label: t('payments.history.status'),
                },
                ...(isAdminOrManager ? {
                  host: {
                    value: hostFilter ? String(hostFilter) : '',
                    options: [
                      { value: '', label: t('payments.history.allHosts') },
                      ...hostsList.map((h) => ({ value: String(h.id), label: h.fullName })),
                    ],
                    onChange: (v) => { setHostFilter(v ? Number(v) : ''); setPage(0); },
                    label: t('payments.history.filterByHost'),
                  },
                } : {}),
              }}
              counter={{
                label: t('payments.history.payment') || 'paiement',
                count: totalElements,
                singular: '',
                plural: 's',
              }}
            />
          }
        />
      )}

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
                <Box component="span" sx={{ display: 'inline-flex', color: C.primary }}><ReceiptLongIcon size={28} strokeWidth={1.75} /></Box>
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
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>{t('payments.history.property')}</TableCell>
                <TableCell align="right">{t('payments.history.amount')}</TableCell>
                <TableCell>{t('payments.history.status')}</TableCell>
                <TableCell align="center">{t('payments.history.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((payment) => {
                const detailPath = payment.type === 'RESERVATION'
                  ? `/reservations/${payment.referenceId}`
                  : payment.type === 'SERVICE_REQUEST'
                    ? `/service-requests/${payment.referenceId}`
                    : `/interventions/${payment.referenceId}`;
                return (
                <TableRow
                  key={`${payment.type}-${payment.id}`}
                  sx={getRowSx(payment.status)}
                  onClick={() => navigate(detailPath)}
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
                  <TableCell>{getTypeChip(payment)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', color: C.textPrimary }}>
                      {payment.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                      {payment.propertyName}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.875rem', color: statusColor(payment.status) }}>
                      {convertAndFormat(payment.amount, payment.currency ?? 'EUR')}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(payment.status)}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <Tooltip title={payment.type === 'RESERVATION' ? 'Voir la reservation' : payment.type === 'SERVICE_REQUEST' ? 'Voir la demande' : t('payments.history.viewIntervention')}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(detailPath);
                          }}
                          sx={{ color: C.textSecondary, '&:hover': { color: C.primary } }}
                        >
                          <VisibilityIcon size={18} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                      {payment.type === 'RESERVATION' && (payment.status === 'PENDING' || payment.status === 'PROCESSING') && (
                        <Tooltip title="Envoyer le lien de paiement par email">
                          <span>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendPaymentLink(payment);
                              }}
                              disabled={sendingPaymentLink === payment.referenceId}
                              sx={{
                                color: C.white,
                                bgcolor: C.info,
                                width: 28,
                                height: 28,
                                '&:hover': { bgcolor: theme.palette.info.dark },
                                '&:disabled': { bgcolor: theme.palette.info.light, color: C.white, opacity: 0.6 },
                              }}
                            >
                              {sendingPaymentLink === payment.referenceId ? (
                                <CircularProgress size={14} sx={{ color: C.white }} />
                              ) : (
                                <SendIcon size={16} strokeWidth={1.75} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {payment.type !== 'RESERVATION' && (payment.status === 'PENDING' || payment.status === 'PROCESSING') && (
                        <Tooltip title={payment.type === 'SERVICE_REQUEST' ? 'Payer cette demande' : 'Payer cette intervention'}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePay(payment);
                              }}
                              disabled={processingPayment === payment.referenceId}
                              sx={{
                                color: C.white,
                                bgcolor: C.primary,
                                width: 28,
                                height: 28,
                                '&:hover': { bgcolor: C.primaryDark },
                                '&:disabled': { bgcolor: C.primaryLight, color: C.white, opacity: 0.6 },
                              }}
                            >
                              {processingPayment === payment.referenceId ? (
                                <CircularProgress size={14} sx={{ color: C.white }} />
                              ) : (
                                <PaymentIcon size={16} strokeWidth={1.75} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {isAdminOrManager && payment.type === 'INTERVENTION' && payment.status === 'PAID' && (
                        <Tooltip title="Rembourser">
                          <span>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRefundClick(payment);
                              }}
                              disabled={refundingPayment === payment.referenceId}
                              sx={{
                                color: C.white,
                                bgcolor: C.error,
                                width: 28,
                                height: 28,
                                '&:hover': { bgcolor: theme.palette.error.dark },
                                '&:disabled': { bgcolor: theme.palette.error.light, color: C.white, opacity: 0.6 },
                              }}
                            >
                              {refundingPayment === payment.referenceId ? (
                                <CircularProgress size={14} sx={{ color: C.white }} />
                              ) : (
                                <MoneyOffIcon size={16} strokeWidth={1.75} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
                );
              })}
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

      {/* Modal de paiement Stripe Embedded */}
      {paymentTarget && (
        <PaymentCheckoutModal
          open={paymentModalOpen}
          onClose={() => { setPaymentModalOpen(false); setPaymentTarget(null); }}
          onSuccess={handlePaymentSuccess}
          interventionId={paymentTarget.type === 'SERVICE_REQUEST' ? undefined : paymentTarget.referenceId}
          serviceRequestId={paymentTarget.type === 'SERVICE_REQUEST' ? paymentTarget.referenceId : undefined}
          amount={paymentTarget.amount}
          interventionTitle={paymentTarget.description}
        />
      )}

      {/* Dialog de confirmation de remboursement */}
      <Dialog
        open={refundDialogOpen}
        onClose={() => { setRefundDialogOpen(false); setRefundTarget(null); setRefundError(null); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>
          Confirmer le remboursement
        </DialogTitle>
        <DialogContent>
          {refundTarget && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              Voulez-vous rembourser <strong>{convertAndFormat(refundTarget.amount, refundTarget.currency ?? 'EUR')}</strong> pour
              <strong> {refundTarget.description}</strong> ?
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            Cette action est irréversible. Le montant sera remboursé via Stripe.
          </Typography>
          {refundError && (
            <Alert severity="error" sx={{ mt: 1.5, py: 0.5 }}>
              {refundError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => { setRefundDialogOpen(false); setRefundTarget(null); setRefundError(null); }}
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleRefundConfirm}
            variant="contained"
            color="error"
            size="small"
            disabled={refundingPayment !== null}
            sx={{ textTransform: 'none' }}
          >
            {refundingPayment !== null ? <CircularProgress size={18} /> : 'Rembourser'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de saisie d'email pour envoi du lien de paiement */}
      <Dialog
        open={emailDialogOpen}
        onClose={() => { setEmailDialogOpen(false); setEmailDialogTarget(null); setEmailError(null); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>
          Email du client
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Aucune adresse email n'est renseignée pour cette réservation. Veuillez saisir l'email du client pour envoyer le lien de paiement.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            type="email"
            label="Adresse email"
            placeholder="guest@example.com"
            value={emailInput}
            onChange={(e) => { setEmailInput(e.target.value); setEmailError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleEmailDialogConfirm(); }}
            error={!!emailError}
            helperText={emailError}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '0.875rem',
                borderRadius: '8px',
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => { setEmailDialogOpen(false); setEmailDialogTarget(null); setEmailError(null); }}
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleEmailDialogConfirm}
            variant="contained"
            size="small"
            disabled={sendingPaymentLink !== null}
            sx={{
              textTransform: 'none',
              bgcolor: C.info,
              '&:hover': { bgcolor: theme.palette.info.dark },
            }}
          >
            {sendingPaymentLink !== null ? <CircularProgress size={18} /> : 'Envoyer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PaymentHistoryPage;
