import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Spinner } from '../../components/ui';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  Input,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  Checkbox,
  Separator,
  ToggleGroup,
  ToggleGroupItem,
} from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
// Le fil d'etapes reste MUI : le kit Baitly n'a pas de primitif Stepper, et
// `CustomStepIcon` recoit les props internes de `StepLabel`. Le bouton de
// soumission garde lui aussi son gabarit MUI : sa teinte `secondary.dark` au
// survol n'a pas de jeton equivalent cote tokens Signature.
import { Box, Button, Stepper, Step, StepLabel, StepIconProps } from '@mui/material';
import {
  ShoppingCart as CartIcon,
  CreditCard as CreditCardIcon,
  CheckCircle as CheckCircleIcon,
  PersonOutline as PersonIcon,
  Payment as PaymentIcon,
} from '../../icons';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import apiClient, { ApiError } from '../../services/apiClient';
import AuthLayout from './AuthLayout';
import OptionCard from './OptionCard';

// Ne PAS appeler loadStripe('') si la clef n'est pas configuree : ça log un
// `IntegrationError: empty string` au boot de l'app sur toutes les pages
// publiques. Meme pattern que BookingPaymentPage / PaymentCheckoutModal.
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

// Resolveurs i18n pour les labels (gardent les cles centralisees mais traduisibles)
const getPropertyTypeLabel = (t: TFunction, key: string): string => {
  const fallbacks: Record<string, string> = {
    studio: 'Studio',
    appartement: 'Appartement',
    maison: 'Maison',
    duplex: 'Duplex',
    villa: 'Villa',
    autre: 'Autre',
  };
  return t(`auth.inscription.propertyTypes.${key}`, fallbacks[key] || key);
};

const getForfaitLabel = (t: TFunction, key: string): string => {
  const fallbacks: Record<string, string> = {
    essentiel: 'Forfait Essentiel',
    confort: 'Forfait Confort',
    premium: 'Forfait Premium',
  };
  return t(`auth.inscription.forfaits.${key}`, fallbacks[key] || key);
};

const getForfaitShortLabel = (t: TFunction, key: string): string => {
  const fallbacks: Record<string, string> = {
    essentiel: 'Essentiel',
    confort: 'Confort',
    premium: 'Premium',
  };
  return t(`auth.inscription.forfaits.${key}Short`, fallbacks[key] || key);
};

const getForfaitTagline = (t: TFunction, key: string): string => {
  const fallbacks: Record<string, string> = {
    essentiel: 'Pour débuter sereinement',
    confort: 'Le plus choisi',
    premium: 'Tout inclus, sans limite',
  };
  return t(`auth.inscription.forfaitTaglines.${key}`, fallbacks[key] || key);
};

// Types d'organisation
type OrganizationTypeKey = 'INDIVIDUAL' | 'CONCIERGE' | 'CLEANING_COMPANY';

const getOrgTypeLabel = (t: TFunction, key: OrganizationTypeKey): string => {
  const fallbacks: Record<OrganizationTypeKey, string> = {
    INDIVIDUAL: 'Particulier',
    CONCIERGE: 'Conciergerie',
    CLEANING_COMPANY: 'Societe de menage',
  };
  return t(`auth.inscription.orgTypes.${key}`, fallbacks[key]);
};

const getOrgTypeDescription = (t: TFunction, key: OrganizationTypeKey): string => {
  const fallbacks: Record<OrganizationTypeKey, string> = {
    INDIVIDUAL: 'Je gère mes propres locations',
    CONCIERGE: "J'opère pour des propriétaires tiers",
    CLEANING_COMPANY: 'Service ménage / multi-services',
  };
  return t(`auth.inscription.orgTypeDescriptions.${key}`, fallbacks[key]);
};

/** Prix de base par forfait (aligné avec la landing page) */
const FORFAIT_BASE_PRICES: Record<string, number> = {
  essentiel: 50,
  confort: 75,
  premium: 100,
};

type BillingPeriod = 'MONTHLY' | 'ANNUAL' | 'BIENNIAL';

const getBillingPeriodLabel = (t: TFunction, key: BillingPeriod): string => {
  const fallbacks: Record<BillingPeriod, string> = {
    MONTHLY: 'Mensuel',
    ANNUAL: 'Annuel',
    BIENNIAL: '2 ans',
  };
  return t(`auth.inscription.billingPeriods.${key}`, fallbacks[key]);
};

