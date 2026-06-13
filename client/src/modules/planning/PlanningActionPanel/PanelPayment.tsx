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
} from '../../../icons';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import { usePanelPayment } from './usePanelPayment';
import PanelPaymentCart from './PanelPaymentCart';
import { STATUS_TONES, toneTokensSx, type ToneTokens } from '../../../components/StatusChip';

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionResult = { success: boolean; error: string | null };

/** Statuts paiement → tons sémantiques partagés (REFUNDED = info ici, distinct de PanelFinancial). */
const STATUS_TOKENS: Record<string, ToneTokens> = {
  PAID: STATUS_TONES.ok,
  PENDING: STATUS_TONES.warn,
  AWAITING_PAYMENT: STATUS_TONES.warn,
  PROCESSING: STATUS_TONES.info,
  FAILED: STATUS_TONES.err,
  REFUNDED: STATUS_TONES.info,
  CANCELLED: STATUS_TONES.neutral,
  COMPLETED: STATUS_TONES.ok,
  SCHEDULED: STATUS_TONES.info,
  IN_PROGRESS: STATUS_TONES.info,
};

const NEUTRAL_TOKENS = STATUS_TONES.neutral;

/** Chip statut pilule — même pattern que PanelReservationInfo (texte couleur + fond soft). */
const chipSx = (bg: string, color: string) => ({
  ...toneTokensSx({ color, bg }),
  borderRadius: 'var(--radius-pill)',
});

const OVERLINE_SX = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--faint)',
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
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Payment size={18} strokeWidth={1.75} /></Box>
        <Typography sx={OVERLINE_SX}>Statut paiement</Typography>
        {(() => { const t = STATUS_TOKENS[(intervention.paymentStatus || intervention.status)?.toUpperCase()] || NEUTRAL_TOKENS; return (
        <Chip
          label={intervention.paymentStatus || intervention.status}
          size="small"
          sx={{ ...chipSx(t.bg, t.color), ml: 'auto' }}
        />
        ); })()}
      </Box>

      {/* Cost details */}
      <Box sx={{ p: 1.5, border: '1px solid var(--line)', borderRadius: '10px', mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Schedule size={14} strokeWidth={1.75} /></Box>
            <Typography sx={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>Durée estimée</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            {intervention.estimatedDurationHours || '—'} h
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><AttachMoney size={14} strokeWidth={1.75} /></Box>
            <Typography sx={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>Coût estimé</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
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
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}><Gavel size={16} strokeWidth={1.75} /></Box>
            <Typography sx={OVERLINE_SX}>
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
            startIcon={<CheckCircle size={14} strokeWidth={1.75} />}
            onClick={() => {
              setValidateCost(estimatedCost.toFixed(2));
              setValidateDialogOpen(true);
            }}
            sx={{ mb: 2 }}
          >
            Valider l'intervention
          </Button>
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Payment history */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Receipt size={16} strokeWidth={1.75} /></Box>
        <Typography sx={OVERLINE_SX}>
          Historique paiements
        </Typography>
      </Box>

      {payment.loadingHistory ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={20} />
        </Box>
      ) : payment.paymentHistory.length === 0 ? (
        <Typography sx={{ fontSize: '0.6875rem', color: 'var(--muted)', fontStyle: 'italic' }}>
          Aucun paiement enregistré
        </Typography>
      ) : (
        <TableContainer sx={{ mb: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ p: 0.5 }}>Date</TableCell>
                <TableCell sx={{ p: 0.5 }}>Montant</TableCell>
                <TableCell sx={{ p: 0.5 }}>Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payment.paymentHistory.map((record) => (
                <TableRow key={record.id}>
                  <TableCell sx={{ p: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(record.transactionDate).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell sx={{ p: 0.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {record.amount.toFixed(2)} €
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    {(() => { const t = STATUS_TOKENS[record.status] || NEUTRAL_TOKENS; return (
                    <Chip
                      label={record.status}
                      size="small"
                      sx={{ ...chipSx(t.bg, t.color), height: 18, fontSize: '0.625rem' }}
                    />
                    ); })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Validate dialog */}
      <Dialog open={validateDialogOpen} onClose={() => setValidateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Valider l'intervention</DialogTitle>
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
