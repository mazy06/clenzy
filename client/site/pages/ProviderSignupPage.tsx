import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, ChevronDownIcon, Loader2Icon, PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from '../../src/components/ui';
import Reveal from '../components/Reveal';
import { ProviderLanguagePicker, useProviderLanguage } from '../lib/providerLanguage';
import type { ProviderLanguage } from '../lib/providerLanguage';
import { SignupLanguageContext, useSignupMessages } from '../lib/providerSignupMessages';
import {
  marketplaceApi,
  ApiError,
  type ApplicationDocument,
  type ApplicationStatus,
  type DocumentType,
  type OfferInput,
  type PricingModel,
  type ServiceCategory,
} from '../lib/marketplaceApi';
import { clearUploadToken, readUploadToken, writeUploadToken } from '../lib/uploadToken';

import { PROVIDER_PRICING_MODELS } from '../../src/types/providerPricing';

const LANGUAGES = ['fr', 'ar', 'en', 'es'] as const;



const UPLOAD_ORDER: DocumentType[] = [
  'COMPANY_REGISTRATION', 'URSSAF_VIGILANCE', 'LIABILITY_INSURANCE', 'IDENTITY', 'OTHER',
];

const DOCUMENT_STATUS = {
  PENDING: { variant: 'outline' as const },
  APPROVED: { variant: 'default' as const },
  REJECTED: { variant: 'destructive' as const },
};

/** Une ligne de prestation en cours de saisie. */
interface OfferDraft {
  /** Clé locale : deux prestations libres peuvent porter le même libellé. */
  key: string;
  categoryCode: string;
  serviceItemCode?: string;
  label: string;
  pricingModel: PricingModel;
  amount: string;
  unitLabel?: string;
}

function catalogueLabel(value: { labelFr: string; labelEn?: string | null }, language: ProviderLanguage) {
  return language === 'en' && value.labelEn?.trim() ? value.labelEn : value.labelFr;
}

