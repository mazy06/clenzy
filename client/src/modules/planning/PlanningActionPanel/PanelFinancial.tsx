import { BaitlyPaymentHistory, type BaitlyHistoryPayment } from './BaitlyPaymentHistory';
import StatusChip from '../../../components/StatusChip';
import { getBaitlyServiceCost, isBaitlyServicePaid } from '../utils/baitlyFinancial';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { cn } from '../../../utils/cn';
import { Alert as UiAlert, AlertDescription } from '../../../components/ui';
import { Info } from '../../../icons/glyphs';
import { Button, Spinner } from '../../../components/ui';
import { useQueryClient } from '@tanstack/react-query';
import PaymentCheckoutModal from '../../../components/PaymentCheckoutModal';
import { reservationsApi } from '../../../services/api/reservationsApi';
import {
  Field,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  NativeSelect,
  NativeSelectOption,
} from '../../../components/ui';
import {
  Separator,
  Collapsible,
  CollapsibleContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipTrigger,
} from '../../../components/ui';
import {
  Payment,
  Add,
  Receipt,
  MoneyOff,
  AttachMoney,
  Check,
  Warning,
  Person,
  Business,
  Send,
  CleaningServices,
  Handyman,
  CreditCard,
  ExpandMore,
  ExpandLess,
  Email,
  CheckCircle,
  Download,
} from '../../../icons';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';
import { RESERVATION_SOURCE_LABELS, isCollectedByChannel } from '../../../services/api/reservationsApi';
import { useCurrency } from '../../../hooks/useCurrency';
import { useNotification } from '../../../hooks/useNotification';
import { Money } from '../../../components/Money';
import { SectionCard, DomainStatusChip, FinRow, OK_TOKENS, WARN_TOKENS, ERR_TOKENS, INFO_TOKENS, NEUTRAL_TOKENS, STATUS_TOKENS, type SoftTokens } from './BaitlyFinancialPrimitives';
import {
  filterAttachedToReservation,
  type AttachmentCandidate,
} from '../utils/interventionAttachment';
import { useAttachedServiceRequests } from './useAttachedServiceRequests';
import { PlanningTooltipContent } from '../PlanningTooltip';

// ── Types for local financial state ────────────────────────────────────────
type LocalPayment = BaitlyHistoryPayment;

interface LocalExtraFee {
  id: number;
  description: string;
  amount: number;
  date: string;
}

interface GeneratedInvoice {
  id: number;
  fileName: string;
  status: string;
  legalNumber: string | null;
  createdAt: string;
}

// Les moyens de paiement ne portent que leur VALEUR : le libellé se lit dans
// `planning.panel.fin.methods.<valeur>` au rendu. Figé à l'import, il resterait
// français après un changement de langue.
const PAYMENT_METHOD_VALUES = ['card', 'transfer', 'cash', 'check', 'stripe', 'other'] as const;

const PAYMENT_STATUS_KEYS = [
  'PAID', 'PENDING', 'REFUNDED', 'DRAFT', 'ISSUED', 'PROCESSING', 'FAILED', 'CANCELLED',
] as const;

const INTERVENTION_STATUS_KEYS = [
  'scheduled', 'in_progress', 'completed', 'cancelled',
  'pending', 'assigned', 'awaiting_payment', 'awaiting_validation',
] as const;

const INTERVENTION_STATUS_TOKENS: Record<string, SoftTokens> = {
  scheduled: INFO_TOKENS,
  in_progress: INFO_TOKENS,
  completed: OK_TOKENS,
  cancelled: NEUTRAL_TOKENS,
  pending: WARN_TOKENS,
  assigned: INFO_TOKENS,
  awaiting_payment: WARN_TOKENS,
  awaiting_validation: WARN_TOKENS,
};

let mockFinancialId = 5000;

// ── Props ──────────────────────────────────────────────────────────────────
interface PanelFinancialProps {
  event: PlanningEvent;
  /** Événements du planning — rattachement des demandes de service. */
  allEvents?: PlanningEvent[];
  interventions?: PlanningIntervention[];
  /** Réservations chargées — arbitrage du rattachement des interventions. */
  loadedReservations?: AttachmentCandidate[];
  onFinancialAction?: (action: string, data: Record<string, unknown>) => Promise<{ success: boolean; error: string | null }>;
  onCreatePaymentSession?: (interventionIds: number[], total: number) => Promise<{ url: string; sessionId: string }>;
  onCreateEmbeddedSession?: (interventionId: number, amount: number) => Promise<{ clientSecret: string; sessionId: string }>;
  onSendPaymentLink?: (reservationId: number, email?: string) => Promise<void>;
  onGenerateInvoice?: (data: {
    documentType: string;
    referenceId: number;
    referenceType: string;
    emailTo?: string;
    sendEmail: boolean;
  }) => Promise<{ id: number; fileName: string; status: string; legalNumber?: string | null }>;
  onPaymentComplete?: () => void;
}

// ── Formatters ─────────────────────────────────────────────────────────

// Nœud (glyphe de devise pour SAR/MAD). Pour un contexte chaîne pure, utiliser
// convertAndFormat directement (cf. notifier).
const fmtCurrency = (val: number) => <Money value={val} from="EUR" />;

