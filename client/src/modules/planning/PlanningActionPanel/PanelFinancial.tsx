import React, { useState, useCallback } from 'react';
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
  Download,
} from '@mui/icons-material';
import type { PlanningEvent } from '../types';
import type { Reservation } from '../../../services/api';

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

interface LocalInvoice {
  id: number;
  number: string;
  date: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID';
  totalHt: number;
  totalTtc: number;
}

const PAYMENT_METHODS = [
  { value: 'card', label: 'Carte bancaire' },
  { value: 'transfer', label: 'Virement bancaire' },
  { value: 'cash', label: 'Especes' },
  { value: 'check', label: 'Cheque' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'other', label: 'Autre' },
];

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  PAID: 'success',
  PENDING: 'warning',
  REFUNDED: 'error',
  DRAFT: 'default',
  ISSUED: 'info',
};

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Paye',
  PENDING: 'En attente',
  REFUNDED: 'Rembourse',
  DRAFT: 'Brouillon',
  ISSUED: 'Emise',
};

let mockFinancialId = 5000;

// ── Props ──────────────────────────────────────────────────────────────────
interface PanelFinancialProps {
  event: PlanningEvent;
  onFinancialAction?: (action: string, data: Record<string, unknown>) => Promise<{ success: boolean; error: string | null }>;
}

