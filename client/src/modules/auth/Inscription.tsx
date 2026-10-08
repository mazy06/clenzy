import { useState, useMemo, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
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
  Button,
  Card,
  CardContent,
  Checkbox,
  Separator,
  Step,
  StepLabel,
  Stepper,
  ToggleGroup,
  ToggleGroupItem,
} from '../../components/ui';
import { TriangleAlert } from '../../icons/glyphs';
import {
  ShoppingCart as CartIcon,
  CreditCard as CreditCardIcon,
  CheckCircle as CheckCircleIcon,
} from '../../icons';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import apiClient, { ApiError } from '../../services/apiClient';
import AuthLayout from './AuthLayout';
import { readSignupDraft, saveSignupDraft } from './baitlySignupDraft';
import OptionCard from './OptionCard';
import BaitlySignupPricing, { signupQuoteKey, type SignupProposal } from './BaitlySignupPricing';

import { runtimeEnv } from '../../config/runtimeConfig';
// Ne PAS appeler loadStripe('') si la clef n'est pas configuree : ça log un
// `IntegrationError: empty string` au boot de l'app sur toutes les pages
// publiques. Meme pattern que BookingPaymentPage / PaymentCheckoutModal.
const stripePublishableKey = runtimeEnv('VITE_STRIPE_PUBLISHABLE_KEY');
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

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

const FORFAIT_BADGE_VARIANTS = { essential: 'secondary', pro: 'default' } as const;
type OrganizationTypeKey = 'INDIVIDUAL' | 'CONCIERGE' | 'CLEANING_COMPANY';
type BillingPeriod = 'MONTHLY';
const getBillingPeriodLabel = (t: TFunction, _period: string) => t('auth.inscription.billingPeriods.MONTHLY', 'Mensuel');

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

// La pastille d'etape n'est plus dessinee ici : le Stepper du kit rend son
// propre numero, remplace par une coche a l'etape franchie. `StepIconComponent`
// n'existe pas cote kit — c'etait la seule raison de `CustomStepIcon`.

interface InscriptionResponse {
  clientSecret: string;
  sessionId: string;
  pmsBaseCents?: number;
  monthlyPriceCents?: number;
  stripePriceAmount?: number;
  billingPeriod?: string;
  currency: string;
}

