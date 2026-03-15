import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AccountBalance,
  Save,
  VerifiedUser,
  CreditCard,
  Warning,
  Edit as EditIcon,
  CheckCircle,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useAllOwnerPayoutConfigs,
  useUpdatePayoutMethod,
  useUpdateSepaDetails,
  useVerifyOwnerConfig,
} from '../../hooks/useOwnerPayoutConfig';
import type { OwnerPayoutConfig, PayoutMethod } from '../../services/api/accountingApi';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  MANUAL: 'Manuel',
  STRIPE_CONNECT: 'Stripe Connect',
  SEPA_TRANSFER: 'Virement SEPA',
};

const PAYOUT_METHOD_COLORS: Record<PayoutMethod, string> = {
  MANUAL: '#9e9e9e',
  STRIPE_CONNECT: '#635bff',
  SEPA_TRANSFER: '#1976d2',
};

const CELL_SX = { fontSize: '0.8125rem', py: 1.25 } as const;
const HEAD_CELL_SX = { fontSize: '0.75rem', fontWeight: 700, py: 1, color: 'text.secondary' } as const;

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

// ─── Component ──────────────────────────────────────────────────────────────

export default function OwnerPayoutSettings() {
  const { t } = useTranslation();
  const { data: configs = [], isLoading } = useAllOwnerPayoutConfigs();
  const updateMethodMutation = useUpdatePayoutMethod();
  const updateSepaMutation = useUpdateSepaDetails();
  const verifyMutation = useVerifyOwnerConfig();

  // SEPA edit dialog
  const [sepaOpen, setSepaOpen] = useState(false);
  const [sepaTarget, setSepaTarget] = useState<OwnerPayoutConfig | null>(null);
  const [sepaIban, setSepaIban] = useState('');
  const [sepaBic, setSepaBic] = useState('');
  const [sepaHolder, setSepaHolder] = useState('');
  const [ibanError, setIbanError] = useState('');

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const openSepaDialog = (config: OwnerPayoutConfig) => {
    setSepaTarget(config);
    setSepaIban('');
    setSepaBic(config.bic ?? '');
    setSepaHolder(config.bankAccountHolder ?? '');
    setIbanError('');
    setSepaOpen(true);
  };

  const handleSaveSepa = async () => {
    if (!sepaTarget) return;
    const cleanIban = sepaIban.replace(/\s+/g, '').toUpperCase();
    if (!IBAN_REGEX.test(cleanIban)) {
      setIbanError(t('settings.ownerPayout.ibanInvalid', 'Format IBAN invalide'));
      return;
    }

    try {
      await updateSepaMutation.mutateAsync({
        ownerId: sepaTarget.ownerId,
        data: { iban: cleanIban, bic: sepaBic.trim(), bankAccountHolder: sepaHolder.trim() },
      });
      setSepaOpen(false);
      setSnackbar({ open: true, message: t('settings.ownerPayout.sepaSaved', 'Coordonnees SEPA enregistrees'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('settings.ownerPayout.sepaError', 'Erreur lors de l\'enregistrement'), severity: 'error' });
    }
  };

  const handleMethodChange = async (ownerId: number, method: PayoutMethod) => {
    try {
      await updateMethodMutation.mutateAsync({ ownerId, data: { payoutMethod: method } });
      setSnackbar({ open: true, message: t('settings.ownerPayout.methodUpdated', 'Methode de paiement mise a jour'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('settings.ownerPayout.methodError', 'Erreur lors de la mise a jour'), severity: 'error' });
    }
  };

  const handleVerify = async (ownerId: number) => {
    try {
      await verifyMutation.mutateAsync(ownerId);
      setSnackbar({ open: true, message: t('settings.ownerPayout.verified', 'Configuration verifiee'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('settings.ownerPayout.verifyError', 'Erreur lors de la verification'), severity: 'error' });
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <AccountBalance sx={{ color: '#A6C0CE', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
          {t('settings.ownerPayout.title', 'Configuration des reversements proprietaires')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('settings.ownerPayout.subtitle', 'Configurez la methode de paiement pour chaque proprietaire (Stripe Connect, virement SEPA ou manuel).')}
      </Typography>

      {configs.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <AccountBalance sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {t('settings.ownerPayout.empty', 'Aucune configuration trouvee. Les configurations sont creees automatiquement lors de la premiere generation de payout.')}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={HEAD_CELL_SX}>{t('settings.ownerPayout.col.owner', 'Proprietaire')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('settings.ownerPayout.col.method', 'Methode')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('settings.ownerPayout.col.details', 'Details')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="center">{t('settings.ownerPayout.col.status', 'Statut')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id} hover>
                  <TableCell sx={CELL_SX}>
                    {t('settings.ownerPayout.ownerLabel', 'Proprietaire')} #{config.ownerId}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={PAYOUT_METHOD_LABELS[config.payoutMethod]}
                      size="small"
                      sx={{
                        fontSize: '0.625rem',
                        height: 20,
                        fontWeight: 700,
                        backgroundColor: PAYOUT_METHOD_COLORS[config.payoutMethod],
                        color: '#fff',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ ...CELL_SX, fontSize: '0.75rem' }}>
                    {config.payoutMethod === 'SEPA_TRANSFER' && config.maskedIban && (
                      <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {config.maskedIban}
                        {config.bic ? ` / ${config.bic}` : ''}
                      </Typography>
                    )}
                    {config.payoutMethod === 'STRIPE_CONNECT' && (
                      <Typography component="span" sx={{ fontSize: '0.75rem' }}>
                        {config.stripeOnboardingComplete
                          ? t('settings.ownerPayout.stripeConnected', 'Compte connecte')
                          : t('settings.ownerPayout.stripeNotConnected', 'Onboarding en cours...')}
                      </Typography>
                    )}
                    {config.payoutMethod === 'MANUAL' && (
                      <Typography component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {t('settings.ownerPayout.manualNote', 'Virement manuel')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {config.verified ? (
                      <Chip
                        icon={<VerifiedUser sx={{ fontSize: '0.75rem !important' }} />}
                        label={t('settings.ownerPayout.verifiedLabel', 'Verifie')}
                        size="small"
                        color="success"
                        sx={{ fontSize: '0.625rem', height: 20, fontWeight: 600 }}
                      />
                    ) : (
                      <Chip
                        icon={<Warning sx={{ fontSize: '0.75rem !important' }} />}
                        label={t('settings.ownerPayout.pendingLabel', 'En attente')}
                        size="small"
                        color="warning"
                        sx={{ fontSize: '0.625rem', height: 20, fontWeight: 600 }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {config.payoutMethod === 'SEPA_TRANSFER' && (
                      <Tooltip title={t('settings.ownerPayout.editSepa', 'Modifier SEPA')}>
                        <IconButton size="small" onClick={() => openSepaDialog(config)}>
                          <EditIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {!config.verified && (
                      <Tooltip title={t('settings.ownerPayout.verify', 'Verifier')}>
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleVerify(config.ownerId)}
                          disabled={verifyMutation.isPending}
                        >
                          <CheckCircle sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── SEPA Edit Dialog ── */}
      <Dialog
        open={sepaOpen}
        onClose={() => setSepaOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
          {t('settings.ownerPayout.editSepaTitle', 'Coordonnees bancaires SEPA')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label={t('settings.ownerPayout.iban', 'IBAN')}
            value={sepaIban}
            onChange={(e) => {
              setSepaIban(e.target.value);
              setIbanError('');
            }}
            error={!!ibanError}
            helperText={ibanError || (sepaTarget?.maskedIban ? `${t('settings.ownerPayout.current', 'Actuel')} : ${sepaTarget.maskedIban}` : '')}
            size="small"
            fullWidth
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.875rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />
          <TextField
            label={t('settings.ownerPayout.bic', 'BIC/SWIFT')}
            value={sepaBic}
            onChange={(e) => setSepaBic(e.target.value)}
            size="small"
            fullWidth
            InputProps={{ sx: { fontSize: '0.875rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />
          <TextField
            label={t('settings.ownerPayout.holder', 'Titulaire du compte')}
            value={sepaHolder}
            onChange={(e) => setSepaHolder(e.target.value)}
            size="small"
            fullWidth
            InputProps={{ sx: { fontSize: '0.875rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSepaOpen(false)} size="small" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSaveSepa}
            disabled={updateSepaMutation.isPending || !sepaIban.trim() || !sepaHolder.trim()}
            startIcon={updateSepaMutation.isPending ? <CircularProgress size={14} /> : <Save />}
            sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
          >
            {t('common.save', 'Enregistrer')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
