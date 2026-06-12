import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  Box,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepIconProps,
  Chip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Link as MuiLink,
  MenuItem,
} from '@mui/material';
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
  const totalCents = monthlyCents * 12;
  return `${formatCents(totalCents)} / an`;
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

  // Consentement RGPD + attribution (4 nouveaux champs)
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [referralSource, setReferralSource] = useState<ReferralSource | ''>('');

  // Determiner si l'utilisateur a choisi la synchronisation calendrier (venant de la landing page)
  const isSyncMode = prefill.calendarSync === 'sync';

  // Prix de base effectif selon le mode (sync ou standard)
  const pmsBaseCents = isSyncMode ? pmsSyncPriceCents : pmsMonthlyPriceCents;

  useEffect(() => {
    apiClient
      .get<{ pmsMonthlyPriceCents?: number; pmsSyncPriceCents?: number }>(
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
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Chip
              label={getForfaitLabel(t, prefill.forfait)}
              sx={{
                backgroundColor: FORFAIT_COLORS[prefill.forfait] || '#6B8A9A',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.8rem',
                px: 1,
              }}
            />
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              {getInterventionPriceLabel(t, prefill.forfait, prefill.interventionPrice)} | {isSyncMode
                ? t('auth.inscription.platformWithSync', 'Plateforme + Synchro')
                : t('auth.inscription.platform', 'Plateforme')} : {getPmsDisplayPrice(t, billingPeriod, pmsBaseCents)}
            </Typography>
          </Box>
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
          <Alert severity={paymentCancelled && !loading ? 'warning' : 'error'} sx={{ mb: 2 }}>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        )}

        {/* Etape 1 : Informations */}
        {activeStep === 0 && (
          <Stack spacing={2}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                fullWidth
                size="small"
                label={t('auth.inscription.fields.fullNameLabel', 'Nom complet *')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('auth.inscription.fields.fullNamePlaceholder', 'Jean Dupont')}
                helperText={t('auth.inscription.fields.fullNameHelper', 'Prenom et nom de famille')}
              />
              <TextField
                fullWidth
                size="small"
                label={t('auth.inscription.fields.emailLabel', 'Email *')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.inscription.fields.emailPlaceholder', 'jean@exemple.fr')}
              />
              <TextField
                fullWidth
                size="small"
                label={t('auth.inscription.fields.phoneLabel', 'Telephone')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.inscription.fields.phonePlaceholder', '07 66 72 91 09')}
                helperText={t('auth.inscription.fields.phoneHelper', 'Optionnel')}
              />
            </Box>

            {/* Selection du type d'organisation */}
            <Box>
              <Typography
                variant="overline"
                sx={{
                  fontWeight: 700,
                  color: 'text.secondary',
                  letterSpacing: 0.6,
                  fontSize: '0.7rem',
                  display: 'block',
                  mb: 1,
                }}
              >
                {t('auth.inscription.you', 'Vous êtes')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                  gap: 1.5,
                }}
              >
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
              </Box>
            </Box>

            {/* Nom de la societe (conditionnel, requis pour type pro) */}
            {isProType && (
              <TextField
                fullWidth
                size="small"
                label={t('auth.inscription.fields.companyLabel', 'Nom de la societe *')}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t('auth.inscription.fields.companyPlaceholder', 'Ma Societe SARL')}
                error={isProType && companyName.trim() === ''}
                helperText={t('auth.inscription.fields.companyHelper', 'Requis pour les conciergeries et societes de menage')}
              />
            )}

            {/* Selection du forfait si non pre-rempli */}
            {!prefill.forfait && (
              <Box>
                <Typography
                  variant="overline"
                  sx={{
                    fontWeight: 700,
                    color: 'text.secondary',
                    letterSpacing: 0.6,
                    fontSize: '0.7rem',
                    display: 'block',
                    mb: 1,
                  }}
                >
                  {t('auth.inscription.choosePlan', 'Choisissez votre forfait *')}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                    gap: 1.5,
                  }}
                >
                  {(['essentiel', 'confort', 'premium'] as const).map((f) => (
                    <OptionCard
                      key={f}
                      selected={forfait === f}
                      onClick={() => setForfait(f)}
                      label={getForfaitShortLabel(t, f)}
                      description={getForfaitTagline(t, f)}
                      hint={
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: 'inherit',
                            fontSize: '0.75rem',
                            opacity: 0.95,
                          }}
                        >
                          {t('auth.inscription.forfaitHint', `dès ${FORFAIT_BASE_PRICES[f]}€/intervention`, { price: FORFAIT_BASE_PRICES[f] })}
                        </Typography>
                      }
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Selection de la periode de facturation */}
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {t('auth.inscription.billingPeriodLabel', 'Periode de facturation')}
            </Typography>
            <ToggleButtonGroup
              value={billingPeriod}
              exclusive
              onChange={(_, val) => val && setBillingPeriod(val as BillingPeriod)}
              size="small"
              fullWidth
              sx={{ mb: 0.5 }}
            >
              <ToggleButton value="MONTHLY" sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 600 }}>
                {getBillingPeriodLabel(t, 'MONTHLY')}
              </ToggleButton>
              <ToggleButton value="ANNUAL" sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 600 }}>
                {getBillingPeriodLabel(t, 'ANNUAL')}
                <Chip label="-20%" size="small" color="success" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
              </ToggleButton>
              <ToggleButton value="BIENNIAL" sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 600 }}>
                {getBillingPeriodLabel(t, 'BIENNIAL')}
                <Chip label="-35%" size="small" color="success" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary">
              {t('auth.inscription.platform', 'Plateforme')} : {getPmsDisplayPrice(t, billingPeriod, pmsBaseCents)}
              {billingPeriod !== 'MONTHLY' && pmsBaseCents !== null && (
                <Typography component="span" variant="caption" sx={{ ml: 0.5, textDecoration: 'line-through', color: 'text.disabled' }}>
                  {formatCents(pmsBaseCents)}{t('auth.inscription.perMonth', '/mois')}
                </Typography>
              )}
              {billingPeriod !== 'MONTHLY' && (
                <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'success.main', fontWeight: 600 }}>
                  {' '}{t('auth.inscription.invoiced', `Facture ${getPmsFirstPayment(t, billingPeriod, pmsBaseCents)}`, { amount: getPmsFirstPayment(t, billingPeriod, pmsBaseCents) })}
                </Typography>
              )}
            </Typography>

            {/* Resume des donnees de la landing page */}
            {hasLandingData && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {t('auth.inscription.requestInfo', 'Informations de votre demande')}
                </Typography>
                <Box sx={{
                  display: 'flex', flexWrap: 'wrap', gap: 0.75,
                }}>
                  {prefill.propertyType && (
                    <Chip size="small" variant="outlined" label={getPropertyTypeLabel(t, prefill.propertyType)} />
                  )}
                  {prefill.surface && (
                    <Chip size="small" variant="outlined" label={t('auth.inscription.surfaceChip', `${prefill.surface} m²`, { value: prefill.surface })} />
                  )}
                  {prefill.guestCapacity && (
                    <Chip size="small" variant="outlined" label={t('auth.inscription.guestCapacityChip', `${prefill.guestCapacity} voyageurs`, { value: prefill.guestCapacity })} />
                  )}
                  {prefill.propertyCount && (
                    <Chip size="small" variant="outlined" label={t('auth.inscription.propertyCountChip', `${prefill.propertyCount} logement(s)`, { value: prefill.propertyCount })} />
                  )}
                  {prefill.city && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={
                        prefill.postalCode
                          ? t('auth.inscription.cityPostalChip', `${prefill.city} (${prefill.postalCode})`, { city: prefill.city, postalCode: prefill.postalCode })
                          : t('auth.inscription.cityChip', `${prefill.city}`, { city: prefill.city })
                      }
                    />
                  )}
                </Box>
              </>
            )}

            {/* Code promo + source d'acquisition (optionnels, collapsibles visuellement) */}
            <Divider sx={{ my: 1 }} />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              <TextField
                fullWidth
                size="small"
                label={t('auth.inscription.promoLabel', 'Code promo / parrainage')}
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder={t('auth.inscription.promoPlaceholder', 'Optionnel')}
                inputProps={{ maxLength: 50, style: { textTransform: 'uppercase' } }}
                helperText={t('auth.inscription.promoHelper', 'Si vous en avez un')}
              />
              <TextField
                select
                fullWidth
                size="small"
                label={t('auth.inscription.referralLabel', 'Comment nous avez-vous connu ?')}
                value={referralSource}
                onChange={(e) => setReferralSource(e.target.value as ReferralSource)}
                helperText={t('auth.inscription.referralHelper', 'Optionnel — nous aide à mieux vous servir')}
                SelectProps={{ displayEmpty: true }}
              >
                <MenuItem value="">
                  <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                    {t('auth.inscription.referralPlaceholder', 'Sélectionner…')}
                  </Typography>
                </MenuItem>
                {REFERRAL_SOURCE_VALUES.map((value) => (
                  <MenuItem key={value} value={value}>
                    {getReferralSourceLabel(t, value)}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {/* Consentements RGPD (CGU obligatoire + newsletter optionnel) */}
            <Divider sx={{ my: 1 }} />
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    size="small"
                    sx={{
                      color: 'divider',
                      '&.Mui-checked': { color: 'primary.main' },
                    }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontSize: '0.8125rem', lineHeight: 1.4 }}>
                    {t('auth.inscription.cguPrefix', "J'accepte les")}{' '}
                    <MuiLink
                      href="/cgu"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      {t('auth.inscription.cguLinkText', "conditions générales d'utilisation")}
                    </MuiLink>{' '}
                    {t('auth.inscription.cguMiddle', 'et la')}{' '}
                    <MuiLink
                      href="/confidentialite"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      {t('auth.inscription.privacyLinkText', 'politique de confidentialité')}
                    </MuiLink>
                    {' '}
                    <Typography component="span" variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                      *
                    </Typography>
                  </Typography>
                }
                sx={{ alignItems: 'flex-start', mr: 0, '& .MuiFormControlLabel-label': { mt: 0.4 } }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newsletterOptIn}
                    onChange={(e) => setNewsletterOptIn(e.target.checked)}
                    size="small"
                    sx={{
                      color: 'divider',
                      '&.Mui-checked': { color: 'primary.main' },
                    }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontSize: '0.8125rem', lineHeight: 1.4 }}>
                    {t('auth.inscription.newsletterOptIn', 'Je souhaite recevoir la newsletter Baitly (nouveautés produit, conseils gestion locative).')}
                  </Typography>
                }
                sx={{ alignItems: 'flex-start', mr: 0, mt: 0.5, '& .MuiFormControlLabel-label': { mt: 0.4 } }}
              />
            </Box>
          </Stack>
        )}

        {/* Etape 2 : Paiement Stripe Embedded Checkout */}
        {activeStep === 1 && clientSecret && (
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3,
          }}>
            {/* Colonne gauche : Recapitulatif de la commande */}
            <Box sx={{ flex: '0 0 320px', minWidth: 0 }}>
              <Card sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                boxShadow: 'none',
              }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '50%',
                      bgcolor: 'rgba(166,192,206,0.15)',
                      color: 'primary.main',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CartIcon size={18} strokeWidth={1.75} color='currentColor' />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {t('auth.inscription.summary', 'Recapitulatif')}
                    </Typography>
                  </Box>

                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {t('auth.inscription.summaryAccount', 'Compte')}
                      </Typography>
                      <Typography variant="body2">{fullName}</Typography>
                      <Typography variant="body2" color="text.secondary">{email}</Typography>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {t('auth.inscription.summaryPlan', 'Forfait')}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Chip
                          label={getForfaitLabel(t, forfait)}
                          size="small"
                          sx={{
                            backgroundColor: FORFAIT_COLORS[forfait] || '#6B8A9A',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                          }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {getInterventionPriceLabel(t, forfait, prefill.interventionPrice)}
                      </Typography>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {isSyncMode
                          ? t('auth.inscription.summarySubscriptionWithSync', 'Abonnement plateforme + Synchro auto')
                          : t('auth.inscription.summarySubscription', 'Abonnement plateforme')}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {getPmsDisplayPrice(t, billingPeriod, confirmedPmsBaseCents ?? pmsBaseCents)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('auth.inscription.summaryPeriod', 'Periode :')} {getBillingPeriodLabel(t, billingPeriod)}
                      </Typography>
                    </Box>

                    <Divider />

                    <Box sx={{
                      p: 1.5, borderRadius: 1.5,
                      bgcolor: 'rgba(166,192,206,0.08)',
                      border: '1px solid rgba(166,192,206,0.2)',
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {t('auth.inscription.summaryTotal', 'Total a payer')}
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: 'primary.dark' }}>
                          {getPmsFirstPayment(t, billingPeriod, confirmedPmsBaseCents ?? pmsBaseCents)}
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>

                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><CheckCircleIcon size={14} strokeWidth={1.75} /></Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('auth.inscription.securedPayment', 'Paiement securise via Stripe')}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Colonne droite : Stripe Embedded Checkout */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Card sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                boxShadow: 'none',
                overflow: 'hidden',
              }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '50%',
                      bgcolor: 'rgba(107,138,154,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CreditCardIcon size={18} strokeWidth={1.75} color='currentColor' />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {t('auth.inscription.paymentTitle', 'Paiement')}
                    </Typography>
                  </Box>
                  <EmbeddedCheckoutProvider
                    stripe={stripePromise}
                    options={{ clientSecret }}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}

        {/* Bouton de navigation (cache a l'etape Paiement) */}
        {activeStep === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
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
              {loading ? <CircularProgress size={20} color="inherit" /> : t('auth.inscription.submit', 'Continuer vers le paiement')}
            </Button>
          </Box>
        )}

        {/* Lien vers login (cache a l'etape Paiement) */}
        {activeStep === 0 && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {t('auth.inscription.alreadyAccount', 'Deja un compte ?')}{' '}
              <Typography
                component="span"
                variant="caption"
                sx={{
                  color: 'secondary.main',
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
                onClick={() => navigate('/login')}
              >
                {t('auth.inscription.loginLink', 'Se connecter')}
              </Typography>
            </Typography>
          </Box>
        )}
    </AuthLayout>
  );
}
