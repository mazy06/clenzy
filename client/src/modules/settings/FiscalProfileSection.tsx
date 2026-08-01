import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import StatusChip from '../../components/StatusChip';
import { Spinner } from '../../components/ui';
import { Button } from '../../components/ui';
import { Card } from '../../components/ui';
import {
  Alert as BuiAlert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  Switch,
  Textarea,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import {
  AccountBalance, Info as InfoIcon, Verified,
} from '../../icons';
import { useFiscalProfile, useUpdateFiscalProfile } from '../../hooks/useFiscalProfile';
import { CURRENCY_OPTIONS, COUNTRY_OPTIONS } from '../../utils/currencyUtils';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import { getCountryDefaults } from '../../utils/countryDefaults';
import { STORAGE_KEYS, getItem } from '../../services/storageService';
import type { FiscalProfileUpdate, FiscalRegime } from '../../services/api/fiscalProfileApi';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { useOnboarding } from '../../hooks/useOnboarding';

// ─── Constants ──────────────────────────────────────────────────────────────

const REGIME_OPTIONS: { value: FiscalRegime; labelKey: string }[] = [
  { value: 'STANDARD', labelKey: 'fiscal.profile.regimeStandard' },
  { value: 'MICRO_ENTERPRISE', labelKey: 'fiscal.profile.regimeMicro' },
  { value: 'SIMPLIFIED', labelKey: 'fiscal.profile.regimeSimplified' },
];

const VAT_FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', labelKey: 'fiscal.profile.freqMonthly' },
  { value: 'QUARTERLY', labelKey: 'fiscal.profile.freqQuarterly' },
  { value: 'ANNUAL', labelKey: 'fiscal.profile.freqAnnual' },
];

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

// ─── Handle exposé au parent (pour bouton Save dans le PageHeader) ─────────

export interface FiscalProfileHandle {
  save: () => Promise<void>;
  hasChanges: () => boolean;
  isSaving: boolean;
}

interface FiscalProfileSectionProps {
  onChangeState?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const FiscalProfileSection = forwardRef<FiscalProfileHandle, FiscalProfileSectionProps>(function FiscalProfileSection({ onChangeState }, ref) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const { data: profile, isLoading, error, refetch } = useFiscalProfile();
  const updateMutation = useUpdateFiscalProfile();
  const { completeStep, steps } = useOnboarding();
  const isConfigureOrgDone = steps.find((s) => s.key === 'configure_org')?.completed ?? false;

  // Track whether this is a first-time setup (no profile existed before)
  const isFirstSetup = !!(profile && !profile.taxIdNumber && !profile.legalEntityName);

  const [form, setForm] = useState<FiscalProfileUpdate>({
    countryCode: 'FR',
    defaultCurrency: 'EUR',
    fiscalRegime: 'STANDARD',
    vatRegistered: true,
    taxIdNumber: '',
    vatNumber: '',
    vatDeclarationFrequency: 'QUARTERLY',
    invoiceLanguage: 'fr',
    invoicePrefix: 'FA',
    legalMentions: '',
    legalEntityName: '',
    legalAddress: '',
  });

  // Sync form with fetched data
  useEffect(() => {
    if (profile) {
      setForm({
        countryCode: profile.countryCode ?? 'FR',
        defaultCurrency: profile.defaultCurrency ?? 'EUR',
        fiscalRegime: profile.fiscalRegime ?? 'STANDARD',
        vatRegistered: profile.vatRegistered ?? true,
        taxIdNumber: profile.taxIdNumber ?? '',
        vatNumber: profile.vatNumber ?? '',
        vatDeclarationFrequency: profile.vatDeclarationFrequency ?? 'QUARTERLY',
        invoiceLanguage: profile.invoiceLanguage ?? 'fr',
        invoicePrefix: profile.invoicePrefix ?? 'FA',
        legalMentions: profile.legalMentions ?? '',
        legalEntityName: profile.legalEntityName ?? '',
        legalAddress: profile.legalAddress ?? '',
      });
    }
  }, [profile]);

  // Pre-fill with geo-detected country defaults on first setup
  useEffect(() => {
    if (!isFirstSetup) return;
    const geoCountry = getItem(STORAGE_KEYS.GEO_COUNTRY);
    if (!geoCountry) return;

    const defaults = getCountryDefaults(geoCountry);
    setForm(prev => ({
      ...prev,
      countryCode: defaults.fiscalCountry,
      defaultCurrency: defaults.currency,
      invoiceLanguage: defaults.language,
    }));
  }, [isFirstSetup]);

  const handleChange = (field: keyof FiscalProfileUpdate, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(form);
      notify.success(t('fiscal.profile.saved'));
      if (!isConfigureOrgDone) {
        completeStep('configure_org');
      }
    } catch {
      notify.error(t('fiscal.profile.error'));
    }
  };

