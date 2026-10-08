import BaitlyTurnstile from "../../src/components/BaitlyTurnstile";
import { runtimeEnvOr } from "../../src/config/runtimeConfig";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
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
} from "../../src/components/ui";
import ProviderProfileCard from "../components/ProviderProfileCard";
import ProviderCountrySelect from "../components/ProviderCountrySelect";
import { PROVIDER_MARKETPLACE_MESSAGES } from "../lib/providerMarketplaceMessages";
import { PROVIDER_TRADE_LABELS_AR } from "../lib/providerTradeLabels";
import { FRENCH_DEPARTMENTS } from "../../src/data/frenchDepartments";
import "../provider-marketplace.css";
import {
  ProviderLanguagePicker,
  useProviderLanguage,
} from "../lib/providerLanguage";
import type { ProviderLanguage } from "../lib/providerLanguage";
import {
  SignupLanguageContext,
  useSignupMessages,
} from "../lib/providerSignupMessages";
import {
  marketplaceApi,
  ApiError,
  type ApplicationDocument,
  type ApplicationStatus,
  type DocumentType,
  type OfferInput,
  type PricingModel,
  type ServiceCategory,
} from "../lib/marketplaceApi";
import {
  clearUploadToken,
  readUploadToken,
  writeUploadToken,
} from "../lib/uploadToken";

import { PROVIDER_PRICING_MODELS } from "../../src/types/providerPricing";

const LANGUAGES = ["fr", "ar", "en", "es"] as const;

const UPLOAD_ORDER: DocumentType[] = [
  "COMPANY_REGISTRATION",
  "URSSAF_VIGILANCE",
  "LIABILITY_INSURANCE",
  "IDENTITY",
  "OTHER",
];

