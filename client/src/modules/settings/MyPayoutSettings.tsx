import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui';
import { useSearchParams } from 'react-router-dom';
import { accountingApi } from '../../services/api/accountingApi';
import { TextField, Button, Alert, Snackbar, CircularProgress, Chip, Divider } from '@mui/material';
import {
  AccountBalance,
  Save,
  VerifiedUser,
  Warning,
  CreditCard,
  OpenInNew,
  CheckCircle,
  Settings as SettingsIcon,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useQueryClient } from '@tanstack/react-query';
import {
  useMyPayoutConfig,
  useUpdateMySepa,
  useInitMyStripeConnect,
  useMyStripeOnboardingLink,
  ownerPayoutConfigKeys,
} from '../../hooks/useOwnerPayoutConfig';
import PayoutMethodEditDialog from './components/PayoutMethodEditDialog';
import OpenBankingConsentBanner from './components/OpenBankingConsentBanner';

// ─── Constants ──────────────────────────────────────────────────────────────

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

// ─── Component ──────────────────────────────────────────────────────────────

export default function MyPayoutSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: config, isLoading, isError } = useMyPayoutConfig();
  const updateSepaMutation = useUpdateMySepa();
  const initStripeMutation = useInitMyStripeConnect();
  const onboardingLinkMutation = useMyStripeOnboardingLink();

  // SEPA form
  const [sepaIban, setSepaIban] = useState('');
  const [sepaBic, setSepaBic] = useState('');
  const [sepaHolder, setSepaHolder] = useState('');
  const [ibanError, setIbanError] = useState('');

  // Unified method dialog (Wise + Open Banking + autres)
  const [methodDialogOpen, setMethodDialogOpen] = useState(false);

  // Open Banking callback auto-finalize
  // Si l'URL contient ?openbanking=callback (retour depuis SCA banque),
  // on appelle automatiquement le backend pour valider le consent.
  const [searchParams, setSearchParams] = useSearchParams();
  const [obProcessing, setObProcessing] = useState(false);
  const [obError, setObError] = useState<string | null>(null);
  useEffect(() => {
    if (searchParams.get('openbanking') !== 'callback') return;
    setObProcessing(true);
    accountingApi.finalizeOpenBankingCallback()
      .then(() => {
        // Cleanup URL pour éviter de re-déclencher au refresh
        const next = new URLSearchParams(searchParams);
        next.delete('openbanking');
        setSearchParams(next, { replace: true });
        queryClient.invalidateQueries({ queryKey: ownerPayoutConfigKeys.me });
      })
      .catch((e) => {
        setObError(e instanceof Error
          ? e.message
          : 'Le consent Open Banking n\'a pas pu être validé. Veuillez relancer le SCA.');
      })
      .finally(() => setObProcessing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="flex justify-center py-6">
        <CircularProgress size={32} />
      </div>
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
    <div>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <AccountBalance size={20} strokeWidth={1.75} color='var(--info)' />
        <h6 className="cn-text-subtitle1 font-semibold text-[0.95rem]">
          {t('settings.myPayout.title', 'Mes coordonnees de reversement')}
        </h6>
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {t('settings.myPayout.subtitle', 'Renseignez vos coordonnees bancaires pour recevoir vos reversements.')}
      </p>

      {/* Status */}
      {config && config.id && (
        <div className="mb-3.5 flex items-center gap-2">
          <p className="cn-text-body2 font-semibold text-[0.8125rem]">
            {t('settings.myPayout.statusLabel', 'Statut')} :
          </p>
          {config.verified ? (
            <Chip
              icon={<VerifiedUser size={12} strokeWidth={1.75} />}
              label={t('settings.myPayout.verified', 'Verifie')}
              size="small"
              color="success"
              sx={{ fontSize: '0.625rem', height: 20, fontWeight: 600 }}
            />
          ) : (
            <Chip
              icon={<Warning size={12} strokeWidth={1.75} />}
              label={t('settings.myPayout.pendingVerification', 'En attente de verification')}
              size="small"
              color="warning"
              sx={{ fontSize: '0.625rem', height: 20, fontWeight: 600 }}
            />
          )}
        </div>
      )}

      {/* ── Banner retour Open Banking SCA ── */}
      {obProcessing && (
        <Alert severity="info" sx={{ mb: 2, fontSize: '0.85rem', borderRadius: 2 }}>
          {t('settings.myPayout.obProcessing', 'Validation du consent Open Banking en cours…')}
        </Alert>
      )}
      {obError && (
        <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem', borderRadius: 2 }} onClose={() => setObError(null)}>
          {obError}
        </Alert>
      )}

      {/* ── Bannière proactive expiration consent Open Banking ── */}
      <OpenBankingConsentBanner
        config={config}
        onReconnect={() => setMethodDialogOpen(true)}
      />

      {/* ── Bannière Méthodes avancées (Wise, Open Banking) ── */}
      {/* `color-mix()` reste en style inline : la syntaxe arbitraire de Tailwind
          n'accepte pas les espaces, et l'echapper la rendrait illisible. */}
      <Card
        className="mb-4 flex flex-row flex-wrap items-center justify-between gap-3 bg-[var(--accent-soft)] p-3"
        style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}
      >
        <div className="flex-1 min-w-[200px]">
          <p className="cn-text-body1 text-[0.85rem] font-bold text-[var(--accent)] mb-0.5">
            {t('settings.myPayout.advancedTitle', 'Méthodes avancées disponibles')}
          </p>
          <p className="cn-text-body1 text-[0.78rem] text-muted-foreground leading-[1.45]">
            {t(
              'settings.myPayout.advancedSubtitle',
              'Wise Business pour les virements internationaux (Maroc, Arabie Saoudite, 80+ pays) ou Open Banking PIS pour des virements SEPA automatiques sans upload manuel.',
            )}
          </p>
        </div>
        <Button
          variant="outlined"
          size="small"
          startIcon={<SettingsIcon size={14} strokeWidth={1.75} />}
          onClick={() => setMethodDialogOpen(true)}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.78rem',
            borderRadius: '8px',
            borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)',
            color: 'var(--accent)',
            '&:hover': { borderColor: 'var(--accent)', backgroundColor: 'var(--accent-soft)' },
          }}
        >
          {t('settings.myPayout.changeMethodBtn', 'Choisir une autre méthode')}
        </Button>
      </Card>

      {/* ── Section SEPA ── */}
      <Card className="gap-0 py-0 p-3.5 mb-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <AccountBalance size={18} strokeWidth={1.75} color='var(--info)' />
          <h6 className="cn-text-subtitle2 font-bold text-[0.875rem]">
            {t('settings.myPayout.sepaSection', 'Virement bancaire (SEPA)')}
          </h6>
        </div>

        {hasSepaConfig && (
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.8125rem' }} icon={<CheckCircle size={18} strokeWidth={1.75} />}>
            {t('settings.myPayout.currentIban', 'IBAN actuel')} : <strong>{config.maskedIban}</strong>
            {config.bic ? ` — BIC : ${config.bic}` : ''}
            {config.bankAccountHolder ? ` — ${config.bankAccountHolder}` : ''}
          </Alert>
        )}

        <div className="flex flex-col gap-2">
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
          <div className="flex gap-2">
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
          </div>

          <div className="flex items-center gap-2 mt-0.5">
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
            <span className="cn-text-caption text-muted-foreground text-[0.6875rem]">
              {t('settings.myPayout.verificationNote', 'Apres modification, vos coordonnees seront verifiees par Baitly avant activation.')}
            </span>
          </div>
        </div>
      </Card>

      {/* ── Section Stripe Connect ── */}
      <Card className="gap-0 py-0 p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <CreditCard size={18} strokeWidth={1.75} color='#635bff' />
          <h6 className="cn-text-subtitle2 font-bold text-[0.875rem]">
            {t('settings.myPayout.stripeSection', 'Stripe Connect')}
          </h6>
        </div>

        <p className="cn-text-body2 text-muted-foreground mb-3 text-[0.8125rem]">
          {t('settings.myPayout.stripeDescription', 'Connectez votre compte Stripe pour recevoir vos reversements automatiquement.')}
        </p>

        {isStripeComplete && (
          <Alert severity="success" sx={{ fontSize: '0.8125rem' }} icon={<CheckCircle size={18} strokeWidth={1.75} />}>
            {t('settings.myPayout.stripeConnected', 'Votre compte Stripe est connecte et actif.')}
          </Alert>
        )}

        {isStripeInProgress && (
          <div className="flex flex-col gap-2">
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
          </div>
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
      </Card>

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

      <PayoutMethodEditDialog
        open={methodDialogOpen}
        currentConfig={config ?? null}
        mode="self"
        onClose={() => setMethodDialogOpen(false)}
        onSaved={() => {
          setSnackbar({
            open: true,
            message: t('settings.myPayout.methodSaved', 'Méthode de reversement mise à jour'),
            severity: 'success',
          });
          queryClient.invalidateQueries({ queryKey: ownerPayoutConfigKeys.me });
        }}
      />
    </div>
  );
}
