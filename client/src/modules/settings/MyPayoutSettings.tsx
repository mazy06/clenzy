import React, { useState } from 'react';
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
  Divider,
} from '@mui/material';
import {
  AccountBalance,
  Save,
  VerifiedUser,
  Warning,
  CreditCard,
  OpenInNew,
  CheckCircle,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useMyPayoutConfig,
  useUpdateMySepa,
  useInitMyStripeConnect,
  useMyStripeOnboardingLink,
} from '../../hooks/useOwnerPayoutConfig';

// ─── Constants ──────────────────────────────────────────────────────────────

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

// ─── Component ──────────────────────────────────────────────────────────────

export default function MyPayoutSettings() {
  const { t } = useTranslation();
  const { data: config, isLoading, isError } = useMyPayoutConfig();
  const updateSepaMutation = useUpdateMySepa();
  const initStripeMutation = useInitMyStripeConnect();
  const onboardingLinkMutation = useMyStripeOnboardingLink();

  // SEPA form
  const [sepaIban, setSepaIban] = useState('');
  const [sepaBic, setSepaBic] = useState('');
  const [sepaHolder, setSepaHolder] = useState('');
  const [ibanError, setIbanError] = useState('');

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  // ─── SEPA handlers ──────────────────────────────────────────────────────

  const handleSaveSepa = async () => {
    const cleanIban = sepaIban.replace(/\s+/g, '').toUpperCase();
    if (!IBAN_REGEX.test(cleanIban)) {
      setIbanError(t('settings.myPayout.ibanInvalid', 'Format IBAN invalide (ex: FR7630006000011234567890189)'));
      return;
    }

    try {
      await updateSepaMutation.mutateAsync({
        iban: cleanIban,
        bic: sepaBic.trim(),
        bankAccountHolder: sepaHolder.trim(),
      });
      setSepaIban('');
      setSepaBic('');
      setSepaHolder('');
      showSnackbar(t('settings.myPayout.sepaSuccess', 'Coordonnees bancaires enregistrees'), 'success');
    } catch {
      showSnackbar(t('settings.myPayout.sepaError', "Erreur lors de l'enregistrement"), 'error');
    }
  };

  // ─── Stripe Connect handlers ────────────────────────────────────────────

  const handleInitStripeConnect = async () => {
    try {
      const result = await initStripeMutation.mutateAsync();
      window.location.href = result.onboardingUrl;
    } catch {
      showSnackbar(t('settings.myPayout.stripeError', 'Erreur lors de la connexion Stripe'), 'error');
    }
  };

  const handleResumeOnboarding = async () => {
    try {
      const result = await onboardingLinkMutation.mutateAsync();
      window.location.href = result.url;
    } catch {
      showSnackbar(t('settings.myPayout.stripeError', 'Erreur lors de la connexion Stripe'), 'error');
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {t('common.loadingError', 'Erreur lors du chargement des donnees. Veuillez reessayer.')}
      </Alert>
    );
  }

  const hasSepaConfig = config?.payoutMethod === 'SEPA_TRANSFER' && config.maskedIban;
  const hasStripeConnect = config?.payoutMethod === 'STRIPE_CONNECT';
  const isStripeComplete = hasStripeConnect && config?.stripeOnboardingComplete;
  const isStripeInProgress = hasStripeConnect && !config?.stripeOnboardingComplete && config?.stripeConnectedAccountId;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <AccountBalance sx={{ color: '#A6C0CE', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
          {t('settings.myPayout.title', 'Mes coordonnees de reversement')}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('settings.myPayout.subtitle', 'Renseignez vos coordonnees bancaires pour recevoir vos reversements.')}
      </Typography>

      {/* Status */}
      {config && config.id && (
        <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem' }}>
            {t('settings.myPayout.statusLabel', 'Statut')} :
          </Typography>
          {config.verified ? (
            <Chip
              icon={<VerifiedUser sx={{ fontSize: '0.75rem !important' }} />}
              label={t('settings.myPayout.verified', 'Verifie')}
              size="small"
              color="success"
              sx={{ fontSize: '0.625rem', height: 20, fontWeight: 600 }}
            />
          ) : (
            <Chip
              icon={<Warning sx={{ fontSize: '0.75rem !important' }} />}
              label={t('settings.myPayout.pendingVerification', 'En attente de verification')}
              size="small"
              color="warning"
              sx={{ fontSize: '0.625rem', height: 20, fontWeight: 600 }}
            />
          )}
        </Box>
      )}

      {/* ── Section SEPA ── */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <AccountBalance sx={{ fontSize: 18, color: '#1976d2' }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.875rem' }}>
            {t('settings.myPayout.sepaSection', 'Virement bancaire (SEPA)')}
          </Typography>
        </Box>

        {hasSepaConfig && (
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.8125rem' }} icon={<CheckCircle sx={{ fontSize: 18 }} />}>
            {t('settings.myPayout.currentIban', 'IBAN actuel')} : <strong>{config.maskedIban}</strong>
            {config.bic ? ` — BIC : ${config.bic}` : ''}
            {config.bankAccountHolder ? ` — ${config.bankAccountHolder}` : ''}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label={t('settings.myPayout.ibanLabel', 'IBAN')}
            value={sepaIban}
            onChange={(e) => {
              setSepaIban(e.target.value);
              setIbanError('');
            }}
            error={!!ibanError}
            helperText={ibanError}
            placeholder="FR76 3000 6000 0112 3456 7890 189"
            size="small"
            fullWidth
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.875rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label={t('settings.myPayout.bicLabel', 'BIC / SWIFT')}
              value={sepaBic}
              onChange={(e) => setSepaBic(e.target.value)}
              placeholder="AGRIFRPP"
              size="small"
              sx={{ flex: 1 }}
              InputProps={{ sx: { fontSize: '0.875rem' } }}
              InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
            />
            <TextField
              label={t('settings.myPayout.holderLabel', 'Titulaire du compte')}
              value={sepaHolder}
              onChange={(e) => setSepaHolder(e.target.value)}
              placeholder="Jean Dupont"
              size="small"
              sx={{ flex: 2 }}
              InputProps={{ sx: { fontSize: '0.875rem' } }}
              InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
            <Button
              variant="contained"
              size="small"
              onClick={handleSaveSepa}
              disabled={updateSepaMutation.isPending || !sepaIban.trim() || !sepaHolder.trim()}
              startIcon={updateSepaMutation.isPending ? <CircularProgress size={14} /> : <Save />}
              sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
            >
              {t('settings.myPayout.saveSepa', 'Enregistrer')}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
              {t('settings.myPayout.verificationNote', 'Apres modification, vos coordonnees seront verifiees par Clenzy avant activation.')}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* ── Section Stripe Connect ── */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <CreditCard sx={{ fontSize: 18, color: '#635bff' }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.875rem' }}>
            {t('settings.myPayout.stripeSection', 'Stripe Connect')}
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.8125rem' }}>
          {t('settings.myPayout.stripeDescription', 'Connectez votre compte Stripe pour recevoir vos reversements automatiquement.')}
        </Typography>

        {isStripeComplete && (
          <Alert severity="success" sx={{ fontSize: '0.8125rem' }} icon={<CheckCircle sx={{ fontSize: 18 }} />}>
            {t('settings.myPayout.stripeConnected', 'Votre compte Stripe est connecte et actif.')}
          </Alert>
        )}

        {isStripeInProgress && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Alert severity="warning" sx={{ fontSize: '0.8125rem' }}>
              {t('settings.myPayout.stripeOnboardingPending', "Votre inscription Stripe n'est pas terminee. Veuillez la completer.")}
            </Alert>
            <Button
              variant="outlined"
              size="small"
              onClick={handleResumeOnboarding}
              disabled={onboardingLinkMutation.isPending}
              startIcon={onboardingLinkMutation.isPending ? <CircularProgress size={14} /> : <OpenInNew />}
              sx={{
                textTransform: 'none',
                fontSize: '0.8125rem',
                color: '#635bff',
                borderColor: '#635bff',
                '&:hover': { borderColor: '#4b45c6', backgroundColor: 'rgba(99, 91, 255, 0.04)' },
                alignSelf: 'flex-start',
              }}
            >
              {t('settings.myPayout.stripeResumeBtn', "Reprendre l'inscription Stripe")}
            </Button>
          </Box>
        )}

        {!hasStripeConnect && (
          <Button
            variant="outlined"
            size="small"
            onClick={handleInitStripeConnect}
            disabled={initStripeMutation.isPending}
            startIcon={initStripeMutation.isPending ? <CircularProgress size={14} /> : <CreditCard />}
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              color: '#635bff',
              borderColor: '#635bff',
              '&:hover': { borderColor: '#4b45c6', backgroundColor: 'rgba(99, 91, 255, 0.04)' },
            }}
          >
            {t('settings.myPayout.stripeConnectBtn', 'Connecter mon compte Stripe')}
          </Button>
        )}
      </Paper>

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
