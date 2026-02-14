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
  Chip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import clenzyLogo from '../../assets/Clenzy_logo.png';
import apiClient, { ApiError } from '../../services/apiClient';

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

const FORFAIT_PRICES: Record<string, string> = {
  essentiel: 'Interventions a partir de 35\u20AC',
  confort: 'Interventions a partir de 55\u20AC',
  premium: 'Interventions a partir de 80\u20AC',
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

const DEFAULT_PMS_MONTHLY_CENTS = 500; // 5€/mois fallback

function getPmsDisplayPrice(period: BillingPeriod, baseCents: number): string {
  const monthlyCents = Math.round(baseCents * BILLING_PERIOD_DISCOUNT[period]);
  const monthly = (monthlyCents / 100).toFixed(0);
  return `${monthly}\u20AC / mois`;
}

function getPmsFirstPayment(period: BillingPeriod, baseCents: number): string {
  const monthlyCents = Math.round(baseCents * BILLING_PERIOD_DISCOUNT[period]);
  if (period === 'MONTHLY') return `${(monthlyCents / 100).toFixed(0)}\u20AC`;
  const total = (monthlyCents * 12 / 100).toFixed(0);
  return `${total}\u20AC / an`;
}

const FORFAIT_COLORS: Record<string, string> = {
  essentiel: '#6B8A9A',
  confort: '#A6C0CE',
  premium: '#5A7684',
};

const steps = ['Vos informations', 'Votre mot de passe'];

interface InscriptionResponse {
  checkoutUrl: string;
  sessionId: string;
}

export default function Inscription() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Recuperer les donnees de la landing page (query params)
  const prefill = useMemo(() => ({
    forfait: searchParams.get('forfait') || '',
    billingPeriod: (searchParams.get('billingPeriod') || 'MONTHLY').toUpperCase() as BillingPeriod,
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
  const [forfait, setForfait] = useState(prefill.forfait || 'essentiel');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(
    (['MONTHLY', 'ANNUAL', 'BIENNIAL'].includes(prefill.billingPeriod) ? prefill.billingPeriod : 'MONTHLY') as BillingPeriod
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Prix PMS charge depuis l'API
  const [pmsBaseCents, setPmsBaseCents] = useState(DEFAULT_PMS_MONTHLY_CENTS);

  useEffect(() => {
    fetch('/api/public/pricing-info')
      .then((r) => r.json())
      .then((data) => {
        if (data.pmsMonthlyPriceCents) {
          setPmsBaseCents(data.pmsMonthlyPriceCents);
        }
      })
      .catch(() => {});
  }, []);

  // Etats
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return nameOk && emailOk && phoneOk && !!forfait;
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
        companyName,
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

      // Rediriger vers Stripe Checkout (meme onglet)
      if (response.checkoutUrl) {
        // Creer un lien temporaire et cliquer dessus pour garantir la navigation dans le meme onglet
        const link = document.createElement('a');
        link.href = response.checkoutUrl;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
        maxWidth: 520,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      }}>
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
            <img src={clenzyLogo} alt="Clenzy Logo" style={{ height: '48px', width: 'auto' }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Creer votre compte
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Accedez a votre espace de gestion Clenzy
          </Typography>
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
              {FORFAIT_PRICES[prefill.forfait] || ''} | Plateforme : {getPmsDisplayPrice(billingPeriod, pmsBaseCents)}
            </Typography>
          </Box>
        )}

        {/* Stepper */}
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
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
            <TextField
              fullWidth
              size="small"
              label="Nom de la societe"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ma Societe SARL"
              helperText="Optionnel"
            />

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
                    {FORFAIT_PRICES[forfait] || ''}
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
              {billingPeriod !== 'MONTHLY' && (
                <Typography component="span" variant="caption" sx={{ ml: 0.5, textDecoration: 'line-through', color: 'text.disabled' }}>
                  {(pmsBaseCents / 100).toFixed(0)}{'\u20AC'}/mois
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
              {companyName && <Typography variant="body2"><strong>Societe :</strong> {companyName}</Typography>}
              <Typography variant="body2">
                <strong>Forfait :</strong> {FORFAIT_LABELS[forfait] || forfait}
              </Typography>
              <Typography variant="body2">
                <strong>Interventions :</strong> {FORFAIT_PRICES[forfait] || ''}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                <strong>Abonnement plateforme :</strong> {getPmsDisplayPrice(billingPeriod, pmsBaseCents)}
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
                Pour activer votre compte, un paiement de <strong>{getPmsFirstPayment(billingPeriod, pmsBaseCents)}</strong> (abonnement plateforme {BILLING_PERIOD_LABELS[billingPeriod].toLowerCase()}) vous sera demande via Stripe. Les interventions seront facturees separement a l'utilisation.
              </Typography>
            </Alert>
          </Stack>
        )}

        {/* Boutons de navigation */}
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
              {loading ? <CircularProgress size={20} color="inherit" /> : `Payer ${getPmsFirstPayment(billingPeriod, pmsBaseCents)} et activer mon compte`}
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

        {/* Lien vers login */}
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
      </Paper>
    </Box>
  );
}
