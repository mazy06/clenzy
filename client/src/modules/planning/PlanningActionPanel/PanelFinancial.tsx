import React, { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '../../../utils/cn';
import { Alert as UiAlert, AlertDescription } from '../../../components/ui';
import { Info } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PaymentCheckoutModal from '../../../components/PaymentCheckoutModal';
import { serviceRequestsApi, type ServiceRequest } from '../../../services/api/serviceRequestsApi';
import { reservationsApi } from '../../../services/api/reservationsApi';
import { Button, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, IconButton, Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Collapse, Tooltip } from '@mui/material';
import {
  Payment,
  Add,
  Receipt,
  MoneyOff,
  AttachMoney,
  Close,
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
import { Money } from '../../../components/Money';
import StatusChip, { STATUS_TONES, type ToneTokens } from '../../../components/StatusChip';

// ── Types for local financial state ────────────────────────────────────────
interface LocalPayment {
  id: number;
  amount: number;
  method: string;
  date: string;
  status: 'PAID' | 'PENDING' | 'REFUNDED';
  reference?: string;
}

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

const PAYMENT_METHODS = [
  { value: 'card', label: 'Carte bancaire' },
  { value: 'transfer', label: 'Virement bancaire' },
  { value: 'cash', label: 'Especes' },
  { value: 'check', label: 'Cheque' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'other', label: 'Autre' },
];

type SoftTokens = ToneTokens;

const OK_TOKENS: SoftTokens = STATUS_TONES.ok;
const WARN_TOKENS: SoftTokens = STATUS_TONES.warn;
const ERR_TOKENS: SoftTokens = STATUS_TONES.err;
const INFO_TOKENS: SoftTokens = STATUS_TONES.info;
const NEUTRAL_TOKENS: SoftTokens = STATUS_TONES.neutral;

/** Statuts paiement → tokens sémantiques (succès = ok, attente = warn, en cours = info, échec = err). */
const STATUS_TOKENS: Record<string, SoftTokens> = {
  PAID: OK_TOKENS,
  PENDING: WARN_TOKENS,
  REFUNDED: ERR_TOKENS,
  DRAFT: NEUTRAL_TOKENS,
  ISSUED: INFO_TOKENS,
  PROCESSING: INFO_TOKENS,
  FAILED: ERR_TOKENS,
  CANCELLED: NEUTRAL_TOKENS,
};

const OVERLINE_SX = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--faint)',
};

/** Report en classes de `OVERLINE_SX`. */
const OVERLINE_CLASS = 'text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--faint)]';

/** ✕ de modale — pattern validé (34px r10 hairline, hover --err). */
const CLOSE_BTN_SX = {
  width: 34,
  height: 34,
  borderRadius: '10px',
  border: '1px solid var(--line-2)',
  backgroundColor: 'var(--card)',
  color: 'var(--muted)',
  transition: 'color .14s, border-color .14s',
  '&:hover': { color: 'var(--err)', borderColor: 'var(--err)', backgroundColor: 'var(--card)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
};

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Paye',
  PENDING: 'En attente',
  REFUNDED: 'Rembourse',
  DRAFT: 'Brouillon',
  ISSUED: 'Emise',
  PROCESSING: 'En cours',
  FAILED: 'Echoue',
  CANCELLED: 'Annule',
};

const INTERVENTION_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Planifie',
  in_progress: 'En cours',
  completed: 'Termine',
  cancelled: 'Annule',
  pending: 'En attente',
  assigned: 'Assigne',
  awaiting_payment: 'Att. paiement',
  awaiting_validation: 'Att. validation',
};

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

// ── Section wrapper — carte hairline, titre overline, badge chip soft ───────
const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeTokens: SoftTokens;
  children: React.ReactNode;
}> = ({ icon, title, badge, badgeTokens, children }) => (
  <div className="border border-[var(--line)] bg-[var(--card)] rounded-[12px] p-2">
    <div className="flex items-center gap-1.5 mb-2">
      {icon}
      <p className={cn(OVERLINE_CLASS, 'cn-text-body2 flex-1')}>
        {title}
      </p>
      <StatusChip pill tokens={{ color: badgeTokens.color, bg: badgeTokens.bg }} label={badge} />
    </div>
    {children}
  </div>
);

// ── Status chip helper — résout le ton via la map domaine puis délègue au
//    StatusChip partagé (taille sm), rayon pilule conservé. ──────────────────
const DomainStatusChip: React.FC<{ status: string; map?: Record<string, string>; tokenMap?: Record<string, SoftTokens> }> = ({
  status,
  map = STATUS_LABELS,
  tokenMap = STATUS_TOKENS,
}) => (
  <StatusChip
    tokens={tokenMap[status] || NEUTRAL_TOKENS}
    label={map[status] || status}
    size="sm"
    sx={{ borderRadius: 'var(--radius-pill)' }}
  />
);

