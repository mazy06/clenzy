import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PaymentCheckoutModal from '../../../components/PaymentCheckoutModal';
import { serviceRequestsApi, type ServiceRequest } from '../../../services/api/serviceRequestsApi';
import { reservationsApi } from '../../../services/api/reservationsApi';
import {
  Box,
  Typography,
  Button,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Tooltip,
} from '@mui/material';
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
import { RESERVATION_SOURCE_LABELS } from '../../../services/api/reservationsApi';
import { useCurrency } from '../../../hooks/useCurrency';
import { Money } from '../../../components/Money';
import StatusChip, { STATUS_TONES, toneTokensSx, type ToneTokens } from '../../../components/StatusChip';

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

/** Chip statut pilule — même pattern que PanelReservationInfo (texte couleur + fond soft). */
const chipSx = (bg: string, color: string) => ({
  ...toneTokensSx({ color, bg }),
  height: 20,
  borderRadius: 'var(--radius-pill)',
});

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
  <Box
    sx={{
      border: '1px solid var(--line)',
      backgroundColor: 'var(--card)',
      borderRadius: '12px',
      p: 1.5,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
      {icon}
      <Typography variant="body2" sx={{ ...OVERLINE_SX, flex: 1 }}>
        {title}
      </Typography>
      <Chip label={badge} size="small" sx={chipSx(badgeTokens.bg, badgeTokens.color)} />
    </Box>
    {children}
  </Box>
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
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
    <Typography
      variant="body2"
      color={secondary !== false ? 'text.secondary' : undefined}
      sx={{ fontSize: '0.8125rem' }}
    >
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          fontSize: '0.8125rem',
          color: color || 'var(--ink)',
          fontVariantNumeric: 'tabular-nums',
          ...(bold && { fontFamily: 'var(--font-display)' }),
        }}
      >
        {value}
      </Typography>
      {children}
    </Box>
  </Box>
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
      const list = (result as unknown as { content?: ServiceRequest[] }).content ?? result;
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

  const isICalImport = reservation && (reservation.source === 'airbnb' || reservation.source === 'booking' || reservation.source === 'other');
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ─── MONTANT (hero) ─────────────────────────────────────────────── */}
      {reservation && (
        <Box>
          <Box
            component="span"
            sx={{
              display: 'block',
              fontSize: '0.625rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--faint)',
              mb: 0.5,
            }}
          >
            Montant
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexWrap: 'wrap' }}>
            <Box
              component="span"
              sx={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--ink)',
                lineHeight: 1.1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {isICalImport && !hasTotalPrice ? 'Non communiqué' : fmtCurrency(grandTotal)}
            </Box>
            {(hasTotalPrice || isOTABooking) && (
              <Box
                component="span"
                sx={{
                  alignSelf: 'center',
                  px: 1,
                  py: '3px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  backgroundColor: isSettled ? 'var(--ok-soft)' : 'var(--warn-soft)',
                  color: isSettled ? 'var(--ok)' : 'var(--warn)',
                }}
              >
                {isOTABooking ? `Réglé · ${otaChannelLabel}` : isSettled ? 'Réglé' : 'En attente'}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 : Paiement Réservation (Guest / Voyageur)
          ═══════════════════════════════════════════════════════════════════ */}
      {reservation && (
        <SectionCard
          icon={<Box component="span" sx={{ display: 'inline-flex', color: 'var(--info)' }}><Person size={18} strokeWidth={1.75} /></Box>}
          title="Paiement reservation"
          badge="Voyageur"
          badgeTokens={INFO_TOKENS}
        >
          {/* Summary */}
          <FinRow label="Montant reservation" value={isICalImport && !hasTotalPrice ? 'Non communique' : fmtCurrency(totalPrice)} bold />

          {extraFees.length > 0 && (
            <>
              {extraFees.map((fee) => (
                <Box key={fee.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    + {fee.description}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    {fmtCurrency(fee.amount)}
                  </Typography>
                </Box>
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

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              Reste a payer
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  fontVariantNumeric: 'tabular-nums',
                  color: effectiveBalanceDue > 0 ? 'var(--warn)' : 'var(--ok)',
                }}
              >
                <Money value={Math.max(0, effectiveBalanceDue)} from="EUR" />
              </Typography>
              <Chip
                label={effectivePaymentStatus}
                size="small"
                sx={chipSx(effectivePaymentStatusTokens.bg, effectivePaymentStatusTokens.color)}
              />
            </Box>
          </Box>

          {/* Invoices */}
          {invoices.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6875rem', color: 'text.secondary' }}>
                Factures ({invoices.length})
              </Typography>
              {invoices.map((inv) => (
                <Box key={inv.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Receipt size={14} strokeWidth={1.75} /></Box>
                  <Typography variant="caption" sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>
                    {inv.legalNumber || inv.fileName}
                  </Typography>
                  <DomainStatusChip status={inv.status} />
                  <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
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
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          <Divider sx={{ my: 0.75 }} />

          {/* ── Confirmation lien envoye ──────────────────────────── */}
          {lastSentAt && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
              <Box component="span" sx={{ display: 'inline-flex', mt: 0.25, color: 'var(--ok)' }}><CheckCircle size={16} strokeWidth={1.75} /></Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ fontSize: '0.6875rem', color: 'var(--ok)', fontWeight: 600 }}>
                  Lien envoye le {fmtDate(lastSentAt)}
                </Typography>
                {lastSentEmail && (
                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.625rem', color: 'text.secondary' }}>
                    a {lastSentEmail}
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {linkSent && (
            <Alert severity="success" sx={{ fontSize: '0.6875rem', mt: 0.5, mb: 0.5, py: 0, '& .MuiAlert-message': { py: 0.25 } }}>
              Lien envoye avec succes !
            </Alert>
          )}

          {/* ── Action buttons (same row) ──────────────────────────── */}
          <Box sx={{ display: 'flex', gap: 0.75, mt: 1 }}>
            {isOTABooking ? (
              // OTA : paiement deja regle sur le canal externe → pas de bouton
              // d'envoi de lien, juste une note d'information.
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.75,
                  px: 1.25,
                  py: 0.875,
                  borderRadius: '9px',
                  backgroundColor: 'var(--ok-soft)',
                  border: '1px solid color-mix(in srgb, var(--ok) 30%, transparent)',
                }}
              >
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--ok)' }}><CheckCircle size={14} strokeWidth={1.75} /></Box>
                <Typography variant="caption" sx={{ fontSize: '0.6875rem', color: 'var(--ok)', fontWeight: 500 }}>
                  Reglement effectue sur {otaChannelLabel}
                </Typography>
              </Box>
            ) : (
              <Button
                size="small"
                variant="contained"
                startIcon={sendingLink ? <CircularProgress size={14} color="inherit" /> : <Send size={14} strokeWidth={1.75} />}
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
                startIcon={invoiceLoading ? <CircularProgress size={12} /> : <Receipt size={12} strokeWidth={1.75} />}
                disabled={invoiceLoading || !onGenerateInvoice || !reservation || !hasTotalPrice}
                onClick={() => reservation && handleGenerateInvoice('RESERVATION', reservation.id)}
                sx={{ flex: 1 }}
              >
                Facture
              </Button>
            )}
          </Box>

          {/* Email input (si pas d'email guest) */}
          <Collapse in={showEmailInput}>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
              <TextField
                size="small"
                placeholder="Email du voyageur"
                type="email"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.75rem' } }}
                InputProps={{
                  startAdornment: <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mr: 0.5 }}><Email size={14} strokeWidth={1.75} /></Box>,
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
            </Box>
          </Collapse>

        </SectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 : Paiement Interventions (Propriétaire / Conciergerie)
          ═══════════════════════════════════════════════════════════════════ */}
      {reservation && (linkedInterventions.length > 0 || payableServiceRequests.length > 0) && (
        <SectionCard
          icon={<Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}><Business size={18} strokeWidth={1.75} /></Box>}
          title="Paiement interventions"
          badge="Proprietaire"
          badgeTokens={WARN_TOKENS}
        >
          {/* ── Interventions proposees (SR assignees, en attente de paiement) ── */}
          {payableServiceRequests.length > 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6875rem', color: 'var(--warn)' }}>
                  Interventions proposees ({payableServiceRequests.length})
                </Typography>
              </Box>
              {payableServiceRequests.map((sr) => {
                const cost = sr.estimatedCost || (sr.estimatedDurationHours ? sr.estimatedDurationHours * 25 : 0);
                const typeIcon = (
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}>
                    {sr.serviceType === 'CLEANING' || sr.serviceType === 'EXPRESS_CLEANING'
                      ? <CleaningServices size={14} strokeWidth={1.75} />
                      : <Handyman size={14} strokeWidth={1.75} />}
                  </Box>
                );
                return (
                  <Box
                    key={`sr-${sr.id}`}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5,
                      p: 0.75, borderRadius: '9px',
                      border: '1px dashed color-mix(in srgb, var(--warn) 50%, transparent)',
                      backgroundColor: 'var(--warn-soft)',
                    }}
                  >
                    {typeIcon}
                    <Tooltip title={sr.title} placement="top">
                      <Typography
                        sx={{ fontSize: '0.6875rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {sr.title}
                      </Typography>
                    </Tooltip>
                    {sr.estimatedDurationHours > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                        {sr.estimatedDurationHours}h
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {cost > 0 ? <Money value={cost} from="EUR" decimals={0} /> : '\u2014'}
                    </Typography>
                    <Chip
                      label="A payer"
                      size="small"
                      sx={{ ...chipSx('var(--warn-soft)', 'var(--warn)'), height: 18, fontSize: '0.625rem', '& .MuiChip-label': { px: 0.75 } }}
                    />
                  </Box>
                );
              })}
              {linkedInterventions.length > 0 && <Divider sx={{ my: 0.5 }} />}
            </>
          )}

          {/* ── Interventions existantes (deja creees et payees) ── */}
          {linkedInterventions.length > 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6875rem', color: 'text.secondary' }}>
                  Prestations liees ({linkedInterventions.length})
                </Typography>
                <IconButton size="small" onClick={() => setInterventionsExpanded(!interventionsExpanded)} sx={{ p: 0.25 }}>
                  {interventionsExpanded ? <ExpandLess size={16} strokeWidth={1.75} /> : <ExpandMore size={16} strokeWidth={1.75} />}
                </IconButton>
              </Box>

              <Collapse in={interventionsExpanded}>
                {linkedInterventions.map((intv) => {
                  const cost = intv.actualCost || intv.estimatedCost || (intv.estimatedDurationHours ? intv.estimatedDurationHours * 25 : 0);
                  const typeIcon = intv.type === 'cleaning'
                    ? <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><CleaningServices size={14} strokeWidth={1.75} /></Box>
                    : <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Handyman size={14} strokeWidth={1.75} /></Box>;
                  return (
                    <Box
                      key={intv.id}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5,
                        p: 0.75, borderRadius: '9px', border: '1px solid var(--line)',
                        backgroundColor: 'var(--card)',
                      }}
                    >
                      {typeIcon}
                      <Tooltip title={intv.title} placement="top">
                        <Typography
                          sx={{ fontSize: '0.6875rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {intv.title}
                        </Typography>
                      </Tooltip>
                      {intv.estimatedDurationHours > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                          {intv.estimatedDurationHours}h
                        </Typography>
                      )}
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {cost > 0 ? <Money value={cost} from="EUR" /> : '—'}
                      </Typography>
                      <DomainStatusChip
                        status={intv.paymentStatus || intv.status}
                        map={{ ...STATUS_LABELS, ...INTERVENTION_STATUS_LABELS }}
                        tokenMap={{ ...STATUS_TOKENS, ...INTERVENTION_STATUS_TOKENS }}
                      />
                    </Box>
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
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
            {/* Pay button — SR proposees first, then unpaid interventions */}
            <Button
              size="small"
              variant="contained"
              startIcon={payingSR ? <CircularProgress size={14} color="inherit" /> : <CreditCard size={14} strokeWidth={1.75} />}
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
              startIcon={invoiceLoading ? <CircularProgress size={12} /> : <Receipt size={12} strokeWidth={1.75} />}
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
          </Box>
        </SectionCard>
      )}

      {/* ── No interventions message ───────────────────────────────────── */}
      {reservation && linkedInterventions.length === 0 && payableServiceRequests.length === 0 && (
        <SectionCard
          icon={<Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}><Business size={18} strokeWidth={1.75} /></Box>}
          title="Paiement interventions"
          badge="Proprietaire"
          badgeTokens={WARN_TOKENS}
        >
          <Typography variant="body2" sx={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--muted)' }}>
            Aucune intervention liee a cette reservation.
          </Typography>
        </SectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          STANDALONE INTERVENTION (no reservation)
          ═══════════════════════════════════════════════════════════════════ */}
      {!reservation && intervention && (
        <SectionCard
          icon={<Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}><Business size={18} strokeWidth={1.75} /></Box>}
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
              startIcon={invoiceLoading ? <CircularProgress size={12} /> : <Receipt size={12} strokeWidth={1.75} />}
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
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6875rem', color: 'text.secondary' }}>
                Factures ({invoices.length})
              </Typography>
              {invoices.map((inv) => (
                <Box key={inv.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Receipt size={14} strokeWidth={1.75} /></Box>
                  <Typography variant="caption" sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>
                    {inv.legalNumber || inv.fileName}
                  </Typography>
                  <DomainStatusChip status={inv.status} />
                  <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
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
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </SectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOGS (unchanged logic, kept compact)
          ═══════════════════════════════════════════════════════════════════ */}

      {/* View Payments Dialog */}
      <Dialog open={paymentsDialogOpen} onClose={() => setPaymentsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Payment size={20} strokeWidth={1.75} /></Box>
            <Typography component="span" variant="inherit">Historique des paiements</Typography>
          </Box>
          <IconButton size="small" aria-label="Fermer" sx={CLOSE_BTN_SX} onClick={() => setPaymentsDialogOpen(false)}><Close size={18} strokeWidth={1.75} /></IconButton>
        </DialogTitle>
        <DialogContent>
          {payments.length === 0 ? (
            <Alert severity="info" sx={{ fontSize: '0.8125rem' }}>Aucun paiement enregistre.</Alert>
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
            <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Total paye</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--ok)' }}>{fmtCurrency(totalPaid)}</Typography>
              </Box>
              {totalRefunded > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Total rembourse</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--err)' }}>-{fmtCurrency(totalRefunded)}</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Reste a payer</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', color: balanceDue > 0 ? 'var(--warn)' : 'var(--ok)' }}>
                  <Money value={Math.max(0, balanceDue)} from="EUR" />
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={addPaymentOpen} onClose={() => setAddPaymentOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Add size={20} strokeWidth={1.75} /></Box>
            <Typography component="span" variant="inherit">Ajouter un paiement</Typography>
          </Box>
          <IconButton size="small" aria-label="Fermer" sx={CLOSE_BTN_SX} onClick={() => setAddPaymentOpen(false)}><Close size={18} strokeWidth={1.75} /></IconButton>
        </DialogTitle>
        <DialogContent>
          {reservation && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', mb: 1.5, display: 'block' }}>
              Reservation : <strong>{reservation.guestName}</strong> — Reste a payer : <strong><Money value={Math.max(0, balanceDue)} from="EUR" /></strong>
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField type="number" label="Montant (EUR)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} size="small" fullWidth required inputProps={{ min: 0.01, step: 0.01 }} sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
            <TextField select label="Methode de paiement" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} size="small" fullWidth sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}>
              {PAYMENT_METHODS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </TextField>
            <TextField type="date" label="Date du paiement" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
            <TextField label="Reference (optionnel)" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} size="small" fullWidth placeholder="N° transaction, cheque..." sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddPaymentOpen(false)} size="small">Annuler</Button>
          <Button onClick={handleAddPayment} variant="contained" size="small" disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || paymentLoading} startIcon={paymentLoading ? <CircularProgress size={14} /> : <Check size={16} strokeWidth={1.75} />}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Extra Fee Dialog */}
      <Dialog open={addFeeOpen} onClose={() => setAddFeeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><AttachMoney size={20} strokeWidth={1.75} /></Box>
            <Typography component="span" variant="inherit">Frais supplementaires</Typography>
          </Box>
          <IconButton size="small" aria-label="Fermer" sx={CLOSE_BTN_SX} onClick={() => setAddFeeOpen(false)}><Close size={18} strokeWidth={1.75} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Description" value={feeDescription} onChange={(e) => setFeeDescription(e.target.value)} size="small" fullWidth required placeholder="Ex: Menage supplementaire, cle perdue..." sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
            <TextField type="number" label="Montant (EUR)" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} size="small" fullWidth required inputProps={{ min: 0.01, step: 0.01 }} sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
          </Box>
          {grandTotal > 0 && (
            <Alert severity="info" sx={{ fontSize: '0.75rem', mt: 2, '& .MuiAlert-message': { py: 0.25 } }}>
              Nouveau total : <Money value={grandTotal + (parseFloat(feeAmount) || 0)} from="EUR" />
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddFeeOpen(false)} size="small">Annuler</Button>
          <Button onClick={handleAddFee} variant="contained" size="small" disabled={!feeDescription.trim() || !feeAmount || parseFloat(feeAmount) <= 0 || feeLoading} startIcon={feeLoading ? <CircularProgress size={14} /> : <Add size={16} strokeWidth={1.75} />}>
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog open={refundDialogOpen} onClose={() => setRefundDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}><MoneyOff size={20} strokeWidth={1.75} /></Box>
            <Typography component="span" variant="inherit">Confirmer le remboursement</Typography>
          </Box>
          <IconButton size="small" aria-label="Fermer" sx={CLOSE_BTN_SX} onClick={() => setRefundDialogOpen(false)}><Close size={18} strokeWidth={1.75} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" icon={<Warning size={18} strokeWidth={1.75} />} sx={{ fontSize: '0.8125rem', mb: 2 }}>
            Cette action est irreversible. Le remboursement sera traite via le mode de paiement d'origine.
          </Alert>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.5, borderRadius: '10px', bgcolor: 'var(--field)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>Montant total paye</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(totalPaid)}</Typography>
            </Box>
            {reservation && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>Client</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>{reservation.guestName}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>Montant rembourse</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--err)', fontVariantNumeric: 'tabular-nums' }}>
                -{fmtCurrency(totalPaid)}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefundDialogOpen(false)} size="small">Annuler</Button>
          <Button onClick={handleRefund} variant="contained" color="warning" size="small" disabled={refundLoading} startIcon={refundLoading ? <CircularProgress size={14} /> : <MoneyOff size={16} strokeWidth={1.75} />}>
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
    </Box>
  );
};

export default PanelFinancial;