function formatDate(value: string, language: string): string {
  return new Date(value).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Inscription des professionnels à la place de marché.
 *
 * <p>Trois temps sur une seule route, parce que c'est un seul parcours du point
 * de vue du candidat : la candidature, la confirmation de son adresse (le lien
 * du courriel revient ici), puis le dépôt des justificatifs. Le dépôt
 * réapparaît de lui-même au retour — le jeton vit sur son appareil, jamais dans
 * l'URL.</p>
 */
export default function ProviderSignupPage() {
  const { language, changeLanguage, direction } = useProviderLanguage();
  return <SignupLanguageContext.Provider value={language}>
    <section className="site-shell py-16" lang={language} dir={direction}>
      <ProviderLanguagePicker language={language} onChange={changeLanguage} />
      <SignupContent />
    </section>
  </SignupLanguageContext.Provider>;
}

function SignupContent() {
  const { m } = useSignupMessages();
  const [token, setToken] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [confirmation, setConfirmation] = useState<'confirmed' | 'confirmationFailed' | null>(null);

  useEffect(() => {
    let active = true;
    readUploadToken().then((value) => { if (active) setToken(value); })
      .catch(() => { if (active) setToken('session'); });
    return () => { active = false; };
  }, []);

  // Le lien du courriel de confirmation arrive ici avec son jeton. Il est
  // consommé puis RETIRÉ de l'adresse : un jeton qui reste dans la barre
  // d'adresse suit l'historique et part dans le `Referer` de toute ressource
  // tierce chargée ensuite.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('confirmation');
    if (!value) return;

    const lang = params.get('lang');
    window.history.replaceState({}, '', window.location.pathname + (lang && ['fr', 'en', 'ar'].includes(lang) ? '?lang=' + lang : ''));
    marketplaceApi.confirmEmail(value)
      .then(() => setConfirmation('confirmed'))
      .catch(() => setConfirmation('confirmationFailed'));
  }, []);

  const handleSubmitted = useCallback((issued: string) => {
    writeUploadToken(issued);
    setToken(issued);
    setJustSubmitted(true);
    window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, []);

  const handleTokenLost = useCallback(() => setToken(null), []);

  return (
    <>
      <Reveal>
        <Badge variant="outline">{m.badge}</Badge>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance">
          {token ? m.application : m.title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {token
            ? m.documentsIntro : m.intro}
        </p>
        {!token && (
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            {m.independent}
          </p>
        )}
      </Reveal>

      {confirmation && (
        <div className="mt-8 rounded-2xl border border-success/40 bg-success/[0.08] px-5 py-4 text-sm leading-relaxed">
          {m[confirmation]}
        </div>
      )}

      <div className="mt-10">
        {token
          ? <DocumentPanel token={token} justSubmitted={justSubmitted} onTokenLost={handleTokenLost} />
          : <ApplicationForm onSubmitted={handleSubmitted} />}
      </div>
    </>
  );
}

// ─── Candidature ──────────────────────────────────────────────────────────────

function ApplicationForm({ onSubmitted }: { onSubmitted: (token: string) => void }) {
  const { m, language } = useSignupMessages();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [termsVersion, setTermsVersion] = useState('');
  const [catalogueError, setCatalogueError] = useState(false);
  const [showAllTrades, setShowAllTrades] = useState(false);

  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [offers, setOffers] = useState<OfferDraft[]>([]);
  const [languages, setLanguages] = useState<string[]>(['fr']);

  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [baseCountryCode, setBaseCountryCode] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [zones, setZones] = useState([{ countryCode: '', department: '', city: '' }]);
  const [availability, setAvailability] = useState<{ dayOfWeek: number; startTime: string; endTime: string }[]>([]);
  const [baseCity, setBaseCity] = useState('');
  const [basePostalCode, setBasePostalCode] = useState('');
  const [travelRadiusKm, setTravelRadiusKm] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState<'submitFailed' | 'limited' | null>(null);
  const [termsUnavailable, setTermsUnavailable] = useState(false);

  useEffect(() => {
    marketplaceApi.getCategories().then(setCategories).catch(() => setCatalogueError(true));
    marketplaceApi.getTermsVersion().then(value => { setTermsVersion(value); setTermsUnavailable(!value.trim()); }).catch(() => setTermsUnavailable(true));
  }, []);

  // Les métiers usuels d'abord : sur trente-deux entrées, une liste
  // alphabétique enterre le ménage entre la conciergerie et le déneigement.
  const { commonTrades, otherTrades } = useMemo(() => ({
    commonTrades: categories.filter((c) => c.common),
    otherTrades: categories.filter((c) => !c.common),
  }), [categories]);

  const visibleTrades = showAllTrades ? [...commonTrades, ...otherTrades] : commonTrades;
  const selectedCategories = categories.filter((c) => selectedTrades.includes(c.code));

  const toggleTrade = (code: string) => {
    setSelectedTrades((current) => {
      if (current.includes(code)) {
        // Retirer un métier retire ses prestations : les garder laisserait des
        // lignes rattachées à un métier que le candidat ne propose plus.
        setOffers((rows) => rows.filter((row) => row.categoryCode !== code));
        return current.filter((value) => value !== code);
      }
      return [...current, code];
    });
  };

  const updateOffer = (key: string, patch: Partial<OfferDraft>) =>
    setOffers((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  /** Choisir une prestation du catalogue remplit le libellé et le mode de prix. */
  const pickCatalogueItem = (key: string, categoryCode: string, itemCode: string) => {
    const item = categories.find((c) => c.code === categoryCode)?.items.find((i) => i.code === itemCode);
    updateOffer(key, {
      serviceItemCode: itemCode || undefined,
      label: item ? catalogueLabel(item, language) : '',
      pricingModel: item?.defaultPricingModel ?? 'FLAT',
    });
  };

  const canSubmit =
    displayName.trim().length > 0 &&
    contactFirstName.trim().length > 1 &&
    contactLastName.trim().length > 1 &&
    email.trim().length > 0 &&
    selectedTrades.length > 0 &&
    /^[A-Z]{2}$/.test(baseCountryCode) &&
    /^[A-Z]{3}$/.test(currency) &&
    zones.length > 0 && zones.every(z => /^[A-Z]{2}$/.test(z.countryCode) && (z.countryCode === 'FR' ? z.department.trim() : z.city.trim())) &&
    offers.length > 0 && offers.every(row => row.label.trim() && (row.pricingModel === 'ON_QUOTE' || (row.amount.trim() && Number.isFinite(Number(row.amount)) && Number(row.amount) >= 0))
      && (row.pricingModel !== 'PER_UNIT' || row.unitLabel?.trim())) &&
    availability.every(slot => slot.startTime && slot.endTime > slot.startTime) &&
    acceptedTerms && termsVersion.trim().length > 0 &&
    status !== 'loading';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus('loading');
    setMessage(null);
    try {
      onSubmitted(await marketplaceApi.apply({
        displayName: displayName.trim(),
        legalName: legalName.trim() || undefined,
        contactFirstName: contactFirstName.trim(),
        contactLastName: contactLastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        headline: headline.trim() || undefined,
        bio: bio.trim() || undefined,
        baseCity: baseCity.trim() || undefined,
        basePostalCode: basePostalCode.trim() || undefined,
        baseCountryCode,
        zones: zones.map((zone, index) => ({ ...zone, primary: index === 0 })),
        availability,
        travelRadiusKm: travelRadiusKm ? Number(travelRadiusKm) : null,
        languages,
        registrationNumber: registrationNumber.trim() || undefined,
        categoryCodes: selectedTrades,
        offers: offers
          .map<OfferInput>((row) => ({
            categoryCode: row.categoryCode,
            serviceItemCode: row.serviceItemCode,
            label: row.label.trim(),
            pricingModel: row.pricingModel,
            amount: row.pricingModel === 'ON_QUOTE' || !row.amount ? null : Number(row.amount),
            currency,
            unitLabel: row.unitLabel?.trim() || undefined,
          })),
        acceptedTerms: true,
        termsVersion,
      }));
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof ApiError && error.status === 429 ? 'limited' : 'submitFailed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormSection step={1} title={m.trades} hint={m.tradesHint}>
        {catalogueError ? (
          <p className="text-sm text-muted-foreground">
            {m.catalogueError}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {visibleTrades.map((trade) => {
                const selected = selectedTrades.includes(trade.code);
                return (
                  <button
                    key={trade.code}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTrade(trade.code)}
                    className={
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors duration-200 ' +
                      (selected
                        ? 'border-primary/60 bg-primary/10 font-medium text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-foreground/25')
                    }
                  >
                    {selected && <CheckIcon className="size-3.5 text-primary" />}
                    {catalogueLabel(trade, language)}
                  </button>
                );
              })}
            </div>
            {otherTrades.length > 0 && !showAllTrades && (
              <Button type="button" variant="ghost" size="sm" className="mt-3"
                onClick={() => setShowAllTrades(true)}>
                {m.moreTrades.replace('{count}', String(otherTrades.length))}
                <ChevronDownIcon className="size-3.5" />
              </Button>
            )}
          </>
        )}
      </FormSection>

      {selectedCategories.length > 0 && (
        <FormSection step={2} title={m.services}
          hint={m.servicesHint}>
          <div className="flex flex-col gap-6">
            {selectedCategories.map((category) => {
              const rows = offers.filter((row) => row.categoryCode === category.code);
              return (
                <div key={category.code}>
                  <p className="mb-2 text-sm font-semibold">{catalogueLabel(category, language)}</p>
                  <div className="flex flex-col gap-2.5">
                    {rows.map((row) => (
                      <div key={row.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {category.items.length > 0 && (
                          <NativeSelect
                            aria-label={m.catalogueService}
                            value={row.serviceItemCode ?? ''}
                            onChange={(e) => pickCatalogueItem(row.key, category.code, e.target.value)}
                            className="sm:w-[38%]"
                          >
                            <NativeSelectOption value="">{m.customService}</NativeSelectOption>
                            {category.items.map((item) => (
                              <NativeSelectOption key={item.code} value={item.code}>
                                {catalogueLabel(item, language)}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        )}
                        <Input
                          aria-label={m.serviceLabel}
                          value={row.label}
                          onChange={(e) => updateOffer(row.key, { label: e.target.value })}
                          placeholder={m.label}
                          maxLength={120}
                          className="sm:flex-1"
                        />
                        <NativeSelect
                          aria-label={m.pricing}
                          value={row.pricingModel}
                          onChange={(e) => updateOffer(row.key, { pricingModel: e.target.value as PricingModel })}
                          className="sm:w-[150px]"
                        >
                          {PROVIDER_PRICING_MODELS.map(value => (
                            <NativeSelectOption key={value} value={value}>{m[value]}</NativeSelectOption>
                          ))}
                        </NativeSelect>
                        {row.pricingModel !== 'ON_QUOTE' && (
                          <Input
                            aria-label={m.amount}
                            value={row.amount}
                            onChange={(e) => updateOffer(row.key, { amount: e.target.value })}
                            inputMode="decimal"
                            placeholder={currency}
                            className="tabular-nums sm:w-[110px]"
                          />
                        )}
                        {row.pricingModel === 'PER_UNIT' && <Input aria-label={m.unit} placeholder={m.unitHint}
                          value={row.unitLabel ?? ''} maxLength={40} required
                          onChange={event => updateOffer(row.key, { unitLabel: event.target.value })} />}
                        <Button type="button" variant="outline" size="icon"
                          aria-label={m.removeService}
                          onClick={() => setOffers((all) => all.filter((o) => o.key !== row.key))}>
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="w-fit"
                      onClick={() => setOffers((all) => [...all, {
                        key: `${category.code}-${Date.now()}-${all.length}`,
                        categoryCode: category.code,
                        label: '',
                        pricingModel: 'FLAT',
                        amount: '',
                      }])}>
                      <PlusIcon className="size-3.5" />
                      {m.addService}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </FormSection>
      )}

      <FormSection step={3} title={m.identity} hint={m.identityHint}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="ps-display">{m.displayName}</FieldLabel>
            <Input id="ps-display" value={displayName} maxLength={150} required
              placeholder="Atelier Ourika" onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ps-legal">{m.legalName}</FieldLabel>
              <Input id="ps-legal" value={legalName} maxLength={200}
                onChange={(e) => setLegalName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ps-siret">{m.registration}</FieldLabel>
              <Input id="ps-siret" value={registrationNumber} maxLength={40}
                onChange={(e) => setRegistrationNumber(e.target.value)} />
            </Field>
          </div>
          {/* Obligatoires : à l'acceptation, ils deviennent le prénom et le nom
              du compte, que Baitly exige. Les laisser facultatifs obligeait à
              les deviner en découpant le nom commercial. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ps-first">{m.firstName}</FieldLabel>
              <Input id="ps-first" value={contactFirstName} maxLength={80} required
                autoComplete="given-name" onChange={(e) => setContactFirstName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ps-last">{m.lastName}</FieldLabel>
              <Input id="ps-last" value={contactLastName} maxLength={80} required
                autoComplete="family-name" onChange={(e) => setContactLastName(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ps-email">{m.email}</FieldLabel>
              <Input id="ps-email" type="email" value={email} maxLength={320} required
                autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ps-phone">{m.phone}</FieldLabel>
              <Input id="ps-phone" type="tel" value={phone} maxLength={40}
                autoComplete="tel" placeholder="+212 6…" onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="ps-site">{m.website}</FieldLabel>
            <Input id="ps-site" type="url" value={website} maxLength={300}
              placeholder="https://" onChange={(e) => setWebsite(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ps-headline">{m.headline}</FieldLabel>
            <Input id="ps-headline" value={headline} maxLength={200}
              placeholder={m.headlineHint}
              onChange={(e) => setHeadline(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ps-bio">{m.bio}</FieldLabel>
            <Textarea id="ps-bio" value={bio} maxLength={4000} rows={4}
              placeholder={m.bioHint}
              onChange={(e) => setBio(e.target.value)} />
          </Field>
        </FieldGroup>
      </FormSection>

      <FormSection step={4} title={m.coverage} hint={m.coverageHint}>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="ps-country">{m.country}</FieldLabel>
              <Input id="ps-country" value={baseCountryCode} maxLength={2} pattern="[A-Z]{2}" required placeholder="FR, MA, GB…"
                onChange={event => setBaseCountryCode(event.target.value.toUpperCase())} /></Field>
            <Field><FieldLabel htmlFor="ps-currency">{m.currency}</FieldLabel>
              <Input id="ps-currency" value={currency} maxLength={3} pattern="[A-Z]{3}" required placeholder="EUR, MAD, GBP…"
                onChange={event => setCurrency(event.target.value.toUpperCase())} /></Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="ps-city">{m.city}</FieldLabel>
              <Input id="ps-city" value={baseCity} maxLength={80}
                autoComplete="address-level2" onChange={(e) => setBaseCity(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ps-zip">{m.zip}</FieldLabel>
              <Input id="ps-zip" value={basePostalCode} maxLength={10}
                autoComplete="postal-code" onChange={(e) => setBasePostalCode(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ps-radius">{m.radius}</FieldLabel>
              <Input id="ps-radius" value={travelRadiusKm} inputMode="numeric"
                className="tabular-nums" onChange={(e) => setTravelRadiusKm(e.target.value)} />
            </Field>
          </div>
          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="mb-2 text-sm font-medium">{m.zones}</legend>
            <p className="text-sm text-muted-foreground">{m.zonesHint}</p>
            {zones.map((zone, index) => <div key={index} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-sm">{m.zoneCountry}
                <Input value={zone.countryCode} maxLength={2} pattern="[A-Z]{2}" required placeholder="FR, MA…"
                  onChange={event => setZones(rows => rows.map((row,i) => i===index ? { ...row, countryCode: event.target.value.toUpperCase() } : row))} /></label>
              <label className="flex flex-col gap-1 text-sm">{zone.countryCode === 'FR' ? m.department : m.city}
                <Input value={zone.countryCode === 'FR' ? zone.department : zone.city} maxLength={zone.countryCode === 'FR' ? 3 : 80} required
                  onChange={event => setZones(rows => rows.map((row,i) => i===index ? { ...row, [zone.countryCode === 'FR' ? 'department' : 'city']: event.target.value } : row))} /></label>
              <Button type="button" variant="outline" onClick={() => setZones(rows => rows.filter((_,i) => i!==index))}>{m.removeZone}</Button>
            </div>)}
            <Button type="button" variant="outline" className="w-fit" disabled={zones.length>=40}
              onClick={() => setZones(rows => [...rows,{ countryCode: baseCountryCode, department: '', city: '' }])}>{m.addZone}</Button>
          </fieldset>
          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="mb-2 text-sm font-medium">{m.weekly}</legend>
            <p className="text-sm text-muted-foreground">{m.weeklyHint}</p>
            {availability.map((slot,index) => <div key={index} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-sm">{m.day}
                <NativeSelect value={slot.dayOfWeek} onChange={event => setAvailability(rows => rows.map((row,i) => i===index ? { ...row, dayOfWeek: Number(event.target.value) } : row))}>
                  {[m.monday,m.tuesday,m.wednesday,m.thursday,m.friday,m.saturday,m.sunday].map((label,i) => <NativeSelectOption key={label} value={i+1}>{label}</NativeSelectOption>)}
                </NativeSelect></label>
              <label className="flex flex-col gap-1 text-sm">{m.start}<Input type="time" required value={slot.startTime}
                onChange={event => setAvailability(rows => rows.map((row,i) => i===index ? { ...row, startTime: event.target.value } : row))} /></label>
              <label className="flex flex-col gap-1 text-sm">{m.end}<Input type="time" required value={slot.endTime}
                onChange={event => setAvailability(rows => rows.map((row,i) => i===index ? { ...row, endTime: event.target.value } : row))} /></label>
              <Button type="button" variant="outline" onClick={() => setAvailability(rows => rows.filter((_,i) => i!==index))}>{m.removeSlot}</Button>
            </div>)}
            <Button type="button" variant="outline" className="w-fit" disabled={availability.length>=60}
              onClick={() => setAvailability(rows => [...rows,{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }])}>{m.addSlot}</Button>
          </fieldset>
          <Field>
            <FieldLabel>{m.spoken}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((language) => {
                const selected = languages.includes(language);
                return (
                  <button
                    key={language}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setLanguages((current) => current.includes(language)
                      ? current.filter((c) => c !== language)
                      : [...current, language])}
                    className={
                      'cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors duration-200 ' +
                      (selected
                        ? 'border-primary/60 bg-primary/10 font-medium text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-foreground/25')
                    }
                  >
                    {m[language]}
                  </button>
                );
              })}
            </div>
          </Field>
        </FieldGroup>
      </FormSection>

      <FormSection step={5} title={m.terms} hint={m.termsHint}>
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox checked={acceptedTerms}
            onCheckedChange={(value) => setAcceptedTerms(value === true)} className="mt-0.5" />
          <span className="text-sm leading-relaxed text-muted-foreground">
            {m.acceptTerms}
            {termsVersion && <span className="text-muted-foreground/80"> ({m.version} {termsVersion})</span>}
            {' '}{m.and}{' '}
            <Link to="/legal/confidentialite" className="font-medium text-foreground underline">
              {m.privacy}
            </Link>.
          </span>
        </label>

        {termsUnavailable && <p role="alert" className="mt-4 text-sm">{m.termsUnavailable}</p>}

        {status === 'error' && (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm">
            {message && m[message]}
          </p>
        )}

        <Button type="submit" size="lg" disabled={!canSubmit} className="mt-6">
          {status === 'loading' && <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />}
          {m.submit}
        </Button>

        {!canSubmit && status !== 'loading' && (
          <p className="mt-2.5 text-sm text-muted-foreground">
            {m.incomplete}
          </p>
        )}
      </FormSection>
    </form>
  );
}

function FormSection({ step, title, hint, children }: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-brand">
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-semibold tabular-nums text-primary">
          {String(step).padStart(2, '0')}
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

// ─── Justificatifs ────────────────────────────────────────────────────────────

function DocumentPanel({ token, justSubmitted, onTokenLost }: {
  token: string;
  justSubmitted: boolean;
  onTokenLost: () => void;
}) {
  const { m, language } = useSignupMessages();
  const [application, setApplication] = useState<ApplicationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'notFound' | 'loadFailed' | 'fileFailed' | 'limited' | null>(null);

  const refresh = useCallback(async () => {
    try {
      setApplication(await marketplaceApi.getStatus(token));
      setError(null);
    } catch (caught) {
      // Jeton expiré, ou dossier déjà tranché : le garder ferait échouer chaque
      // dépôt en silence. On le retire et on le dit.
      if (caught instanceof ApiError && (caught.status === 404 || caught.status === 401)) {
        clearUploadToken();
        onTokenLost();
      }
      setError(caught instanceof ApiError && caught.status === 429 ? 'limited' : 'loadFailed');
    } finally {
      setLoading(false);
    }
  }, [token, onTokenLost]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleUpload = async (type: DocumentType, file: File, expiresAt?: string) => {
    setBusy(true);
    setError(null);
    try {
      await marketplaceApi.uploadDocument(token, type, file, expiresAt);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 429 ? 'limited' : 'fileFailed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" /> {m.loading}
      </p>
    );
  }

  if (!application) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-base">{error ? m[error] : m.inaccessible}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {m.contact}
        </p>
        <Button type="button" variant="outline" className="mt-3"
          onClick={() => { setLoading(true); void refresh(); }}>{m.retry}</Button>
      </div>
    );
  }

  const missing = application.requiredTypes.filter(
    (type) => !application.documents.some((d) => d.documentType === type && d.status !== 'REJECTED'));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-success/40 bg-success/[0.08] p-6">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <CheckIcon className="size-5 text-success" /> {m.registered}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <bdi>{application.displayName}</bdi> · {m.submittedAt.replace('{date}', formatDate(application.submittedAt, language))}
        </p>
        {justSubmitted && (
          <p className="mt-2.5 text-sm leading-relaxed">
            {m.confirmHint}
          </p>
        )}
        {missing.length > 0 && (
          <p className="mt-2.5 text-sm leading-relaxed">
            {m.missing.replace('{count}', String(missing.length))}{' '}
            {missing.map((type) => m[type]).join(', ')}.
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-brand">
        <h2 className="text-lg font-semibold tracking-tight">{m.documents}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {m.fileHint}
        </p>
        <div className="mt-5 flex flex-col gap-3">
          {UPLOAD_ORDER.map((type) => (
            <UploadRow
              key={type}
              type={type}
              required={application.requiredTypes.includes(type)}
              documents={application.documents.filter((d) => d.documentType === type)}
              onUpload={handleUpload}
              busy={busy}
            />
          ))}
        </div>
        {error && (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm">
            {error && m[error]}
          </p>
        )}
      </section>
    </div>
  );
}

function UploadRow({ type, required, documents, onUpload, busy }: {
  type: DocumentType;
  required: boolean;
  documents: ApplicationDocument[];
  onUpload: (type: DocumentType, file: File, expiresAt?: string) => Promise<void>;
  busy: boolean;
}) {
  const { m, language } = useSignupMessages();
  const [expiresAt, setExpiresAt] = useState('');
  const inputId = `upload-${type}`;
  const needsExpiry = type === 'URSSAF_VIGILANCE';

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {m[type]}
            {required && <span className="ms-2 text-xs font-normal text-primary">{m.required}</span>}
          </p>
          {needsExpiry && (
            <p className="mt-1 text-sm text-muted-foreground">
              {m.expiryHint}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {needsExpiry && (
            <Input type="date" aria-label={m.expiry} value={expiresAt}
              className="h-9 w-[150px]" onChange={(e) => setExpiresAt(e.target.value)} />
          )}
          <input
            id={inputId}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
            className="hidden"
            disabled={busy}
            aria-label={m[type]}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              await onUpload(type, file, expiresAt || undefined);
              // Sans cette remise à zéro, redéposer le MÊME fichier après un
              // refus ne déclenche aucun change : le navigateur ne voit pas de
              // changement de valeur.
              event.target.value = '';
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy}
            aria-label={m.upload + ' · ' + m[type]}
            onClick={() => document.getElementById(inputId)?.click()}>
            <UploadIcon className="size-3.5" /> {m.upload}
          </Button>
        </div>
      </div>

      {documents.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {documents.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="truncate">{document.fileName}</span>
              <span className="text-muted-foreground">· {formatDate(document.createdAt, language)}</span>
              <Badge variant={DOCUMENT_STATUS[document.status].variant}>
                {m[document.status]}
              </Badge>
              {document.reviewNote && (
                <span className="w-full text-sm leading-relaxed text-muted-foreground">
                  {document.reviewNote}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