// ── Row helper ──────────────────────────────────────────────────────────────
const FinRow: React.FC<{
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  color?: string;
  secondary?: boolean;
  children?: React.ReactNode;
}> = ({ label, value, bold, color, secondary, children }) => (
  <div className="flex justify-between items-center mb-0.5">
    <p className={cn('cn-text-body2 text-[0.8125rem]', secondary !== false && 'text-[var(--muted)]')}>
      {label}
    </p>
    <div className="flex items-center gap-1.5">
      {/* `color` et `bold` sont des props : leur valeur n'existe qu'a
          l'execution, donc style inline et non classes Tailwind. */}
      <p
        className="cn-text-body2 font-semibold text-[0.8125rem] tabular-nums"
        style={{
          color: color || 'var(--ink)',
          ...(bold && { fontFamily: 'var(--font-display)' }),
        }}
      >
        {value}
      </p>
      {children}
    </div>
  </div>
);

// ── Props ──────────────────────────────────────────────────────────────────
interface PanelFinancialProps {
  event: PlanningEvent;
  interventions?: PlanningIntervention[];
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
const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

// Nœud (glyphe de devise pour SAR/MAD). Pour un contexte chaîne pure, utiliser
// convertAndFormat directement (cf. snackbars).
const fmtCurrency = (val: number) => <Money value={val} from="EUR" />;

const PanelFinancial: React.FC<PanelFinancialProps> = ({
  event,
  interventions,
  onCreatePaymentSession,
  onCreateEmbeddedSession,
  onSendPaymentLink,
  onGenerateInvoice,
  onPaymentComplete,
}) => {
  const reservation = event.reservation;
  const intervention = event.intervention;
  const { convertAndFormat } = useCurrency();

  // Latest-ref : le polling de paiement lit toujours le callback frais sans
  // re-declencher l'effet (deps fines anti-spam API).
  const onPaymentCompleteRef = useRef(onPaymentComplete);
  useEffect(() => {
    onPaymentCompleteRef.current = onPaymentComplete;
  });

  const today = new Date().toISOString().split('T')[0];

  // ── Fetch service requests for this reservation ───────────────────────────
  const { data: serviceRequestsRaw } = useQuery({
    queryKey: ['planning', 'service-requests', reservation?.id],
    queryFn: async () => {
      const result = await serviceRequestsApi.getAll({ reservationId: reservation!.id });
      const list = result;
      return list as ServiceRequest[];
    },
    enabled: !!reservation?.id,
    staleTime: 30_000,
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
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
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
  // Only show interventions that are assigned + paid (or no cost) in the financial tab
  const linkedInterventions = (interventions || []).filter((i) => {
    if (!reservation) return false;
    // Must be assigned to a contractor/team
    if (!i.assigneeName) return false;
    // If has a cost, must be paid
    const cost = i.actualCost || i.estimatedCost || 0;
    if (cost > 0 && i.paymentStatus !== 'PAID') return false;
    // Only show interventions explicitly linked to THIS reservation
    if (i.linkedReservationId === reservation.id) return true;
    // Also include unlinked interventions (no reservation link) on the same property
    // with overlapping dates — these are "orphan" interventions that likely belong here
    if (!i.linkedReservationId && i.propertyId === event.propertyId) {
      const iStart = i.startDate;
      const iEnd = i.endDate;
      return iStart <= reservation.checkOut && iEnd >= reservation.checkIn;
    }
    return false;
  });

  const interventionCostTotal = linkedInterventions.reduce((sum, i) => {
    const cost = i.actualCost || i.estimatedCost || (i.estimatedDurationHours ? i.estimatedDurationHours * 25 : 0);
    return sum + cost;
  }, 0);

  const interventionPaid = linkedInterventions
    .filter((i) => i.paymentStatus === 'PAID' || i.paymentStatus === 'PROCESSING' || i.status === 'completed')
    .reduce((sum, i) => {
      const cost = i.actualCost || i.estimatedCost || (i.estimatedDurationHours ? i.estimatedDurationHours * 25 : 0);
      return sum + cost;
    }, 0);

  const interventionAwaiting = linkedInterventions.filter((i) => i.status === 'awaiting_payment');
  const interventionAwaitingTotal = interventionAwaiting.reduce((sum, i) => {
    const cost = i.estimatedCost || (i.estimatedDurationHours ? i.estimatedDurationHours * 25 : 0);
    return sum + cost;
  }, 0);

  // ── Computed values — Service Requests (interventions proposees) ──────
  const payableServiceRequests = (serviceRequestsRaw ?? []).filter(
    (sr) => sr.status === 'AWAITING_PAYMENT',
  );
  const srProposedTotal = payableServiceRequests.reduce((sum, sr) => {
    const cost = sr.estimatedCost || (sr.estimatedDurationHours ? sr.estimatedDurationHours * 25 : 0);
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
      showSnackbar('Lien de paiement envoye avec succes');
      setTimeout(() => setLinkSent(false), 4000);
    } catch {
      showSnackbar("Erreur lors de l'envoi du lien", 'error');
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
    showSnackbar(`Paiement de ${convertAndFormat(amount, 'EUR')} enregistre`);
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
      showSnackbar(`Facture ${result.legalNumber || result.fileName} generee`);
    } catch (err) {
      showSnackbar(`Erreur generation facture: ${err instanceof Error ? err.message : 'Erreur'}`);
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
    showSnackbar(`Frais "${newFee.description}" (+${convertAndFormat(amount, 'EUR')}) ajoute`);
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
    showSnackbar(`Remboursement de ${convertAndFormat(totalPaid, 'EUR')} effectue`, 'info');
  }, [totalPaid, today, reservation?.id, convertAndFormat]);

  // ── Handler — Intervention payment (embedded) ──────────────────────────
  const unpaidInterventions = linkedInterventions.filter(
    (i) => i.paymentStatus !== 'PAID' && i.paymentStatus !== 'PROCESSING' && i.status !== 'completed',
  );
  const unpaidTotal = unpaidInterventions.reduce((sum, i) => {
    const cost = i.estimatedCost || (i.estimatedDurationHours ? i.estimatedDurationHours * 25 : 0);
    return sum + cost;
  }, 0);

  const handlePayInterventions = useCallback(() => {
    if (unpaidInterventions.length === 0) return;
    const intv = unpaidInterventions[0];
    const cost = intv.estimatedCost || (intv.estimatedDurationHours ? intv.estimatedDurationHours * 25 : 0);
    setPaymentModalTarget({ interventionId: intv.id, amount: cost, title: intv.title });
    setPaymentModalOpen(true);
  }, [unpaidInterventions]);

  // ── Handler — Service Request payment (modal embedded) ─────────────────
  const [payingSR] = useState(false);

  const handlePayServiceRequest = useCallback((sr: { id: number; estimatedCost?: number; title: string }) => {
    setPaymentModalTarget({
      serviceRequestId: sr.id,
      amount: sr.estimatedCost || 0,
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
          <span className="block text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--faint)] mb-0.5">
            Montant
          </span>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-[family-name:var(--font-display)] text-[1.75rem] font-bold text-[var(--ink)] leading-[1.1] tabular-nums">
              {isICalImport && !hasTotalPrice ? 'Non communiqué' : fmtCurrency(grandTotal)}
            </span>
            {(hasTotalPrice || isOTABooking) && (
              <span className={cn('self-center px-1.5 py-[3px] rounded-[var(--radius-pill)] text-[0.6875rem] font-semibold', isSettled ? 'bg-[var(--ok-soft)]' : 'bg-[var(--warn-soft)]', isSettled ? 'text-[var(--ok)]' : 'text-[var(--warn)]')}>
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
          title="Paiement reservation"
          badge="Voyageur"
          badgeTokens={INFO_TOKENS}
        >
          {/* Summary */}
          <FinRow label="Montant reservation" value={isICalImport && !hasTotalPrice ? 'Non communique' : fmtCurrency(totalPrice)} bold />

          {/* Commission du canal. Affichee sous le montant brut parce qu'elle
              s'y retranche : c'est l'ecart entre ce que paie le voyageur et ce
              qui revient. Le libelle dit si le canal l'a remontee ou si elle
              est estimee — sans quoi une estimation se lirait comme un releve. */}
          {otaFee != null && otaFee > 0 && (
            <FinRow
              label={
                reservation?.otaFeeEstimated
                  ? `Commission ${otaChannelLabel} (estimee)`
                  : `Commission ${otaChannelLabel}`
              }
              value={<>-{fmtCurrency(otaFee)}</>}
              color="var(--err)"
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
              <Divider sx={{ my: 0.5 }} />
              <FinRow label="Total" value={fmtCurrency(grandTotal)} bold />
            </>
          )}

          <FinRow
            label={isOTABooking ? `Paye sur ${otaChannelLabel}` : 'Paye'}
            value={fmtCurrency(effectiveTotalPaid)}
            color="var(--ok)"
          />

          {totalRefunded > 0 && (
            <FinRow label="Rembourse" value={<>-{fmtCurrency(totalRefunded)}</>} color="var(--err)" />
          )}

          <div className="flex justify-between items-center mb-1.5">
            <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">
              Reste a payer
            </p>
            <div className="flex items-center gap-1.5">
              <p className={cn('cn-text-body2 font-semibold tabular-nums', effectiveBalanceDue > 0 ? 'text-[var(--warn)]' : 'text-[var(--ok)]')} style={{ fontFamily: 'var(--font-display)' }}>
                <Money value={Math.max(0, effectiveBalanceDue)} from="EUR" />
              </p>
              <StatusChip pill tokens={{ color: effectivePaymentStatusTokens.color, bg: effectivePaymentStatusTokens.bg }} label={effectivePaymentStatus} />
            </div>
          </div>

          {/* Invoices */}
          {invoices.length > 0 && (
            <div className="mb-1.5">
              <span className="cn-text-caption font-semibold text-[0.6875rem] text-muted-foreground">
                Factures ({invoices.length})
              </span>
              {invoices.map((inv) => (
                <div className="flex items-center gap-1 mt-0.5" key={inv.id}>
                  <span className="inline-flex text-muted-foreground"><Receipt size={14} strokeWidth={1.75} /></span>
                  <span className="cn-text-caption text-[0.6875rem] font-semibold">
                    {inv.legalNumber || inv.fileName}
                  </span>
                  <DomainStatusChip status={inv.status} />
                  <div className="ms-auto flex gap-0.5">
                    <Tooltip title="Telecharger">
                      <IconButton
                        size="small"
                        onClick={async () => {
                          const { documentsApi } = await import('../../../services/api/documentsApi');
                          await documentsApi.downloadGeneration(inv.id, inv.fileName);
                        }}
                        sx={{ p: 0.25 }}
                      >
                        <Download size={14} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicata">
                      <IconButton
                        size="small"
                        onClick={async () => {
                          const { documentsApi } = await import('../../../services/api/documentsApi');
                          await documentsApi.downloadGeneration(inv.id, inv.fileName.replace('.pdf', '-duplicata.pdf'));
                        }}
                        sx={{ p: 0.25 }}
                      >
                        <Receipt size={14} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Divider sx={{ my: 0.75 }} />

          {/* ── Confirmation lien envoye ──────────────────────────── */}
          {lastSentAt && (
            <div className="flex items-start gap-1.5 mb-0.5">
              <span className="inline-flex mt-0.5 text-[var(--ok)]"><CheckCircle size={16} strokeWidth={1.75} /></span>
              <div className="flex-1">
                <span className="cn-text-caption text-[0.6875rem] text-[var(--ok)] font-semibold">
                  Lien envoye le {fmtDate(lastSentAt)}
                </span>
                {lastSentEmail && (
                  <span className="cn-text-caption block text-[0.625rem] text-muted-foreground">
                    a {lastSentEmail}
                  </span>
                )}
              </div>
            </div>
          )}

          {linkSent && (
            <Alert severity="success" sx={{ fontSize: '0.6875rem', mt: 0.5, mb: 0.5, py: 0, '& .MuiAlert-message': { py: 0.25 } }}>
              Lien envoye avec succes !
            </Alert>
          )}

          {/* ── Action buttons (same row) ──────────────────────────── */}
          <div className="flex gap-1 mt-1.5">
            {isOTABooking ? (
              // OTA : paiement deja regle sur le canal externe → pas de bouton
              // d'envoi de lien, juste une note d'information.
              <div className="flex-1 flex items-center justify-center gap-[4.5px] px-[7.5px] py-[5.25px] rounded-[9px] bg-[var(--ok-soft)] border border-solid border-[color-mix(in_srgb,_var(--ok)_30%,_transparent)]">
                <span className="inline-flex text-[var(--ok)]"><CheckCircle size={14} strokeWidth={1.75} /></span>
                <span className="cn-text-caption text-[0.6875rem] text-[var(--ok)] font-medium">
                  Reglement effectue sur {otaChannelLabel}
                </span>
              </div>
            ) : (
              <Button
                size="small"
                variant="contained"
                startIcon={sendingLink ? <Spinner className="size-3.5" /> : <Send size={14} strokeWidth={1.75} />}
                disabled={sendingLink || !onSendPaymentLink || !hasTotalPrice || reservation?.paymentStatus === 'PAID'}
                onClick={() => {
                  if (reservation.guestEmail) {
                    handleSendPaymentLink(reservation.guestEmail);
                  } else {
                    setShowEmailInput(true);
                  }
                }}
                sx={{ flex: 1 }}
              >
                {lastSentAt ? 'Renvoyer lien' : 'Lien paiement'}
              </Button>
            )}

            {invoices.length > 0 ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Download size={12} strokeWidth={1.75} />}
                onClick={async () => {
                  const inv = invoices[invoices.length - 1];
                  const { documentsApi } = await import('../../../services/api/documentsApi');
                  await documentsApi.downloadGeneration(inv.id, inv.fileName);
                }}
                sx={{ flex: 1 }}
              >
                Duplicata
              </Button>
            ) : (
              <Button
                size="small"
                variant="outlined"
                startIcon={invoiceLoading ? <Spinner className="size-3" /> : <Receipt size={12} strokeWidth={1.75} />}
                disabled={invoiceLoading || !onGenerateInvoice || !reservation || !hasTotalPrice}
                onClick={() => reservation && handleGenerateInvoice('RESERVATION', reservation.id)}
                sx={{ flex: 1 }}
              >
                Facture
              </Button>
            )}
          </div>

          {/* Email input (si pas d'email guest) */}
          <Collapse in={showEmailInput}>
            <div className="flex gap-0.5 mt-1">
              <TextField
                size="small"
                placeholder="Email du voyageur"
                type="email"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                InputProps={{
                  startAdornment: <span className="inline-flex text-muted-foreground me-0.5"><Email size={14} strokeWidth={1.75} /></span>,
                }}
              />
              <Button
                size="small"
                variant="contained"
                disabled={!linkEmail || sendingLink || !hasTotalPrice}
                onClick={() => handleSendPaymentLink(linkEmail)}
                sx={{ minWidth: 'auto', px: 1.5 }}
              >
                Envoyer
              </Button>
            </div>
          </Collapse>

        </SectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 : Paiement Interventions (Propriétaire / Conciergerie)
          ═══════════════════════════════════════════════════════════════════ */}
      {reservation && (linkedInterventions.length > 0 || payableServiceRequests.length > 0) && (
        <SectionCard
          icon={<span className="inline-flex text-[var(--warn)]"><Business size={18} strokeWidth={1.75} /></span>}
          title="Paiement interventions"
          badge="Proprietaire"
          badgeTokens={WARN_TOKENS}
        >
          {/* ── Interventions proposees (SR assignees, en attente de paiement) ── */}
          {payableServiceRequests.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-0.5">
                <span className="cn-text-caption font-semibold text-[0.6875rem] text-[var(--warn)]">
                  Interventions proposees ({payableServiceRequests.length})
                </span>
              </div>
              {payableServiceRequests.map((sr) => {
                const cost = sr.estimatedCost || (sr.estimatedDurationHours ? sr.estimatedDurationHours * 25 : 0);
                const typeIcon = (
                  <span className="inline-flex text-[var(--warn)]">
                    {sr.serviceType === 'CLEANING' || sr.serviceType === 'EXPRESS_CLEANING'
                      ? <CleaningServices size={14} strokeWidth={1.75} />
                      : <Handyman size={14} strokeWidth={1.75} />}
                  </span>
                );
                return (
                  <div className="flex items-center gap-[4.5px] mb-[3px] p-[4.5px] rounded-[9px] border border-dashed border-[color-mix(in_srgb,_var(--warn)_50%,_transparent)] bg-[var(--warn-soft)]" key={`sr-${sr.id}`}>
                    {typeIcon}
                    <Tooltip title={sr.title} placement="top">
                      <p className="cn-text-body1 text-[0.6875rem] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {sr.title}
                      </p>
                    </Tooltip>
                    {sr.estimatedDurationHours > 0 && (
                      <span className="cn-text-caption text-muted-foreground text-[0.625rem]">
                        {sr.estimatedDurationHours}h
                      </span>
                    )}
                    <p className="cn-text-body1 text-[0.75rem] font-semibold min-w-[50px] text-end tabular-nums">
                      {cost > 0 ? <Money value={cost} from="EUR" decimals={0} /> : '\u2014'}
                    </p>
                    <StatusChip pill size="sm" tokens={WARN_TOKENS} label="A payer" />
                  </div>
                );
              })}
              {linkedInterventions.length > 0 && <Divider sx={{ my: 0.5 }} />}
            </>
          )}

          {/* ── Interventions existantes (deja creees et payees) ── */}
          {linkedInterventions.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-0.5">
                <span className="cn-text-caption font-semibold text-[0.6875rem] text-muted-foreground">
                  Prestations liees ({linkedInterventions.length})
                </span>
                <IconButton size="small" onClick={() => setInterventionsExpanded(!interventionsExpanded)} sx={{ p: 0.25 }}>
                  {interventionsExpanded ? <ExpandLess size={16} strokeWidth={1.75} /> : <ExpandMore size={16} strokeWidth={1.75} />}
                </IconButton>
              </div>

              <Collapse in={interventionsExpanded}>
                {linkedInterventions.map((intv) => {
                  const cost = intv.actualCost || intv.estimatedCost || (intv.estimatedDurationHours ? intv.estimatedDurationHours * 25 : 0);
                  const typeIcon = intv.type === 'cleaning'
                    ? <span className="inline-flex text-muted-foreground"><CleaningServices size={14} strokeWidth={1.75} /></span>
                    : <span className="inline-flex text-muted-foreground"><Handyman size={14} strokeWidth={1.75} /></span>;
                  return (
                    <div className="flex items-center gap-1 mb-0.5 p-1 rounded-[9px] border border-[var(--line)] bg-[var(--card)]" key={intv.id}>
                      {typeIcon}
                      <Tooltip title={intv.title} placement="top">
                        <p className="cn-text-body1 text-[0.6875rem] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {intv.title}
                        </p>
                      </Tooltip>
                      {intv.estimatedDurationHours > 0 && (
                        <span className="cn-text-caption text-muted-foreground text-[0.625rem]">
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
              </Collapse>
            </>
          )}

          <Divider sx={{ my: 0.75 }} />

          {/* Summary */}
          {srProposedTotal > 0 && (
            <FinRow label="Interventions proposees" value={fmtCurrency(srProposedTotal)} color="var(--warn)" />
          )}
          <FinRow label="Total interventions" value={fmtCurrency(interventionCostTotal + srProposedTotal)} bold />
          {interventionPaid > 0 && (
            <FinRow label="Paye" value={fmtCurrency(interventionPaid)} color="var(--ok)" />
          )}
          {interventionAwaitingTotal > 0 && (
            <FinRow label="En attente" value={fmtCurrency(interventionAwaitingTotal)} color="var(--warn)" />
          )}

          {/* Action buttons */}
          <div className="flex gap-1 flex-wrap mt-1.5">
            {/* Pay button — SR proposees first, then unpaid interventions */}
            <Button
              size="small"
              variant="contained"
              startIcon={payingSR ? <Spinner className="size-3.5" /> : <CreditCard size={14} strokeWidth={1.75} />}
              disabled={payingSR || (payableServiceRequests.length === 0 && interventionCostTotal <= interventionPaid)}
              onClick={() => {
                if (payableServiceRequests.length > 0) {
                  const sr = payableServiceRequests[0];
                  handlePayServiceRequest({ id: sr.id, estimatedCost: sr.estimatedCost, title: sr.title });
                } else {
                  handlePayInterventions();
                }
              }}
              color="warning"
              sx={{ flex: 1 }}
            >
              Payer
            </Button>
            {/* Generate invoice for linked interventions — always visible */}
            <Button
              size="small"
              variant="outlined"
              startIcon={invoiceLoading ? <Spinner className="size-3" /> : <Receipt size={12} strokeWidth={1.75} />}
              disabled={invoiceLoading || linkedInterventions.length === 0 || !onGenerateInvoice}
              onClick={() => {
                if (linkedInterventions.length > 0) {
                  const intv = linkedInterventions[0];
                  handleGenerateInvoice('INTERVENTION', intv.id);
                }
              }}
              color="warning"
              sx={{ flex: 1 }}
            >
              Facture
            </Button>
            {/* Refund button — always visible */}
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<MoneyOff size={12} strokeWidth={1.75} />}
              disabled={interventionPaid <= 0}
              onClick={() => setRefundDialogOpen(true)}
              sx={{ flex: 1 }}
            >
              Remboursement
            </Button>
          </div>
        </SectionCard>
      )}

      {/* ── No interventions message ───────────────────────────────────── */}
      {reservation && linkedInterventions.length === 0 && payableServiceRequests.length === 0 && (
        <SectionCard
          icon={<span className="inline-flex text-[var(--warn)]"><Business size={18} strokeWidth={1.75} /></span>}
          title="Paiement interventions"
          badge="Proprietaire"
          badgeTokens={WARN_TOKENS}
        >
          <p className="cn-text-body2 text-[0.75rem] italic text-[var(--muted)]">
            Aucune intervention liee a cette reservation.
          </p>
        </SectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          STANDALONE INTERVENTION (no reservation)
          ═══════════════════════════════════════════════════════════════════ */}
      {!reservation && intervention && (
        <SectionCard
          icon={<span className="inline-flex text-[var(--warn)]"><Business size={18} strokeWidth={1.75} /></span>}
          title="Cout intervention"
          badge="Proprietaire"
          badgeTokens={WARN_TOKENS}
        >
          <FinRow label="Duree estimee" value={intervention.estimatedDurationHours ? `${intervention.estimatedDurationHours}h` : '-'} />
          {intervention.estimatedDurationHours && (
            <FinRow
              label="Cout estime (25 EUR/h)"
              value={fmtCurrency(intervention.estimatedDurationHours * 25)}
              bold
            />
          )}
          {intervention.actualCost != null && intervention.actualCost > 0 && (
            <FinRow label="Cout reel" value={fmtCurrency(intervention.actualCost)} bold color="var(--ok)" />
          )}

          <Divider sx={{ my: 0.75 }} />

          <FinRow
            label="Statut paiement"
            value=""
          >
            <DomainStatusChip
              status={intervention.paymentStatus || intervention.status}
              map={{ ...STATUS_LABELS, ...INTERVENTION_STATUS_LABELS }}
              tokenMap={{ ...STATUS_TOKENS, ...INTERVENTION_STATUS_TOKENS }}
            />
          </FinRow>

          {intervention.status === 'awaiting_payment' && (
            <Button
              size="small"
              variant="contained"
              startIcon={<CreditCard size={14} strokeWidth={1.75} />}
              fullWidth
              onClick={() => {
                const cost = intervention.estimatedCost || (intervention.estimatedDurationHours ? intervention.estimatedDurationHours * 25 : 0);
                setPaymentModalTarget({ interventionId: intervention.id, amount: cost, title: intervention.title });
                setPaymentModalOpen(true);
              }}
              color="warning"
              sx={{ mt: 1 }}
            >
              Payer {fmtCurrency(intervention.estimatedCost || (intervention.estimatedDurationHours ? intervention.estimatedDurationHours * 25 : 0))}
            </Button>
          )}

          {/* Generate invoice for standalone intervention */}
          {onGenerateInvoice && (
            <Button
              size="small"
              variant="outlined"
              startIcon={invoiceLoading ? <Spinner className="size-3" /> : <Receipt size={12} strokeWidth={1.75} />}
              fullWidth
              disabled={invoiceLoading}
              onClick={() => handleGenerateInvoice('INTERVENTION', intervention.id)}
              color="warning"
              sx={{ mt: 0.75 }}
            >
              Generer facture
            </Button>
          )}

          {/* Standalone intervention invoices */}
          {invoices.length > 0 && (
            <div className="mt-1.5">
              <span className="cn-text-caption font-semibold text-[0.6875rem] text-muted-foreground">
                Factures ({invoices.length})
              </span>
              {invoices.map((inv) => (
                <div className="flex items-center gap-1 mt-0.5" key={inv.id}>
                  <span className="inline-flex text-muted-foreground"><Receipt size={14} strokeWidth={1.75} /></span>
                  <span className="cn-text-caption text-[0.6875rem] font-semibold">
                    {inv.legalNumber || inv.fileName}
                  </span>
                  <DomainStatusChip status={inv.status} />
                  <div className="ms-auto flex gap-0.5">
                    <Tooltip title="Telecharger">
                      <IconButton
                        size="small"
                        onClick={async () => {
                          const { documentsApi } = await import('../../../services/api/documentsApi');
                          await documentsApi.downloadGeneration(inv.id, inv.fileName);
                        }}
                        sx={{ p: 0.25 }}
                      >
                        <Download size={14} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicata">
                      <IconButton
                        size="small"
                        onClick={async () => {
                          const { documentsApi } = await import('../../../services/api/documentsApi');
                          await documentsApi.downloadGeneration(inv.id, inv.fileName.replace('.pdf', '-duplicata.pdf'));
                        }}
                        sx={{ p: 0.25 }}
                      >
                        <Receipt size={14} strokeWidth={1.75} />
                      </IconButton>
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

      {/* View Payments Dialog */}
      <Dialog open={paymentsDialogOpen} onClose={() => setPaymentsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--accent)]"><Payment size={20} strokeWidth={1.75} /></span>
            <span>Historique des paiements</span>
          </div>
          <IconButton size="small" aria-label="Fermer" sx={CLOSE_BTN_SX} onClick={() => setPaymentsDialogOpen(false)}><Close size={18} strokeWidth={1.75} /></IconButton>
        </DialogTitle>
        <DialogContent>
          {payments.length === 0 ? (
            <UiAlert variant="info" className="text-[0.8125rem]">
              <Info />
              <AlertDescription>Aucun paiement enregistre.</AlertDescription>
            </UiAlert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Methode</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell align="right">Montant</TableCell>
                    <TableCell>Statut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{p.date}</TableCell>
                      <TableCell>{PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{p.reference || '-'}</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} align="right">
                        {p.status === 'REFUNDED' ? '-' : ''}{fmtCurrency(p.amount)}
                      </TableCell>
                      <TableCell><DomainStatusChip status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {payments.length > 0 && (
            <div className="mt-2 pt-1.5 border-t border-[var(--line)]">
              <div className="flex justify-between mb-0.5">
                <span className="cn-text-caption font-semibold text-[0.75rem]">Total paye</span>
                <span className="cn-text-caption font-bold text-[0.75rem] text-[var(--ok)]">{fmtCurrency(totalPaid)}</span>
              </div>
              {totalRefunded > 0 && (
                <div className="flex justify-between mb-0.5">
                  <span className="cn-text-caption font-semibold text-[0.75rem]">Total rembourse</span>
                  <span className="cn-text-caption font-bold text-[0.75rem] text-[var(--err)]">-{fmtCurrency(totalRefunded)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="cn-text-caption font-semibold text-[0.75rem]">Reste a payer</span>
                <span className={cn('cn-text-caption font-bold text-[0.75rem] tabular-nums', balanceDue > 0 ? 'text-[var(--warn)]' : 'text-[var(--ok)]')}>
                  <Money value={Math.max(0, balanceDue)} from="EUR" />
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={addPaymentOpen} onClose={() => setAddPaymentOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--accent)]"><Add size={20} strokeWidth={1.75} /></span>
            <span>Ajouter un paiement</span>
          </div>
          <IconButton size="small" aria-label="Fermer" sx={CLOSE_BTN_SX} onClick={() => setAddPaymentOpen(false)}><Close size={18} strokeWidth={1.75} /></IconButton>
        </DialogTitle>
        <DialogContent>
          {reservation && (
            <span className="cn-text-caption text-muted-foreground text-[0.6875rem] mb-2 block">
              Reservation : <strong>{reservation.guestName}</strong> — Reste a payer : <strong><Money value={Math.max(0, balanceDue)} from="EUR" /></strong>
            </span>
          )}
          <div className="flex flex-col gap-3">
            <TextField type="number" label="Montant (EUR)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} size="small" fullWidth required inputProps={{ min: 0.01, step: 0.01 }} sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
            <TextField select label="Methode de paiement" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} size="small" fullWidth sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}>
              {PAYMENT_METHODS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </TextField>
            <TextField type="date" label="Date du paiement" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
            <TextField label="Reference (optionnel)" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} size="small" fullWidth placeholder="N° transaction, cheque..." sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddPaymentOpen(false)} size="small">Annuler</Button>
          <Button onClick={handleAddPayment} variant="contained" size="small" disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || paymentLoading} startIcon={paymentLoading ? <Spinner className="size-3.5" /> : <Check size={16} strokeWidth={1.75} />}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Extra Fee Dialog */}
      <Dialog open={addFeeOpen} onClose={() => setAddFeeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--accent)]"><AttachMoney size={20} strokeWidth={1.75} /></span>
            <span>Frais supplementaires</span>
          </div>
          <IconButton size="small" aria-label="Fermer" sx={CLOSE_BTN_SX} onClick={() => setAddFeeOpen(false)}><Close size={18} strokeWidth={1.75} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <div className="flex flex-col gap-3">
            <TextField label="Description" value={feeDescription} onChange={(e) => setFeeDescription(e.target.value)} size="small" fullWidth required placeholder="Ex: Menage supplementaire, cle perdue..." sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
            <TextField type="number" label="Montant (EUR)" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} size="small" fullWidth required inputProps={{ min: 0.01, step: 0.01 }} sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
          </div>
          {grandTotal > 0 && (
            <Alert severity="info" sx={{ fontSize: '0.75rem', mt: 2, '& .MuiAlert-message': { py: 0.25 } }}>
              Nouveau total : <Money value={grandTotal + (parseFloat(feeAmount) || 0)} from="EUR" />
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddFeeOpen(false)} size="small">Annuler</Button>
          <Button onClick={handleAddFee} variant="contained" size="small" disabled={!feeDescription.trim() || !feeAmount || parseFloat(feeAmount) <= 0 || feeLoading} startIcon={feeLoading ? <Spinner className="size-3.5" /> : <Add size={16} strokeWidth={1.75} />}>
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog open={refundDialogOpen} onClose={() => setRefundDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--warn)]"><MoneyOff size={20} strokeWidth={1.75} /></span>
            <span>Confirmer le remboursement</span>
          </div>
          <IconButton size="small" aria-label="Fermer" sx={CLOSE_BTN_SX} onClick={() => setRefundDialogOpen(false)}><Close size={18} strokeWidth={1.75} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" icon={<Warning size={18} strokeWidth={1.75} />} sx={{ fontSize: '0.8125rem', mb: 2 }}>
            Cette action est irreversible. Le remboursement sera traite via le mode de paiement d'origine.
          </Alert>
          <div className="flex flex-col gap-0.5 p-2 rounded-[10px] bg-[var(--field)]">
            <div className="flex justify-between">
              <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">Montant total paye</p>
              <p className="cn-text-body2 font-bold text-[0.8125rem] tabular-nums">{fmtCurrency(totalPaid)}</p>
            </div>
            {reservation && (
              <div className="flex justify-between">
                <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">Client</p>
                <p className="cn-text-body2 font-semibold text-[0.8125rem]">{reservation.guestName}</p>
              </div>
            )}
            <div className="flex justify-between">
              <p className="cn-text-body2 text-muted-foreground text-[0.8125rem]">Montant rembourse</p>
              <p className="cn-text-body2 font-bold text-[0.8125rem] text-[var(--err)] tabular-nums">
                -{fmtCurrency(totalPaid)}
              </p>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefundDialogOpen(false)} size="small">Annuler</Button>
          <Button onClick={handleRefund} variant="contained" color="warning" size="small" disabled={refundLoading} startIcon={refundLoading ? <Spinner className="size-3.5" /> : <MoneyOff size={16} strokeWidth={1.75} />}>
            Confirmer le remboursement
          </Button>
        </DialogActions>
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

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ fontSize: '0.8125rem' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default PanelFinancial;
