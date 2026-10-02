import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
  Button,
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import type { Property } from '../../services/api/propertiesApi';
import {
  touristTaxApi,
  type FrTaxCategory,
  type TaxCalculationMode,
  type TouristTaxConfig,
  type TouristTaxConfigRequest,
} from '../../services/api/touristTaxApi';
import { touristTaxReferenceApi, type MaTaxCategory } from '../../services/api/touristTaxReferenceApi';

const MA_REFERENCE_CATEGORIES: { value: MaTaxCategory; key: string; fallback: string }[] = [
  { value: 'RIAD_MAISON', key: 'touristTax.reference.ma.riad', fallback: 'Logement loué aux touristes (appartement, maison, riad)' },
  { value: 'MAISON_HOTES', key: 'touristTax.reference.ma.guestHouse', fallback: 'Maison d’hôtes ou hôtel de luxe' },
  { value: 'RESIDENCE_TOURISTIQUE', key: 'touristTax.reference.ma.residence', fallback: 'Résidence touristique' },
  { value: 'HOTEL_1_2', key: 'touristTax.reference.ma.hotel12', fallback: 'Hôtel 1 ou 2 étoiles' },
  { value: 'HOTEL_3', key: 'touristTax.reference.ma.hotel3', fallback: 'Hôtel 3 étoiles' },
  { value: 'HOTEL_4', key: 'touristTax.reference.ma.hotel4', fallback: 'Hôtel 4 étoiles' },
  { value: 'HOTEL_5', key: 'touristTax.reference.ma.hotel5', fallback: 'Hôtel 5 étoiles' },
  { value: 'VILLAGE_VACANCES', key: 'touristTax.reference.ma.village', fallback: 'Village de vacances' },
  { value: 'AUTRES', key: 'touristTax.reference.ma.other', fallback: 'Autre forme d’hébergement' },
];