const DOCUMENT_STATUS = {
  PENDING: { variant: "outline" as const },
  APPROVED: { variant: "default" as const },
  REJECTED: { variant: "destructive" as const },
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

function catalogueLabel(
  value: { code?: string; labelFr: string; labelEn?: string | null },
  language: ProviderLanguage,
) {
  if (language === "ar" && value.code && PROVIDER_TRADE_LABELS_AR[value.code])
    return PROVIDER_TRADE_LABELS_AR[value.code];
  return language === "en" && value.labelEn?.trim()
    ? value.labelEn
    : value.labelFr;
}

function formatDate(value: string, language: string): string {
  return new Date(value).toLocaleDateString(language, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
  return (
    <SignupLanguageContext.Provider value={language}>
      <section
        className="site-shell bpr-signup"
        lang={language}
        dir={direction}
      >
        <div className="bpr-signup-topline">
          <Link to={`/prestataires?lang=${language}`}>
            <ArrowLeftIcon size={16} aria-hidden="true" />
            {PROVIDER_MARKETPLACE_MESSAGES[language].signupBack}
          </Link>
          <ProviderLanguagePicker
            language={language}
            onChange={changeLanguage}
          />
        </div>
        <SignupContent />
      </section>
    </SignupLanguageContext.Provider>
  );
}

function SignupContent() {
  const { m, language } = useSignupMessages();
  const copy = PROVIDER_MARKETPLACE_MESSAGES[language];
  const [token, setToken] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [confirmation, setConfirmation] = useState<
    "confirmed" | "confirmationFailed" | null
  >(null);

  useEffect(() => {
    let active = true;
    readUploadToken()
      .then((value) => {
        if (active) setToken(value);
      })
      .catch(() => {
        if (active) setToken("session");
      });
    return () => {
      active = false;
    };
  }, []);

  // Le lien du courriel de confirmation arrive ici avec son jeton. Il est
  // consommé puis RETIRÉ de l'adresse : un jeton qui reste dans la barre
  // d'adresse suit l'historique et part dans le `Referer` de toute ressource
  // tierce chargée ensuite.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("confirmation");
    if (!value) return;

    const lang = params.get("lang");
    window.history.replaceState(
      {},
      "",
      window.location.pathname +
        (lang && ["fr", "en", "ar"].includes(lang) ? "?lang=" + lang : ""),
    );
    marketplaceApi
      .confirmEmail(value)
      .then(() => setConfirmation("confirmed"))
      .catch(() => setConfirmation("confirmationFailed"));
  }, []);

  const handleSubmitted = useCallback((issued: string) => {
    writeUploadToken(issued);
    setToken(issued);
    setJustSubmitted(true);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, []);

  const handleTokenLost = useCallback(() => setToken(null), []);

  return (
    <>
      <header className="bpr-signup-heading">
        <p className="baitly-readiness-eyebrow">{m.badge}</p>
        <h1>{token ? m.application : copy.signupTitle}</h1>
        <p>{token ? m.documentsIntro : copy.signupIntro}</p>
      </header>

      {confirmation && (
        <div className="mt-8 rounded-2xl border border-success/40 bg-success/[0.08] px-5 py-4 text-sm leading-relaxed">
          {m[confirmation]}
        </div>
      )}

      <div className="mt-10">
        {token ? (
          <DocumentPanel
            token={token}
            justSubmitted={justSubmitted}
            onTokenLost={handleTokenLost}
          />
        ) : (
          <ApplicationForm onSubmitted={handleSubmitted} />
        )}
      </div>
    </>
  );
}

// ─── Candidature ──────────────────────────────────────────────────────────────

function ApplicationForm({
  onSubmitted,
}: {
  onSubmitted: (token: string) => void;
}) {
  const { m, language } = useSignupMessages();
  const copy = PROVIDER_MARKETPLACE_MESSAGES[language];
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState(false);
  const [tradeSearch, setTradeSearch] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [termsVersion, setTermsVersion] = useState("");
  const [catalogueError, setCatalogueError] = useState(false);
  const [showAllTrades, setShowAllTrades] = useState(false);

  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [offers, setOffers] = useState<OfferDraft[]>([]);
  const [languages, setLanguages] = useState<string[]>(["fr"]);

  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [baseCountryCode, setBaseCountryCode] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [zones, setZones] = useState([
    { countryCode: "", department: "", city: "" },
  ]);
  const [availability, setAvailability] = useState<
    { dayOfWeek: number; startTime: string; endTime: string }[]
  >([]);
  const [baseCity, setBaseCity] = useState("");
  const [basePostalCode, setBasePostalCode] = useState("");
  const [travelRadiusKm, setTravelRadiusKm] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const captchaEnabled =
    runtimeEnvOr("VITE_BAITLY_CAPTCHA_ENABLED", "false") === "true";
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<"submitFailed" | "limited" | null>(
    null,
  );
  const [termsUnavailable, setTermsUnavailable] = useState(false);

  useEffect(() => {
    marketplaceApi
      .getCategories()
      .then(setCategories)
      .catch(() => setCatalogueError(true))
      .finally(() => setCatalogueLoading(false));
    marketplaceApi
      .getTermsVersion()
      .then((value) => {
        setTermsVersion(value);
        setTermsUnavailable(!value.trim());
      })
      .catch(() => setTermsUnavailable(true));
  }, []);

  // Les métiers usuels d'abord : sur trente-deux entrées, une liste
  // alphabétique enterre le ménage entre la conciergerie et le déneigement.
  const { commonTrades, otherTrades } = useMemo(
    () => ({
      commonTrades: categories.filter((c) => c.common),
      otherTrades: categories.filter((c) => !c.common),
    }),
    [categories],
  );

  const orderedTrades = [...commonTrades, ...otherTrades];
  const visibleTrades = tradeSearch.trim()
    ? orderedTrades.filter((trade) =>
        catalogueLabel(trade, language)
          .toLocaleLowerCase(language)
          .includes(tradeSearch.trim().toLocaleLowerCase(language)),
      )
    : showAllTrades
      ? orderedTrades
      : commonTrades;
  const selectedCategories = categories.filter((c) =>
    selectedTrades.includes(c.code),
  );

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
    setOffers((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  /** Choisir une prestation du catalogue remplit le libellé et le mode de prix. */
  const pickCatalogueItem = (
    key: string,
    categoryCode: string,
    itemCode: string,
  ) => {
    const item = categories
      .find((c) => c.code === categoryCode)
      ?.items.find((i) => i.code === itemCode);
    updateOffer(key, {
      serviceItemCode: itemCode || undefined,
      label: item ? catalogueLabel(item, language) : "",
      pricingModel: item?.defaultPricingModel ?? "FLAT",
    });
  };

  const validServices =
    selectedTrades.length > 0 &&
    /^[A-Z]{3}$/.test(currency) &&
    offers.length > 0 &&
    offers.every(
      (row) =>
        row.label.trim() &&
        (row.pricingModel === "ON_QUOTE" ||
          (row.amount.trim() &&
            Number.isFinite(Number(row.amount)) &&
            Number(row.amount) >= 0)) &&
        (row.pricingModel !== "PER_UNIT" || row.unitLabel?.trim()),
    );
  const validCoverage =
    /^[A-Z]{2}$/.test(baseCountryCode) &&
    zones.length > 0 &&
    zones.every(
      (zone) =>
        /^[A-Z]{2}$/.test(zone.countryCode) &&
        (zone.countryCode === "FR" ? zone.department.trim() : zone.city.trim()),
    ) &&
    availability.every(
      (slot) => slot.startTime && slot.endTime > slot.startTime,
    ) &&
    (!travelRadiusKm ||
      (Number.isFinite(Number(travelRadiusKm)) && Number(travelRadiusKm) >= 0));
  const validProfile =
    displayName.trim().length > 0 &&
    contactFirstName.trim().length > 1 &&
    contactLastName.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validSteps = [validServices, validCoverage, validProfile];
  const canSubmit =
    validSteps.every(Boolean) &&
    acceptedTerms &&
    termsVersion.trim().length > 0 &&
    status !== "loading" &&
    (!captchaEnabled || !!captchaToken);
  const stepErrors = [
    copy.missingServices,
    copy.missingCoverage,
    copy.missingProfile,
  ];
  const goToStep = (next: number) => {
    setStep(next);
    setStepError(false);
    requestAnimationFrame(() => {
      stepHeading.current?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView?.({
        block: "start",
        behavior: "instant",
      });
    });
  };
  const advance = () => {
    const invalid = formRef.current?.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(":invalid");
    const disclosure = invalid?.closest("details");
    if (disclosure) disclosure.open = true;
    const nativeValid = formRef.current?.reportValidity() ?? true;
    if (!validSteps[step] || !nativeValid) {
      setStepError(true);
      return;
    }
    goToStep(step + 1);
  };
  const number = new Intl.NumberFormat(
    language === "ar" ? "ar-SA-u-nu-arab" : language,
    { maximumFractionDigits: 2 },
  );
  const firstOffer = offers.find((offer) => offer.label.trim());
  const priceLabel =
    firstOffer?.pricingModel === "ON_QUOTE"
      ? m.ON_QUOTE
      : firstOffer &&
          firstOffer.amount.trim() &&
          Number.isFinite(Number(firstOffer.amount))
        ? `${number.format(Number(firstOffer.amount))} ${currency}`
        : copy.previewPrice;
  const areaLabel = zones
    .filter((zone) => zone.city.trim() || zone.department.trim())
    .map(
      (zone) =>
        `${zone.countryCode === "FR" ? (FRENCH_DEPARTMENTS.find((department) => department.code === zone.department)?.name ?? zone.department) : zone.city}${zone.countryCode ? `, ${new Intl.DisplayNames([language], { type: "region" }).of(zone.countryCode)}` : ""}`,
    )
    .join(" · ");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (step < 3) {
      advance();
      return;
    }
    if (!canSubmit) return;
    setStatus("loading");
    setMessage(null);
    try {
      onSubmitted(
        await marketplaceApi.apply({
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
          zones: zones.map((zone, index) => ({
            ...zone,
            primary: index === 0,
          })),
          availability,
          travelRadiusKm: travelRadiusKm ? Number(travelRadiusKm) : null,
          languages,
          registrationNumber: registrationNumber.trim() || undefined,
          categoryCodes: selectedTrades,
          offers: offers.map<OfferInput>((row) => ({
            categoryCode: row.categoryCode,
            serviceItemCode: row.serviceItemCode,
            label: row.label.trim(),
            pricingModel: row.pricingModel,
            amount:
              row.pricingModel === "ON_QUOTE" || !row.amount
                ? null
                : Number(row.amount),
            currency,
            unitLabel: row.unitLabel?.trim() || undefined,
          })),
          captchaToken: captchaToken ?? undefined,
          acceptedTerms: true,
          termsVersion,
        }),
      );
    } catch (error) {
      setCaptchaToken(null);
      setCaptchaReset((value) => value + 1);
      setStatus("error");
      setMessage(
        error instanceof ApiError && error.status === 429
          ? "limited"
          : "submitFailed",
      );
    }
  };

  return (
    <div className="bpr-signup-layout">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="bpr-form"
      >
        <nav aria-label={m.application} className="bpr-stepper">
          <ol>
            {copy.steps.map((label, index) => (
              <li
                key={label}
                data-current={step === index || undefined}
                data-complete={step > index || undefined}
              >
                <button
                  type="button"
                  disabled={index >= step || status === "loading"}
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => goToStep(index)}
                >
                  <span>
                    {index < step ? (
                      <CheckIcon size={15} aria-hidden="true" />
                    ) : (
                      number.format(index + 1)
                    )}
                  </span>
                  <span>{label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="bpr-form-surface">
          <div className="bpr-current-step">
            <p>
              {copy.stepLabel
                .replace("{step}", number.format(step + 1))
                .replace("{total}", number.format(copy.steps.length))}
            </p>
            <h2 ref={stepHeading} tabIndex={-1}>
              {copy.steps[step]}
            </h2>
          </div>
          {step === 0 && (
            <>
              <Field className="bpr-currency-field">
                <FieldLabel htmlFor="ps-currency">{copy.currency}</FieldLabel>
                <Input
                  id="ps-currency"
                  value={currency}
                  maxLength={3}
                  pattern="[A-Z]{3}"
                  required
                  list="bpr-currencies"
                  onChange={(event) =>
                    setCurrency(event.target.value.toUpperCase())
                  }
                />
                <datalist id="bpr-currencies">
                  {["EUR", "MAD", "SAR", "USD", "GBP", "CAD", "CHF", "AED"].map(
                    (code) => (
                      <option key={code} value={code}>
                        {new Intl.DisplayNames([language], {
                          type: "currency",
                        }).of(code)}
                      </option>
                    ),
                  )}
                </datalist>
              </Field>
              <FormSection title={m.trades} hint={m.tradesHint}>
                {catalogueLoading ? (
                  <div
                    className="bpr-trades-skeleton"
                    aria-busy="true"
                    aria-label={m.loading}
                  >
                    {Array.from({ length: 6 }, (_, index) => (
                      <span key={index} />
                    ))}
                  </div>
                ) : catalogueError ? (
                  <div role="alert">
                    <p>{m.catalogueError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCatalogueError(false);
                        setCatalogueLoading(true);
                        marketplaceApi
                          .getCategories()
                          .then(setCategories)
                          .catch(() => setCatalogueError(true))
                          .finally(() => setCatalogueLoading(false));
                      }}
                    >
                      {m.retry}
                    </Button>
                  </div>
                ) : (
                  <>
                    <label className="bpr-trade-search">
                      <SearchIcon size={18} aria-hidden="true" />
                      <Input
                        aria-label={copy.searchTrade}
                        placeholder={copy.searchTrade}
                        value={tradeSearch}
                        onChange={(event) => setTradeSearch(event.target.value)}
                      />
                    </label>
                    <div className="bpr-trade-options">
                      {visibleTrades.map((trade) => {
                        const selected = selectedTrades.includes(trade.code);
                        return (
                          <button
                            key={trade.code}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleTrade(trade.code)}
                            className="bpr-trade-option"
                          >
                            <span
                              className="bpr-trade-check"
                              aria-hidden="true"
                            >
                              {selected && <CheckIcon size={13} />}
                            </span>
                            {catalogueLabel(trade, language)}
                          </button>
                        );
                      })}
                    </div>
                    {visibleTrades.length === 0 && <p>{copy.noTrades}</p>}
                    {selectedTrades.length > 0 && (
                      <p className="bpr-selected-count">
                        {copy.selectedTrades.replace(
                          "{count}",
                          number.format(selectedTrades.length),
                        )}
                      </p>
                    )}
                    {otherTrades.length > 0 &&
                      !showAllTrades &&
                      !tradeSearch && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-3"
                          onClick={() => setShowAllTrades(true)}
                        >
                          {m.moreTrades.replace(
                            "{count}",
                            String(otherTrades.length),
                          )}
                          <ChevronDownIcon className="size-3.5" />
                        </Button>
                      )}
                  </>
                )}
              </FormSection>

              {selectedCategories.length > 0 && (
                <FormSection title={m.services} hint={m.servicesHint}>
                  <div className="flex flex-col gap-6">
                    {selectedCategories.map((category) => {
                      const rows = offers.filter(
                        (row) => row.categoryCode === category.code,
                      );
                      return (
                        <div key={category.code}>
                          <p className="mb-2 text-sm font-semibold">
                            {catalogueLabel(category, language)}
                          </p>
                          <div className="flex flex-col gap-2.5">
                            {rows.map((row) => (
                              <div key={row.key} className="bpr-offer-row">
                                {category.items.length > 0 && (
                                  <Field className="bpr-offer-description">
                                    <FieldLabel
                                      htmlFor={`${row.key}-catalogue`}
                                    >
                                      {m.catalogueService}
                                    </FieldLabel>
                                    <NativeSelect
                                      id={`${row.key}-catalogue`}
                                      value={row.serviceItemCode ?? ""}
                                      onChange={(event) =>
                                        pickCatalogueItem(
                                          row.key,
                                          category.code,
                                          event.target.value,
                                        )
                                      }
                                    >
                                      <NativeSelectOption value="">
                                        {m.customService}
                                      </NativeSelectOption>
                                      {category.items.map((item) => (
                                        <NativeSelectOption
                                          key={item.code}
                                          value={item.code}
                                        >
                                          {catalogueLabel(item, language)}
                                        </NativeSelectOption>
                                      ))}
                                    </NativeSelect>
                                  </Field>
                                )}
                                <Field className="bpr-offer-description">
                                  <FieldLabel htmlFor={`${row.key}-label`}>
                                    {m.serviceLabel}
                                  </FieldLabel>
                                  <Input
                                    id={`${row.key}-label`}
                                    value={row.label}
                                    required
                                    maxLength={120}
                                    placeholder={copy.serviceExample}
                                    onChange={(event) =>
                                      updateOffer(row.key, {
                                        label: event.target.value,
                                      })
                                    }
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel htmlFor={`${row.key}-pricing`}>
                                    {m.pricing}
                                  </FieldLabel>
                                  <NativeSelect
                                    id={`${row.key}-pricing`}
                                    value={row.pricingModel}
                                    onChange={(event) =>
                                      updateOffer(row.key, {
                                        pricingModel: event.target
                                          .value as PricingModel,
                                      })
                                    }
                                  >
                                    {PROVIDER_PRICING_MODELS.map((value) => (
                                      <NativeSelectOption
                                        key={value}
                                        value={value}
                                      >
                                        {m[value]}
                                      </NativeSelectOption>
                                    ))}
                                  </NativeSelect>
                                </Field>
                                {row.pricingModel !== "ON_QUOTE" && (
                                  <Field>
                                    <FieldLabel htmlFor={`${row.key}-amount`}>
                                      {m.amount} ({currency})
                                    </FieldLabel>
                                    <Input
                                      id={`${row.key}-amount`}
                                      aria-label={m.amount}
                                      value={row.amount}
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      required
                                      onChange={(event) =>
                                        updateOffer(row.key, {
                                          amount: event.target.value,
                                        })
                                      }
                                      inputMode="decimal"
                                      placeholder="0"
                                    />
                                  </Field>
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  aria-label={m.removeService}
                                  onClick={() =>
                                    setOffers((all) =>
                                      all.filter(
                                        (offer) => offer.key !== row.key,
                                      ),
                                    )
                                  }
                                >
                                  <Trash2Icon className="size-4" />
                                </Button>
                                {row.pricingModel === "PER_UNIT" && (
                                  <Field className="bpr-offer-description">
                                    <FieldLabel htmlFor={`${row.key}-unit`}>
                                      {m.unit}
                                    </FieldLabel>
                                    <Input
                                      id={`${row.key}-unit`}
                                      placeholder={m.unitHint}
                                      value={row.unitLabel ?? ""}
                                      maxLength={40}
                                      required
                                      onChange={(event) =>
                                        updateOffer(row.key, {
                                          unitLabel: event.target.value,
                                        })
                                      }
                                    />
                                  </Field>
                                )}
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-fit"
                              onClick={() =>
                                setOffers((all) => [
                                  ...all,
                                  {
                                    key: `${category.code}-${Date.now()}-${all.length}`,
                                    categoryCode: category.code,
                                    label: "",
                                    pricingModel: "FLAT",
                                    amount: "",
                                  },
                                ])
                              }
                            >
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
            </>
          )}
          {step === 2 && (
            <FormSection title={m.identity} hint={m.identityHint}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="ps-display">{m.displayName}</FieldLabel>
                  <Input
                    id="ps-display"
                    value={displayName}
                    maxLength={150}
                    required
                    placeholder="Atelier Ourika"
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </Field>
                {/* Obligatoires : à l'acceptation, ils deviennent le prénom et le nom
              du compte, que Baitly exige. Les laisser facultatifs obligeait à
              les deviner en découpant le nom commercial. */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="ps-first">{m.firstName}</FieldLabel>
                    <Input
                      id="ps-first"
                      minLength={2}
                      value={contactFirstName}
                      maxLength={80}
                      required
                      autoComplete="given-name"
                      onChange={(e) => setContactFirstName(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ps-last">{m.lastName}</FieldLabel>
                    <Input
                      id="ps-last"
                      minLength={2}
                      value={contactLastName}
                      maxLength={80}
                      required
                      autoComplete="family-name"
                      onChange={(e) => setContactLastName(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="ps-email">{m.email}</FieldLabel>
                    <Input
                      id="ps-email"
                      type="email"
                      value={email}
                      maxLength={320}
                      required
                      autoComplete="email"
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ps-phone">{m.phone}</FieldLabel>
                    <Input
                      id="ps-phone"
                      type="tel"
                      value={phone}
                      maxLength={40}
                      autoComplete="tel"
                      placeholder={
                        (
                          {
                            FR: "+33 6…",
                            MA: "+212 6…",
                            SA: "+966 5…",
                          } as Record<string, string>
                        )[baseCountryCode]
                      }
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </Field>
                </div>
                <details className="bpr-optional">
                  <summary>
                    {copy.optional}
                    <ChevronDownIcon size={16} aria-hidden="true" />
                  </summary>
                  <div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="ps-legal">
                          {m.legalName}
                        </FieldLabel>
                        <Input
                          id="ps-legal"
                          value={legalName}
                          maxLength={200}
                          onChange={(e) => setLegalName(e.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="ps-siret">
                          {m.registration}
                        </FieldLabel>
                        <Input
                          id="ps-siret"
                          value={registrationNumber}
                          maxLength={40}
                          onChange={(e) =>
                            setRegistrationNumber(e.target.value)
                          }
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="ps-site">{m.website}</FieldLabel>
                      <Input
                        id="ps-site"
                        type="url"
                        value={website}
                        maxLength={300}
                        placeholder="https://"
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="ps-headline">
                        {m.headline}
                      </FieldLabel>
                      <Input
                        id="ps-headline"
                        value={headline}
                        maxLength={200}
                        placeholder={m.headlineHint}
                        onChange={(e) => setHeadline(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="ps-bio">{m.bio}</FieldLabel>
                      <Textarea
                        id="ps-bio"
                        value={bio}
                        maxLength={4000}
                        rows={4}
                        placeholder={m.bioHint}
                        onChange={(e) => setBio(e.target.value)}
                      />
                    </Field>
                  </div>
                </details>
              </FieldGroup>
            </FormSection>
          )}

          {step === 1 && (
            <FormSection title={m.coverage} hint={m.coverageHint}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="ps-country">{copy.country}</FieldLabel>
                  <ProviderCountrySelect
                    id="ps-country"
                    language={language}
                    placeholder={copy.chooseCountry}
                    value={baseCountryCode}
                    required
                    onChange={(event) => {
                      setBaseCountryCode(event.target.value);
                      setZones((rows) =>
                        rows.map((row) =>
                          row.countryCode
                            ? row
                            : { ...row, countryCode: event.target.value },
                        ),
                      );
                    }}
                  />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="ps-city">{m.city}</FieldLabel>
                    <Input
                      id="ps-city"
                      value={baseCity}
                      maxLength={80}
                      autoComplete="address-level2"
                      onChange={(e) => setBaseCity(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ps-zip">{m.zip}</FieldLabel>
                    <Input
                      id="ps-zip"
                      value={basePostalCode}
                      maxLength={10}
                      autoComplete="postal-code"
                      onChange={(e) => setBasePostalCode(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ps-radius">{m.radius}</FieldLabel>
                    <Input
                      id="ps-radius"
                      type="number"
                      min={0}
                      step={1}
                      value={travelRadiusKm}
                      inputMode="numeric"
                      className="tabular-nums"
                      onChange={(e) => setTravelRadiusKm(e.target.value)}
                    />
                  </Field>
                </div>
                <fieldset className="flex min-w-0 flex-col gap-3">
                  <legend className="mb-2 text-sm font-medium">
                    {m.zones}
                  </legend>
                  <p className="text-sm text-muted-foreground">{m.zonesHint}</p>
                  {zones.map((zone, index) => (
                    <div key={index} className="flex flex-wrap items-end gap-2">
                      <label className="flex flex-col gap-1 text-sm">
                        {copy.zoneCountry}
                        <ProviderCountrySelect
                          language={language}
                          placeholder={copy.chooseCountry}
                          value={zone.countryCode}
                          required
                          onChange={(event) =>
                            setZones((rows) =>
                              rows.map((row, i) =>
                                i === index
                                  ? { ...row, countryCode: event.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        {zone.countryCode === "FR" ? m.department : m.city}
                        {zone.countryCode === "FR" ? (
                          <NativeSelect
                            value={zone.department}
                            required
                            onChange={(event) =>
                              setZones((rows) =>
                                rows.map((row, i) =>
                                  i === index
                                    ? { ...row, department: event.target.value }
                                    : row,
                                ),
                              )
                            }
                          >
                            <NativeSelectOption value="">
                              {m.department}
                            </NativeSelectOption>
                            {FRENCH_DEPARTMENTS.map((department) => (
                              <NativeSelectOption
                                key={department.code}
                                value={department.code}
                              >
                                {department.code} · {department.name}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        ) : (
                          <Input
                            value={zone.city}
                            maxLength={80}
                            required
                            onChange={(event) =>
                              setZones((rows) =>
                                rows.map((row, i) =>
                                  i === index
                                    ? { ...row, city: event.target.value }
                                    : row,
                                ),
                              )
                            }
                          />
                        )}
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setZones((rows) => rows.filter((_, i) => i !== index))
                        }
                      >
                        {m.removeZone}
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    disabled={zones.length >= 40}
                    onClick={() =>
                      setZones((rows) => [
                        ...rows,
                        {
                          countryCode: baseCountryCode,
                          department: "",
                          city: "",
                        },
                      ])
                    }
                  >
                    {m.addZone}
                  </Button>
                </fieldset>
                <details className="bpr-optional">
                  <summary>
                    {copy.availability}
                    <ChevronDownIcon size={16} aria-hidden="true" />
                  </summary>
                  <div>
                    <fieldset className="flex min-w-0 flex-col gap-3">
                      <legend className="mb-2 text-sm font-medium">
                        {m.weekly}
                      </legend>
                      <p className="text-sm text-muted-foreground">
                        {m.weeklyHint}
                      </p>
                      {availability.map((slot, index) => (
                        <div
                          key={index}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <label className="flex flex-col gap-1 text-sm">
                            {m.day}
                            <NativeSelect
                              value={slot.dayOfWeek}
                              onChange={(event) =>
                                setAvailability((rows) =>
                                  rows.map((row, i) =>
                                    i === index
                                      ? {
                                          ...row,
                                          dayOfWeek: Number(event.target.value),
                                        }
                                      : row,
                                  ),
                                )
                              }
                            >
                              {[
                                m.monday,
                                m.tuesday,
                                m.wednesday,
                                m.thursday,
                                m.friday,
                                m.saturday,
                                m.sunday,
                              ].map((label, i) => (
                                <NativeSelectOption key={label} value={i + 1}>
                                  {label}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            {m.start}
                            <Input
                              type="time"
                              required
                              value={slot.startTime}
                              onChange={(event) =>
                                setAvailability((rows) =>
                                  rows.map((row, i) =>
                                    i === index
                                      ? {
                                          ...row,
                                          startTime: event.target.value,
                                        }
                                      : row,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            {m.end}
                            <Input
                              type="time"
                              required
                              value={slot.endTime}
                              onChange={(event) =>
                                setAvailability((rows) =>
                                  rows.map((row, i) =>
                                    i === index
                                      ? { ...row, endTime: event.target.value }
                                      : row,
                                  ),
                                )
                              }
                            />
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setAvailability((rows) =>
                                rows.filter((_, i) => i !== index),
                              )
                            }
                          >
                            {m.removeSlot}
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-fit"
                        disabled={availability.length >= 60}
                        onClick={() =>
                          setAvailability((rows) => [
                            ...rows,
                            {
                              dayOfWeek: 1,
                              startTime: "09:00",
                              endTime: "17:00",
                            },
                          ])
                        }
                      >
                        {m.addSlot}
                      </Button>
                    </fieldset>
                  </div>
                </details>
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
                          onClick={() =>
                            setLanguages((current) =>
                              current.includes(language)
                                ? current.filter((c) => c !== language)
                                : [...current, language],
                            )
                          }
                          className={
                            "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors duration-200 " +
                            (selected
                              ? "border-primary/60 bg-primary/10 font-medium text-foreground"
                              : "border-border bg-background text-muted-foreground hover:border-foreground/25")
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
          )}

          {step === 3 && (
            <>
              <div className="bpr-review">
                <h3>{copy.verifyTitle}</h3>
                <p>{copy.verifyHint}</p>
                {[
                  {
                    title: copy.steps[0],
                    value: offers
                      .map(
                        (offer) =>
                          `${offer.label} · ${offer.pricingModel === "ON_QUOTE" ? m.ON_QUOTE : `${number.format(Number(offer.amount))} ${currency} · ${m[offer.pricingModel]}`}`,
                      )
                      .join("\n"),
                    step: 0,
                  },
                  { title: copy.steps[1], value: areaLabel, step: 1 },
                  {
                    title: copy.steps[2],
                    value: `${displayName}\n${contactFirstName} ${contactLastName} · ${email}`,
                    step: 2,
                  },
                ].map((item) => (
                  <div className="bpr-review-row" key={item.step}>
                    <div>
                      <h4>{item.title}</h4>
                      <p dir="auto">{item.value}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(item.step)}
                      aria-label={`${copy.edit} : ${item.title}`}
                    >
                      {copy.edit}
                    </button>
                  </div>
                ))}
              </div>
              <FormSection title={m.terms} hint={m.termsHint}>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={acceptedTerms}
                    onCheckedChange={(value) =>
                      setAcceptedTerms(value === true)
                    }
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {m.acceptTerms}
                    {termsVersion && (
                      <span className="text-muted-foreground/80">
                        {" "}
                        ({m.version} {termsVersion})
                      </span>
                    )}{" "}
                    {m.and}{" "}
                    <Link
                      to="/legal/confidentialite"
                      className="font-medium text-foreground underline"
                    >
                      {m.privacy}
                    </Link>
                    .
                  </span>
                </label>

                {termsUnavailable && (
                  <p role="alert" className="mt-4 text-sm">
                    {m.termsUnavailable}
                  </p>
                )}

                {status === "error" && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm"
                  >
                    {message && m[message]}
                  </p>
                )}

                {captchaEnabled && (
                  <BaitlyTurnstile
                    siteKey={runtimeEnvOr("VITE_TURNSTILE_SITE_KEY", "")}
                    action="marketplace-application"
                    language={language}
                    resetKey={captchaReset}
                    onToken={setCaptchaToken}
                  />
                )}

                {!canSubmit && status !== "loading" && (
                  <p className="mt-2.5 text-sm text-muted-foreground">
                    {m.incomplete}
                  </p>
                )}
              </FormSection>
              <p className="bpr-submit-note">{copy.submitNote}</p>
            </>
          )}
          {stepError && (
            <p className="bpr-form-error" role="alert">
              {stepErrors[step]}
            </p>
          )}
          <footer className="bpr-form-actions">
            {step > 0 && (
              <button
                type="button"
                className="bpr-back-button"
                onClick={() => goToStep(step - 1)}
                disabled={status === "loading"}
              >
                <ArrowLeftIcon size={16} aria-hidden="true" />
                {copy.previous}
              </button>
            )}
            <button
              className="baitly-button"
              type="submit"
              disabled={
                step === 3 ? !canSubmit : catalogueLoading || catalogueError
              }
            >
              {status === "loading" && (
                <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />
              )}
              {step === 3 ? m.submit : copy.next}
              <ArrowRightIcon size={17} aria-hidden="true" />
            </button>
          </footer>
        </div>
      </form>
      <aside className="bpr-signup-aside">
        <h2>{copy.preview}</h2>
        <ProviderProfileCard
          name={displayName || copy.previewName}
          trade={
            headline ||
            firstOffer?.label ||
            selectedCategories
              .map((category) => catalogueLabel(category, language))
              .join(" · ") ||
            copy.previewTrade
          }
          city={areaLabel || baseCity || copy.previewCity}
          price={priceLabel}
          unit={
            firstOffer && firstOffer.pricingModel !== "ON_QUOTE"
              ? m[firstOffer.pricingModel]
              : undefined
          }
        />
        <p className="bpr-preview-note">{copy.previewNote}</p>
        <p className="bpr-preview-note">{copy.noReviews}</p>
        <div className="bpr-next-steps">
          <h3>{copy.afterTitle}</h3>
          <ol>
            {copy.afterSteps.map((item, index) => (
              <li key={item}>
                <span>{number.format(index + 1)}</span>
                {item}
              </li>
            ))}
          </ol>
        </div>
        <p className="bpr-independence">
          <CheckIcon size={17} aria-hidden="true" />
          {copy.noCommitment}
        </p>
      </aside>
    </div>
  );
}

function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bpr-form-section">
      <div>
        <div>
          <h3>{title}</h3>
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
