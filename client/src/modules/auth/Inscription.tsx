import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
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
  ThemeProvider,
  CssBaseline,
  Card,
  CardContent,
} from '@mui/material';
import {
  ShoppingCart as CartIcon,
  CreditCard as CreditCardIcon,
  CheckCircle as CheckCircleIcon,
  PersonOutline as PersonIcon,
  LockOutlined as LockIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import lightTheme from '../../theme/theme';
import ClenzyAnimatedLogo from '../../components/ClenzyAnimatedLogo';
import apiClient, { ApiError } from '../../services/apiClient';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// Labels pour affichage
const PROPERTY_TYPE_LABELS: Record<string, string> = {
  studio: 'Studio',
  appartement: 'Appartement',
  maison: 'Maison',
  duplex: 'Duplex',
  villa: 'Villa',
  autre: 'Autre',
};

const FORFAIT_LABELS: Record<string, string> = {
  essentiel: 'Forfait Essentiel',
  confort: 'Forfait Confort',
  premium: 'Forfait Premium',
};

// Types d'organisation
type OrganizationTypeKey = 'INDIVIDUAL' | 'CONCIERGE' | 'CLEANING_COMPANY';

const ORG_TYPE_LABELS: Record<OrganizationTypeKey, string> = {
  INDIVIDUAL: 'Particulier',
  CONCIERGE: 'Conciergerie',
  CLEANING_COMPANY: 'Societe de menage',
};

/** Prix de base par forfait (aligné avec la landing page) */
const FORFAIT_BASE_PRICES: Record<string, number> = {
  essentiel: 50,
  confort: 75,
  premium: 100,
};

type BillingPeriod = 'MONTHLY' | 'ANNUAL' | 'BIENNIAL';

const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  MONTHLY: 'Mensuel',
  ANNUAL: 'Annuel',
  BIENNIAL: '2 ans',
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

function getPmsDisplayPrice(period: BillingPeriod, baseCents: number | null): string {
  if (baseCents === null) return '…';
  const monthlyCents = Math.round(baseCents * BILLING_PERIOD_DISCOUNT[period]);
  return `${formatCents(monthlyCents)} / mois`;
}

function getPmsFirstPayment(period: BillingPeriod, baseCents: number | null): string {
  if (baseCents === null) return '…';
  const monthlyCents = Math.round(baseCents * BILLING_PERIOD_DISCOUNT[period]);
  if (period === 'MONTHLY') return formatCents(monthlyCents);
  const totalCents = monthlyCents * 12;
  return `${formatCents(totalCents)} / an`;
}

/** Libellé prix intervention : utilise le prix transmis par la landing page, sinon le prix de base */
function getInterventionPriceLabel(forfait: string, interventionPrice?: string): string {
  const price = interventionPrice
    ? parseInt(interventionPrice, 10)
    : FORFAIT_BASE_PRICES[forfait];
  if (!price) return '';
  return `Interventions a partir de ${price}€`;
}

const FORFAIT_COLORS: Record<string, string> = {
  essentiel: '#6B8A9A',
  confort: '#A6C0CE',
  premium: '#5A7684',
};

const steps = ['Vos informations', 'Votre mot de passe', 'Paiement'];

const STEP_ICONS: Record<number, React.ReactElement> = {
  1: <PersonIcon />,
  2: <LockIcon />,
  3: <PaymentIcon />,
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
          ? '#6B8A9A'
          : active
            ? '#5A7684'
            : 'grey.300',
        color: '#fff',
        transition: 'all 0.3s ease',
        '& .MuiSvgIcon-root': { fontSize: 18 },
      }}
    >
      {completed ? <CheckCircleIcon sx={{ fontSize: 20 }} /> : STEP_ICONS[icon as number]}
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Prix PMS charges depuis l'API (pas de fallback — toujours depuis /pricing-info)
  const [pmsMonthlyPriceCents, setPmsMonthlyPriceCents] = useState<number | null>(null);
  const [pmsSyncPriceCents, setPmsSyncPriceCents] = useState<number | null>(null);

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
      setError('Le paiement a ete annule. Vous pouvez reessayer quand vous le souhaitez.');
    }
  }, [paymentCancelled]);

  // Validation
  const isStep1Valid = () => {
    const nameParts = fullName.trim().split(/\s+/).filter((p) => p.length >= 2);
    const nameOk = nameParts.length >= 2;
    const emailOk = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email);
    const phoneDigits = phone.replace(/[\s.\-]/g, '');
    const phoneOk = !phone.trim() || /^(?:(?:\+33|0033)[1-9]\d{8}|0[1-9]\d{8})$/.test(phoneDigits);
    const companyOk = !isProType || companyName.trim().length > 0;
    return nameOk && emailOk && phoneOk && !!forfait && companyOk;
  };

  const isStep2Valid = () => {
    return password.length >= 8 && password === confirmPassword;
  };

  const handleNext = () => {
    setError(null);
    if (activeStep === 0 && !isStep1Valid()) {
      setError('Veuillez remplir correctement tous les champs obligatoires.');
      return;
    }
    if (activeStep === 1 && !isStep2Valid()) {
      if (password.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caracteres.');
      } else {
        setError('Les mots de passe ne correspondent pas.');
      }
      return;
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.post<InscriptionResponse>('/public/inscription', {
        fullName,
        email,
        phone,
        companyName: isProType ? companyName : undefined,
        organizationType,
        password,
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
      }, { skipAuth: true });

      // Stocker le clientSecret + prix confirmes et passer au step Paiement
      if (response.clientSecret) {
        setClientSecret(response.clientSecret);
        // Utiliser le prix reel du backend pour le recap (coherence avec Stripe)
        if (response.pmsBaseCents) {
          setConfirmedPmsBaseCents(response.pmsBaseCents);
        }
        setActiveStep(2);
      } else {
        setError('Erreur lors de la creation de la session de paiement.');
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 409) {
        setError('Un compte existe deja avec cette adresse email.');
      } else if (apiErr.message) {
        setError(apiErr.message);
      } else {
        setError('Une erreur est survenue. Veuillez reessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #A6C0CE 0%, #8BA3B3 50%, #6B8A9A 100%)',
      p: 2,
    }}>
      <Paper elevation={8} sx={{
        p: { xs: 3, sm: 4 },
        width: '100%',
        maxWidth: activeStep === 2 ? 960 : 640,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        transition: 'max-width 0.3s ease',
      }}>
        {/* Logo animé */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <ClenzyAnimatedLogo scale={1.1} />
        </Box>

        {/* Badge forfait selectionne */}
        {prefill.forfait && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Chip
              label={FORFAIT_LABELS[prefill.forfait] || prefill.forfait}
              sx={{
                backgroundColor: FORFAIT_COLORS[prefill.forfait] || '#6B8A9A',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.8rem',
                px: 1,
              }}
            />
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              {getInterventionPriceLabel(prefill.forfait, prefill.interventionPrice)} | Plateforme{isSyncMode ? ' + Synchro' : ''} : {getPmsDisplayPrice(billingPeriod, pmsBaseCents)}
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
                cursor: activeStep > index && activeStep !== 2 ? 'pointer' : 'default',
                '&:hover .MuiStepLabel-label': activeStep > index && activeStep !== 2
                  ? { color: '#5A7684' }
                  : {},
              }}
              onClick={() => {
                // Permettre de revenir aux etapes precedentes (sauf depuis le paiement Stripe)
                if (index < activeStep && activeStep !== 2) {
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
                label="Nom complet *"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jean Dupont"
                helperText="Prenom et nom de famille"
              />
              <TextField
                fullWidth
                size="small"
                label="Email *"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jean@exemple.fr"
              />
              <TextField
                fullWidth
                size="small"
                label="Telephone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07 66 72 91 09"
                helperText="Optionnel"
              />
            </Box>

            {/* Selection du type d'organisation */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                Vous etes
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {(['INDIVIDUAL', 'CONCIERGE', 'CLEANING_COMPANY'] as const).map((t) => (
                  <Chip
                    key={t}
                    label={ORG_TYPE_LABELS[t]}
                    clickable
                    onClick={() => {
                      setOrganizationType(t);
                      if (t === 'INDIVIDUAL') setCompanyName('');
                    }}
                    sx={{
                      backgroundColor: organizationType === t ? '#6B8A9A' : 'transparent',
                      color: organizationType === t ? '#fff' : 'text.primary',
                      fontWeight: organizationType === t ? 600 : 400,
                      border: '1px solid',
                      borderColor: organizationType === t ? 'transparent' : 'grey.300',
                      '&:hover': {
                        backgroundColor: organizationType === t ? '#6B8A9A' : 'grey.100',
                      },
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* Nom de la societe (conditionnel, requis pour type pro) */}
            {isProType && (
              <TextField
                fullWidth
                size="small"
                label="Nom de la societe *"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ma Societe SARL"
                error={isProType && companyName.trim() === ''}
                helperText="Requis pour les conciergeries et societes de menage"
              />
            )}

            {/* Selection du forfait si non pre-rempli */}
            {!prefill.forfait && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Choisissez votre forfait *
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {(['essentiel', 'confort', 'premium'] as const).map((f) => (
                    <Chip
                      key={f}
                      label={FORFAIT_LABELS[f]}
                      clickable
                      onClick={() => setForfait(f)}
                      sx={{
                        backgroundColor: forfait === f ? (FORFAIT_COLORS[f] || '#6B8A9A') : 'transparent',
                        color: forfait === f ? '#fff' : 'text.primary',
                        fontWeight: forfait === f ? 600 : 400,
                        border: '1px solid',
                        borderColor: forfait === f ? 'transparent' : 'grey.300',
                        '&:hover': {
                          backgroundColor: forfait === f ? (FORFAIT_COLORS[f] || '#6B8A9A') : 'grey.100',
                        },
                      }}
                    />
                  ))}
                </Stack>
                {forfait && (
                  <Typography variant="caption" color="text.secondary">
                    {getInterventionPriceLabel(forfait)}
                  </Typography>
                )}
              </>
            )}

            {/* Selection de la periode de facturation */}
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Periode de facturation
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
                Mensuel
              </ToggleButton>
              <ToggleButton value="ANNUAL" sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 600 }}>
                Annuel
                <Chip label="-20%" size="small" color="success" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
              </ToggleButton>
              <ToggleButton value="BIENNIAL" sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 600 }}>
                2 ans
                <Chip label="-35%" size="small" color="success" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary">
              Plateforme : {getPmsDisplayPrice(billingPeriod, pmsBaseCents)}
              {billingPeriod !== 'MONTHLY' && pmsBaseCents !== null && (
                <Typography component="span" variant="caption" sx={{ ml: 0.5, textDecoration: 'line-through', color: 'text.disabled' }}>
                  {formatCents(pmsBaseCents)}/mois
                </Typography>
              )}
              {billingPeriod !== 'MONTHLY' && (
                <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'success.main', fontWeight: 600 }}>
                  {' '}Facture {getPmsFirstPayment(billingPeriod, pmsBaseCents)}
                </Typography>
              )}
            </Typography>

            {/* Resume des donnees de la landing page */}
            {hasLandingData && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Informations de votre demande
                </Typography>
                <Box sx={{
                  display: 'flex', flexWrap: 'wrap', gap: 0.75,
                }}>
                  {prefill.propertyType && (
                    <Chip size="small" variant="outlined" label={PROPERTY_TYPE_LABELS[prefill.propertyType] || prefill.propertyType} />
                  )}
                  {prefill.surface && (
                    <Chip size="small" variant="outlined" label={`${prefill.surface} m\u00B2`} />
                  )}
                  {prefill.guestCapacity && (
                    <Chip size="small" variant="outlined" label={`${prefill.guestCapacity} voyageurs`} />
                  )}
                  {prefill.propertyCount && (
                    <Chip size="small" variant="outlined" label={`${prefill.propertyCount} logement(s)`} />
                  )}
                  {prefill.city && (
                    <Chip size="small" variant="outlined" label={`${prefill.city}${prefill.postalCode ? ` (${prefill.postalCode})` : ''}`} />
                  )}
                </Box>
              </>
            )}
          </Stack>
        )}

        {/* Etape 2 : Mot de passe */}
        {activeStep === 1 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Choisissez un mot de passe pour securiser votre compte.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="Mot de passe *"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helperText="Minimum 8 caracteres"
              />
              <TextField
                fullWidth
                size="small"
                label="Confirmer le mot de passe *"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={confirmPassword.length > 0 && password !== confirmPassword}
                helperText={
                  confirmPassword.length > 0 && password !== confirmPassword
                    ? 'Les mots de passe ne correspondent pas'
                    : ''
                }
              />
            </Box>

            {/* Recapitulatif */}
            <Box sx={{
              mt: 1, p: 2, borderRadius: 2,
              backgroundColor: 'grey.50', border: '1px solid',
              borderColor: 'grey.200',
            }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 1 }}>
                Recapitulatif
              </Typography>
              <Typography variant="body2"><strong>Nom :</strong> {fullName}</Typography>
              <Typography variant="body2"><strong>Email :</strong> {email}</Typography>
              {phone && <Typography variant="body2"><strong>Telephone :</strong> {phone}</Typography>}
              {isProType && (
                <>
                  <Typography variant="body2"><strong>Type :</strong> {ORG_TYPE_LABELS[organizationType]}</Typography>
                  <Typography variant="body2"><strong>Societe :</strong> {companyName}</Typography>
                </>
              )}
              <Typography variant="body2">
                <strong>Forfait :</strong> {FORFAIT_LABELS[forfait] || forfait}
              </Typography>
              <Typography variant="body2">
                <strong>Interventions :</strong> {getInterventionPriceLabel(forfait, prefill.interventionPrice)}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                <strong>Abonnement plateforme{isSyncMode ? ' + Synchro auto' : ''} :</strong> {getPmsDisplayPrice(billingPeriod, pmsBaseCents)}
                {billingPeriod !== 'MONTHLY' && (
                  <Typography component="span" variant="body2" sx={{ ml: 0.5, color: 'success.main' }}>
                    ({BILLING_PERIOD_LABELS[billingPeriod]})
                  </Typography>
                )}
              </Typography>
              {billingPeriod !== 'MONTHLY' && (
                <Typography variant="caption" color="text.secondary">
                  Facture : {getPmsFirstPayment(billingPeriod, pmsBaseCents)}
                </Typography>
              )}
            </Box>

            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="caption">
                Pour activer votre compte, un paiement de <strong>{getPmsFirstPayment(billingPeriod, pmsBaseCents)}</strong> (abonnement plateforme{isSyncMode ? ' + synchro auto' : ''} {BILLING_PERIOD_LABELS[billingPeriod].toLowerCase()}) vous sera demande. Les interventions seront facturees separement a l'utilisation.
              </Typography>
            </Alert>
          </Stack>
        )}

        {/* Etape 3 : Paiement Stripe Embedded Checkout */}
        {activeStep === 2 && clientSecret && (
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3,
          }}>
            {/* Colonne gauche : Recapitulatif de la commande */}
            <Box sx={{ flex: '0 0 320px', minWidth: 0 }}>
              <Card sx={{
                borderLeft: '4px solid #A6C0CE',
                borderRadius: 2,
                boxShadow: '0 1px 4px rgba(107,138,154,0.10)',
              }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '50%',
                      bgcolor: 'rgba(166,192,206,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CartIcon sx={{ fontSize: 18, color: '#6B8A9A' }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Recapitulatif
                    </Typography>
                  </Box>

                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Compte
                      </Typography>
                      <Typography variant="body2">{fullName}</Typography>
                      <Typography variant="body2" color="text.secondary">{email}</Typography>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Forfait
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Chip
                          label={FORFAIT_LABELS[forfait] || forfait}
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
                        {getInterventionPriceLabel(forfait, prefill.interventionPrice)}
                      </Typography>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Abonnement plateforme{isSyncMode ? ' + Synchro auto' : ''}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#6B8A9A' }}>
                        {getPmsDisplayPrice(billingPeriod, confirmedPmsBaseCents ?? pmsBaseCents)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Periode : {BILLING_PERIOD_LABELS[billingPeriod]}
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
                          Total a payer
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#5A7684' }}>
                          {getPmsFirstPayment(billingPeriod, confirmedPmsBaseCents ?? pmsBaseCents)}
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>

                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                    <Typography variant="caption" color="text.secondary">
                      Paiement securise via Stripe
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Colonne droite : Stripe Embedded Checkout */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Card sx={{
                borderLeft: '4px solid #6B8A9A',
                borderRadius: 2,
                boxShadow: '0 1px 4px rgba(107,138,154,0.10)',
                overflow: 'hidden',
              }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '50%',
                      bgcolor: 'rgba(107,138,154,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CreditCardIcon sx={{ fontSize: 18, color: '#6B8A9A' }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Paiement
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

        {/* Boutons de navigation (caches a l'etape Paiement) */}
        {activeStep < 2 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              variant="outlined"
              sx={{
                visibility: activeStep === 0 ? 'hidden' : 'visible',
                borderColor: 'grey.300',
                color: 'text.secondary',
                '&:hover': { borderColor: 'grey.400' },
              }}
            >
              Retour
            </Button>

            {activeStep === 1 ? (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading || !isStep2Valid()}
                sx={{
                  px: 4,
                  fontWeight: 600,
                  backgroundColor: 'secondary.main',
                  '&:hover': { backgroundColor: 'secondary.dark' },
                  borderRadius: 1.5,
                }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Continuer vers le paiement'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!isStep1Valid()}
                sx={{
                  px: 4,
                  fontWeight: 600,
                  backgroundColor: 'secondary.main',
                  '&:hover': { backgroundColor: 'secondary.dark' },
                  borderRadius: 1.5,
                }}
              >
                Suivant
              </Button>
            )}
          </Box>
        )}

        {/* Lien vers login (cache a l'etape Paiement) */}
        {activeStep < 2 && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Deja un compte ?{' '}
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
                Se connecter
              </Typography>
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
    </ThemeProvider>
  );
}
