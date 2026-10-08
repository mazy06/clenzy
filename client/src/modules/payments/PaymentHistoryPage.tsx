import { financeEventArtwork } from '../billing/components/financeEventArtwork';
import FinanceHeaderFilters from '../billing/components/FinanceHeaderFilters';
import FinanceWorkspace from '../billing/components/FinanceWorkspace';
import { FinanceAmountKpis } from '../billing/components/FinanceKpis';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import FinanceStatusIcon from '../billing/components/FinanceStatusIcon';
import { Alert as UiAlert, AlertAction, AlertDescription } from '../../components/ui';
import { TriangleAlert, X } from '../../icons/glyphs';
import { Spinner } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { Button } from '../../components/ui';
import { Field, FieldError, FieldLabel, Input } from '../../components/ui';
import {
  ReceiptLong as ReceiptLongIcon,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { paymentsApi } from '../../services/api/paymentsApi';
import type { PaymentRecord, HostOption } from '../../services/api/paymentsApi';
import { reservationsApi } from '../../services/api/reservationsApi';
import PageHeader from '../../components/PageHeader';
import { FilterSearchBar } from '../../components/FilterSearchBar';
import DataFetchWrapper from '../../components/DataFetchWrapper';
import PaymentCheckoutModal from '../../components/PaymentCheckoutModal';
import EmptyState from '../../components/EmptyState';
import { Money } from '../../components/Money';
import PagePagination from '../../components/PagePagination';
import { activeIntlLocale } from '../../utils/activeLocale';
import { FinanceBatchPanel } from './FinanceBatchPanel';
import { payableItems, prepareBatchPayments } from './batchPayments';
import PaymentRecordDetail, { PaymentRecordActions } from './PaymentRecordDetail';
import { useRefundFollowUp } from './useRefundFollowUp';
import BaitlyVerifyPayment from './BaitlyVerifyPayment';

interface PaymentHistoryPageProps {
  embedded?: boolean;
}

const PaymentHistoryPage: React.FC<PaymentHistoryPageProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Role detection
  const isAdminOrManager = user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) ?? false;

  // Data state
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const requestVersion = useRef(0);

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
  const [refundAmount, setRefundAmount] = useState('');
  const refundRequestId = useRef('');
  const [refundSeries, setRefundSeries] = useState<Record<number,string>>({});
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundNotice, setRefundNotice] = useState<string | null>(null);
  const [pendingRefundIds, setPendingRefundIds] = useState<number[]>([]);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const filteredPayments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? allPayments.filter(record => [record.description, record.propertyName, record.hostName]
      .some(value => value?.toLocaleLowerCase().includes(query))) : allPayments;
  }, [allPayments, search]);
  const totalElements = filteredPayments.length;
  const payments = filteredPayments.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  // ─── Load hosts list for ADMIN/MANAGER ──────────────────────────────────────

  useEffect(() => {
    if (isAdminOrManager) {
      paymentsApi.getHosts().then(setHostsList).catch(() => setHostsList([]));
    }
  }, [isAdminOrManager]);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const loadData = useCallback(async (background = false) => {
    const version = ++requestVersion.current;
    try {
      if (!background) setLoading(true);
      setError(null);

      const historyRes = await paymentsApi.getAllHistory({
          status: statusFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          hostId: hostFilter || undefined,
        });

      if (requestVersion.current !== version) return;
      setAllPayments(historyRes);
    } catch {
      if (requestVersion.current !== version) return;
      setAllPayments([]);
      setError(t('payments.errors.load'));
    } finally {
      if (requestVersion.current === version) setLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo, hostFilter]);

  useEffect(() => {
    loadData();
    return () => { requestVersion.current++; };
  }, [loadData]);

  // Les confirmations PSP arrivent après le Checkout : rafraîchir aussi le dossier sélectionné.
  useEffect(() => {
    if (loading || paymentModalOpen || refundDialogOpen || emailDialogOpen) return;
    let running = false;
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || running) return;
      running = true;
      try { await loadData(true); } finally { running = false; }
    };
    const timer = window.setInterval(refresh, 20_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadData, loading, paymentModalOpen, refundDialogOpen, emailDialogOpen]);

  const handleRefundsConfirmed = useCallback((ids: number[]) => {
    setPendingRefundIds(current => current.filter(id => !ids.includes(id)));
    if (refundTarget && ids.includes(refundTarget.referenceId)) {
      setRefundDialogOpen(false);
      setRefundTarget(null);
      setRefundNotice(null);
    }
    void loadData();
  }, [loadData, refundTarget]);
  useRefundFollowUp(pendingRefundIds, handleRefundsConfirmed, refundSeries);

  useEffect(() => { setPage(0); }, [search, statusFilter, dateFrom, dateTo, hostFilter]);
  useEffect(() => { setPage(current => Math.min(current, Math.max(0, Math.ceil(totalElements / rowsPerPage) - 1))); }, [totalElements, rowsPerPage]);
  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  const handlePay = (payment: PaymentRecord) => {
    if (!Number.isFinite(payment.payableAmount ?? payment.amount) || (payment.payableAmount ?? payment.amount) <= 0) {
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
      setEmailError(t('payments.errors.invalidEmail'));
      return;
    }
    setEmailError(null);
    doSendPaymentLink(target, trimmed);
  };

  const handleRefundClick = (payment: PaymentRecord) => {
    setRefundTarget(payment);
    setRefundAmount(Math.max(0,payment.amount-(payment.refundedAmount??0)).toFixed(2));
    refundRequestId.current=crypto.randomUUID();
    setRefundDialogOpen(true);
    setRefundError(null);
    setRefundNotice(null);
  };

  const handleRefundConfirm = async () => {
    if (!refundTarget || refundingPayment !== null || refundNotice || pendingRefundIds.includes(refundTarget.referenceId)) return;
    try {
      const amount=Number(refundAmount.replace(',','.'));
      const available=refundTarget.amount-(refundTarget.refundedAmount??0);
      if (!refundTarget.supportsPartialRefund && amount !== refundTarget.amount) {
        setRefundError(t('payments.refundFullOnly')); return;
      }
      if(!Number.isFinite(amount) || amount<=0 || amount>available || !/^\d+(?:[.,]\d{1,2})?$/.test(refundAmount)) {
        setRefundError(t('payments.refundAmountInvalid')); return;
      }
      setRefundingPayment(refundTarget.referenceId);
      setRefundError(null);
      const isSeries=refundTarget.refundAcrossReceipts || (refundTarget.refundedAmount??0)>0 || amount!==refundTarget.amount;
      const result = isSeries ? await paymentsApi.refundInstallment(refundTarget.referenceId,amount,refundRequestId.current)
        : await paymentsApi.refund(refundTarget.referenceId);
      if('refundReference' in result) setRefundSeries(current=>({...current,[refundTarget.referenceId]:String(result.refundReference)}));
      setPendingRefundIds(current => current.includes(refundTarget.referenceId) ? current : [...current, refundTarget.referenceId]);
      setRefundNotice(result.status === 'PROCESSING' ? result.message : t('payments.refundSynchronizing'));
    } catch (err: unknown) {
      setRefundError(err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message : t('payments.errors.refund'));
    } finally {
      setRefundingPayment(null);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const STATUS_LABEL: Record<string, string> = {
    UNKNOWN: t('payments.collection.verify'),
    PARTIALLY_PAID: t('payments.collection.partial'),
    NOT_REQUIRED: t('payments.collection.notRequired'),
    PAID: t('payments.history.paid'),
    PENDING: t('payments.history.pending'),
    PROCESSING: t('payments.history.processing'),
    FAILED: t('payments.history.failed'),
    REFUNDED: t('payments.history.refunded'),
    PARTIALLY_REFUNDED: t('payments.history.partiallyRefunded'),
    CANCELLED: t('payments.history.cancelled'),
  };

  const getStatusIcon = (payment: PaymentRecord) => {
    const paidToOta = payment.status === 'PAID' && payment.paymentCollection === 'CHANNEL';
    const label = paidToOta ? t('payments.collection.paidToOta')
      : payment.type === 'RESERVATION' && payment.status === 'PENDING' ? t('payments.collection.toCollect')
      : STATUS_LABEL[payment.status] || payment.status;
    return <FinanceStatusIcon value={paidToOta ? 'CHANNEL' : payment.status}
      label={[label, payment.settlementStatus === 'EXTERNAL_UNVERIFIED' ? t('payments.collection.settlementUnverified') : null].filter(Boolean).join(' · ')} />;
  };

  const filterControls = <FilterSearchBar
              bare
              searchTerm={search}
              onSearchChange={(v) => { setSearch(v); setPage(0); }}
              searchPlaceholder={t('payments.history.search')}
              filters={{
                status: {
                  value: statusFilter,
                  options: [
                    { value: '', label: t('payments.history.allStatuses') },
                    { value: 'UNKNOWN', label: t('payments.collection.verify') },
                    { value: 'PAID', label: t('payments.history.paid') },
                    { value: 'PENDING', label: t('payments.history.pending') },
                    { value: 'PROCESSING', label: t('payments.history.processing') },
                    { value: 'FAILED', label: t('payments.history.failed') },
                    { value: 'REFUNDED', label: t('payments.history.refunded') },
                    { value: 'PARTIALLY_REFUNDED', label: t('payments.history.partiallyRefunded') },
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
                label: t('payments.history.payment', 'paiement'),
                count: totalElements,
                singular: '',
                plural: 's',
              }}
            />;

  // ─── Render ───────────────────────────────────────────────────────────────

  const makePaymentRecord = (payment: PaymentRecord) => {
    const detailPath = payment.type === 'RESERVATION'
      ? `/reservations/${payment.referenceId}`
      : payment.type === 'SERVICE_REQUEST' ? `/service-requests/${payment.referenceId}` : `/interventions/${payment.referenceId}`;
    return {
      id: `${payment.type}-${payment.id}`,
      title: payment.description,
      subtitle: payment.subDescription,
      eventImage: financeEventArtwork(payment.description, payment.type),
      identity: {
        propertyName: payment.propertyName,
        interventionId: payment.type === 'INTERVENTION' ? payment.referenceId : undefined,
        reservationId: payment.type === 'RESERVATION' ? payment.referenceId : undefined,
        serviceRequestId: payment.type === 'SERVICE_REQUEST' ? payment.referenceId : undefined,
      },
      amount: new Intl.NumberFormat(activeIntlLocale(), { style: 'currency', currency: payment.currency || 'EUR' }).format(payment.amount),
      status: getStatusIcon(payment),
      fields: [],
      headerActions: <PaymentRecordActions onView={() => navigate(detailPath)}
        onRefund={() => handleRefundClick(payment)} canRefund={isAdminOrManager && payment.type === 'INTERVENTION' && ['PAID','PARTIALLY_REFUNDED'].includes(payment.status)
          && (payment.supportsPartialRefund === true || !(payment.refundedAmount! > 0))
          && !payment.paymentDisputed && !payment.refundReviewRequired && (payment.refundedAmount??0)<payment.amount && !(payment.refundPendingAmount! > 0)}
        refunding={refundingPayment === payment.referenceId || pendingRefundIds.includes(payment.referenceId)}>
          {isAdminOrManager && payment.type === 'INTERVENTION' && payment.stripeSessionId && ['PAID','PROCESSING'].includes(payment.status)
            && <BaitlyVerifyPayment key={payment.stripeSessionId} session={payment.stripeSessionId} onVerified={() => { void loadData(true); }} />}
        </PaymentRecordActions>,
      detailBody: <PaymentRecordDetail key={`${payment.type}-${payment.id}`} payment={payment} status={getStatusIcon(payment)}
        onPay={() => handlePay(payment)}
        onSendLink={() => handleSendPaymentLink(payment)}
        sending={sendingPaymentLink === payment.referenceId}
        processing={processingPayment === payment.referenceId} />,
    };
  };
  const selectedPayment = filteredPayments.find(payment => `${payment.type}-${payment.id}` === String(selectedId));

  return (
    <div className="payment-history-page">
      {embedded && <FinanceHeaderFilters>{filterControls}</FinanceHeaderFilters>}
      {/* Header + Filters */}
      {!embedded && (
        <PageHeader
          inlineControls={filterControls}
          title={t('payments.history.title')}
          subtitle={t('payments.history.subtitle')}
          iconBadge={<ReceiptLongIcon />}
          backPath="/dashboard"
          showBackButton={true}

        />
      )}

      {payError && (
        <UiAlert variant="destructive" className="mb-3 text-[12.5px]">
          <TriangleAlert />
          <AlertDescription>{payError}</AlertDescription>
          <AlertAction>
            <Button variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setPayError(null)}>
              <X />
            </Button>
          </AlertAction>
        </UiAlert>
      )}

      {/* KPIs (StatTile baseline) */}
      {!error && <FinanceAmountKpis kind="payments" records={filteredPayments.map(row => ({ ...row, dueAmount: row.payableAmount, paidToOta: row.type === 'RESERVATION' && row.paymentCollection === 'CHANNEL' }))} loading={loading} />}

      {/* Data table */}
      <FinanceBatchPanel placement={embedded ? 'header' : 'inline'} title={t('financeBatch.payments')} actionLabel={t('financeBatch.preparePayments')}
        disabled={loading || !!error} items={payableItems(payments)}
        loadAll={async () => {
          const all = await paymentsApi.getAllHistory({ status: statusFilter || undefined, hostId: hostFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
          const term = search.trim().toLowerCase();
          return payableItems(all.filter(item => (!dateFrom || item.transactionDate?.slice(0, 10) >= dateFrom)
            && (!dateTo || item.transactionDate?.slice(0, 10) <= dateTo)
            && (!term || [item.description, item.propertyName, item.hostName].some(value => value?.toLowerCase().includes(term)))));
        }} onExecute={prepareBatchPayments} />
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
        <FinanceWorkspace artwork="received" items={payments.map(makePaymentRecord)}
          onPageSizeChange={setRowsPerPage} selectedId={selectedId} onSelect={setSelectedId}
          selectedRecord={selectedPayment ? makePaymentRecord(selectedPayment) : undefined}
          pagination={<><PagePagination
            count={totalElements}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            hideOnSinglePage={false}
            compact
          /></>} />
      </DataFetchWrapper>

      {/* Modal de paiement Stripe Embedded */}
      {paymentTarget && (
        <PaymentCheckoutModal
          open={paymentModalOpen}
          onClose={() => { setPaymentModalOpen(false); setPaymentTarget(null); }}
          onSuccess={handlePaymentSuccess}
          interventionId={paymentTarget.type === 'SERVICE_REQUEST' ? undefined : paymentTarget.referenceId}
          serviceRequestId={paymentTarget.type === 'SERVICE_REQUEST' ? paymentTarget.referenceId : undefined}
          amount={paymentTarget.payableAmount ?? paymentTarget.amount}
          currency={paymentTarget.currency}
          interventionTitle={paymentTarget.description}
        />
      )}

      {/* Dialog de confirmation de remboursement */}
      <Dialog
        open={refundDialogOpen}
        onOpenChange={(next) => {
          if (!next && refundingPayment === null) { setRefundDialogOpen(false); setRefundTarget(null); setRefundError(null); setRefundNotice(null); }
        }}
      >
        <DialogContent className="sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle>{t('payments.confirmRefund')}</DialogTitle>
          </DialogHeader>
          <div>
            {refundTarget && (
              <div className="space-y-3 mb-3">
                <p className="text-sm font-medium">{refundTarget.description}</p>
                <p className="text-xs text-muted-foreground">{t('payments.refundableBalance')} : <Money value={Math.max(0,refundTarget.amount-(refundTarget.refundedAmount??0))} from={refundTarget.currency??'EUR'} /></p>
                <Field>
                  <FieldLabel htmlFor="refund-amount">{t('payments.refundAmount')} ({refundTarget.currency??'EUR'})</FieldLabel>
                  <Input id="refund-amount" inputMode="decimal" value={refundAmount} disabled={refundingPayment!==null || refundNotice!==null}
                    readOnly={!refundTarget.supportsPartialRefund} aria-describedby={!refundTarget.supportsPartialRefund ? 'refund-full-only' : undefined}
                    onChange={event=>{setRefundAmount(event.target.value);setRefundError(null);refundRequestId.current=crypto.randomUUID();}}
                    className="tabular-nums" />
                </Field>
                {!refundTarget.supportsPartialRefund && <p id="refund-full-only" className="text-xs text-muted-foreground">{t('payments.refundFullOnly')}</p>}
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {t('payments.refundIrreversible')}
            </span>
            {refundError && (
              <UiAlert variant="destructive" className="mt-2 py-0.5">
                <TriangleAlert />
                <AlertDescription>{refundError}</AlertDescription>
              </UiAlert>
            )}
            {refundNotice && (
              <UiAlert className="mt-2" role="status">
                <AlertDescription>{refundNotice}</AlertDescription>
              </UiAlert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setRefundDialogOpen(false); setRefundTarget(null); setRefundError(null); setRefundNotice(null); }}
              size="sm"
              disabled={refundingPayment !== null}
            >
              {refundNotice ? t('common.close') : t('common.cancel')}
            </Button>
            <Button
              onClick={handleRefundConfirm}
              variant="destructive"
              size="sm"
              disabled={refundingPayment !== null || refundNotice !== null}
            >
              {refundingPayment !== null ? <Spinner className="size-[18px]" /> : 'Rembourser'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de saisie d'email pour envoi du lien de paiement */}
      <Dialog
        open={emailDialogOpen}
        onOpenChange={(next) => {
          if (!next) { setEmailDialogOpen(false); emailDialogTargetRef.current = null; setEmailError(null); }
        }}
      >
        <DialogContent className="sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle>{t('payments.customerEmail')}</DialogTitle>
          </DialogHeader>
          <div>
            <p className="text-xs mb-3 text-muted-foreground">
              {t('payments.noEmailHint')}
            </p>
            <Field>
              <FieldLabel htmlFor="payment-guest-email">Adresse email</FieldLabel>
              <Input
                id="payment-guest-email"
                className="w-full"
                autoFocus
                type="email"
                placeholder="guest@example.com"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setEmailError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleEmailDialogConfirm(); }}
                aria-invalid={!!emailError}
              />
              <FieldError>{emailError}</FieldError>
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setEmailDialogOpen(false); emailDialogTargetRef.current = null; setEmailError(null); }}
              size="sm"
            >
              Annuler
            </Button>
            <Button
              onClick={handleEmailDialogConfirm}
              size="sm"
              disabled={sendingPaymentLink !== null}
            >
              {sendingPaymentLink !== null ? <Spinner className="size-[18px]" /> : 'Envoyer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentHistoryPage;