const BILLING_PERIOD_DISCOUNT: Record<BillingPeriod, number> = {
  MONTHLY: 1.0,
  ANNUAL: 0.80,
  BIENNIAL: 0.65,
};

const BILLING_PERIOD_MONTHS: Record<BillingPeriod, number> = {
  MONTHLY: 1,
  ANNUAL: 12,
  BIENNIAL: 24,
};

// Plus de fallback hardcodé — les prix sont toujours chargés depuis l'API /pricing-info

/** Formate un montant en centimes en euros (ex: 2275 → "22,75€", 3000 → "30€") */
function formatCents(cents: number): string {
  const euros = cents / 100;
  return euros % 1 === 0 ? `${euros.toFixed(0)}€` : `${euros.toFixed(2).replace('.', ',')}€`;
}

function getPmsDisplayPrice(t: TFunction, period: BillingPeriod, baseCents: number | null): string {
  if (baseCents === null) return '…';
  const monthlyCents = Math.round(baseCents * BILLING_PERIOD_DISCOUNT[period]);
  return `${formatCents(monthlyCents)}${t('auth.inscription.perMonth', ' / mois')}`;
}

function getPmsFirstPayment(t: TFunction, period: BillingPeriod, baseCents: number | null): string {
  if (baseCents === null) return '…';
  const monthlyCents = Math.round(baseCents * BILLING_PERIOD_DISCOUNT[period]);
  if (period === 'MONTHLY') return formatCents(monthlyCents);
  // Facture = mensuel remisé × nombre de mois de la période (12 pour l'annuel,
  // 24 pour les 2 ans) — pas un ×12 codé en dur, sinon « 2 ans » facturait 1 an.
  const totalCents = monthlyCents * BILLING_PERIOD_MONTHS[period];
  const suffix = period === 'BIENNIAL'
    ? t('auth.inscription.perBiennial', ' / 2 ans')
    : t('auth.inscription.perYear', ' / an');
  return `${formatCents(totalCents)}${suffix}`;
}

/** Libellé prix intervention : utilise le prix transmis par la landing page, sinon le prix de base */
function getInterventionPriceLabel(t: TFunction, forfait: string, interventionPrice?: string): string {
  const price = interventionPrice
    ? parseInt(interventionPrice, 10)
    : FORFAIT_BASE_PRICES[forfait];
  if (!price) return '';
  return t('auth.inscription.interventionPrice', `Interventions a partir de ${price}€`, { price });
}

const FORFAIT_COLORS: Record<string, string> = {
  essentiel: '#6B8A9A',
  confort: '#A6C0CE',
  premium: '#5A7684',
};

/**
 * Sources d'acquisition declarees a l'inscription (attribution marketing).
 * Liste fermee — synchronisee avec {@code InscriptionDto.ALLOWED_REFERRAL_SOURCES}
 * cote backend.
 */
type ReferralSource = 'google' | 'social' | 'word_of_mouth' | 'press' | 'partner' | 'other';

const REFERRAL_SOURCE_VALUES: ReferralSource[] = [
  'google',
  'social',
  'word_of_mouth',
  'press',
  'partner',
  'other',
];

const getReferralSourceLabel = (t: TFunction, key: ReferralSource): string => {
  const fallbacks: Record<ReferralSource, string> = {
    google: 'Recherche Google',
    social: 'Réseaux sociaux (Instagram, LinkedIn…)',
    word_of_mouth: 'Bouche-à-oreille',
    press: 'Presse / blog',
    partner: 'Partenaire',
    other: 'Autre',
  };
  return t(`auth.inscription.referralSources.${key}`, fallbacks[key]);
};

const STEP_ICONS: Record<number, React.ReactElement> = {
  1: <PersonIcon />,
  2: <PaymentIcon />,
};

function CustomStepIcon(props: StepIconProps) {
  const { active, completed, icon } = props;
  return (
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: completed
          ? 'primary.main'
          : active
            ? 'primary.dark'
            : 'grey.300',
        color: '#fff',
        transition: 'all 0.3s ease',
        '& .MuiSvgIcon-root': { fontSize: 18 },
      }}
    >
      {completed ? <CheckCircleIcon size={20} strokeWidth={1.75} /> : STEP_ICONS[icon as number]}
    </Box>
  );
}

interface InscriptionResponse {
  clientSecret: string;
  sessionId: string;
  pmsBaseCents?: number;
  monthlyPriceCents?: number;
  stripePriceAmount?: number;
  billingPeriod?: string;
}

