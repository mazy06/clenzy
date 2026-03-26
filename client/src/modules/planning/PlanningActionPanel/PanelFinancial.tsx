import React, { useState, useCallback, useEffect } from 'react';
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
} from '@mui/icons-material';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';
import { useCurrency } from '../../../hooks/useCurrency';

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

const STATUS_HEX: Record<string, string> = {
  PAID: '#4A9B8E',
  PENDING: '#ED6C02',
  REFUNDED: '#d32f2f',
  DRAFT: '#757575',
  ISSUED: '#0288d1',
  PROCESSING: '#0288d1',
  FAILED: '#d32f2f',
  CANCELLED: '#757575',
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

const INTERVENTION_STATUS_HEX: Record<string, string> = {
  scheduled: '#0288d1',
  in_progress: '#ED6C02',
  completed: '#4A9B8E',
  cancelled: '#757575',
  pending: '#ED6C02',
  assigned: '#0288d1',
  awaiting_payment: '#D4A574',
  awaiting_validation: '#7B61FF',
};

let mockFinancialId = 5000;

// ── Section wrapper ─────────────────────────────────────────────────────────
const SectionCard: React.FC<{
  borderColor: string;
  bgColor: string;
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeColor: string;
  children: React.ReactNode;
}> = ({ borderColor, bgColor, icon, title, badge, badgeColor, children }) => (
  <Box
    sx={{
      borderLeft: `3px solid ${borderColor}`,
      backgroundColor: bgColor,
      borderRadius: '0 8px 8px 0',
      p: 1.5,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
      {icon}
      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', flex: 1 }}>
        {title}
      </Typography>
      <Chip
        label={badge}
        size="small"
        sx={{
          fontSize: '0.5625rem',
          height: 20,
          fontWeight: 600,
          backgroundColor: `${badgeColor}18`,
          color: badgeColor,
          border: `1px solid ${badgeColor}40`,
          borderRadius: '6px',
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    </Box>
    {children}
  </Box>
);

// ── Status chip helper ──────────────────────────────────────────────────────
const StatusChip: React.FC<{ status: string; map?: Record<string, string>; hexMap?: Record<string, string> }> = ({
  status,
  map = STATUS_LABELS,
  hexMap = STATUS_HEX,
}) => {
  const c = hexMap[status] || '#757575';
  return (
    <Chip
      label={map[status] || status}
      size="small"
      sx={{
        fontSize: '0.5625rem',
        height: 18,
        fontWeight: 600,
        backgroundColor: `${c}18`,
        color: c,
        border: `1px solid ${c}40`,
        borderRadius: '6px',
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
};

// ── Row helper ──────────────────────────────────────────────────────────────
const FinRow: React.FC<{
  label: string;
  value: string;
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
        sx={{ fontWeight: bold ? 700 : 600, fontSize: '0.8125rem', color: color || undefined }}
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
      setPayments((prev) => {
        // Don't duplicate if already has a PAID Stripe entry
        if (prev.some((p) => p.status === 'PAID' && p.reference?.startsWith('STRIPE-'))) return prev;
        return [{
          id: ++mockFinancialId,
          amount: reservation.totalPrice,
          method: 'card',
          date: reservation.paidAt || reservation.checkIn,
          status: 'PAID' as const,
          reference: `STRIPE-${reservation.id}`,
        }];
      });
    }
  }, [reservation?.id, reservation?.paymentStatus]);

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
          onPaymentComplete?.();
        }
      } catch {
        // Silent — non-blocking check
      }
    };
    checkPayment();
    return () => { cancelled = true; };
  }, [reservation?.id, reservation?.paymentStatus, reservation?.paymentLinkSentAt]);

  // ── Computed values — Reservation ──────────────────────────────────────
  const totalPrice = reservation?.totalPrice || 0;
  const totalExtraFees = extraFees.reduce((sum, f) => sum + f.amount, 0);
  const grandTotal = totalPrice + totalExtraFees;
  const totalPaid = payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = payments.filter((p) => p.status === 'REFUNDED').reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = grandTotal - totalPaid + totalRefunded;

  const paymentStatus = balanceDue <= 0 ? 'Solde' : totalPaid > 0 ? 'Partiel' : 'En attente';
  const paymentStatusHex = balanceDue <= 0 ? '#4A9B8E' : totalPaid > 0 ? '#0288d1' : '#ED6C02';

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
    showSnackbar(`Paiement de ${amount.toFixed(2)} EUR enregistre`);
  }, [paymentAmount, paymentMethod, paymentDate, paymentReference, today]);

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
    showSnackbar(`Frais "${newFee.description}" (+${amount.toFixed(2)} EUR) ajoute`);
  }, [feeDescription, feeAmount, today]);

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
    showSnackbar(`Remboursement de ${totalPaid.toFixed(2)} EUR effectue`, 'info');
  }, [totalPaid, today, reservation?.id]);

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

  // ── Formatters ─────────────────────────────────────────────────────────
  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  const fmtCurrency = (val: number) => `${val.toFixed(2)} EUR`;

  const isICalImport = reservation && (reservation.source === 'airbnb' || reservation.source === 'booking' || reservation.source === 'other');
  const hasTotalPrice = totalPrice > 0;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 : Paiement Réservation (Guest / Voyageur)
          ═══════════════════════════════════════════════════════════════════ */}
      {reservation && (
        <SectionCard
          borderColor="#0288d1"
          bgColor="#0288d108"
          icon={<Person sx={{ fontSize: 18, color: '#0288d1' }} />}
          title="Paiement reservation"
          badge="Voyageur"
          badgeColor="#0288d1"
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

          <FinRow label="Paye" value={fmtCurrency(totalPaid)} color="success.main" />

          {totalRefunded > 0 && (
            <FinRow label="Rembourse" value={`-${fmtCurrency(totalRefunded)}`} color="error.main" />
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              Reste a payer
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: balanceDue > 0 ? 'warning.main' : 'success.main' }}>
                {Math.max(0, balanceDue).toFixed(2)} EUR
              </Typography>
              <Chip
                label={paymentStatus}
                size="small"
                sx={{
                  fontSize: '0.625rem', height: 20, fontWeight: 600,
                  backgroundColor: `${paymentStatusHex}18`, color: paymentStatusHex,
                  border: `1px solid ${paymentStatusHex}40`, borderRadius: '6px',
                  '& .MuiChip-label': { px: 0.75 },
                }}
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
                  <Receipt sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>
                    {inv.legalNumber || inv.fileName}
                  </Typography>
                  <StatusChip status={inv.status} />
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
                        <Download sx={{ fontSize: 14 }} />
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
                        <Receipt sx={{ fontSize: 14 }} />
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
              <CheckCircle sx={{ fontSize: 16, color: '#4A9B8E', mt: 0.25 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ fontSize: '0.6875rem', color: '#4A9B8E', fontWeight: 600 }}>
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
            <Button
              size="small"
              variant="contained"
              startIcon={sendingLink ? <CircularProgress size={14} color="inherit" /> : <Send sx={{ fontSize: 14 }} />}
              disabled={sendingLink || !onSendPaymentLink || !hasTotalPrice || reservation?.paymentStatus === 'PAID'}
              onClick={() => {
                if (reservation.guestEmail) {
                  handleSendPaymentLink(reservation.guestEmail);
                } else {
                  setShowEmailInput(true);
                }
              }}
              sx={{
                flex: 1, fontSize: '0.6875rem', textTransform: 'none',
                backgroundColor: '#0288d1', '&:hover': { backgroundColor: '#01579b' },
              }}
            >
              {lastSentAt ? 'Renvoyer lien' : 'Lien paiement'}
            </Button>

            {invoices.length > 0 ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Download sx={{ fontSize: 12 }} />}
                onClick={async () => {
                  const inv = invoices[invoices.length - 1];
                  const { documentsApi } = await import('../../../services/api/documentsApi');
                  await documentsApi.downloadGeneration(inv.id, inv.fileName);
                }}
                sx={{ flex: 1, fontSize: '0.6875rem', textTransform: 'none' }}
              >
                Duplicata
              </Button>
            ) : (
              <Button
                size="small"
                variant="outlined"
                startIcon={invoiceLoading ? <CircularProgress size={12} /> : <Receipt sx={{ fontSize: 12 }} />}
                disabled={invoiceLoading || !onGenerateInvoice || !reservation || !hasTotalPrice}
                onClick={() => reservation && handleGenerateInvoice('RESERVATION', reservation.id)}
                sx={{ flex: 1, fontSize: '0.6875rem', textTransform: 'none' }}
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
                  startAdornment: <Email sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }} />,
                }}
              />
              <Button
                size="small"
                variant="contained"
                disabled={!linkEmail || sendingLink || !hasTotalPrice}
                onClick={() => handleSendPaymentLink(linkEmail)}
                sx={{ fontSize: '0.6875rem', textTransform: 'none', minWidth: 'auto', px: 1.5 }}
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
          borderColor="#D4A574"
          bgColor="#D4A57408"
          icon={<Business sx={{ fontSize: 18, color: '#D4A574' }} />}
          title="Paiement interventions"
          badge="Proprietaire"
          badgeColor="#D4A574"
        >
          {/* ── Interventions proposees (SR assignees, en attente de paiement) ── */}
          {payableServiceRequests.length > 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6875rem', color: '#D4A574' }}>
                  Interventions proposees ({payableServiceRequests.length})
                </Typography>
              </Box>
              {payableServiceRequests.map((sr) => {
                const cost = sr.estimatedCost || (sr.estimatedDurationHours ? sr.estimatedDurationHours * 25 : 0);
                const typeIcon = sr.serviceType === 'CLEANING' || sr.serviceType === 'EXPRESS_CLEANING'
                  ? <CleaningServices sx={{ fontSize: 14, color: '#D4A574' }} />
                  : <Handyman sx={{ fontSize: 14, color: '#D4A574' }} />;
                return (
                  <Box
                    key={`sr-${sr.id}`}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5,
                      p: 0.75, borderRadius: 1,
                      border: '1px dashed',
                      borderColor: '#D4A57480',
                      backgroundColor: '#D4A57408',
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
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 50, textAlign: 'right' }}>
                      {cost > 0 ? `${cost.toFixed(0)} EUR` : '\u2014'}
                    </Typography>
                    <Chip
                      label="A payer"
                      size="small"
                      sx={{
                        fontSize: '0.5625rem', height: 18, fontWeight: 600,
                        backgroundColor: '#D4A57420', color: '#D4A574',
                        border: '1px solid #D4A57440', borderRadius: '6px',
                        '& .MuiChip-label': { px: 0.5 },
                      }}
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
                  {interventionsExpanded ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                </IconButton>
              </Box>

              <Collapse in={interventionsExpanded}>
                {linkedInterventions.map((intv) => {
                  const cost = intv.actualCost || intv.estimatedCost || (intv.estimatedDurationHours ? intv.estimatedDurationHours * 25 : 0);
                  const typeIcon = intv.type === 'cleaning'
                    ? <CleaningServices sx={{ fontSize: 14, color: 'text.secondary' }} />
                    : <Handyman sx={{ fontSize: 14, color: 'text.secondary' }} />;
                  return (
                    <Box
                      key={intv.id}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5,
                        p: 0.75, borderRadius: 1, border: '1px solid', borderColor: 'divider',
                        backgroundColor: 'background.paper',
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
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 50, textAlign: 'right' }}>
                        {cost > 0 ? convertAndFormat(cost, 'EUR') : '—'}
                      </Typography>
                      <StatusChip
                        status={intv.paymentStatus || intv.status}
                        map={{ ...STATUS_LABELS, ...INTERVENTION_STATUS_LABELS }}
                        hexMap={{ ...STATUS_HEX, ...INTERVENTION_STATUS_HEX }}
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
            <FinRow label="Interventions proposees" value={fmtCurrency(srProposedTotal)} color="#D4A574" />
          )}
          <FinRow label="Total interventions" value={fmtCurrency(interventionCostTotal + srProposedTotal)} bold />
          {interventionPaid > 0 && (
            <FinRow label="Paye" value={fmtCurrency(interventionPaid)} color="#4A9B8E" />
          )}
          {interventionAwaitingTotal > 0 && (
            <FinRow label="En attente" value={fmtCurrency(interventionAwaitingTotal)} color="#D4A574" />
          )}

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
            {/* Pay button — SR proposees first, then unpaid interventions */}
            <Button
              size="small"
              variant="contained"
              startIcon={payingSR ? <CircularProgress size={14} color="inherit" /> : <CreditCard sx={{ fontSize: 14 }} />}
              disabled={payingSR || (payableServiceRequests.length === 0 && interventionCostTotal <= interventionPaid)}
              onClick={() => {
                if (payableServiceRequests.length > 0) {
                  const sr = payableServiceRequests[0];
                  handlePayServiceRequest({ id: sr.id, estimatedCost: sr.estimatedCost, title: sr.title });
                } else {
                  handlePayInterventions();
                }
              }}
              sx={{
                flex: 1,
                fontSize: '0.75rem', textTransform: 'none', fontWeight: 700,
                backgroundColor: '#D4A574', '&:hover': { backgroundColor: '#C0915E' },
                '&.Mui-disabled': { backgroundColor: '#D4A57440', color: '#fff8' },
              }}
            >
              Payer
            </Button>
            {/* Generate invoice for linked interventions — always visible */}
            <Button
              size="small"
              variant="outlined"
              startIcon={invoiceLoading ? <CircularProgress size={12} /> : <Receipt sx={{ fontSize: 12 }} />}
              disabled={invoiceLoading || linkedInterventions.length === 0 || !onGenerateInvoice}
              onClick={() => {
                if (linkedInterventions.length > 0) {
                  const intv = linkedInterventions[0];
                  handleGenerateInvoice('INTERVENTION', intv.id);
                }
              }}
              sx={{ flex: 1, fontSize: '0.6875rem', textTransform: 'none', borderColor: '#D4A574', color: '#D4A574' }}
            >
              Facture
            </Button>
            {/* Refund button — always visible */}
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<MoneyOff sx={{ fontSize: 12 }} />}
              disabled={interventionPaid <= 0}
              onClick={() => setRefundDialogOpen(true)}
              sx={{ flex: 1, fontSize: '0.6875rem', textTransform: 'none' }}
            >
              Remboursement
            </Button>
          </Box>
        </SectionCard>
      )}

      {/* ── No interventions message ───────────────────────────────────── */}
      {reservation && linkedInterventions.length === 0 && payableServiceRequests.length === 0 && (
        <SectionCard
          borderColor="#D4A574"
          bgColor="#D4A57408"
          icon={<Business sx={{ fontSize: 18, color: '#D4A574' }} />}
          title="Paiement interventions"
          badge="Proprietaire"
          badgeColor="#D4A574"
        >
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
            Aucune intervention liee a cette reservation.
          </Typography>
        </SectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          STANDALONE INTERVENTION (no reservation)
          ═══════════════════════════════════════════════════════════════════ */}
      {!reservation && intervention && (
        <SectionCard
          borderColor="#D4A574"
          bgColor="#D4A57408"
          icon={<Business sx={{ fontSize: 18, color: '#D4A574' }} />}
          title="Cout intervention"
          badge="Proprietaire"
          badgeColor="#D4A574"
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
            <FinRow label="Cout reel" value={fmtCurrency(intervention.actualCost)} bold color="#4A9B8E" />
          )}

          <Divider sx={{ my: 0.75 }} />

          <FinRow
            label="Statut paiement"
            value=""
          >
            <StatusChip
              status={intervention.paymentStatus || intervention.status}
              map={{ ...STATUS_LABELS, ...INTERVENTION_STATUS_LABELS }}
              hexMap={{ ...STATUS_HEX, ...INTERVENTION_STATUS_HEX }}
            />
          </FinRow>

          {intervention.status === 'awaiting_payment' && (
            <Button
              size="small"
              variant="contained"
              startIcon={<CreditCard sx={{ fontSize: 14 }} />}
              fullWidth
              onClick={() => {
                const cost = intervention.estimatedCost || (intervention.estimatedDurationHours ? intervention.estimatedDurationHours * 25 : 0);
                setPaymentModalTarget({ interventionId: intervention.id, amount: cost, title: intervention.title });
                setPaymentModalOpen(true);
              }}
              sx={{
                mt: 1,
                fontSize: '0.75rem', textTransform: 'none', fontWeight: 700,
                backgroundColor: '#D4A574', '&:hover': { backgroundColor: '#C0915E' },
              }}
            >
              Payer {fmtCurrency(intervention.estimatedCost || (intervention.estimatedDurationHours ? intervention.estimatedDurationHours * 25 : 0))}
            </Button>
          )}

          {/* Generate invoice for standalone intervention */}
          {onGenerateInvoice && (
            <Button
              size="small"
              variant="outlined"
              startIcon={invoiceLoading ? <CircularProgress size={12} /> : <Receipt sx={{ fontSize: 12 }} />}
              fullWidth
              disabled={invoiceLoading}
              onClick={() => handleGenerateInvoice('INTERVENTION', intervention.id)}
              sx={{
                mt: 0.75,
                fontSize: '0.6875rem', textTransform: 'none',
                borderColor: '#D4A574', color: '#D4A574',
              }}
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
                  <Receipt sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>
                    {inv.legalNumber || inv.fileName}
                  </Typography>
                  <StatusChip status={inv.status} />
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
                        <Download sx={{ fontSize: 14 }} />
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
                        <Receipt sx={{ fontSize: 14 }} />
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
      <Dialog open={paymentsDialogOpen} onClose={() => setPaymentsDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Payment sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Historique des paiements</Typography>
          </Box>
          <IconButton size="small" onClick={() => setPaymentsDialogOpen(false)}><Close sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 2 }}>
          {payments.length === 0 ? (
            <Alert severity="info" sx={{ fontSize: '0.8125rem' }}>Aucun paiement enregistre.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.6875rem', fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontSize: '0.6875rem', fontWeight: 700 }}>Methode</TableCell>
                    <TableCell sx={{ fontSize: '0.6875rem', fontWeight: 700 }}>Reference</TableCell>
                    <TableCell sx={{ fontSize: '0.6875rem', fontWeight: 700 }} align="right">Montant</TableCell>
                    <TableCell sx={{ fontSize: '0.6875rem', fontWeight: 700 }}>Statut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{p.date}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{p.reference || '-'}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }} align="right">
                        {p.status === 'REFUNDED' ? '-' : ''}{fmtCurrency(p.amount)}
                      </TableCell>
                      <TableCell><StatusChip status={p.status} /></TableCell>
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
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'success.main' }}>{fmtCurrency(totalPaid)}</Typography>
              </Box>
              {totalRefunded > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Total rembourse</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'error.main' }}>-{fmtCurrency(totalRefunded)}</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Reste a payer</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: balanceDue > 0 ? 'warning.main' : 'success.main' }}>
                  {Math.max(0, balanceDue).toFixed(2)} EUR
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={addPaymentOpen} onClose={() => setAddPaymentOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Add sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Ajouter un paiement</Typography>
          </Box>
          <IconButton size="small" onClick={() => setAddPaymentOpen(false)}><Close sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          {reservation && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', mb: 1.5, display: 'block' }}>
              Reservation : <strong>{reservation.guestName}</strong> — Reste a payer : <strong>{Math.max(0, balanceDue).toFixed(2)} EUR</strong>
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
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setAddPaymentOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>Annuler</Button>
          <Button onClick={handleAddPayment} variant="contained" size="small" disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || paymentLoading} startIcon={paymentLoading ? <CircularProgress size={14} /> : <Check sx={{ fontSize: 16 }} />} sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Extra Fee Dialog */}
      <Dialog open={addFeeOpen} onClose={() => setAddFeeOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachMoney sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Frais supplementaires</Typography>
          </Box>
          <IconButton size="small" onClick={() => setAddFeeOpen(false)}><Close sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Description" value={feeDescription} onChange={(e) => setFeeDescription(e.target.value)} size="small" fullWidth required placeholder="Ex: Menage supplementaire, cle perdue..." sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
            <TextField type="number" label="Montant (EUR)" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} size="small" fullWidth required inputProps={{ min: 0.01, step: 0.01 }} sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }} />
          </Box>
          {grandTotal > 0 && (
            <Alert severity="info" sx={{ fontSize: '0.75rem', mt: 2, '& .MuiAlert-message': { py: 0.25 } }}>
              Nouveau total : {(grandTotal + (parseFloat(feeAmount) || 0)).toFixed(2)} EUR
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setAddFeeOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>Annuler</Button>
          <Button onClick={handleAddFee} variant="contained" size="small" disabled={!feeDescription.trim() || !feeAmount || parseFloat(feeAmount) <= 0 || feeLoading} startIcon={feeLoading ? <CircularProgress size={14} /> : <Add sx={{ fontSize: 16 }} />} sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog open={refundDialogOpen} onClose={() => setRefundDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MoneyOff sx={{ fontSize: 20, color: 'warning.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Confirmer le remboursement</Typography>
          </Box>
          <IconButton size="small" onClick={() => setRefundDialogOpen(false)}><Close sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          <Alert severity="warning" icon={<Warning sx={{ fontSize: 18 }} />} sx={{ fontSize: '0.8125rem', mb: 2 }}>
            Cette action est irreversible. Le remboursement sera traite via le mode de paiement d'origine.
          </Alert>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>Montant total paye</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>{fmtCurrency(totalPaid)}</Typography>
            </Box>
            {reservation && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>Client</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>{reservation.guestName}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>Montant rembourse</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', color: 'error.main' }}>
                -{fmtCurrency(totalPaid)}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setRefundDialogOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>Annuler</Button>
          <Button onClick={handleRefund} variant="contained" color="warning" size="small" disabled={refundLoading} startIcon={refundLoading ? <CircularProgress size={14} /> : <MoneyOff sx={{ fontSize: 16 }} />} sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
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