const REFERENCE_CATEGORIES: { value: FrTaxCategory; key: string; fallback: string }[] = [
  { value: 'UNCLASSIFIED', key: 'touristTax.reference.cat.unclassified', fallback: 'Non classé' },
  { value: 'MEUBLE_1', key: 'touristTax.reference.cat.stars1', fallback: 'Meublé 1 étoile' },
  { value: 'MEUBLE_2', key: 'touristTax.reference.cat.stars2', fallback: 'Meublé 2 étoiles' },
  { value: 'MEUBLE_3', key: 'touristTax.reference.cat.stars3', fallback: 'Meublé 3 étoiles' },
  { value: 'MEUBLE_4', key: 'touristTax.reference.cat.stars4', fallback: 'Meublé 4 étoiles' },
  { value: 'MEUBLE_5', key: 'touristTax.reference.cat.stars5', fallback: 'Meublé 5 étoiles' },
  { value: 'CHAMBRE_HOTES', key: 'touristTax.reference.cat.guestHouse', fallback: 'Chambre d’hôtes' },
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface TouristTaxBaremeDialogProps {
  open: boolean;
  /** Barème en édition, null = création. */
  config: TouristTaxConfig | null;
  properties: Property[];
  saving: boolean;
  onClose: () => void;
  onSave: (request: TouristTaxConfigRequest) => void;
}

/** Valeur spéciale du select logement pour le barème par défaut de l'org. */
const ORG_DEFAULT = 'ORG_DEFAULT';

interface FormState {
  propertyId: string; // ORG_DEFAULT ou id numérique en string
  communeName: string;
  communeCode: string;
  calculationMode: TaxCalculationMode;
  ratePerPerson: string;
  percentageRatePct: string; // saisi en % (stocké en fraction côté backend)
  capPerPersonNight: string;
  departmentalSurchargePct: string;
  regionalSurchargePct: string;
  maxNights: string;
  exemptMinors: boolean;
  enabled: boolean;
}

function toForm(config: TouristTaxConfig | null): FormState {
  return {
    propertyId: config?.propertyId != null ? String(config.propertyId) : ORG_DEFAULT,
    communeName: config?.communeName ?? '',
    communeCode: config?.communeCode ?? '',
    calculationMode: config?.calculationMode ?? 'PER_PERSON_PER_NIGHT',
    ratePerPerson: config?.ratePerPerson != null ? String(config.ratePerPerson) : '',
    percentageRatePct: config?.percentageRate != null ? String(config.percentageRate * 100) : '',
    capPerPersonNight: config?.capPerPersonNight != null ? String(config.capPerPersonNight) : '',
    departmentalSurchargePct:
      config?.departmentalSurchargePct != null ? String(config.departmentalSurchargePct) : '',
    regionalSurchargePct:
      config?.regionalSurchargePct != null ? String(config.regionalSurchargePct) : '',
    maxNights: config?.maxNights != null ? String(config.maxNights) : '',
    exemptMinors: config?.exemptMinors ?? true,
    enabled: config?.enabled ?? true,
  };
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Dialog de saisie d'un barème de taxe de séjour (création/édition).
 * Le pourcentage est saisi en % et converti en fraction pour le backend.
 */
export default function TouristTaxBaremeDialog({
  open,
  config,
  properties,
  saving,
  onClose,
  onSave,
}: TouristTaxBaremeDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(() => toForm(config));

  // Ré-initialise le formulaire à chaque ouverture (création ou édition).
  useEffect(() => {
    if (open) setForm(toForm(config));
  }, [open, config]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Référentiel officiel (DGFiP) : pré-remplit le barème depuis la commune, à valider.
  const [refCategory, setRefCategory] = useState<FrTaxCategory>('UNCLASSIFIED');
  const [maCategory, setMaCategory] = useState<MaTaxCategory>('RIAD_MAISON');
  // Pays du logement choisi : le référentiel et ses règles en dépendent (barème org = France).
  const selectedProperty = properties.find((p) => String(p.id) === form.propertyId);
  const refCountry = (selectedProperty?.countryCode || 'FR').toUpperCase();
  const [refLoading, setRefLoading] = useState(false);
  const [refMessage, setRefMessage] = useState<string | null>(null);

  const prefillFromReference = async () => {
    if (refCountry === 'MA') {
      const city = form.communeName.trim() || selectedProperty?.city || '';
      setRefLoading(true);
      setRefMessage(null);
      try {
        const s = await touristTaxReferenceApi.suggest({ countryCode: 'MA', city, category: maCategory });
        setForm((prev) => ({
          ...prev,
          communeName: prev.communeName.trim() || (s.communeName ?? city),
          calculationMode: 'PER_PERSON_PER_NIGHT',
          ratePerPerson: s.ratePerPerson != null ? String(s.ratePerPerson) : '',
          percentageRatePct: '',
          capPerPersonNight: '',
          departmentalSurchargePct: '',
          regionalSurchargePct: '',
        }));
        setRefMessage(s.exact
          ? t('touristTax.reference.maExact', 'Tarif publié par {{city}} — à confirmer auprès de la commune.', { city: s.communeName ?? city })
          : t('touristTax.reference.maRange', 'Tarif de la commune inconnu : fourchette légale {{min}} – {{max}} MAD, haut de fourchette proposé.', { min: s.minRate ?? '—', max: s.maxRate ?? '—' }));
      } catch {
        setRefMessage(t('touristTax.reference.error', 'Référentiel officiel indisponible, réessayez plus tard.'));
      } finally {
        setRefLoading(false);
      }
      return;
    }
    const insee = form.communeCode.trim().toUpperCase();
    if (!/^(\d{5}|2[AB]\d{3})$/.test(insee)) {
      setRefMessage(t('touristTax.reference.inseeRequired', 'Saisissez d’abord le code INSEE de la commune (5 caractères).'));
      return;
    }
    setRefLoading(true);
    setRefMessage(null);
    try {
      const s = await touristTaxApi.getReference(insee, refCategory);
      setForm((prev) => ({
        ...prev,
        communeName: prev.communeName.trim() || (s.communeName ?? ''),
        communeCode: insee,
        calculationMode: s.calculationMode,
        ratePerPerson: s.ratePerPerson != null ? String(s.ratePerPerson) : '',
        percentageRatePct: s.percentageRate != null ? String(Math.round(s.percentageRate * 10000) / 100) : '',
        capPerPersonNight: s.capPerPersonNight != null ? String(s.capPerPersonNight) : '',
        departmentalSurchargePct: s.departmentalSurchargePct != null ? String(s.departmentalSurchargePct) : '',
        regionalSurchargePct: s.regionalSurchargePct != null ? String(s.regionalSurchargePct) : '',
      }));
      setRefMessage(t('touristTax.reference.applied',
        'Barème {{year}} de la commune repris du référentiel DGFiP — vérifiez-le avant d’enregistrer.',
        { year: s.sourceYear }));
    } catch (e) {
      const status = (e as { status?: number }).status;
      setRefMessage(status === 404
        ? t('touristTax.reference.notFound', 'Aucun tarif publié pour cette commune et cette catégorie (taxe peut-être non instituée).')
        : t('touristTax.reference.error', 'Référentiel officiel indisponible, réessayez plus tard.'));
    } finally {
      setRefLoading(false);
    }
  };

  const isPercentage = form.calculationMode === 'PERCENTAGE_OF_RATE';
  const canSubmit = form.communeName.trim() !== '' && !saving;

  const handleSave = () => {
    const pct = numOrNull(form.percentageRatePct);
    onSave({
      propertyId: form.propertyId === ORG_DEFAULT ? null : Number(form.propertyId),
      communeName: form.communeName.trim(),
      communeCode: form.communeCode.trim() || null,
      calculationMode: form.calculationMode,
      ratePerPerson: isPercentage ? null : numOrNull(form.ratePerPerson),
      percentageRate: isPercentage && pct != null ? pct / 100 : null,
      capPerPersonNight: isPercentage ? numOrNull(form.capPerPersonNight) : null,
      departmentalSurchargePct: numOrNull(form.departmentalSurchargePct),
      regionalSurchargePct: numOrNull(form.regionalSurchargePct),
      maxNights: numOrNull(form.maxNights),
      exemptMinors: form.exemptMinors,
      // Exonération des mineurs : moins de 12 ans au Maroc, moins de 18 ans en France.
      childrenExemptUnder: refCountry === 'MA' ? 12 : 18,
      enabled: form.enabled,
    });
  };

  return (
    // maxWidth="sm" MUI = 600 px.
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {config
              ? t('touristTax.dialog.editTitle', 'Modifier le barème')
              : t('touristTax.dialog.createTitle', 'Nouveau barème de taxe de séjour')}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-12 gap-3 mt-0">
          <div className="col-span-12">
            <Field>
              <FieldLabel htmlFor="tourist-tax-property">
                {t('touristTax.dialog.property', 'Logement')}
              </FieldLabel>
              <NativeSelect
                id="tourist-tax-property"
                className="w-full"
                value={form.propertyId}
                onChange={(e) => {
                  const value = e.target.value;
                  // La commune du logement est déjà connue (déduite de son adresse) : on la reprend.
                  const chosen = properties.find((p) => String(p.id) === value);
                  setForm((prev) => ({
                    ...prev,
                    propertyId: value,
                    communeCode: prev.communeCode.trim() || chosen?.communeInseeCode || '',
                    communeName: prev.communeName.trim() || chosen?.city || '',
                  }));
                }}
                disabled={config != null /* la clé naturelle ne change pas en édition */}
              >
                <NativeSelectOption value={ORG_DEFAULT}>
                  {t('touristTax.dialog.orgDefault', 'Barème par défaut (toute l’organisation)')}
                </NativeSelectOption>
                {properties.map((p) => (
                  <NativeSelectOption key={p.id} value={String(p.id)}>
                    {p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>
                {t(
                  'touristTax.dialog.propertyHelp',
                  'Le barème par défaut s’applique à tous les logements sans barème propre.'
                )}
              </FieldDescription>
            </Field>
          </div>

          <div className="col-span-12 min-[600px]:col-span-8">
            <Field>
              <FieldLabel htmlFor="tourist-tax-commune-name">
                {t('touristTax.dialog.communeName', 'Commune')}
              </FieldLabel>
              <Input
                id="tourist-tax-commune-name"
                required
                value={form.communeName}
                onChange={(e) => set('communeName', e.target.value)}
              />
            </Field>
          </div>
          <div className="col-span-12 min-[600px]:col-span-4">
            <Field>
              <FieldLabel htmlFor="tourist-tax-commune-code">
                {t('touristTax.dialog.communeCode', 'Code INSEE')}
              </FieldLabel>
              <Input
                id="tourist-tax-commune-code"
                value={form.communeCode}
                onChange={(e) => set('communeCode', e.target.value)}
              />
            </Field>
          </div>

          <div className="col-span-12 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field className="min-w-[180px] flex-1">
                <FieldLabel htmlFor="tourist-tax-ref-category">
                  {t('touristTax.reference.category', 'Classement du logement')}
                </FieldLabel>
                {refCountry === 'MA' ? (
                  <NativeSelect
                    id="tourist-tax-ref-category"
                    className="w-full"
                    value={maCategory}
                    onChange={(e) => setMaCategory(e.target.value as MaTaxCategory)}
                  >
                    {MA_REFERENCE_CATEGORIES.map((c) => (
                      <NativeSelectOption key={c.value} value={c.value}>{t(c.key, c.fallback)}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <NativeSelect
                    id="tourist-tax-ref-category"
                    className="w-full"
                    value={refCategory}
                    onChange={(e) => setRefCategory(e.target.value as FrTaxCategory)}
                  >
                    {REFERENCE_CATEGORIES.map((c) => (
                      <NativeSelectOption key={c.value} value={c.value}>{t(c.key, c.fallback)}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Button type="button" variant="outline" size="sm" onClick={prefillFromReference} disabled={refLoading}>
                {t('touristTax.reference.prefill', 'Pré-remplir (référentiel officiel)')}
              </Button>
            </div>
            <FieldDescription className="mt-2">
              {refMessage ?? (refCountry === 'MA'
                ? t('touristTax.reference.helpMa', 'Maroc : tarif fixé par chaque commune dans la fourchette légale (loi 47-06, art. 70). Enfants de moins de 12 ans exonérés.')
                : t('touristTax.reference.help',
                  'Tarifs délibérés par la commune, publiés par la DGFiP. Île-de-France : surtaxes régionales de 15 % et 200 % incluses.'))}
            </FieldDescription>
          </div>

          <div className="col-span-12">
            <Field>
              <FieldLabel htmlFor="tourist-tax-mode">
                {t('touristTax.dialog.mode', 'Mode de calcul')}
              </FieldLabel>
              <NativeSelect
                id="tourist-tax-mode"
                className="w-full"
                value={form.calculationMode}
                onChange={(e) => set('calculationMode', e.target.value as TaxCalculationMode)}
              >
                <NativeSelectOption value="PER_PERSON_PER_NIGHT">
                  {t('touristTax.mode.perPersonPerNight', 'Classé — montant fixe / personne / nuit')}
                </NativeSelectOption>
                <NativeSelectOption value="PERCENTAGE_OF_RATE">
                  {t('touristTax.mode.percentageOfRate', 'Non classé « au réel » — % du prix, plafonné')}
                </NativeSelectOption>
                <NativeSelectOption value="FLAT_PER_NIGHT">
                  {t('touristTax.mode.flatPerNight', 'Forfait / nuit')}
                </NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>

          {!isPercentage && (
            <div className="col-span-12 min-[600px]:col-span-6">
              <Field>
                <FieldLabel htmlFor="tourist-tax-rate">
                  {form.calculationMode === 'FLAT_PER_NIGHT'
                    ? t('touristTax.dialog.ratePerNight', 'Montant par nuit')
                    : t('touristTax.dialog.ratePerPerson', 'Montant par personne et par nuit')}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="tourist-tax-rate"
                    inputMode="decimal"
                    value={form.ratePerPerson}
                    onChange={(e) => set('ratePerPerson', e.target.value)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>€</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </div>
          )}

          {isPercentage && (
            <>
              <div className="col-span-12 min-[600px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="tourist-tax-percentage">
                    {t('touristTax.dialog.percentageRate', 'Taux (% du prix de la nuitée / pers.)')}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="tourist-tax-percentage"
                      inputMode="decimal"
                      value={form.percentageRatePct}
                      onChange={(e) => set('percentageRatePct', e.target.value)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>%</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>
              <div className="col-span-12 min-[600px]:col-span-6">
                <Field>
                  <FieldLabel htmlFor="tourist-tax-cap">
                    {t('touristTax.dialog.cap', 'Plafond / personne / nuit')}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="tourist-tax-cap"
                      inputMode="decimal"
                      value={form.capPerPersonNight}
                      onChange={(e) => set('capPerPersonNight', e.target.value)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>€</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>
            </>
          )}

          <div className="col-span-12 min-[600px]:col-span-6">
            <Field>
              <FieldLabel htmlFor="tourist-tax-departmental">
                {t('touristTax.dialog.departmentalSurcharge', 'Taxe additionnelle départementale')}
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="tourist-tax-departmental"
                  inputMode="decimal"
                  value={form.departmentalSurchargePct}
                  onChange={(e) => set('departmentalSurchargePct', e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>%</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {t('touristTax.dialog.departmentalHelp', 'Typiquement 10 %')}
              </FieldDescription>
            </Field>
          </div>
          <div className="col-span-12 min-[600px]:col-span-6">
            <Field>
              <FieldLabel htmlFor="tourist-tax-regional">
                {t('touristTax.dialog.regionalSurcharge', 'Taxe additionnelle régionale')}
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="tourist-tax-regional"
                  inputMode="decimal"
                  value={form.regionalSurchargePct}
                  onChange={(e) => set('regionalSurchargePct', e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>%</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </div>

          <div className="col-span-12 min-[600px]:col-span-6">
            <Field>
              <FieldLabel htmlFor="tourist-tax-max-nights">
                {t('touristTax.dialog.maxNights', 'Nuits taxées max (optionnel)')}
              </FieldLabel>
              <Input
                id="tourist-tax-max-nights"
                inputMode="numeric"
                value={form.maxNights}
                onChange={(e) => set('maxNights', e.target.value)}
              />
            </Field>
          </div>
          <div className="col-span-12 min-[600px]:col-span-6 flex flex-col gap-1.5 justify-center">
            <Field orientation="horizontal" className="w-[fit-content] gap-2">
              <Switch
                id="tourist-tax-exempt-minors"
                size="sm"
                checked={form.exemptMinors}
                onCheckedChange={(checked) => set('exemptMinors', checked)}
              />
              <FieldLabel htmlFor="tourist-tax-exempt-minors" className="cursor-pointer">
                {t('touristTax.dialog.exemptMinors', 'Exonérer les mineurs (<18 ans)')}
              </FieldLabel>
            </Field>
            <Field orientation="horizontal" className="w-[fit-content] gap-2">
              <Switch
                id="tourist-tax-enabled"
                size="sm"
                checked={form.enabled}
                onCheckedChange={(checked) => set('enabled', checked)}
              />
              <FieldLabel htmlFor="tourist-tax-enabled" className="cursor-pointer">
                {t('touristTax.dialog.enabled', 'Barème actif')}
              </FieldLabel>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Annuler')}</Button>
          <Button onClick={handleSave} disabled={!canSubmit}>
            {t('common.save', 'Enregistrer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