const PanelFinancial: React.FC<PanelFinancialProps> = ({ event, onFinancialAction }) => {
  const reservation = event.reservation;
  const intervention = event.intervention;

  const today = new Date().toISOString().split('T')[0];

  // ── Local financial state (mock mode) ────────────────────────────────────
  const [payments, setPayments] = useState<LocalPayment[]>(() => {
    if (!reservation) return [];
    // Generate a mock initial deposit if totalPrice exists
    if (reservation.totalPrice > 0) {
      const depositAmount = Math.round(reservation.totalPrice * 0.3 * 100) / 100;
      return [{
        id: ++mockFinancialId,
        amount: depositAmount,
        method: 'card',
        date: reservation.checkIn,
        status: 'PAID' as const,
        reference: `DEP-${reservation.id}`,
      }];
    }
    return [];
  });

  const [extraFees, setExtraFees] = useState<LocalExtraFee[]>([]);
  const [invoices, setInvoices] = useState<LocalInvoice[]>([]);

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

  // Errors & feedback
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // ── Computed values ──────────────────────────────────────────────────────
  const totalPrice = reservation?.totalPrice || 0;
  const totalExtraFees = extraFees.reduce((sum, f) => sum + f.amount, 0);
  const grandTotal = totalPrice + totalExtraFees;
  const totalPaid = payments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = payments.filter((p) => p.status === 'REFUNDED').reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = grandTotal - totalPaid + totalRefunded;

  const paymentStatus = balanceDue <= 0 ? 'Solde' : totalPaid > 0 ? 'Partiel' : 'En attente';
  const paymentStatusColor = balanceDue <= 0 ? 'success' : totalPaid > 0 ? 'info' : 'warning';

  // ── Handlers ─────────────────────────────────────────────────────────────

  // 1. Add payment
  const handleAddPayment = useCallback(async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setPaymentLoading(true);
    // Simulate API call
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

  // 2. Generate invoice
  const handleGenerateInvoice = useCallback(async () => {
    if (!reservation) return;
    setInvoiceLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    const taxRate = 0.20;
    const totalHt = Math.round(grandTotal / (1 + taxRate) * 100) / 100;
    const totalTtc = grandTotal;

    const newInvoice: LocalInvoice = {
      id: ++mockFinancialId,
      number: `FAC-${new Date().getFullYear()}-${String(mockFinancialId).padStart(4, '0')}`,
      date: today,
      status: 'DRAFT',
      totalHt,
      totalTtc,
    };
    setInvoices((prev) => [...prev, newInvoice]);
    setInvoiceLoading(false);
    showSnackbar(`Facture ${newInvoice.number} generee`);
  }, [reservation, grandTotal, today]);

  // 3. Add extra fee
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

  // 4. Refund
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Payment summary — Reservation */}
      {reservation && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
            Resume paiement
          </Typography>

          {/* Total line */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              Montant reservation
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {totalPrice.toFixed(2)} EUR
            </Typography>
          </Box>

          {/* Extra fees */}
          {extraFees.length > 0 && (
            <>
              {extraFees.map((fee) => (
                <Box key={fee.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    + {fee.description}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    {fee.amount.toFixed(2)} EUR
                  </Typography>
                </Box>
              ))}
              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                  Total
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {grandTotal.toFixed(2)} EUR
                </Typography>
              </Box>
            </>
          )}

          {/* Paid / Balance */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              Paye
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
              {totalPaid.toFixed(2)} EUR
            </Typography>
          </Box>

          {totalRefunded > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                Rembourse
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                -{totalRefunded.toFixed(2)} EUR
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                color={paymentStatusColor}
                sx={{ fontSize: '0.625rem', height: 20 }}
              />
            </Box>
          </Box>

          {/* Invoices summary */}
          {invoices.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6875rem', color: 'text.secondary' }}>
                Factures ({invoices.length})
              </Typography>
              {invoices.map((inv) => (
                <Box key={inv.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                  <Receipt sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.6875rem' }}>
                    {inv.number}
                  </Typography>
                  <Chip
                    label={STATUS_LABELS[inv.status] || inv.status}
                    size="small"
                    color={STATUS_COLORS[inv.status] || 'default'}
                    sx={{ fontSize: '0.5625rem', height: 16 }}
                  />
                  <Typography variant="caption" sx={{ fontSize: '0.6875rem', ml: 'auto' }}>
                    {inv.totalTtc.toFixed(2)} EUR
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Cost summary — Intervention */}
      {!reservation && intervention && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
            Cout intervention
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">Duree estimee</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {intervention.estimatedDurationHours ? `${intervention.estimatedDurationHours}h` : '-'}
            </Typography>
          </Box>
          {intervention.estimatedDurationHours && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Cout estime (25 EUR/h)</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {(intervention.estimatedDurationHours * 25).toFixed(2)} EUR
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <Divider />

      {/* Financial actions */}
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
          Actions financieres
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Payment sx={{ fontSize: 14 }} />}
            fullWidth
            onClick={() => setPaymentsDialogOpen(true)}
            sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
          >
            Voir paiements
            {payments.length > 0 && (
              <Chip
                label={payments.length}
                size="small"
                color="primary"
                sx={{ fontSize: '0.5625rem', height: 18, ml: 'auto' }}
              />
            )}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Add sx={{ fontSize: 14 }} />}
            fullWidth
            onClick={() => {
              setPaymentAmount(balanceDue > 0 ? balanceDue.toFixed(2) : '');
              setPaymentMethod('card');
              setPaymentDate(today);
              setPaymentReference('');
              setAddPaymentOpen(true);
            }}
            sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
          >
            Ajouter paiement
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={invoiceLoading ? <CircularProgress size={14} /> : <Receipt sx={{ fontSize: 14 }} />}
            fullWidth
            disabled={invoiceLoading || !reservation}
            onClick={handleGenerateInvoice}
            sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
          >
            Generer facture
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AttachMoney sx={{ fontSize: 14 }} />}
            fullWidth
            onClick={() => {
              setFeeDescription('');
              setFeeAmount('');
              setAddFeeOpen(true);
            }}
            sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
          >
            Ajouter frais supplementaires
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<MoneyOff sx={{ fontSize: 14 }} />}
            fullWidth
            disabled={totalPaid <= 0}
            onClick={() => setRefundDialogOpen(true)}
            sx={{ fontSize: '0.75rem', textTransform: 'none', justifyContent: 'flex-start' }}
          >
            Remboursement
          </Button>
        </Box>
      </Box>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* View Payments Dialog */}
      <Dialog
        open={paymentsDialogOpen}
        onClose={() => setPaymentsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Payment sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Historique des paiements
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setPaymentsDialogOpen(false)}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 2 }}>
          {payments.length === 0 ? (
            <Alert severity="info" sx={{ fontSize: '0.8125rem' }}>
              Aucun paiement enregistre pour cette reservation.
            </Alert>
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
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        {PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {p.reference || '-'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }} align="right">
                        {p.status === 'REFUNDED' ? '-' : ''}{p.amount.toFixed(2)} EUR
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_LABELS[p.status] || p.status}
                          size="small"
                          color={STATUS_COLORS[p.status] || 'default'}
                          sx={{ fontSize: '0.5625rem', height: 18 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Totals */}
          {payments.length > 0 && (
            <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Total paye</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'success.main' }}>{totalPaid.toFixed(2)} EUR</Typography>
              </Box>
              {totalRefunded > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Total rembourse</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'error.main' }}>-{totalRefunded.toFixed(2)} EUR</Typography>
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
      <Dialog
        open={addPaymentOpen}
        onClose={() => setAddPaymentOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Add sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Ajouter un paiement
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAddPaymentOpen(false)}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          {reservation && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', mb: 1.5, display: 'block' }}>
              Reservation : <strong>{reservation.guestName}</strong> — Reste a payer : <strong>{Math.max(0, balanceDue).toFixed(2)} EUR</strong>
            </Typography>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              type="number"
              label="Montant (EUR)"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              size="small"
              fullWidth
              required
              inputProps={{ min: 0.01, step: 0.01 }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
            <TextField
              select
              label="Methode de paiement"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              size="small"
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            >
              {PAYMENT_METHODS.map((m) => (
                <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              type="date"
              label="Date du paiement"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
            <TextField
              label="Reference (optionnel)"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              size="small"
              fullWidth
              placeholder="N° transaction, cheque..."
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setAddPaymentOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={handleAddPayment}
            variant="contained"
            size="small"
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || paymentLoading}
            startIcon={paymentLoading ? <CircularProgress size={14} /> : <Check sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Extra Fee Dialog */}
      <Dialog
        open={addFeeOpen}
        onClose={() => setAddFeeOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachMoney sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Frais supplementaires
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setAddFeeOpen(false)}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Description"
              value={feeDescription}
              onChange={(e) => setFeeDescription(e.target.value)}
              size="small"
              fullWidth
              required
              placeholder="Ex: Menage supplementaire, cle perdue..."
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
            <TextField
              type="number"
              label="Montant (EUR)"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              size="small"
              fullWidth
              required
              inputProps={{ min: 0.01, step: 0.01 }}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' } }}
            />
          </Box>

          {grandTotal > 0 && (
            <Alert severity="info" sx={{ fontSize: '0.75rem', mt: 2, '& .MuiAlert-message': { py: 0.25 } }}>
              Nouveau total : {(grandTotal + (parseFloat(feeAmount) || 0)).toFixed(2)} EUR
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setAddFeeOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={handleAddFee}
            variant="contained"
            size="small"
            disabled={!feeDescription.trim() || !feeAmount || parseFloat(feeAmount) <= 0 || feeLoading}
            startIcon={feeLoading ? <CircularProgress size={14} /> : <Add sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog
        open={refundDialogOpen}
        onClose={() => setRefundDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MoneyOff sx={{ fontSize: 20, color: 'warning.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
              Confirmer le remboursement
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setRefundDialogOpen(false)}>
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
          <Alert severity="warning" icon={<Warning sx={{ fontSize: 18 }} />} sx={{ fontSize: '0.8125rem', mb: 2 }}>
            Cette action est irreversible. Le remboursement sera traite via le mode de paiement d'origine.
          </Alert>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>Montant total paye</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>{totalPaid.toFixed(2)} EUR</Typography>
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
                -{totalPaid.toFixed(2)} EUR
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Button onClick={() => setRefundDialogOpen(false)} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={handleRefund}
            variant="contained"
            color="warning"
            size="small"
            disabled={refundLoading}
            startIcon={refundLoading ? <CircularProgress size={14} /> : <MoneyOff sx={{ fontSize: 16 }} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Confirmer le remboursement
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ fontSize: '0.8125rem' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PanelFinancial;