export default function Inscription() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const steps = useMemo(
    () => [
      t('auth.inscription.stepInformations', 'Vos informations'),
      t('auth.inscription.stepPayment', 'Paiement'),
    ],
    [t],
  );

  // Recuperer les donnees de la landing page (query params)
  const prefill = useMemo(() => ({
    forfait: searchParams.get('forfait') || '',
    billingPeriod: (searchParams.get('billingPeriod') || 'MONTHLY').toUpperCase() as BillingPeriod,
    interventionPrice: searchParams.get('interventionPrice') || '',
    email: searchParams.get('email') || '',
    fullName: searchParams.get('fullName') || '',
    phone: searchParams.get('phone') || '',
    city: searchParams.get('city') || '',
    postalCode: searchParams.get('postalCode') || '',
    propertyType: searchParams.get('propertyType') || '',
    propertyCount: searchParams.get('propertyCount') || '',
    surface: searchParams.get('surface') || '',
    guestCapacity: searchParams.get('guestCapacity') || '',
    bookingFrequency: searchParams.get('bookingFrequency') || '',
    cleaningSchedule: searchParams.get('cleaningSchedule') || '',
    calendarSync: searchParams.get('calendarSync') || '',
    services: searchParams.get('services') || '',
    servicesDevis: searchParams.get('servicesDevis') || '',
  }), [searchParams]);

  const hasLandingData = !!prefill.forfait && !!prefill.email;

  // Detecter si le paiement a ete annule (retour depuis Stripe)
  const paymentCancelled = searchParams.get('payment') === 'cancelled';

  // Etape active du stepper
  const [activeStep, setActiveStep] = useState(0);

  // Champs du formulaire
  const [fullName, setFullName] = useState(prefill.fullName);
  const [email, setEmail] = useState(prefill.email);
  const [phone, setPhone] = useState(prefill.phone);
  const [companyName, setCompanyName] = useState('');
  const [organizationType, setOrganizationType] = useState<OrganizationTypeKey>('INDIVIDUAL');
  const isProType = organizationType !== 'INDIVIDUAL';
  const [forfait, setForfait] = useState(prefill.forfait || 'essentiel');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(
    (['MONTHLY', 'ANNUAL', 'BIENNIAL'].includes(prefill.billingPeriod) ? prefill.billingPeriod : 'MONTHLY') as BillingPeriod
  );
  // Prix PMS charges depuis l'API (pas de fallback — toujours depuis /pricing-info)
  const [pmsMonthlyPriceCents, setPmsMonthlyPriceCents] = useState<number | null>(null);
  const [pmsSyncPriceCents, setPmsSyncPriceCents] = useState<number | null>(null);
  // Supplement IA mensuel par forfait (centimes) — campagne X5
  const [aiSurchargeCentsByForfait, setAiSurchargeCentsByForfait] = useState<Record<string, number>>({});

  // Consentement RGPD + attribution (4 nouveaux champs)
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [referralSource, setReferralSource] = useState<ReferralSource | ''>('');

  // Determiner si l'utilisateur a choisi la synchronisation calendrier (venant de la landing page)
  const isSyncMode = prefill.calendarSync === 'sync';

  // Prix de base effectif selon le mode (sync ou standard) + supplement IA du
  // forfait selectionne — aligne sur le montant facture par Stripe (backend X5)
  const pmsCoreCents = isSyncMode ? pmsSyncPriceCents : pmsMonthlyPriceCents;
  const pmsBaseCents = pmsCoreCents === null
    ? null
    : pmsCoreCents + (aiSurchargeCentsByForfait[forfait] ?? 0);

  useEffect(() => {
    apiClient
      .get<{
        pmsMonthlyPriceCents?: number;
        pmsSyncPriceCents?: number;
        aiSurchargeEssentielCents?: number;
        aiSurchargeConfortCents?: number;
        aiSurchargePremiumCents?: number;
      }>(
        '/public/pricing-info',
        { skipAuth: true },
      )
      .then((data) => {
        if (data.pmsMonthlyPriceCents) {
          setPmsMonthlyPriceCents(data.pmsMonthlyPriceCents);
        }
        if (data.pmsSyncPriceCents) {
          setPmsSyncPriceCents(data.pmsSyncPriceCents);
        }
        setAiSurchargeCentsByForfait({
          essentiel: data.aiSurchargeEssentielCents ?? 0,
          confort: data.aiSurchargeConfortCents ?? 0,
          premium: data.aiSurchargePremiumCents ?? 0,
        });
      })
      .catch(() => {});
  }, []);

  // Etats
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  // Prix confirmes par le backend (utilises dans le recap Step 3 pour coherence avec Stripe)
  const [confirmedPmsBaseCents, setConfirmedPmsBaseCents] = useState<number | null>(null);

  // Afficher le message d'annulation si retour de Stripe
  useEffect(() => {
    if (paymentCancelled) {
      setError(t('auth.inscription.errors.paymentCancelled', 'Le paiement a ete annule. Vous pouvez reessayer quand vous le souhaitez.'));
    }
  }, [paymentCancelled, t]);

  // Validation
  const isStep1Valid = () => {
    const nameParts = fullName.trim().split(/\s+/).filter((p) => p.length >= 2);
    const nameOk = nameParts.length >= 2;
    const emailOk = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email);
    const phoneDigits = phone.replace(/[\s.\-]/g, '');
    const phoneOk = !phone.trim() || /^(?:(?:\+33|0033)[1-9]\d{8}|0[1-9]\d{8})$/.test(phoneDigits);
    const companyOk = !isProType || companyName.trim().length > 0;
    // RGPD : l'acceptation des CGU est obligatoire avant de continuer vers le paiement
    return nameOk && emailOk && phoneOk && !!forfait && companyOk && acceptedTerms;
  };

  const handleNext = () => {
    setError(null);
    if (activeStep === 0 && !isStep1Valid()) {
      setError(t('auth.inscription.errors.fillFields', 'Veuillez remplir correctement tous les champs obligatoires.'));
      return;
    }
    // Step 0 valide → soumettre le formulaire et passer au paiement
    handleSubmit();
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      // Stocker l'email pour la page InscriptionSuccess (renvoi d'email)
      sessionStorage.setItem('inscription_email', email);

      const response = await apiClient.post<InscriptionResponse>('/public/inscription', {
        fullName,
        email,
        phone,
        companyName: isProType ? companyName : undefined,
        organizationType,
        forfait,
        billingPeriod,
        city: prefill.city,
        postalCode: prefill.postalCode,
        propertyType: prefill.propertyType,
        propertyCount: prefill.propertyCount ? parseInt(prefill.propertyCount) : undefined,
        surface: prefill.surface ? parseInt(prefill.surface) : undefined,
        guestCapacity: prefill.guestCapacity ? parseInt(prefill.guestCapacity) : undefined,
        bookingFrequency: prefill.bookingFrequency || undefined,
        cleaningSchedule: prefill.cleaningSchedule || undefined,
        calendarSync: prefill.calendarSync || undefined,
        services: prefill.services ? prefill.services.split(',') : undefined,
        servicesDevis: prefill.servicesDevis ? prefill.servicesDevis.split(',') : undefined,
        // Consentement RGPD + attribution
        acceptedTerms,
        newsletterOptIn,
        promoCode: promoCode.trim() || undefined,
        referralSource: referralSource || undefined,
      }, { skipAuth: true });

      // Stocker le clientSecret + prix confirmes et passer au step Paiement
      if (response.clientSecret) {
        setClientSecret(response.clientSecret);
        // Utiliser le prix reel du backend pour le recap (coherence avec Stripe)
        if (response.pmsBaseCents) {
          setConfirmedPmsBaseCents(response.pmsBaseCents);
        }
        setActiveStep(1);
      } else {
        setError(t('auth.inscription.errors.createSessionFailed', 'Erreur lors de la creation de la session de paiement.'));
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 409) {
        setError(t('auth.inscription.errors.emailAlreadyExists', 'Un compte existe deja avec cette adresse email.'));
      } else if (apiErr.message) {
        setError(apiErr.message);
      } else {
        setError(t('auth.inscription.errors.generic', 'Une erreur est survenue. Veuillez reessayer.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout maxFormWidth={activeStep === 1 ? 880 : 560}>
      {/* Badge forfait selectionne */}
        {prefill.forfait && (
          <div className="text-center mb-3">
            <StatusChip tokens={{ color: '#fff', bg: FORFAIT_COLORS[prefill.forfait] || '#6B8A9A' }} label={getForfaitLabel(t, prefill.forfait)} className="text-[0.8rem] px-1.5" />
            <span className="cn-text-caption block text-muted-foreground mt-0.5">
              {getInterventionPriceLabel(t, prefill.forfait, prefill.interventionPrice)} | {isSyncMode
                ? t('auth.inscription.platformWithSync', 'Plateforme + Synchro')
                : t('auth.inscription.platform', 'Plateforme')} : {getPmsDisplayPrice(t, billingPeriod, pmsBaseCents)}
            </span>
          </div>
        )}

        {/* Stepper */}
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {steps.map((label, index) => (
            <Step
              key={label}
              completed={activeStep > index}
              sx={{
                cursor: activeStep > index && activeStep !== 1 ? 'pointer' : 'default',
                '&:hover .MuiStepLabel-label': activeStep > index && activeStep !== 1
                  ? { color: 'primary.dark' }
                  : {},
              }}
              onClick={() => {
                // Permettre de revenir aux etapes precedentes (sauf depuis le paiement Stripe)
                if (index < activeStep && activeStep !== 1) {
                  setError(null);
                  setActiveStep(index);
                }
              }}
            >
              <StepLabel
                StepIconComponent={CustomStepIcon}
                sx={{
                  '& .MuiStepLabel-label': {
                    fontSize: '0.78rem',
                    fontWeight: activeStep === index ? 600 : 400,
                    transition: 'all 0.2s ease',
                  },
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Erreur */}
        {error && (
          <Alert variant={paymentCancelled && !loading ? 'warning' : 'destructive'} className="mb-3">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Etape 1 : Informations */}
        {activeStep === 0 && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-3">
              <Field>
                <FieldLabel htmlFor="inscription-full-name">
                  {t('auth.inscription.fields.fullNameLabel', 'Nom complet *')}
                </FieldLabel>
                <Input
                  id="inscription-full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('auth.inscription.fields.fullNamePlaceholder', 'Jean Dupont')}
                />
                <FieldDescription>
                  {t('auth.inscription.fields.fullNameHelper', 'Prenom et nom de famille')}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="inscription-email">
                  {t('auth.inscription.fields.emailLabel', 'Email *')}
                </FieldLabel>
                <Input
                  id="inscription-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.inscription.fields.emailPlaceholder', 'jean@exemple.fr')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="inscription-phone">
                  {t('auth.inscription.fields.phoneLabel', 'Telephone')}
                </FieldLabel>
                <Input
                  id="inscription-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('auth.inscription.fields.phonePlaceholder', '07 66 72 91 09')}
                />
                <FieldDescription>
                  {t('auth.inscription.fields.phoneHelper', 'Optionnel')}
                </FieldDescription>
              </Field>
            </div>

            {/* Selection du type d'organisation */}
            <div>
              <span className="cn-text-overline font-bold text-[var(--muted)] tracking-[0.6px] text-[0.7rem] block mb-1.5">
                {t('auth.inscription.you', 'Vous êtes')}
              </span>
              <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(3,_1fr)] gap-[9px]">
                {(['INDIVIDUAL', 'CONCIERGE', 'CLEANING_COMPANY'] as const).map((type) => (
                  <OptionCard
                    key={type}
                    selected={organizationType === type}
                    onClick={() => {
                      setOrganizationType(type);
                      if (type === 'INDIVIDUAL') setCompanyName('');
                    }}
                    label={getOrgTypeLabel(t, type)}
                    description={getOrgTypeDescription(t, type)}
                  />
                ))}
              </div>
            </div>

            {/* Nom de la societe (conditionnel, requis pour type pro) */}
            {isProType && (
              <Field>
                <FieldLabel htmlFor="inscription-company">
                  {t('auth.inscription.fields.companyLabel', 'Nom de la societe *')}
                </FieldLabel>
                <Input
                  id="inscription-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t('auth.inscription.fields.companyPlaceholder', 'Ma Societe SARL')}
                  aria-invalid={companyName.trim() === ''}
                />
                {companyName.trim() === '' ? (
                  <FieldError>
                    {t('auth.inscription.fields.companyHelper', 'Requis pour les conciergeries et societes de menage')}
                  </FieldError>
                ) : (
                  <FieldDescription>
                    {t('auth.inscription.fields.companyHelper', 'Requis pour les conciergeries et societes de menage')}
                  </FieldDescription>
                )}
              </Field>
            )}

            {/* Selection du forfait si non pre-rempli */}
            {!prefill.forfait && (
              <div>
                <span className="cn-text-overline font-bold text-[var(--muted)] tracking-[0.6px] text-[0.7rem] block mb-1.5">
                  {t('auth.inscription.choosePlan', 'Choisissez votre forfait *')}
                </span>
                <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(3,_1fr)] gap-[9px]">
                  {(['essentiel', 'confort', 'premium'] as const).map((f) => (
                    <OptionCard
                      key={f}
                      selected={forfait === f}
                      onClick={() => setForfait(f)}
                      label={getForfaitShortLabel(t, f)}
                      description={getForfaitTagline(t, f)}
                      hint={
                        <span className="cn-text-caption font-semibold text-inherit text-[0.75rem] opacity-95">
                          {t('auth.inscription.forfaitHint', `dès ${FORFAIT_BASE_PRICES[f]}€/intervention`, { price: FORFAIT_BASE_PRICES[f] })}
                        </span>
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Selection de la periode de facturation */}
            <Separator className="my-1.5" />
            <span className="cn-text-caption text-muted-foreground font-semibold">
              {t('auth.inscription.billingPeriodLabel', 'Periode de facturation')}
            </span>
            {/* ToggleGroup rend une valeur vide quand on re-clique l'item actif :
                on ignore ce cas, la periode doit toujours etre definie. */}
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={billingPeriod}
              onValueChange={(val) => val && setBillingPeriod(val as BillingPeriod)}
              className="mb-[3px] w-full [&>*]:flex-1"
            >
              <ToggleGroupItem value="MONTHLY" className="text-[0.78rem] font-semibold">
                {getBillingPeriodLabel(t, 'MONTHLY')}
              </ToggleGroupItem>
              <ToggleGroupItem value="ANNUAL" className="text-[0.78rem] font-semibold">
                {getBillingPeriodLabel(t, 'ANNUAL')}
                <Badge variant="success" className="ms-0.5 h-[18px] text-[0.65rem] font-bold">-20%</Badge>
              </ToggleGroupItem>
              <ToggleGroupItem value="BIENNIAL" className="text-[0.78rem] font-semibold">
                {getBillingPeriodLabel(t, 'BIENNIAL')}
                <Badge variant="success" className="ms-0.5 h-[18px] text-[0.65rem] font-bold">-35%</Badge>
              </ToggleGroupItem>
            </ToggleGroup>
            <span className="cn-text-caption text-muted-foreground">
              {t('auth.inscription.platform', 'Plateforme')} : {getPmsDisplayPrice(t, billingPeriod, pmsBaseCents)}
              {billingPeriod !== 'MONTHLY' && pmsBaseCents !== null && (
                <span className="cn-text-caption ms-0.5 line-through text-muted-foreground opacity-60">
                  {formatCents(pmsBaseCents)}{t('auth.inscription.perMonth', '/mois')}
                </span>
              )}
              {billingPeriod !== 'MONTHLY' && (
                <span className="cn-text-caption ms-0.5 text-[var(--bui-success-ink)] font-semibold">
                  {' '}{t('auth.inscription.invoiced', `Facture ${getPmsFirstPayment(t, billingPeriod, pmsBaseCents)}`, { amount: getPmsFirstPayment(t, billingPeriod, pmsBaseCents) })}
                </span>
              )}
            </span>

            {/* Resume des donnees de la landing page */}
            {hasLandingData && (
              <>
                <Separator className="my-1.5" />
                <span className="cn-text-caption text-muted-foreground font-semibold">
                  {t('auth.inscription.requestInfo', 'Informations de votre demande')}
                </span>
                <div className="flex flex-wrap gap-1">
                  {prefill.propertyType && (
                    <Badge variant="outline">{getPropertyTypeLabel(t, prefill.propertyType)}</Badge>
                  )}
                  {prefill.surface && (
                    <Badge variant="outline">{t('auth.inscription.surfaceChip', `${prefill.surface} m²`, { value: prefill.surface })}</Badge>
                  )}
                  {prefill.guestCapacity && (
                    <Badge variant="outline">{t('auth.inscription.guestCapacityChip', `${prefill.guestCapacity} voyageurs`, { value: prefill.guestCapacity })}</Badge>
                  )}
                  {prefill.propertyCount && (
                    <Badge variant="outline">{t('auth.inscription.propertyCountChip', `${prefill.propertyCount} logement(s)`, { value: prefill.propertyCount })}</Badge>
                  )}
                  {prefill.city && (
                    <Badge variant="outline">{prefill.postalCode
                          ? t('auth.inscription.cityPostalChip', `${prefill.city} (${prefill.postalCode})`, { city: prefill.city, postalCode: prefill.postalCode })
                          : t('auth.inscription.cityChip', `${prefill.city}`, { city: prefill.city })}</Badge>
                  )}
                </div>
              </>
            )}

            {/* Code promo + source d'acquisition (optionnels, collapsibles visuellement) */}
            <Separator className="my-1.5" />
            <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-3">
              <Field>
                <FieldLabel htmlFor="inscription-promo-code">
                  {t('auth.inscription.promoLabel', 'Code promo / parrainage')}
                </FieldLabel>
                <Input
                  id="inscription-promo-code"
                  className="uppercase"
                  maxLength={50}
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder={t('auth.inscription.promoPlaceholder', 'Optionnel')}
                />
                <FieldDescription>
                  {t('auth.inscription.promoHelper', 'Si vous en avez un')}
                </FieldDescription>
              </Field>
              {/* Le libelle est desormais statique au-dessus du champ : plus de
                  chevauchement possible entre lui et l'option vide, donc plus
                  besoin des reglages displayEmpty / shrink de MUI. */}
              <Field>
                <FieldLabel htmlFor="inscription-referral-source">
                  {t('auth.inscription.referralLabel', 'Comment nous avez-vous connu ?')}
                </FieldLabel>
                <NativeSelect
                  id="inscription-referral-source"
                  className="w-full"
                  value={referralSource}
                  onChange={(e) => setReferralSource(e.target.value as ReferralSource)}
                >
                  <NativeSelectOption value="">
                    {t('auth.inscription.referralPlaceholder', 'Sélectionner…')}
                  </NativeSelectOption>
                  {REFERRAL_SOURCE_VALUES.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {getReferralSourceLabel(t, value)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  {t('auth.inscription.referralHelper', 'Optionnel — nous aide à mieux vous servir')}
                </FieldDescription>
              </Field>
            </div>

            {/* Consentements RGPD (CGU obligatoire + newsletter optionnel) */}
            <Separator className="my-1.5" />
            <div className="flex flex-col gap-[3px]">
              <Field orientation="horizontal" className="items-start">
                <Checkbox
                  id="inscription-accept-terms"
                  className="mt-[3px]"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                />
                <FieldLabel htmlFor="inscription-accept-terms" className="cn-text-body2 text-[0.8125rem] leading-[1.4] font-normal">
                  <span>
                    {t('auth.inscription.cguPrefix', "J'accepte les")}{' '}
                    <a
                      href="/cgu"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--mui-primary)] font-semibold underline"
                    >
                      {t('auth.inscription.cguLinkText', "conditions générales d'utilisation")}
                    </a>{' '}
                    {t('auth.inscription.cguMiddle', 'et la')}{' '}
                    <a
                      href="/confidentialite"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--mui-primary)] font-semibold underline"
                    >
                      {t('auth.inscription.privacyLinkText', 'politique de confidentialité')}
                    </a>
                    {' '}
                    <span className="cn-text-caption text-destructive font-semibold">
                      *
                    </span>
                  </span>
                </FieldLabel>
              </Field>
              <Field orientation="horizontal" className="items-start">
                <Checkbox
                  id="inscription-newsletter"
                  className="mt-[3px]"
                  checked={newsletterOptIn}
                  onCheckedChange={(checked) => setNewsletterOptIn(checked === true)}
                />
                <FieldLabel htmlFor="inscription-newsletter" className="cn-text-body2 text-[0.8125rem] leading-[1.4] font-normal">
                  {t('auth.inscription.newsletterOptIn', 'Je souhaite recevoir la newsletter Baitly (nouveautés produit, conseils gestion locative).')}
                </FieldLabel>
              </Field>
            </div>
          </div>
        )}

        {/* Etape 2 : Paiement Stripe Embedded Checkout */}
        {activeStep === 1 && clientSecret && (
          <div className="flex flex-col min-[900px]:flex-row gap-[18px]">
            {/* Colonne gauche : Recapitulatif de la commande */}
            <div className="flex-[0_0_320px] min-w-0">
              <Card className="border-solid border-[var(--line)] rounded-[12px] shadow-none">
                <CardContent className="p-[15px]">
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="w-[36px] h-[36px] rounded-[50%] bg-[rgba(166,192,206,0.15)] text-primary flex items-center justify-center">
                      <CartIcon size={18} strokeWidth={1.75} color='currentColor' />
                    </div>
                    <h6 className="cn-text-subtitle2 font-semibold text-foreground">
                      {t('auth.inscription.summary', 'Recapitulatif')}
                    </h6>
                  </div>

                  <div className="flex flex-col gap-[9px]">
                    <div>
                      <span className="cn-text-caption text-muted-foreground font-semibold">
                        {t('auth.inscription.summaryAccount', 'Compte')}
                      </span>
                      <p className="cn-text-body2">{fullName}</p>
                      <p className="cn-text-body2 text-muted-foreground">{email}</p>
                    </div>

                    <Separator />

                    <div>
                      <span className="cn-text-caption text-muted-foreground font-semibold">
                        {t('auth.inscription.summaryPlan', 'Forfait')}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StatusChip tokens={{ color: '#fff', bg: FORFAIT_COLORS[forfait] || '#6B8A9A' }} label={getForfaitLabel(t, forfait)} className="text-[0.75rem]" />
                      </div>
                      <span className="cn-text-caption text-muted-foreground mt-0.5 block">
                        {getInterventionPriceLabel(t, forfait, prefill.interventionPrice)}
                      </span>
                    </div>

                    <Separator />

                    <div>
                      <span className="cn-text-caption text-muted-foreground font-semibold">
                        {isSyncMode
                          ? t('auth.inscription.summarySubscriptionWithSync', 'Abonnement plateforme + Synchro auto')
                          : t('auth.inscription.summarySubscription', 'Abonnement plateforme')}
                      </span>
                      <p className="cn-text-body2 font-semibold text-primary">
                        {getPmsDisplayPrice(t, billingPeriod, confirmedPmsBaseCents ?? pmsBaseCents)}
                      </p>
                      <span className="cn-text-caption text-muted-foreground">
                        {t('auth.inscription.summaryPeriod', 'Periode :')} {getBillingPeriodLabel(t, billingPeriod)}
                      </span>
                    </div>

                    <Separator />

                    <div className="p-2 rounded-[1.5px] bg-[rgba(166,192,206,0.08)] border border-solid border-[rgba(166,192,206,0.2)]">
                      <div className="flex justify-between items-center">
                        <p className="cn-text-body2 font-semibold">
                          {t('auth.inscription.summaryTotal', 'Total a payer')}
                        </p>
                        <p className="cn-text-body1 font-bold text-[var(--mui-primary-d)]">
                          {getPmsFirstPayment(t, billingPeriod, confirmedPmsBaseCents ?? pmsBaseCents)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-0.5">
                    <span className="inline-flex text-[var(--bui-success-ink)]"><CheckCircleIcon size={14} strokeWidth={1.75} /></span>
                    <span className="cn-text-caption text-muted-foreground">
                      {t('auth.inscription.securedPayment', 'Paiement securise via Stripe')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Colonne droite : Stripe Embedded Checkout */}
            <div className="flex-1 min-w-0">
              <Card className="border-solid border-[var(--line)] rounded-[12px] shadow-none overflow-hidden">
                <CardContent className="p-[15px]">
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="w-[36px] h-[36px] rounded-[50%] bg-[rgba(107,138,154,0.12)] flex items-center justify-center">
                      <CreditCardIcon size={18} strokeWidth={1.75} color='currentColor' />
                    </div>
                    <h6 className="cn-text-subtitle2 font-semibold text-foreground">
                      {t('auth.inscription.paymentTitle', 'Paiement')}
                    </h6>
                  </div>
                  <EmbeddedCheckoutProvider
                    stripe={stripePromise}
                    options={{ clientSecret }}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Bouton de navigation (cache a l'etape Paiement) */}
        {activeStep === 0 && (
          <div className="flex justify-center mt-4">
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading || !isStep1Valid()}
              sx={{
                px: 4,
                fontWeight: 600,
                backgroundColor: 'secondary.main',
                '&:hover': { backgroundColor: 'secondary.dark' },
                borderRadius: 1.5,
              }}
            >
              {loading ? <Spinner className="size-5" /> : t('auth.inscription.submit', 'Continuer vers le paiement')}
            </Button>
          </div>
        )}

        {/* Lien vers login (cache a l'etape Paiement) */}
        {activeStep === 0 && (
          <div className="mt-3 text-center">
            <span className="cn-text-caption text-muted-foreground">
              {t('auth.inscription.alreadyAccount', 'Deja un compte ?')}{' '}
              <span className="cn-text-caption text-[var(--mui-secondary)] font-semibold cursor-pointer hover:decoration-[underline]" onClick={() => navigate('/login')}>
                {t('auth.inscription.loginLink', 'Se connecter')}
              </span>
            </span>
          </div>
        )}
    </AuthLayout>
  );
}