  // ── Loaded baseline for change detection ─────────────────────────────────
  const baseline = useMemo<FiscalProfileUpdate | null>(() => {
    if (!profile) return null;
    return {
      countryCode: profile.countryCode ?? 'FR',
      defaultCurrency: profile.defaultCurrency ?? 'EUR',
      fiscalRegime: profile.fiscalRegime ?? 'STANDARD',
      vatRegistered: profile.vatRegistered ?? true,
      taxIdNumber: profile.taxIdNumber ?? '',
      vatNumber: profile.vatNumber ?? '',
      vatDeclarationFrequency: profile.vatDeclarationFrequency ?? 'QUARTERLY',
      invoiceLanguage: profile.invoiceLanguage ?? 'fr',
      invoicePrefix: profile.invoicePrefix ?? 'FA',
      legalMentions: profile.legalMentions ?? '',
      legalEntityName: profile.legalEntityName ?? '',
      legalAddress: profile.legalAddress ?? '',
    };
  }, [profile]);

  const hasChanges = () => {
    if (!baseline) return false;
    return (Object.keys(form) as Array<keyof FiscalProfileUpdate>).some((k) => form[k] !== baseline[k]);
  };

  // Notify parent when state changes (for header button rendering)
  useEffect(() => {
    onChangeState?.();
  }, [form, updateMutation.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    save: handleSave,
    hasChanges,
    isSaving: updateMutation.isPending,
  }));

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-10" />
      </div>
    );
  }

  // ── Error state — show a helpful retry notice, NOT a blocking error ──
  if (error && !profile) {
    return (
      <div>
        <BuiAlert variant="warning" className="mb-3">
          <InfoIcon />
          <AlertDescription>{t('fiscal.profile.loadError')}</AlertDescription>
          <AlertAction>
            {/* `color="inherit"` n'a pas d'equivalent au kit : on pose
                explicitement la teinte --warn de l'alerte qui l'heberge. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-[var(--warn)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
            >
              Réessayer
            </Button>
          </AlertAction>
        </BuiAlert>
      </div>
    );
  }

  return (
    <div>
      {/* First-time setup banner */}
      {isFirstSetup && (
        <BuiAlert variant="info" className="mb-3">
          <InfoIcon />
          <AlertTitle className="cn-text-subtitle2 font-semibold mb-0.5">
            {t('fiscal.profile.setupTitle')}
          </AlertTitle>
          <AlertDescription>
            <p className="cn-text-body2 text-[0.8rem]">
              {t('fiscal.profile.setupDescription')}
            </p>
            <span className="cn-text-caption text-muted-foreground block mt-0.5 text-[0.7rem]">
              {t('fiscal.profile.setupNotice')}
            </span>
          </AlertDescription>
        </BuiAlert>
      )}

      <div className="grid grid-cols-12 gap-3">
        {/* ── Section 1 : Informations fiscales ── */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card className="gap-0 py-0 p-3 h-full">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="inline-flex text-primary"><AccountBalance size={20} strokeWidth={1.75} /></span>
              <h6 className="cn-text-subtitle1 font-semibold text-[0.95rem]">
                {t('fiscal.profile.sectionFiscalInfo')}
              </h6>
              {!isFirstSetup && profile?.vatRegistered && (
                <StatusChip tokens={{ color: 'var(--ok)', bg: 'var(--ok-soft)' }} label="TVA" icon={<Verified size={11} strokeWidth={2} />} className="ms-auto tracking-[0.04em] px-0.5" />
              )}
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 min-[600px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="fiscal-country">{t('fiscal.profile.country')}</FieldLabel>
                  <NativeSelect
                    id="fiscal-country"
                    className="w-full"
                    value={form.countryCode}
                    onChange={(e) => handleChange('countryCode', e.target.value)}
                    required
                  >
                    {COUNTRY_OPTIONS.map(c => (
                      <NativeSelectOption key={c.code} value={c.code}>{c.label}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <div className="col-span-12 min-[600px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="fiscal-currency">{t('fiscal.profile.currency')}</FieldLabel>
                  <NativeSelect
                    id="fiscal-currency"
                    className="w-full"
                    value={form.defaultCurrency}
                    onChange={(e) => handleChange('defaultCurrency', e.target.value)}
                    required
                  >
                    {CURRENCY_OPTIONS.map(c => (
                      <NativeSelectOption key={c.code} value={c.code}>{c.label}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <div className="col-span-12 min-[600px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="fiscal-regime">{t('fiscal.profile.regime')}</FieldLabel>
                  <NativeSelect
                    id="fiscal-regime"
                    className="w-full"
                    value={form.fiscalRegime ?? ''}
                    onChange={(e) => handleChange('fiscalRegime', e.target.value)}
                  >
                    {REGIME_OPTIONS.map(r => (
                      <NativeSelectOption key={r.value} value={r.value}>{t(r.labelKey)}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <div className="col-span-12 min-[600px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="fiscal-tax-id">{t('fiscal.profile.taxId')}</FieldLabel>
                  <Input
                    id="fiscal-tax-id"
                    value={form.taxIdNumber ?? ''}
                    onChange={(e) => handleChange('taxIdNumber', e.target.value)}
                    placeholder="FR12345678901"
                  />
                </Field>
              </div>

              <div className="col-span-12 min-[600px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="fiscal-vat-number">{t('fiscal.profile.vatNumber')}</FieldLabel>
                  <Input
                    id="fiscal-vat-number"
                    value={form.vatNumber ?? ''}
                    onChange={(e) => handleChange('vatNumber', e.target.value)}
                    placeholder="FR 12 345678901"
                  />
                </Field>
              </div>

              <div className="col-span-12 min-[600px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="fiscal-vat-frequency">{t('fiscal.profile.vatFrequency')}</FieldLabel>
                  <NativeSelect
                    id="fiscal-vat-frequency"
                    className="w-full"
                    value={form.vatDeclarationFrequency || 'QUARTERLY'}
                    onChange={(e) => handleChange('vatDeclarationFrequency', e.target.value)}
                  >
                    {VAT_FREQUENCY_OPTIONS.map(f => (
                      <NativeSelectOption key={f.value} value={f.value}>{t(f.labelKey)}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <div className="col-span-12 min-[600px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="fiscal-invoice-language">{t('fiscal.profile.invoiceLanguage')}</FieldLabel>
                  <NativeSelect
                    id="fiscal-invoice-language"
                    className="w-full"
                    value={form.invoiceLanguage || 'fr'}
                    onChange={(e) => handleChange('invoiceLanguage', e.target.value)}
                  >
                    {LANGUAGE_OPTIONS.map(l => (
                      <NativeSelectOption key={l.value} value={l.value}>{l.label}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <div className="col-span-12 min-[600px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="fiscal-invoice-prefix">{t('fiscal.profile.invoicePrefix')}</FieldLabel>
                  <Input
                    id="fiscal-invoice-prefix"
                    value={form.invoicePrefix ?? ''}
                    onChange={(e) => handleChange('invoicePrefix', e.target.value)}
                    placeholder="FA"
                  />
                  <FieldDescription>Ex: FA-2026-0001</FieldDescription>
                </Field>
              </div>

              <div className="col-span-12">
                <Field orientation="horizontal">
                  <Switch
                    id="fiscal-vat-registered"
                    checked={form.vatRegistered}
                    onCheckedChange={(checked) => handleChange('vatRegistered', checked)}
                  />
                  <FieldLabel htmlFor="fiscal-vat-registered" className="cn-text-body2 font-normal">
                    {t('fiscal.profile.vatRegistered')}
                  </FieldLabel>
                </Field>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Section 2 : Informations legales ── */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card className="gap-0 py-0 p-3 h-full">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="inline-flex text-[var(--mui-secondary)]"><AccountBalance size={20} strokeWidth={1.75} /></span>
              <h6 className="cn-text-subtitle1 font-semibold text-[0.95rem]">
                {t('fiscal.profile.sectionLegalInfo')}
              </h6>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12">
                <Field>
                  <FieldLabel htmlFor="fiscal-legal-name">{t('fiscal.profile.legalName')}</FieldLabel>
                  <Input
                    id="fiscal-legal-name"
                    value={form.legalEntityName ?? ''}
                    onChange={(e) => handleChange('legalEntityName', e.target.value)}
                  />
                </Field>
              </div>
              <div className="col-span-12">
                <AddressAutocomplete
                  value={form.legalAddress ?? ''}
                  label={t('fiscal.profile.legalAddress')}
                  placeholder="Rechercher une adresse..."
                  onChange={(val) => handleChange('legalAddress', val)}
                  onSelect={(address) => handleChange('legalAddress', address.label)}
                  size="small"
                />
              </div>
              <div className="col-span-12">
                <Field>
                  <FieldLabel htmlFor="fiscal-legal-mentions">{t('fiscal.profile.legalMentions')}</FieldLabel>
                  <Textarea
                    id="fiscal-legal-mentions"
                    rows={4}
                    value={form.legalMentions ?? ''}
                    onChange={(e) => handleChange('legalMentions', e.target.value)}
                    placeholder="Mentions legales obligatoires sur les factures"
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
});

FiscalProfileSection.displayName = 'FiscalProfileSection';

export default FiscalProfileSection;
