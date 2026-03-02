import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Divider,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Payment,
  CheckCircle,
  Schedule,
  AttachMoney,
  Receipt,
  MoneyOff,
  Gavel,
} from '@mui/icons-material';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import { usePanelPayment } from './usePanelPayment';
import PanelPaymentCart from './PanelPaymentCart';

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionResult = { success: boolean; error: string | null };

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  PAID: 'success',
  PENDING: 'warning',
  AWAITING_PAYMENT: 'warning',
  PROCESSING: 'info',
  FAILED: 'error',
  REFUNDED: 'error',
  CANCELLED: 'default',
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface PanelPaymentProps {
  event: PlanningEvent;
  interventions?: PlanningIntervention[];
  onCreatePaymentSession?: (interventionIds: number[], total: number) => Promise<{ url: string; sessionId: string }>;
  onValidateIntervention?: (interventionId: number, estimatedCost: number) => Promise<ActionResult>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PanelPayment: React.FC<PanelPaymentProps> = ({
  event,
  interventions,
  onCreatePaymentSession,
  onValidateIntervention,
}) => {
  const { user } = useAuth();
  const intervention = event.intervention;

  const canValidate = user?.roles?.some((r: string) => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) || user?.orgRole === 'ADMIN';

  // Validate dialog state
  const [validateDialogOpen, setValidateDialogOpen] = useState(false);
  const [validateCost, setValidateCost] = useState('');
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState<string | null>(null);

  // Payment hook
  const payment = usePanelPayment(
    event.propertyId,
    interventions,
    onCreatePaymentSession,
  );

  const handleValidate = useCallback(async () => {
    if (!intervention || !onValidateIntervention) return;
    const cost = parseFloat(validateCost);
    if (isNaN(cost) || cost <= 0) {
      setValidateError('Veuillez entrer un coût valide');
      return;
    }
    setValidating(true);
    setValidateError(null);
    const result = await onValidateIntervention(intervention.id, cost);
    if (!result.success) setValidateError(result.error);
    else setValidateDialogOpen(false);
    setValidating(false);
  }, [intervention, validateCost, onValidateIntervention]);

  if (!intervention) {
    return (
      <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
        Aucune donnée d'intervention disponible
      </Alert>
    );
  }

  const estimatedCost = intervention.estimatedDurationHours
    ? intervention.estimatedDurationHours * 25
    : 0;

  return (
    <Box>
      {/* Payment status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Payment sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>Statut paiement</Typography>
        <Chip
          label={intervention.paymentStatus || intervention.status}
          size="small"
          color={STATUS_COLORS[intervention.paymentStatus || intervention.status] || 'default'}
          sx={{ fontSize: '0.625rem', height: 22, ml: 'auto' }}
        />
      </Box>

      {/* Cost details */}
      <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Schedule sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>Durée estimée</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>
            {intervention.estimatedDurationHours || '—'} h
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AttachMoney sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>Coût estimé</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'primary.main' }}>
            {estimatedCost.toFixed(2)} €
          </Typography>
        </Box>
      </Box>

      {/* Pay button for AWAITING_PAYMENT */}
      {intervention.status === 'awaiting_payment' && (
        <>
          <PanelPaymentCart payment={payment} />
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Manager validation */}
      {canValidate && intervention.status === 'awaiting_validation' && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Gavel sx={{ fontSize: 16, color: 'warning.main' }} />
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
              Validation manager
            </Typography>
          </Box>
          <Alert severity="warning" sx={{ fontSize: '0.6875rem', mb: 1 }}>
            Cette intervention est terminée et attend votre validation.
          </Alert>
          <Button
            variant="contained"
            color="warning"
            fullWidth
            size="small"
            startIcon={<CheckCircle sx={{ fontSize: 14 }} />}
            onClick={() => {
              setValidateCost(estimatedCost.toFixed(2));
              setValidateDialogOpen(true);
            }}
            sx={{ textTransform: 'none', fontSize: '0.75rem', mb: 2 }}
          >
            Valider l'intervention
          </Button>
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Payment history */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <Receipt sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
          Historique paiements
        </Typography>
      </Box>

      {payment.loadingHistory ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={20} />
        </Box>
      ) : payment.paymentHistory.length === 0 ? (
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontStyle: 'italic' }}>
          Aucun paiement enregistré
        </Typography>
      ) : (
        <TableContainer sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '0.5625rem', fontWeight: 700, p: 0.5 }}>Date</TableCell>
                <TableCell sx={{ fontSize: '0.5625rem', fontWeight: 700, p: 0.5 }}>Montant</TableCell>
                <TableCell sx={{ fontSize: '0.5625rem', fontWeight: 700, p: 0.5 }}>Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payment.paymentHistory.map((record) => (
                <TableRow key={record.id}>
                  <TableCell sx={{ fontSize: '0.5625rem', p: 0.5 }}>
                    {new Date(record.transactionDate).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.5625rem', fontWeight: 600, p: 0.5 }}>
                    {record.amount.toFixed(2)} €
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    <Chip
                      label={record.status}
                      size="small"
                      color={STATUS_COLORS[record.status] || 'default'}
                      sx={{ fontSize: '0.5rem', height: 18 }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Validate dialog */}
      <Dialog open={validateDialogOpen} onClose={() => setValidateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.875rem' }}>Valider l'intervention</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.75rem', mb: 2 }}>
            Intervention : <strong>{intervention.title}</strong>
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Coût final estimé (EUR)"
            type="number"
            value={validateCost}
            onChange={(e) => setValidateCost(e.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
          />
          {validateError && <Alert severity="error" sx={{ fontSize: '0.6875rem', mt: 1 }}>{validateError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValidateDialogOpen(false)} size="small">Annuler</Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleValidate}
            disabled={validating}
            startIcon={validating ? <CircularProgress size={14} /> : undefined}
          >
            Valider
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PanelPayment;
