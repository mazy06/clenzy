import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, Info, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Field, FieldError, FieldLabel, Input } from '../../components/ui';
import { useSearchParams } from 'react-router-dom';
import { accountingApi } from '../../services/api/accountingApi';
import { useNotification } from '../../hooks/useNotification';
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

  const { notify } = useNotification();

  const showMessage = (message: string, severity: 'success' | 'error') => {
    notify[severity](message);
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
      showMessage(t('settings.myPayout.sepaSuccess', 'Coordonnees bancaires enregistrees'), 'success');
    } catch {
      showMessage(t('settings.myPayout.sepaError', "Erreur lors de l'enregistrement"), 'error');
    }
  };

  // ─── Stripe Connect handlers ────────────────────────────────────────────

  const handleInitStripeConnect = async () => {
    try {
      const result = await initStripeMutation.mutateAsync();
      window.location.href = result.onboardingUrl;
    } catch {
      showMessage(t('settings.myPayout.stripeError', 'Erreur lors de la connexion Stripe'), 'error');
    }
  };

  const handleResumeOnboarding = async () => {
    try {
      const result = await onboardingLinkMutation.mutateAsync();
      window.location.href = result.url;
    } catch {
      showMessage(t('settings.myPayout.stripeError', 'Erreur lors de la connexion Stripe'), 'error');
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (isError) {
    return (
      <BuiAlert variant="destructive" className="mt-3">
        <TriangleAlert />
        <AlertDescription>{t('common.loadingError', 'Erreur lors du chargement des donnees. Veuillez reessayer.')}</AlertDescription>
      </BuiAlert>
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
            <Badge variant="success" className="text-[0.625rem] h-[20px] font-semibold"><VerifiedUser size={12} strokeWidth={1.75} />{t('settings.myPayout.verified', 'Verifie')}</Badge>
          ) : (
            <Badge variant="warning" className="text-[0.625rem] h-[20px] font-semibold"><Warning size={12} strokeWidth={1.75} />{t('settings.myPayout.pendingVerification', 'En attente de verification')}</Badge>
          )}
        </div>
      )}

      {/* ── Banner retour Open Banking SCA ── */}
      {obProcessing && (
        <BuiAlert variant="info" className="mb-3 text-[0.85rem]">
          <Info />
          <AlertDescription>{t('settings.myPayout.obProcessing', 'Validation du consent Open Banking en cours…')}</AlertDescription>
        </BuiAlert>
      )}
      {obError && (
        <BuiAlert variant="destructive" className="mb-3 text-[0.85rem]">
          <TriangleAlert />
          <AlertDescription>{obError}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setObError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
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
        <BuiButton
          variant="outline"
          size="sm"
          className="text-[var(--accent)] border-[var(--accent)] hover:bg-[var(--accent-soft)]"
          onClick={() => setMethodDialogOpen(true)}
        >
          <SettingsIcon size={14} strokeWidth={1.75} />
          {t('settings.myPayout.changeMethodBtn', 'Choisir une autre méthode')}
        </BuiButton>
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
          <BuiAlert variant="info" className="mb-3 text-[0.8125rem]">
            <CheckCircle size={18} strokeWidth={1.75} />
            <AlertDescription>
              {t('settings.myPayout.currentIban', 'IBAN actuel')} : <strong>{config.maskedIban}</strong>
              {config.bic ? ` — BIC : ${config.bic}` : ''}
              {config.bankAccountHolder ? ` — ${config.bankAccountHolder}` : ''}
            </AlertDescription>
          </BuiAlert>
        )}

        <div className="flex flex-col gap-2">
          <Field>
            <FieldLabel htmlFor="payout-sepa-iban" className="text-[0.8125rem]">
              {t('settings.myPayout.ibanLabel', 'IBAN')}
            </FieldLabel>
            <Input
              id="payout-sepa-iban"
              className="w-full font-mono text-[0.875rem]"
              value={sepaIban}
              onChange={(e) => {
                setSepaIban(e.target.value);
                setIbanError('');
              }}
              aria-invalid={!!ibanError}
              placeholder="FR76 3000 6000 0112 3456 7890 189"
            />
            <FieldError>{ibanError}</FieldError>
          </Field>
          <div className="flex gap-2">
            <Field className="flex-1">
              <FieldLabel htmlFor="payout-sepa-bic" className="text-[0.8125rem]">
                {t('settings.myPayout.bicLabel', 'BIC / SWIFT')}
              </FieldLabel>
              <Input
                id="payout-sepa-bic"
                className="w-full text-[0.875rem]"
                value={sepaBic}
                onChange={(e) => setSepaBic(e.target.value)}
                placeholder="AGRIFRPP"
              />
            </Field>
            <Field className="flex-[2]">
              <FieldLabel htmlFor="payout-sepa-holder" className="text-[0.8125rem]">
                {t('settings.myPayout.holderLabel', 'Titulaire du compte')}
              </FieldLabel>
              <Input
                id="payout-sepa-holder"
                className="w-full text-[0.875rem]"
                value={sepaHolder}
                onChange={(e) => setSepaHolder(e.target.value)}
                placeholder="Jean Dupont"
              />
            </Field>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <BuiButton
              size="sm"
              onClick={handleSaveSepa}
              disabled={updateSepaMutation.isPending || !sepaIban.trim() || !sepaHolder.trim()}
            >
              {updateSepaMutation.isPending ? <Spinner className="size-3.5" /> : <Save />}
              {t('settings.myPayout.saveSepa', 'Enregistrer')}
            </BuiButton>
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
          <BuiAlert variant="success" className="text-[0.8125rem]">
            <CheckCircle size={18} strokeWidth={1.75} />
            <AlertDescription>
              {t('settings.myPayout.stripeConnected', 'Votre compte Stripe est connecte et actif.')}
            </AlertDescription>
          </BuiAlert>
        )}

        {isStripeInProgress && (
          <div className="flex flex-col gap-2">
            <BuiAlert variant="warning" className="text-[0.8125rem]">
              <TriangleAlert />
              <AlertDescription>{t('settings.myPayout.stripeOnboardingPending', "Votre inscription Stripe n'est pas terminee. Veuillez la completer.")}</AlertDescription>
            </BuiAlert>
            {/* Violet Stripe conserve : c'est la couleur de marque du fournisseur,
                pas une teinte semantique — elle identifie l'action au premier coup d'oeil. */}
            <BuiButton
              variant="outline"
              size="sm"
              className="self-start text-[#635bff] border-[#635bff] hover:bg-[#635bff]/5"
              onClick={handleResumeOnboarding}
              disabled={onboardingLinkMutation.isPending}
            >
              {onboardingLinkMutation.isPending ? <Spinner className="size-3.5" /> : <OpenInNew />}
              {t('settings.myPayout.stripeResumeBtn', "Reprendre l'inscription Stripe")}
            </BuiButton>
          </div>
        )}

        {!hasStripeConnect && (
          <BuiButton
            variant="outline"
            size="sm"
            className="self-start text-[#635bff] border-[#635bff] hover:bg-[#635bff]/5"
            onClick={handleInitStripeConnect}
            disabled={initStripeMutation.isPending}
          >
            {initStripeMutation.isPending ? <Spinner className="size-3.5" /> : <CreditCard />}
            {t('settings.myPayout.stripeConnectBtn', 'Connecter mon compte Stripe')}
          </BuiButton>
        )}
      </Card>

      <PayoutMethodEditDialog
        open={methodDialogOpen}
        currentConfig={config ?? null}
        mode="self"
        onClose={() => setMethodDialogOpen(false)}
        onSaved={() => {
          notify.success(t('settings.myPayout.methodSaved', 'Méthode de reversement mise à jour'));
          queryClient.invalidateQueries({ queryKey: ownerPayoutConfigKeys.me });
        }}
      />
    </div>
  );
}