const PanelFinancial: React.FC<PanelFinancialProps> = ({
  event,
  allEvents,
  interventions,
  loadedReservations = [],
  onCreatePaymentSession,
  onCreateEmbeddedSession,
  onSendPaymentLink,
  onGenerateInvoice,
  onPaymentComplete,
}) => {
  const { t } = useTranslation();
  // Dates de l'écran : calendrier de la langue active.
  const fmt = useDateFormat();
  const reservation = event.reservation;
  const intervention = event.intervention;
  const { convertAndFormat } = useCurrency();

  /** « 12/08/2026 14:30 » dans le calendrier affiché. */
  const fmtDate = useCallback((iso: string) => {
    try {
      const d = new Date(iso);
      return `${fmt.formatShortDate(d)} ${fmt.formatPattern(d, 'HH:mm')}`;
    } catch { return iso; }
  }, [fmt]);

  // Les tables de libellés passées à `DomainStatusChip` se rebrassent avec la
  // langue : construites hors composant, elles resteraient françaises.
  const paymentMethods = useMemo(
    () => PAYMENT_METHOD_VALUES.map((value) => ({ value, label: t(`planning.panel.fin.methods.${value}`) })),
    [t],
  );
  const STATUS_LABELS = useMemo(
    () => Object.fromEntries(PAYMENT_STATUS_KEYS.map((k) => [k, t(`planning.panel.fin.statuses.${k}`)])),
    [t],
  );
  const INTERVENTION_STATUS_LABELS = useMemo(
    () => Object.fromEntries(INTERVENTION_STATUS_KEYS.map((k) => [k, t(`planning.panel.fin.intervention.${k}`)])),
    [t],
  );
  const { notify } = useNotification();

  // Latest-ref : le polling de paiement lit toujours le callback frais sans
  // re-declencher l'effet (deps fines anti-spam API).
  const onPaymentCompleteRef = useRef(onPaymentComplete);
  useEffect(() => {
    onPaymentCompleteRef.current = onPaymentComplete;
  });

  const today = new Date().toISOString().split('T')[0];

  // ── Demandes de service rattachées à la réservation ───────────────────────
  const serviceRequestsRaw = useAttachedServiceRequests({
    reservationId: reservation?.id,
    allEvents,
    loadedReservations,
  });

  // ── Local financial state ─────────────────────────────────────────────────
  // Payments are tracked server-side (paymentStatus + paidAt on the reservation).
  // Start empty — actual payment status is derived from reservation.paymentStatus.
  const [payments, setPayments] = useState<LocalPayment[]>(() => {
    if (!reservation) return [];
    // If the reservation was already paid (confirmed via Stripe webhook), reflect it
    if (reservation.paymentStatus === 'PAID' && reservation.totalPrice > 0) {
      return [{
        id: ++mockFinancialId,
        amount: reservation.totalPrice,
        method: 'card',
        date: reservation.paidAt || reservation.checkIn,
        status: 'PAID' as const,
        reference: `STRIPE-${reservation.id}`,
      }];
    }
    return [];
  });

  const [extraFees, setExtraFees] = useState<LocalExtraFee[]>([]);
  const [invoices, setInvoices] = useState<GeneratedInvoice[]>([]);

  // Charger les factures deja generees pour cette reservation/intervention
  useEffect(() => {
    const loadExistingInvoices = async () => {
      try {
        const { documentsApi } = await import('../../../services/api/documentsApi');
        let allGenerations: GeneratedInvoice[] = [];

        // Factures pour la reservation
        if (reservation?.id) {
          const resGens = await documentsApi.getGenerationsByReference('RESERVATION', reservation.id);
          const factureGens = resGens.filter((g) => g.documentType === 'FACTURE' && g.status !== 'FAILED');
          allGenerations = [
            ...allGenerations,
            ...factureGens.map((g) => ({
              id: g.id,
              fileName: g.fileName,
              status: g.status,
              legalNumber: g.legalNumber,
              createdAt: g.createdAt?.split('T')[0] ?? '',
            })),
          ];
        }

        if (allGenerations.length > 0) {
          setInvoices(allGenerations);
        }
      } catch {
        // Silencieux — les factures existantes ne sont pas critiques au montage
      }
    };
    loadExistingInvoices();
  }, [reservation?.id]);

  // Sync payments state when reservation payment status changes (e.g. auto-check confirms payment)
  useEffect(() => {
    if (!reservation) return;
    if (reservation.paymentStatus === 'PAID' && reservation.totalPrice > 0) {
      // Don't duplicate if already has a PAID Stripe entry
      if (payments.some((p) => p.status === 'PAID' && p.reference?.startsWith('STRIPE-'))) return;
      const stripePayment: LocalPayment = {
        id: ++mockFinancialId,
        amount: reservation.totalPrice,
        method: 'card',
        date: reservation.paidAt || reservation.checkIn,
        status: 'PAID' as const,
        reference: `STRIPE-${reservation.id}`,
      };
      setPayments((prev) => {
        // Guard again against the latest state to avoid a duplicate on a race
        if (prev.some((p) => p.status === 'PAID' && p.reference?.startsWith('STRIPE-'))) return prev;
        return [stripePayment];
      });
    }
    // Double garde (some + updater) : re-runs sur nouvelle identite = no-op.
  }, [reservation, payments]);

  // ── Dialog states ────────────────────────────────────────────────────────
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [addFeeOpen, setAddFeeOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);

  // Add payment form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Extra fee form
  const [feeDescription, setFeeDescription] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeLoading, setFeeLoading] = useState(false);

  // Invoice / Refund
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);

  // Stripe payment link
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(reservation?.paymentLinkSentAt || null);
  const [lastSentEmail, setLastSentEmail] = useState<string | null>(reservation?.paymentLinkEmail || null);

  // Auto-check payment status (fallback when webhook missed)
  const queryClient = useQueryClient();

  // Intervention payment
  const [payingInterventions, setPayingInterventions] = useState(false);
  const [interventionsExpanded, setInterventionsExpanded] = useState(true);

  // Payment modal — supporte intervention OU service request
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalTarget, setPaymentModalTarget] = useState<{
    interventionId?: number;
    serviceRequestId?: number;
    amount: number;
    title: string;
  } | null>(null);

  // Errors & feedback
  const notifier = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    notify[severity](message);
  };

  // Sync payment link state with reservation changes
  useEffect(() => {
    setLastSentAt(reservation?.paymentLinkSentAt || null);
    setLastSentEmail(reservation?.paymentLinkEmail || null);
    setLinkSent(false);
    setShowEmailInput(false);
    setLinkEmail('');
  }, [reservation?.id, reservation?.paymentLinkSentAt, reservation?.paymentLinkEmail]);

  // Auto-check payment status when panel opens with a sent payment link but no confirmation
  useEffect(() => {
    if (!reservation) return;
    if (reservation.paymentStatus === 'PAID') return;
    if (!reservation.paymentLinkSentAt) return;

    let cancelled = false;
    const checkPayment = async () => {
      try {
        const result = await reservationsApi.checkPaymentStatus(reservation.id);
        if (!cancelled && result.paymentStatus === 'PAID') {
          // Payment confirmed — refresh all planning data
          queryClient.invalidateQueries({ queryKey: ['planning-page'] });
          onPaymentCompleteRef.current?.();
        }
      } catch {
        // Silent — non-blocking check
      }
    };
    checkPayment();
    return () => { cancelled = true; };
    // Deps fines volontaires (anti-spam API) : dependre de l'objet reservation
    // relancerait checkPaymentStatus a chaque refetch du planning. Le callback
    // est lu via onPaymentCompleteRef (latest-ref) ; queryClient est stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation?.id, reservation?.paymentStatus, reservation?.paymentLinkSentAt, queryClient]);

  // ── Computed values — Reservation ──────────────────────────────────────
  const totalPrice = reservation?.totalPrice || 0;
  // Reel quand le canal l'a remonte, estime au taux du canal sinon ; le serveur
  // tranche et le signale via otaFeeEstimated.
  const otaFee = reservation?.otaFeeAmount ?? null;
  const totalExtraFees = extraFees.reduce((sum, f) => sum + f.amount, 0);
  const grandTotal = totalPrice + totalExtraFees;
  const totalPaid = payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = payments.filter((p) => p.status === 'REFUNDED').reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = grandTotal - totalPaid + totalRefunded;

  const paymentStatus = balanceDue <= 0 ? 'Solde' : totalPaid > 0 ? 'Partiel' : 'En attente';
  const paymentStatusTokens = balanceDue <= 0 ? OK_TOKENS : totalPaid > 0 ? INFO_TOKENS : WARN_TOKENS;

  // ── Computed values — Interventions ────────────────────────────────────
  // Rattachement : MÊME règle que la brique du planning et que l'onglet
  // Opérations (cf. filterAttachedToReservation). Les prestations NON réglées
  // en font partie — c'est précisément celles-là qu'on vient encaisser ici : le
  // filtre « assignée + payée » qui tenait lieu de rattachement vidait la
  // section de tout ce qui restait à payer, et rendait le bouton « Payer »
  // inatteignable.
  const linkedInterventions = reservation
    ? filterAttachedToReservation(
        (interventions || []).filter((i) => i.status !== 'cancelled'),
        reservation.id,
        loadedReservations,
      )
    : [];

  const interventionCostTotal = linkedInterventions.reduce((sum, i) => {
    const cost = getBaitlyServiceCost(i);
    return sum + cost;
  }, 0);

  const interventionPaid = linkedInterventions
    .filter(isBaitlyServicePaid)
    .reduce((sum, i) => {
      const cost = getBaitlyServiceCost(i);
      return sum + cost;
    }, 0);

  const interventionAwaiting = linkedInterventions.filter((i) => i.status === 'awaiting_payment');
  const interventionAwaitingTotal = interventionAwaiting.reduce((sum, i) => {
    const cost = getBaitlyServiceCost(i);
    return sum + cost;
  }, 0);

  // ── Computed values — Service Requests (interventions proposees) ──────
  const payableServiceRequests = serviceRequestsRaw.filter(
    (sr) => sr.status === 'AWAITING_PAYMENT',
  );
  const srProposedTotal = payableServiceRequests.reduce((sum, sr) => {
    const cost = getBaitlyServiceCost(sr);
    return sum + cost;
  }, 0);

  // ── Handlers — Reservation payments ────────────────────────────────────

  const handleSendPaymentLink = useCallback(async (email?: string) => {
    if (!reservation || !onSendPaymentLink) return;
    setSendingLink(true);
    try {
      await onSendPaymentLink(reservation.id, email || undefined);
      setLastSentAt(new Date().toISOString());
      setLastSentEmail(email || reservation.guestEmail || null);
      setLinkSent(true);
      setShowEmailInput(false);
      setLinkEmail('');
      notifier(t('payments.linkSent'));
      setTimeout(() => setLinkSent(false), 4000);
    } catch {
      notifier("Erreur lors de l'envoi du lien", 'error');
    } finally {
      setSendingLink(false);
    }
  }, [reservation, onSendPaymentLink]);

  const handleAddPayment = useCallback(async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    setPaymentLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const newPayment: LocalPayment = {
      id: ++mockFinancialId,
      amount,
      method: paymentMethod,
      date: paymentDate,
      status: 'PAID',
      reference: paymentReference || undefined,
    };
    setPayments((prev) => [...prev, newPayment]);
    setPaymentLoading(false);
    setAddPaymentOpen(false);
    setPaymentAmount('');
    setPaymentMethod('card');
    setPaymentDate(today);
    setPaymentReference('');
    notifier(`Paiement de ${convertAndFormat(amount, 'EUR')} enregistre`);
  }, [paymentAmount, paymentMethod, paymentDate, paymentReference, today, convertAndFormat]);

  const handleGenerateInvoice = useCallback(async (refType: string, refId: number) => {
    if (!onGenerateInvoice) return;
    setInvoiceLoading(true);
    try {
      const result = await onGenerateInvoice({
        documentType: 'FACTURE',
        referenceId: refId,
        referenceType: refType,
        sendEmail: refType === 'INTERVENTION',
      });
      const newInvoice: GeneratedInvoice = {
        id: result.id,
        fileName: result.fileName,
        status: result.status,
        legalNumber: result.legalNumber ?? null,
        createdAt: new Date().toISOString().split('T')[0],
      };
      setInvoices((prev) => [...prev, newInvoice]);
      notifier(`Facture ${result.legalNumber || result.fileName} generee`);
    } catch (err) {
      notifier(`Erreur generation facture: ${err instanceof Error ? err.message : 'Erreur'}`);
    } finally {
      setInvoiceLoading(false);
    }
  }, [onGenerateInvoice]);

  const handleAddFee = useCallback(async () => {
    const amount = parseFloat(feeAmount);
    if (isNaN(amount) || amount <= 0 || !feeDescription.trim()) return;
    setFeeLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    const newFee: LocalExtraFee = {
      id: ++mockFinancialId,
      description: feeDescription.trim(),
      amount,
      date: today,
    };
    setExtraFees((prev) => [...prev, newFee]);
    setFeeLoading(false);
    setAddFeeOpen(false);
    setFeeDescription('');
    setFeeAmount('');
    notifier(`Frais "${newFee.description}" (+${convertAndFormat(amount, 'EUR')}) ajoute`);
  }, [feeDescription, feeAmount, today, convertAndFormat]);

  const handleRefund = useCallback(async () => {
    if (totalPaid <= 0) return;
    setRefundLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    const newPayment: LocalPayment = {
      id: ++mockFinancialId,
      amount: totalPaid,
      method: 'transfer',
      date: today,
      status: 'REFUNDED',
      reference: `RMB-${reservation?.id || 0}`,
    };
    setPayments((prev) => [...prev, newPayment]);
    setRefundLoading(false);
    setRefundDialogOpen(false);
    notifier(`Remboursement de ${convertAndFormat(totalPaid, 'EUR')} effectue`, 'info');
  }, [totalPaid, today, reservation?.id, convertAndFormat]);

  // ── Handler — Intervention payment (embedded) ──────────────────────────
  const unpaidInterventions = linkedInterventions.filter(
    (i) => i.paymentStatus !== 'PAID' && i.paymentStatus !== 'PROCESSING',
  );
  const unpaidTotal = unpaidInterventions.reduce((sum, i) => {
    const cost = getBaitlyServiceCost(i);
    return sum + cost;
  }, 0);

  const handlePayInterventions = useCallback(() => {
    if (unpaidInterventions.length === 0) return;
    const intv = unpaidInterventions[0];
    const cost = getBaitlyServiceCost(intv);
    setPaymentModalTarget({ interventionId: intv.id, amount: cost, title: intv.title });
    setPaymentModalOpen(true);
  }, [unpaidInterventions]);

  // ── Handler — Service Request payment (modal embedded) ─────────────────
  const [payingSR] = useState(false);

  const handlePayServiceRequest = useCallback((sr: { id: number; estimatedCost?: number; title: string }) => {
    setPaymentModalTarget({
      serviceRequestId: sr.id,
      amount: getBaitlyServiceCost(sr),
      title: sr.title,
    });
    setPaymentModalOpen(true);
  }, []);

  // Called by the modal when Stripe confirms payment — just refresh data, don't close the modal
  const handlePaymentModalSuccess = useCallback(() => {
    // Invalidate the SR query so paid SRs disappear from "Interventions proposées"
    // (avoids the duplicate: SR "A payer" + created intervention "Payé" both showing)
    queryClient.invalidateQueries({ queryKey: ['planning', 'service-requests'] });
    onPaymentComplete?.();
  }, [onPaymentComplete, queryClient]);

  // Called when the user clicks "Fermer" on the success screen
  const handlePaymentModalClose = useCallback(() => {
    setPaymentModalOpen(false);
    setPaymentModalTarget(null);
  }, []);

  const isICalImport = !!reservation && isCollectedByChannel(reservation);
  const hasTotalPrice = totalPrice > 0;

  // ── OTA bookings : reservation deja payee sur le canal externe ────────
  // Quand la reservation vient d'un canal OTA (Airbnb, Booking.com, autres
  // canaux ICS), le voyageur a deja regle directement sur la plateforme.
  // Le PMS doit refleter ca : reste a payer 0, statut "Paye OTA", pas de
  // bouton "Lien paiement". Seules les interventions restent a regler.
  const isOTABooking = !!isICalImport;
  const otaChannelLabel = isOTABooking && reservation
    ? RESERVATION_SOURCE_LABELS[reservation.source as keyof typeof RESERVATION_SOURCE_LABELS] || 'OTA'
    : null;
  const effectiveTotalPaid = isOTABooking ? grandTotal : totalPaid;
  const effectiveBalanceDue = isOTABooking ? 0 : balanceDue;
  const effectivePaymentStatus = isOTABooking ? `Paye ${otaChannelLabel}` : paymentStatus;
  const effectivePaymentStatusTokens = isOTABooking ? OK_TOKENS : paymentStatusTokens;

  // ── Hero « MONTANT » (maquette Signature) : gros montant display +
  //    badge Réglé / En attente (tokens ok-soft / warn-soft). ─────────────
  const isSettled = isOTABooking || (hasTotalPrice && effectiveBalanceDue <= 0 && effectiveTotalPaid > 0);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">

      {/* ─── MONTANT (hero) ─────────────────────────────────────────────── */}
      {reservation && (
        <div>
          <span className="block text-xs font-medium uppercase tracking-[0.05em] text-[var(--bui-muted-foreground)] mb-0.5">
            {t('planning.panel.fin.amount', 'Montant')}
          </span>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-[family-name:var(--font-display)] text-[1.75rem] font-bold text-[var(--ink)] leading-[1.1] tabular-nums">
              {isICalImport && !hasTotalPrice ? t('planning.panel.fin.notDisclosed') : fmtCurrency(grandTotal)}
            </span>
            {(hasTotalPrice || isOTABooking) && (
              <span className={cn('self-center px-1.5 py-[3px] rounded-[var(--radius-pill)] text-xs font-semibold', isSettled ? 'bg-[var(--ok-soft)]' : 'bg-[var(--warn-soft)]', isSettled ? 'text-[var(--bui-success-ink)]' : 'text-[var(--bui-warning-ink)]')}>
                {isOTABooking ? `Réglé · ${otaChannelLabel}` : isSettled ? 'Réglé' : 'En attente'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 : Paiement Réservation (Guest / Voyageur)
          ═══════════════════════════════════════════════════════════════════ */}
      {reservation && (
        <SectionCard
          icon={<span className="inline-flex text-[var(--info)]"><Person size={18} strokeWidth={1.75} /></span>}
          title={t('planning.panel.fin.reservationPayment', 'Paiement réservation')}
          badge={t('planning.panel.fin.guestBadge', 'Voyageur')}
          badgeTokens={INFO_TOKENS}
        >
          {/* Summary */}
          <FinRow
            label={t('planning.panel.fin.reservationAmount', 'Montant réservation')}
            value={isICalImport && !hasTotalPrice ? t('planning.panel.fin.notDisclosed') : fmtCurrency(totalPrice)}
            bold
          />

          {/* Commission du canal. Affichee sous le montant brut parce qu'elle
              s'y retranche : c'est l'ecart entre ce que paie le voyageur et ce
              qui revient. Le libelle dit si le canal l'a remontee ou si elle
              est estimee — sans quoi une estimation se lirait comme un releve. */}
          {otaFee != null && otaFee > 0 && (
            <FinRow
              label={
                reservation?.otaFeeEstimated
                  ? t('planning.panel.fin.commissionEstimated', { channel: otaChannelLabel })
                  : t('planning.panel.fin.commission', { channel: otaChannelLabel })
              }
              value={<>-{fmtCurrency(otaFee)}</>}
              color="var(--bui-destructive-ink)"
            />
          )}

          {extraFees.length > 0 && (
            <>
              {extraFees.map((fee) => (
                <div className="flex justify-between items-center mb-0.5" key={fee.id}>
                  <span className="cn-text-caption text-muted-foreground text-[0.75rem]">
                    + {fee.description}
                  </span>
                  <span className="cn-text-caption font-semibold text-[0.75rem]">
                    {fmtCurrency(fee.amount)}
                  </span>
                </div>
              ))}
              <Separator className="my-[3px]" />
              <FinRow label={t('planning.panel.fin.total', 'Total')} value={fmtCurrency(grandTotal)} bold />
            </>
          )}

          <FinRow
            label={isOTABooking
              ? t('planning.panel.fin.paidOn', { channel: otaChannelLabel })
              : t('planning.panel.fin.paid', 'Payé')}
            value={fmtCurrency(effectiveTotalPaid)}
            color="var(--bui-success-ink)"
          />

          {totalRefunded > 0 && (
            <FinRow label={t('planning.panel.fin.refunded', 'Remboursé')} value={<>-{fmtCurrency(totalRefunded)}</>} color="var(--bui-destructive-ink)" />
          )}

          <div className="flex justify-between items-center mb-1.5">
            <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">
              {t('planning.panel.fin.balanceDue', 'Reste à payer')}
            </p>
            <div className="flex items-center gap-1.5">
              <p className={cn('cn-text-body2 font-semibold tabular-nums', effectiveBalanceDue > 0 ? 'text-[var(--bui-warning-ink)]' : 'text-[var(--bui-success-ink)]')} style={{ fontFamily: 'var(--font-display)' }}>
                <Money value={Math.max(0, effectiveBalanceDue)} from="EUR" />
              </p>
              <StatusChip pill tokens={{ color: effectivePaymentStatusTokens.color, bg: effectivePaymentStatusTokens.bg }} label={effectivePaymentStatus} />
            </div>
          </div>

          {/* Invoices */}
          {invoices.length > 0 && (
            <div className="mb-1.5">
              <span className="cn-text-caption font-semibold text-xs text-muted-foreground">
                {t('planning.panel.fin.invoices', { count: invoices.length })}
              </span>
              {invoices.map((inv) => (
                <div className="flex items-center gap-1 mt-0.5" key={inv.id}>
                  <span className="inline-flex text-muted-foreground"><Receipt size={14} strokeWidth={1.75} /></span>
                  <span className="cn-text-caption text-xs font-semibold">
                    {inv.legalNumber || inv.fileName}
                  </span>
                  <DomainStatusChip status={inv.status} />
                  <div className="ms-auto flex gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t('planning.panel.fin.download', 'Télécharger')}
                            onClick={async () => {
                              const { documentsApi } = await import('../../../services/api/documentsApi');
                              await documentsApi.downloadGeneration(inv.id, inv.fileName);
                            }}
                          >
                            <Download size={14} strokeWidth={1.75} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <PlanningTooltipContent>{t('planning.panel.fin.download', 'Télécharger')}</PlanningTooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t('planning.panel.fin.duplicate', 'Duplicata')}
                            onClick={async () => {
                              const { documentsApi } = await import('../../../services/api/documentsApi');
                              await documentsApi.downloadGeneration(inv.id, inv.fileName.replace('.pdf', '-duplicata.pdf'));
                            }}
                          >
                            <Receipt size={14} strokeWidth={1.75} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <PlanningTooltipContent>{t('planning.panel.fin.duplicate', 'Duplicata')}</PlanningTooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator className="my-[4.5px]" />

          {/* ── Confirmation lien envoye ──────────────────────────── */}
          {lastSentAt && (
            <div className="flex items-start gap-1.5 mb-0.5">
              <span className="inline-flex mt-0.5 text-[var(--bui-success-ink)]"><CheckCircle size={16} strokeWidth={1.75} /></span>
              <div className="flex-1">
                <span className="cn-text-caption text-xs text-[var(--bui-success-ink)] font-semibold">
                  {t('planning.panel.fin.linkSentOn', { date: fmtDate(lastSentAt) })}
                </span>
                {lastSentEmail && (
                  <span className="cn-text-caption block text-xs text-muted-foreground">
                    {t('planning.panel.fin.linkSentTo', { email: lastSentEmail })}
                  </span>
                )}
              </div>
            </div>
          )}

          {linkSent && (
            <UiAlert variant="success" className="my-[3px] py-1 text-xs">
              <CheckCircle size={14} strokeWidth={1.75} />
              <AlertDescription className="text-xs">{t('planning.panel.fin.linkSent')}</AlertDescription>
            </UiAlert>
          )}

          {/* ── Action buttons (same row) ──────────────────────────── */}
          <div className="flex gap-1 mt-1.5">
            {isOTABooking ? (
              // OTA : paiement deja regle sur le canal externe → pas de bouton
              // d'envoi de lien, juste une note d'information.
              <div className="flex-1 flex items-center justify-center gap-[4.5px] px-[7.5px] py-[5.25px] rounded-[9px] bg-[var(--ok-soft)] border border-solid border-[color-mix(in_srgb,_var(--ok)_30%,_transparent)]">
                <span className="inline-flex text-[var(--bui-success-ink)]"><CheckCircle size={14} strokeWidth={1.75} /></span>
                <span className="cn-text-caption text-xs text-[var(--bui-success-ink)] font-medium">
                  {t('planning.panel.fin.settledOn', { channel: otaChannelLabel })}
                </span>
              </div>
            ) : (
              <Button
                size="sm"
                disabled={sendingLink || !onSendPaymentLink || !hasTotalPrice || reservation?.paymentStatus === 'PAID'}
                onClick={() => {
                  if (reservation.guestEmail) {
                    handleSendPaymentLink(reservation.guestEmail);
                  } else {
                    setShowEmailInput(true);
                  }
                }}
                className="flex-1"
              >
                {sendingLink ? <Spinner className="size-3.5" /> : <Send size={14} strokeWidth={1.75} />}
                {lastSentAt
                  ? t('planning.panel.fin.resendLink', 'Renvoyer lien')
                  : t('planning.panel.fin.paymentLink', 'Lien paiement')}
              </Button>
            )}

            {invoices.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const inv = invoices[invoices.length - 1];
                  const { documentsApi } = await import('../../../services/api/documentsApi');
                  await documentsApi.downloadGeneration(inv.id, inv.fileName);
                }}
                className="flex-1"
              >
                <Download size={12} strokeWidth={1.75} />
                {t('planning.panel.fin.duplicate', 'Duplicata')}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={invoiceLoading || !onGenerateInvoice || !reservation || !hasTotalPrice}
                onClick={() => reservation && handleGenerateInvoice('RESERVATION', reservation.id)}
                className="flex-1"
              >
                {invoiceLoading ? <Spinner className="size-3" /> : <Receipt size={12} strokeWidth={1.75} />}
                {t('planning.panel.fin.invoice', 'Facture')}
              </Button>
            )}
          </div>

          {/* Email input (si pas d'email guest) */}
          <Collapsible open={showEmailInput}>
            <CollapsibleContent>
            <div className="flex gap-0.5 mt-1">
              {/* Pas de libelle : le champ n'apparait qu'a la demande, le
                  placeholder suffit — d'ou l'aria-label pour le lecteur d'ecran. */}
              <InputGroup className="w-full">
                <InputGroupAddon>
                  <span className="inline-flex text-muted-foreground"><Email size={14} strokeWidth={1.75} /></span>
                </InputGroupAddon>
                <InputGroupInput
                  id="panel-financial-link-email"
                  aria-label={t('planning.panel.fin.guestEmail', 'Email du voyageur')}
                  placeholder={t('planning.panel.fin.guestEmail', 'Email du voyageur')}
                  type="email"
                  className="text-[0.75rem]"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                />
              </InputGroup>
              {/* px: 1.5 = 9 px (le spacing MUI de ce projet vaut 6). */}
              <Button
                size="sm"
                disabled={!linkEmail || sendingLink || !hasTotalPrice}
                onClick={() => handleSendPaymentLink(linkEmail)}
                className="min-w-0 px-[9px]"
              >
                {t('planning.panel.fin.send', 'Envoyer')}
              </Button>
            </div>
            </CollapsibleContent>
          </Collapsible>

        </SectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 : Paiement Interventions (Propriétaire / Conciergerie)
          ═══════════════════════════════════════════════════════════════════ */}
      {reservation && (linkedInterventions.length > 0 || payableServiceRequests.length > 0) && (
        <SectionCard
          icon={<span className="inline-flex text-[var(--bui-warning-ink)]"><Business size={18} strokeWidth={1.75} /></span>}
          title={t('planning.panel.fin.interventionPayment', 'Paiement interventions')}
          badge={t('planning.panel.fin.ownerBadge', 'Propriétaire')}
          badgeTokens={WARN_TOKENS}
        >
          {/* ── Interventions proposees (SR assignees, en attente de paiement) ── */}
          {payableServiceRequests.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-0.5">
                <span className="cn-text-caption font-semibold text-xs text-[var(--bui-warning-ink)]">
                  {t('planning.panel.fin.proposed', { count: payableServiceRequests.length })}
                </span>
              </div>
              {payableServiceRequests.map((sr) => {
                const cost = getBaitlyServiceCost(sr);
                const typeIcon = (
                  <span className="inline-flex text-[var(--bui-warning-ink)]">
                    {sr.serviceType === 'CLEANING' || sr.serviceType === 'EXPRESS_CLEANING'
                      ? <CleaningServices size={14} strokeWidth={1.75} />
                      : <Handyman size={14} strokeWidth={1.75} />}
                  </span>
                );
                return (
                  <div className="flex items-center gap-[4.5px] mb-[3px] p-[4.5px] rounded-[9px] border border-dashed border-[color-mix(in_srgb,_var(--warn)_50%,_transparent)] bg-[var(--warn-soft)]" key={`sr-${sr.id}`}>
                    {typeIcon}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="cn-text-body1 text-xs flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {sr.title}
                        </p>
                      </TooltipTrigger>
                      <PlanningTooltipContent side="top">{sr.title}</PlanningTooltipContent>
                    </Tooltip>
                    {sr.estimatedDurationHours > 0 && (
                      <span className="cn-text-caption text-muted-foreground text-xs">
                        {sr.estimatedDurationHours}h
                      </span>
                    )}
                    <p className="cn-text-body1 text-[0.75rem] font-semibold min-w-[50px] text-end tabular-nums">
                      {cost > 0 ? <Money value={cost} from="EUR" decimals={0} /> : '\u2014'}
                    </p>
                    <StatusChip pill size="sm" tokens={WARN_TOKENS} label={t('planning.panel.fin.toPay', 'À payer')} />
                  </div>
                );
              })}
              {linkedInterventions.length > 0 && <Separator className="my-[3px]" />}
            </>
          )}

          {/* ── Interventions existantes (deja creees et payees) ── */}
          {linkedInterventions.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-0.5">
                <span className="cn-text-caption font-semibold text-xs text-muted-foreground">
                  {t('planning.panel.fin.linkedServices', { count: linkedInterventions.length })}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={interventionsExpanded
                    ? t('planning.panel.fin.collapseLinked')
                    : t('planning.panel.fin.expandLinked')}
                  aria-expanded={interventionsExpanded}
                  onClick={() => setInterventionsExpanded(!interventionsExpanded)}
                >
                  {interventionsExpanded ? <ExpandLess size={16} strokeWidth={1.75} /> : <ExpandMore size={16} strokeWidth={1.75} />}
                </Button>
              </div>

              <Collapsible open={interventionsExpanded}>
                <CollapsibleContent>
                {linkedInterventions.map((intv) => {
                  const cost = getBaitlyServiceCost(intv);
                  const typeIcon = intv.type === 'cleaning'
                    ? <span className="inline-flex text-muted-foreground"><CleaningServices size={14} strokeWidth={1.75} /></span>
                    : <span className="inline-flex text-muted-foreground"><Handyman size={14} strokeWidth={1.75} /></span>;
                  return (
                    <div className="flex items-center gap-1 mb-0.5 p-1 rounded-[9px] border border-[var(--bui-border)] bg-[var(--bui-card)]" key={intv.id}>
                      {typeIcon}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="cn-text-body1 text-xs flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                            {intv.title}
                          </p>
                        </TooltipTrigger>
                        <PlanningTooltipContent side="top">{intv.title}</PlanningTooltipContent>
                      </Tooltip>
                      {intv.estimatedDurationHours > 0 && (
                        <span className="cn-text-caption text-muted-foreground text-xs">
                          {intv.estimatedDurationHours}h
                        </span>
                      )}
                      <p className="cn-text-body1 text-[0.75rem] font-semibold min-w-[50px] text-end tabular-nums">
                        {cost > 0 ? <Money value={cost} from="EUR" /> : '—'}
                      </p>
                      <DomainStatusChip
                        status={intv.paymentStatus || intv.status}
                        map={{ ...STATUS_LABELS, ...INTERVENTION_STATUS_LABELS }}
                        tokenMap={{ ...STATUS_TOKENS, ...INTERVENTION_STATUS_TOKENS }}
                      />
                    </div>
                  );
                })}
                </CollapsibleContent>
              </Collapsible>
            </>
          )}

          <Separator className="my-[4.5px]" />

          {/* Summary */}
          {srProposedTotal > 0 && (
            <FinRow label={t('planning.panel.fin.proposedTotal', 'Interventions proposées')} value={fmtCurrency(srProposedTotal)} color="var(--bui-warning-ink)" />
          )}
          <FinRow label={t('planning.panel.fin.interventionsTotal', 'Total interventions')} value={fmtCurrency(interventionCostTotal + srProposedTotal)} bold />
          {interventionPaid > 0 && (
            <FinRow label={t('planning.panel.fin.paid', 'Payé')} value={fmtCurrency(interventionPaid)} color="var(--bui-success-ink)" />
          )}
          {interventionAwaitingTotal > 0 && (
            <FinRow label={t('planning.panel.fin.awaiting', 'En attente')} value={fmtCurrency(interventionAwaitingTotal)} color="var(--bui-warning-ink)" />
          )}

          {/* Action buttons */}
          <div className="flex gap-1 flex-wrap mt-1.5">
            {/* Pay button — SR proposees first, then unpaid interventions.
                Le kit n'a pas de variante « warning » pleine : outline + teinte
                --warn, comme les deux autres actions de la zone Proprietaire. */}
            <Button
              size="sm"
              variant="outline"
              disabled={payingSR || (payableServiceRequests.length === 0 && interventionCostTotal <= interventionPaid)}
              onClick={() => {
                if (payableServiceRequests.length > 0) {
                  const sr = payableServiceRequests[0];
                  handlePayServiceRequest({ id: sr.id, estimatedCost: sr.estimatedCost, title: sr.title });
                } else {
                  handlePayInterventions();
                }
              }}
              className="flex-1 text-[var(--bui-warning-ink)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
            >
              {payingSR ? <Spinner className="size-3.5" /> : <CreditCard size={14} strokeWidth={1.75} />}
              {t('planning.panel.fin.pay', 'Payer')}
            </Button>
            {/* Generate invoice for linked interventions — always visible */}
            <Button
              size="sm"
              variant="outline"
              disabled={invoiceLoading || linkedInterventions.length === 0 || !onGenerateInvoice}
              onClick={() => {
                if (linkedInterventions.length > 0) {
                  const intv = linkedInterventions[0];
                  handleGenerateInvoice('INTERVENTION', intv.id);
                }
              }}
              className="flex-1 text-[var(--bui-warning-ink)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
            >
              {invoiceLoading ? <Spinner className="size-3" /> : <Receipt size={12} strokeWidth={1.75} />}
              {t('planning.panel.fin.invoice', 'Facture')}
            </Button>
            {/* Refund button — always visible */}
            <Button
              size="sm"
              variant="outline"
              disabled={interventionPaid <= 0}
              onClick={() => setRefundDialogOpen(true)}
              className="flex-1 text-[var(--bui-warning-ink)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
            >
              <MoneyOff size={12} strokeWidth={1.75} />
              {t('planning.panel.fin.refund', 'Remboursement')}
            </Button>
          </div>
        </SectionCard>
      )}

      {/* ── No interventions message ───────────────────────────────────── */}
      {reservation && linkedInterventions.length === 0 && payableServiceRequests.length === 0 && (
        <SectionCard
          icon={<span className="inline-flex text-[var(--bui-warning-ink)]"><Business size={18} strokeWidth={1.75} /></span>}
          title={t('planning.panel.fin.interventionPayment', 'Paiement interventions')}
          badge={t('planning.panel.fin.ownerBadge', 'Propriétaire')}
          badgeTokens={WARN_TOKENS}
        >
          <p className="cn-text-body2 text-[0.75rem] italic text-[var(--bui-muted-foreground)]">
            {t('planning.panel.fin.noLinked')}
          </p>
        </SectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          STANDALONE INTERVENTION (no reservation)
          ═══════════════════════════════════════════════════════════════════ */}
      {!reservation && intervention && (
        <SectionCard
          icon={<span className="inline-flex text-[var(--bui-warning-ink)]"><Business size={18} strokeWidth={1.75} /></span>}
          title={t('planning.panel.fin.interventionCost', 'Coût intervention')}
          badge={t('planning.panel.fin.ownerBadge', 'Propriétaire')}
          badgeTokens={WARN_TOKENS}
        >
          <FinRow label={t('planning.panel.fin.estimatedDuration', 'Durée estimée')} value={intervention.estimatedDurationHours ? `${intervention.estimatedDurationHours}h` : '-'} />
          {intervention.estimatedDurationHours && (
            <FinRow
              label={t('planning.panel.fin.estimatedCost', 'Coût estimé')}
              value={fmtCurrency(getBaitlyServiceCost(intervention))}
              bold
            />
          )}
          {intervention.actualCost != null && intervention.actualCost >= 0 && (
            <FinRow label={t('planning.panel.fin.actualCost', 'Coût réel')} value={fmtCurrency(intervention.actualCost)} bold color="var(--bui-success-ink)" />
          )}

          <Separator className="my-[4.5px]" />

          <FinRow
            label={t('planning.panel.fin.paymentStatus', 'Statut paiement')}
            value=""
          >
            <DomainStatusChip
              status={intervention.paymentStatus || intervention.status}
              map={{ ...STATUS_LABELS, ...INTERVENTION_STATUS_LABELS }}
              tokenMap={{ ...STATUS_TOKENS, ...INTERVENTION_STATUS_TOKENS }}
            />
          </FinRow>

          {intervention.status === 'awaiting_payment' && (
            // mt: 1 = 6 px (le spacing MUI de ce projet vaut 6).
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const cost = getBaitlyServiceCost(intervention);
                setPaymentModalTarget({ interventionId: intervention.id, amount: cost, title: intervention.title });
                setPaymentModalOpen(true);
              }}
              className="w-full mt-[6px] text-[var(--bui-warning-ink)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
            >
              <CreditCard size={14} strokeWidth={1.75} />
              {t('planning.panel.fin.pay', 'Payer')} {fmtCurrency(getBaitlyServiceCost(intervention))}
            </Button>
          )}

          {/* Generate invoice for standalone intervention */}
          {onGenerateInvoice && (
            // mt: 0.75 = 4.5 px (le spacing MUI de ce projet vaut 6).
            <Button
              size="sm"
              variant="outline"
              disabled={invoiceLoading}
              onClick={() => handleGenerateInvoice('INTERVENTION', intervention.id)}
              className="w-full mt-[4.5px] text-[var(--bui-warning-ink)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
            >
              {invoiceLoading ? <Spinner className="size-3" /> : <Receipt size={12} strokeWidth={1.75} />}
              {t('planning.panel.fin.generateInvoice', 'Générer facture')}
            </Button>
          )}

          {/* Standalone intervention invoices */}
          {invoices.length > 0 && (
            <div className="mt-1.5">
              <span className="cn-text-caption font-semibold text-xs text-muted-foreground">
                {t('planning.panel.fin.invoices', { count: invoices.length })}
              </span>
              {invoices.map((inv) => (
                <div className="flex items-center gap-1 mt-0.5" key={inv.id}>
                  <span className="inline-flex text-muted-foreground"><Receipt size={14} strokeWidth={1.75} /></span>
                  <span className="cn-text-caption text-xs font-semibold">
                    {inv.legalNumber || inv.fileName}
                  </span>
                  <DomainStatusChip status={inv.status} />
                  <div className="ms-auto flex gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t('planning.panel.fin.download', 'Télécharger')}
                            onClick={async () => {
                              const { documentsApi } = await import('../../../services/api/documentsApi');
                              await documentsApi.downloadGeneration(inv.id, inv.fileName);
                            }}
                          >
                            <Download size={14} strokeWidth={1.75} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <PlanningTooltipContent>{t('planning.panel.fin.download', 'Télécharger')}</PlanningTooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t('planning.panel.fin.duplicate', 'Duplicata')}
                            onClick={async () => {
                              const { documentsApi } = await import('../../../services/api/documentsApi');
                              await documentsApi.downloadGeneration(inv.id, inv.fileName.replace('.pdf', '-duplicata.pdf'));
                            }}
                          >
                            <Receipt size={14} strokeWidth={1.75} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <PlanningTooltipContent>{t('planning.panel.fin.duplicate', 'Duplicata')}</PlanningTooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOGS (unchanged logic, kept compact)
          ═══════════════════════════════════════════════════════════════════ */}

      <BaitlyPaymentHistory open={paymentsDialogOpen} onOpenChange={setPaymentsDialogOpen}
        payments={payments} paymentMethods={paymentMethods} fmtCurrency={fmtCurrency}
        totalPaid={totalPaid} totalRefunded={totalRefunded} balanceDue={balanceDue} />

      {/* Add Payment Dialog */}
      <Dialog open={addPaymentOpen} onOpenChange={(next) => { if (!next) setAddPaymentOpen(false); }}>
        <DialogContent className="sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <span className="inline-flex text-[var(--brand-ink)]"><Add size={20} strokeWidth={1.75} /></span>
              <span>{t('planning.panel.fin.addPayment', 'Ajouter un paiement')}</span>
            </DialogTitle>
          </DialogHeader>
          {reservation && (
            <span className="cn-text-caption text-muted-foreground text-xs mb-2 block">
              {t('planning.panel.fin.addPaymentIntro', {
                guest: reservation.guestName,
                balance: convertAndFormat(Math.max(0, balanceDue), 'EUR'),
              })}
            </span>
          )}
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="panel-financial-payment-amount">{t('planning.panel.fin.amountEur', 'Montant (€)')}</FieldLabel>
              <Input
                id="panel-financial-payment-amount"
                type="number"
                required
                min={0.01}
                step={0.01}
                className="w-full text-[0.8125rem]"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="panel-financial-payment-method">{t('planning.panel.fin.paymentMethod', 'Méthode de paiement')}</FieldLabel>
              <NativeSelect
                id="panel-financial-payment-method"
                className="w-full text-[0.8125rem]"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {paymentMethods.map((m) => (
                  <NativeSelectOption key={m.value} value={m.value}>{m.label}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="panel-financial-payment-date">{t('planning.panel.fin.paymentDate', 'Date du paiement')}</FieldLabel>
              <Input
                id="panel-financial-payment-date"
                type="date"
                className="w-full text-[0.8125rem]"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="panel-financial-payment-reference">{t('planning.panel.fin.reference', 'Référence (optionnel)')}</FieldLabel>
              <Input
                id="panel-financial-payment-reference"
                placeholder={t('planning.panel.fin.referencePlaceholder')}
                className="w-full text-[0.8125rem]"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddPaymentOpen(false)} size="sm">{t('planning.panel.fin.cancel', 'Annuler')}</Button>
            <Button onClick={handleAddPayment} size="sm" disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || paymentLoading}>
              {paymentLoading ? <Spinner className="size-3.5" /> : <Check size={16} strokeWidth={1.75} />}
              {t('planning.panel.fin.save', 'Enregistrer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Extra Fee Dialog */}
      <Dialog open={addFeeOpen} onOpenChange={(next) => { if (!next) setAddFeeOpen(false); }}>
        <DialogContent className="sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <span className="inline-flex text-[var(--brand-ink)]"><AttachMoney size={20} strokeWidth={1.75} /></span>
              <span>{t('planning.panel.fin.extraFees', 'Frais supplémentaires')}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="panel-financial-fee-description">{t('planning.panel.fin.description', 'Description')}</FieldLabel>
              <Input
                id="panel-financial-fee-description"
                required
                placeholder={t('planning.panel.fin.feePlaceholder')}
                className="w-full text-[0.8125rem]"
                value={feeDescription}
                onChange={(e) => setFeeDescription(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="panel-financial-fee-amount">{t('planning.panel.fin.amountEur', 'Montant (€)')}</FieldLabel>
              <Input
                id="panel-financial-fee-amount"
                type="number"
                required
                min={0.01}
                step={0.01}
                className="w-full text-[0.8125rem]"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
            </Field>
          </div>
          {grandTotal > 0 && (
            <UiAlert variant="info" className="mt-3 text-[0.75rem]">
              <Info />
              <AlertDescription className="text-[0.75rem]">
                {t('planning.panel.fin.newTotal', 'Nouveau total :')} <Money value={grandTotal + (parseFloat(feeAmount) || 0)} from="EUR" />
              </AlertDescription>
            </UiAlert>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddFeeOpen(false)} size="sm">{t('planning.panel.fin.cancel', 'Annuler')}</Button>
            <Button onClick={handleAddFee} size="sm" disabled={!feeDescription.trim() || !feeAmount || parseFloat(feeAmount) <= 0 || feeLoading}>
              {feeLoading ? <Spinner className="size-3.5" /> : <Add size={16} strokeWidth={1.75} />}
              {t('planning.panel.fin.add', 'Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={(next) => { if (!next) setRefundDialogOpen(false); }}>
        <DialogContent className="sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <span className="inline-flex text-[var(--bui-warning-ink)]"><MoneyOff size={20} strokeWidth={1.75} /></span>
              <span>{t('planning.panel.fin.confirmRefund', 'Confirmer le remboursement')}</span>
            </DialogTitle>
          </DialogHeader>
          <UiAlert variant="warning" className="mb-3 text-[0.8125rem]">
            <Warning size={18} strokeWidth={1.75} />
            <AlertDescription className="text-[0.8125rem]">
              {t('planning.panel.fin.refundWarning')}
            </AlertDescription>
          </UiAlert>
          <div className="flex flex-col gap-0.5 p-2 rounded-[10px] bg-[var(--field)]">
            <div className="flex justify-between">
              <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">{t('planning.panel.fin.totalPaidAmount', 'Montant total payé')}</p>
              <p className="cn-text-body2 font-bold text-[0.8125rem] tabular-nums">{fmtCurrency(totalPaid)}</p>
            </div>
            {reservation && (
              <div className="flex justify-between">
                <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">{t('planning.panel.fin.client', 'Client')}</p>
                <p className="cn-text-body2 font-semibold text-[0.8125rem]">{reservation.guestName}</p>
              </div>
            )}
            <div className="flex justify-between">
              <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">{t('planning.panel.fin.refundedAmount', 'Montant remboursé')}</p>
              <p className="cn-text-body2 font-bold text-[0.8125rem] text-[var(--bui-destructive-ink)] tabular-nums">
                -{fmtCurrency(totalPaid)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRefundDialogOpen(false)} size="sm">{t('planning.panel.fin.cancel', 'Annuler')}</Button>
            {/* Teinte --warn conservee (pas de variante « warning » au kit) :
                l'action est irreversible mais ce n'est pas une suppression. */}
            <Button
              onClick={handleRefund}
              variant="outline"
              size="sm"
              disabled={refundLoading}
              className="text-[var(--bui-warning-ink)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
            >
              {refundLoading ? <Spinner className="size-3.5" /> : <MoneyOff size={16} strokeWidth={1.75} />}
              {t('planning.panel.fin.confirmRefund', 'Confirmer le remboursement')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Checkout Modal */}
      {paymentModalTarget && (
        <PaymentCheckoutModal
          open={paymentModalOpen}
          onClose={handlePaymentModalClose}
          onSuccess={handlePaymentModalSuccess}
          interventionId={paymentModalTarget.interventionId}
          serviceRequestId={paymentModalTarget.serviceRequestId}
          amount={paymentModalTarget.amount}
          interventionTitle={paymentModalTarget.title}
        />
      )}
    </div>
  );
};

export default PanelFinancial;