export default function Inscription() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const steps = useMemo(
    () => [
      t('auth.inscription.stepInformations', 'Vos informations'),
      t('auth.inscription.stepPayment', 'Paiement'),
    ],
    [t],
  );

  const [draft] = useState(() => {
    const saved = readSignupDraft();
    return searchParams.get('email') && saved?.payload.email !== searchParams.get('email') ? null : saved;
  });
  const restored = (key: string, fallback = '') => {
    const value = draft?.payload[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.join(',') : fallback;
  };
  // Recuperer les donnees de la landing page (query params)
  const prefill = useMemo(() => ({
    forfait: searchParams.get('forfait') || restored('forfait'),
    billingPeriod: (searchParams.get('billingPeriod') || 'MONTHLY').toUpperCase() as BillingPeriod,
    interventionPrice: searchParams.get('interventionPrice') || '',
    email: searchParams.get('email') || restored('email'),
    fullName: searchParams.get('fullName') || restored('fullName'),
    phone: searchParams.get('phone') || restored('phone'),
    city: searchParams.get('city') || restored('city'),
    postalCode: searchParams.get('postalCode') || restored('postalCode'),
    propertyType: searchParams.get('propertyType') || restored('propertyType'),
    propertyCount: searchParams.get('propertyCount') || restored('propertyCount'),
    surface: searchParams.get('surface') || restored('surface'),
    guestCapacity: searchParams.get('guestCapacity') || restored('guestCapacity'),
    bookingFrequency: searchParams.get('bookingFrequency') || restored('bookingFrequency'),
    cleaningSchedule: searchParams.get('cleaningSchedule') || restored('cleaningSchedule'),
    calendarSync: searchParams.get('calendarSync') || restored('calendarSync'),
    services: searchParams.get('services') || restored('services'),
    servicesDevis: searchParams.get('servicesDevis') || restored('servicesDevis'),
  }), [searchParams, draft]);

  const hasLandingData = !!prefill.forfait && !!prefill.email;

  // Detecter si le paiement a ete annule (retour depuis Stripe)
  const paymentCancelled = searchParams.get('payment') === 'cancelled';

  // Etape active du stepper
  const [activeStep, setActiveStep] = useState(0);

  // Champs du formulaire
  const [fullName, setFullName] = useState(prefill.fullName);
  const [email, setEmail] = useState(prefill.email);
  const [phone, setPhone] = useState(prefill.phone);
  const [companyName, setCompanyName] = useState(restored('companyName'));
  const [organizationType, setOrganizationType] = useState<OrganizationTypeKey>(() => ['INDIVIDUAL', 'CONCIERGE', 'CLEANING_COMPANY'].includes(restored('organizationType')) ? restored('organizationType') as OrganizationTypeKey : 'INDIVIDUAL');
  const isProType = organizationType !== 'INDIVIDUAL';
  const [forfait, setForfait] = useState(['pro', 'premium'].includes(prefill.forfait) ? 'pro' : 'essential');
  const [billingCountry, setBillingCountry] = useState(searchParams.get('country') || restored('billingCountry', 'FR'));
  const [propertyCount, setPropertyCount] = useState(Number(prefill.propertyCount) || 1);
  const [proposal, setProposal] = useState<SignupProposal | null>(null);
  const request = useRef<{ key: string; id: string } | null>(draft?.request ?? null);
  const submitting = useRef(false);
  const billingPeriod = 'MONTHLY';
  // Consentement RGPD + attribution (4 nouveaux champs)
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(draft?.payload.newsletterOptIn === true);
  const [promoCode, setPromoCode] = useState(restored('promoCode'));
  const [referralSource, setReferralSource] = useState<ReferralSource | ''>(restored('referralSource') as ReferralSource | '');

  // Etats
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  // Prix confirmes par le backend (utilises dans le recap Step 3 pour coherence avec Stripe)
  const [confirmed, setConfirmed] = useState<InscriptionResponse | null>(null);
  const quoteReady = proposal?.key === signupQuoteKey(forfait, billingCountry, propertyCount, promoCode);
  const money = (amount: number, currency: string) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(amount / 100);

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
    const phoneOk = !phone.trim() || /^\+?[0-9]{7,15}$/.test(phoneDigits);
    const companyOk = !isProType || companyName.trim().length > 0;
    // RGPD : l'acceptation des CGU est obligatoire avant de continuer vers le paiement
    return nameOk && emailOk && phoneOk && !!forfait && companyOk && acceptedTerms && quoteReady;
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
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);

    try {
      // Stocker l'email pour la page InscriptionSuccess (renvoi d'email)
      sessionStorage.setItem('inscription_email', email);

      const payload = {
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
        propertyCount,
        billingCountry,
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
      };
      const key = JSON.stringify(payload);
      if (!request.current || request.current.key !== key) request.current = { key, id: crypto.randomUUID() };
      saveSignupDraft(payload, request.current);
      const response = await apiClient.post<InscriptionResponse>('/public/inscription', { ...payload, requestId: request.current.id }, { skipAuth: true });

      // Stocker le clientSecret + prix confirmes et passer au step Paiement
      if (response.clientSecret) {
        setClientSecret(response.clientSecret);
        setConfirmed(response);
        setActiveStep(1);
      } else {
        setError(t('auth.inscription.errors.createSessionFailed', 'Erreur lors de la creation de la session de paiement.'));
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.message) {
        setError(apiErr.message);
      } else {
        setError(t('auth.inscription.errors.generic', 'Une erreur est survenue. Veuillez reessayer.'));
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthLayout maxFormWidth={activeStep === 1 ? 880 : 560}>
        {/* Stepper */}
        <Stepper activeStep={activeStep} className="mb-[18px]">
          {steps.map((label, index) => {
            const retourPossible = index < activeStep && activeStep !== 1;
            return (
              <Step
                key={label}
                className={retourPossible ? 'cursor-pointer' : 'cursor-default'}
                onClick={() => {
                  // Permettre de revenir aux etapes precedentes (sauf depuis le paiement Stripe)
                  if (retourPossible) {
                    setError(null);
                    setActiveStep(index);
                  }
                }}
              >
                <StepLabel>{label}</StepLabel>
              </Step>
            );
          })}
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
              <span className="block text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
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

            <BaitlySignupPricing plan={forfait} country={billingCountry} count={propertyCount} promo={promoCode} disabled={loading}
              onPlan={setForfait} onCountry={setBillingCountry} onCount={setPropertyCount} onQuote={setProposal} />

            {/* Resume des donnees de la landing page */}
            {hasLandingData && (
              <>
                <Separator className="my-1.5" />
                <span className="text-xs font-semibold text-muted-foreground">
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
                <FieldLabel htmlFor="inscription-accept-terms" className="text-[0.8125rem] leading-[1.4] font-normal">
                  <span>
                    {t('auth.inscription.cguPrefix', "J'accepte les")}{' '}
                    <a
                      href="/cgu"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-semibold underline"
                    >
                      {t('auth.inscription.cguLinkText', "conditions générales d'utilisation")}
                    </a>{' '}
                    {t('auth.inscription.cguMiddle', 'et la')}{' '}
                    <a
                      href="/confidentialite"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-semibold underline"
                    >
                      {t('auth.inscription.privacyLinkText', 'politique de confidentialité')}
                    </a>
                    {' '}
                    <span className="text-xs font-semibold text-destructive">
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
                <FieldLabel htmlFor="inscription-newsletter" className="text-[0.8125rem] leading-[1.4] font-normal">
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
              <Card className="shadow-none">
                <CardContent className="p-[15px]">
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="w-[36px] h-[36px] rounded-full bg-primary-soft text-primary flex items-center justify-center">
                      <CartIcon size={18} strokeWidth={1.75} color='currentColor' />
                    </div>
                    <h6 className="text-xs font-semibold text-foreground">
                      {t('auth.inscription.summary', 'Recapitulatif')}
                    </h6>
                  </div>

                  <div className="flex flex-col gap-[9px]">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {t('auth.inscription.summaryAccount', 'Compte')}
                      </span>
                      <p className="text-xs">{fullName}</p>
                      <p className="text-xs text-muted-foreground">{email}</p>
                    </div>

                    <Separator />

                    <div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {t('auth.inscription.summaryPlan', 'Forfait')}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant={forfait === 'pro' ? 'default' : 'secondary'}>
                          {forfait === 'pro' ? 'Baitly Pro' : 'Baitly Essentiel'}
                        </Badge>
                      </div>
                      <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                        {t('monthlySubscription.properties', { count: propertyCount })}
                      </span>
                    </div>

                    <Separator />

                    <div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {t('monthlySubscription.title')}
                      </span>
                      <p className="text-xs font-semibold text-primary tabular-nums">
                        {confirmed && money(confirmed.monthlyPriceCents ?? 0, confirmed.currency)} {t('signupMonthly.netPerMonth')}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {t('auth.inscription.summaryPeriod', 'Periode :')} {getBillingPeriodLabel(t, billingPeriod)}
                      </span>
                    </div>

                    <Separator />

                    <div className="rounded-lg border border-border bg-muted p-2">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-semibold">
                          {t('signupMonthly.firstNet')}
                        </p>
                        <p className="text-sm font-bold text-primary tabular-nums">
                          {confirmed && money(confirmed.stripePriceAmount ?? 0, confirmed.currency)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">{t('monthlySubscription.tax')}</p>
                  <div className="mt-3 flex items-center gap-0.5">
                    <span className="inline-flex text-success-ink"><CheckCircleIcon size={14} strokeWidth={1.75} /></span>
                    <span className="text-xs text-muted-foreground">
                      {t('auth.inscription.securedPayment', 'Paiement securise via Stripe')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Colonne droite : Stripe Embedded Checkout */}
            <div className="flex-1 min-w-0">
              <Card className="shadow-none overflow-hidden">
                <CardContent className="p-[15px]">
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="w-[36px] h-[36px] rounded-full bg-muted text-foreground flex items-center justify-center">
                      <CreditCardIcon size={18} strokeWidth={1.75} color='currentColor' />
                    </div>
                    <h6 className="text-xs font-semibold text-foreground">
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
              onClick={handleNext}
              disabled={loading || !isStep1Valid()}
              className="px-6"
            >
              {loading ? <Spinner className="size-5" /> : t('auth.inscription.submit', 'Continuer vers le paiement')}
            </Button>
          </div>
        )}

        {/* Lien vers login (cache a l'etape Paiement) */}
        {activeStep === 0 && (
          <div className="mt-3 text-center">
            <span className="text-xs text-muted-foreground">
              {t('auth.inscription.alreadyAccount', 'Deja un compte ?')}{' '}
              <span className="font-semibold text-primary cursor-pointer hover:underline" onClick={() => navigate('/login')}>
                {t('auth.inscription.loginLink', 'Se connecter')}
              </span>
            </span>
          </div>
        )}
    </AuthLayout>
  );
}
