import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
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
  Button,
  CircularProgress,
  Alert,
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
import StatTile from '../../components/StatTile';
import EmptyState from '../../components/EmptyState';
import { Money } from '../../components/Money';

interface PaymentHistoryPageProps {
  embedded?: boolean;
}

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

// ── Statuts → tokens sémantiques Signature (chips -soft : texte couleur + fond -soft) ──
const STATUS_TOKEN: Record<string, { fg: string; bg: string }> = {
  PAID: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  PENDING: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  PROCESSING: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  FAILED: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  REFUNDED: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  // Neutre : pas de token sémantique dédié — repli muted/hover (pattern manquant signalé)
  CANCELLED: { fg: 'var(--muted)', bg: 'var(--hover)' },
};

/** Chip -soft : texte couleur + fond -soft (pilule/typo via thème global MuiChip) */
const chipSx = (fg: string, bg: string) => ({
  backgroundColor: bg,
  color: fg,
  '& .MuiChip-icon': { color: fg, marginLeft: '6px' },
});

/** Row styling — status passe par le chip dans la colonne dédiée, pas un side-stripe.
 *  Le hover --hover vient du thème global MuiTableRow. */
const getRowSx = (_status: PaymentRecord['status']) => ({
  cursor: 'pointer',
});

const PaymentHistoryPage: React.FC<PaymentHistoryPageProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

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
  // Cible du dialog email : instance value lue uniquement dans les handlers
  // (l'ouverture du dialog est pilotee par emailDialogOpen) — ref, pas de re-render.
  const emailDialogTargetRef = useRef<PaymentRecord | null>(null);
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
    emailDialogTargetRef.current = payment;
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
      emailDialogTargetRef.current = null;
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
    const target = emailDialogTargetRef.current;
    if (!target) return;
    const trimmed = emailInput.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Veuillez saisir une adresse email valide');
      return;
    }
    setEmailError(null);
    doSendPaymentLink(target, trimmed);
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

  const STATUS_LABEL: Record<string, string> = {
    PAID: t('payments.history.paid'),
    PENDING: t('payments.history.pending'),
    PROCESSING: t('payments.history.processing'),
    FAILED: t('payments.history.failed'),
    REFUNDED: t('payments.history.refunded'),
    CANCELLED: t('payments.history.cancelled'),
  };

  const getStatusChip = (status: PaymentRecord['status']) => {
    const tk = STATUS_TOKEN[status] ?? STATUS_TOKEN.CANCELLED;
    return <Chip label={STATUS_LABEL[status] || status} size="small" sx={chipSx(tk.fg, tk.bg)} />;
  };

  /** Type → accent palette Clenzy (fond soft dérivé du hex, sans border) */
  const typeChipSx = (hex: string) => chipSx(hex, `${hex}18`);

  const getTypeChip = (payment: PaymentRecord) => {
    if (payment.type === 'RESERVATION') {
      return (
        <Chip
          icon={<HotelIcon size={14} strokeWidth={1.75} />}
          label="Reservation"
          size="small"
          sx={typeChipSx('#7BA3C2')}
        />
      );
    }
    if (payment.type === 'SERVICE_REQUEST') {
      return (
        <Chip
          icon={<AssignmentIcon size={14} strokeWidth={1.75} />}
          label="Demande"
          size="small"
          sx={typeChipSx('#D4A574')}
        />
      );
    }
    return (
      <Chip
        icon={<SparkleIcon size={14} strokeWidth={1.75} />}
        label="Intervention"
        size="small"
        sx={typeChipSx('#6B8A9A')}
      />
    );
  };

  // ─── Summary cards ────────────────────────────────────────────────────────

  const totalDue = summary.totalPending;

  // KPI StatTile — couleurs = palette accents Clenzy validée
  const summaryCards = isAdminOrManager
    ? [
        {
          label: t('payments.history.totalPaid'),
          value: <Money value={summary.totalPaid} from="EUR" />,
          color: '#4A9B8E',
          icon: <CheckCircleIcon />,
        },
        {
          label: t('payments.history.totalPending'),
          value: <Money value={summary.totalPending} from="EUR" />,
          color: '#D4A574',
          icon: <HourglassEmptyIcon />,
        },
        {
          label: t('payments.history.totalRefunded'),
          value: <Money value={summary.totalRefunded} from="EUR" />,
          color: '#7BA3C2',
          icon: <MoneyOffIcon />,
        },
        {
          label: t('payments.history.transactions'),
          value: String(summary.transactionCount),
          color: '#6B8A9A',
          icon: <ReceiptIcon />,
        },
      ]
    : [
        {
          label: t('payments.history.totalPaid'),
          value: <Money value={summary.totalPaid} from="EUR" />,
          color: '#4A9B8E',
          icon: <CheckCircleIcon />,
        },
        {
          label: t('payments.history.totalDue'),
          value: <Money value={totalDue} from="EUR" />,
          color: totalDue > 0 ? '#C97A7A' : '#D4A574',
          icon: <WarningIcon />,
        },
        {
          label: t('payments.history.transactions'),
          value: String(summary.transactionCount),
          color: '#6B8A9A',
          icon: <ReceiptIcon />,
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
          sx={{
            mb: 2,
            // Alerte -soft hairline (pattern .rm-conflict)
            bgcolor: 'var(--err-soft)',
            border: '1px solid color-mix(in srgb, var(--err) 30%, transparent)',
            borderRadius: '12px',
            color: 'var(--body)',
            fontSize: '12.5px',
            '& .MuiAlert-icon': { color: 'var(--err)' },
          }}
          onClose={() => setPayError(null)}
        >
          {payError}
        </Alert>
      )}

      {/* KPIs (StatTile baseline) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, mb: 2 }}>
        {summaryCards.map((card) => (
          <StatTile
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            color={card.color}
            loading={loading}
          />
        ))}
      </Box>

      {/* Data table */}
      <DataFetchWrapper
        loading={loading}
        error={error}
        onRetry={loadData}
        variant="skeleton"
        isEmpty={payments.length === 0}
        emptyState={
          <EmptyState
            icon={<ReceiptLongIcon />}
            title={t('payments.history.noPayments')}
            description={t('payments.history.noPaymentsDesc')}
            variant="plain"
          />
        }
      >
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
                    <Typography variant="body2" sx={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDate(payment.transactionDate)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--ink)' }}>
                      {payment.hostName || '\u2014'}
                    </Typography>
                  </TableCell>
                  <TableCell>{getTypeChip(payment)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.125 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--ink)', lineHeight: 1.3 }}
                      >
                        {payment.description}
                      </Typography>
                      {payment.subDescription && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '11px',
                            color: 'var(--muted)',
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1.2,
                          }}
                        >
                          {payment.subDescription}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '12.5px', color: 'var(--body)' }}>
                      {payment.propertyName}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {/* Montant : display tabular-nums, encre \u2014 jamais proportional */}
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'var(--font-display)',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        color: 'var(--ink)',
                      }}
                    >
                      <Money value={payment.amount} from={payment.currency ?? 'EUR'} />
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
                                color: 'var(--info)',
                                '&:hover': { bgcolor: 'var(--info-soft)', color: 'var(--info)' },
                                '&.Mui-disabled': { opacity: 0.45 },
                              }}
                            >
                              {sendingPaymentLink === payment.referenceId ? (
                                <CircularProgress size={14} sx={{ color: 'var(--info)' }} />
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
                                color: 'var(--accent)',
                                '&:hover': { bgcolor: 'var(--accent-soft)', color: 'var(--accent)' },
                                '&.Mui-disabled': { opacity: 0.45 },
                              }}
                            >
                              {processingPayment === payment.referenceId ? (
                                <CircularProgress size={14} sx={{ color: 'var(--accent)' }} />
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
                                color: 'var(--err)',
                                '&:hover': { bgcolor: 'var(--err-soft)', color: 'var(--err)' },
                                '&.Mui-disabled': { opacity: 0.45 },
                              }}
                            >
                              {refundingPayment === payment.referenceId ? (
                                <CircularProgress size={14} sx={{ color: 'var(--err)' }} />
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
            sx={{ borderTop: '1px solid var(--line)' }}
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
      >
        <DialogTitle>
          Confirmer le remboursement
        </DialogTitle>
        <DialogContent>
          {refundTarget && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              Voulez-vous rembourser <strong><Money value={refundTarget.amount} from={refundTarget.currency ?? 'EUR'} /></strong> pour
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
        <DialogActions>
          <Button
            onClick={() => { setRefundDialogOpen(false); setRefundTarget(null); setRefundError(null); }}
            size="small"
          >
            Annuler
          </Button>
          <Button
            onClick={handleRefundConfirm}
            variant="contained"
            color="error"
            size="small"
            disabled={refundingPayment !== null}
          >
            {refundingPayment !== null ? <CircularProgress size={18} /> : 'Rembourser'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de saisie d'email pour envoi du lien de paiement */}
      <Dialog
        open={emailDialogOpen}
        onClose={() => { setEmailDialogOpen(false); emailDialogTargetRef.current = null; setEmailError(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
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
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => { setEmailDialogOpen(false); emailDialogTargetRef.current = null; setEmailError(null); }}
            size="small"
          >
            Annuler
          </Button>
          <Button
            onClick={handleEmailDialogConfirm}
            variant="contained"
            size="small"
            disabled={sendingPaymentLink !== null}
          >
            {sendingPaymentLink !== null ? <CircularProgress size={18} /> : 'Envoyer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PaymentHistoryPage;
