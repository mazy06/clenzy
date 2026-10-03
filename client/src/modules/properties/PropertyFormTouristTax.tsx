import React, { useEffect, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import {
  Button,
  Checkbox,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  NativeSelect,
  NativeSelectOption,
  Switch,
} from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyFormValues } from '../../schemas';
import { touristTaxReferenceApi, type TouristTaxSuggestion } from '../../services/api/touristTaxReferenceApi';

/** Titre de section — échelle « overline » de Baitly UI (comme les autres sections). */
const SECTION_TITLE_CLASS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-[9px]';

const FR_CATEGORIES: [string, string, string][] = [
  ['UNCLASSIFIED', 'touristTax.reference.cat.unclassified', 'Non classé'],
  ['MEUBLE_1', 'touristTax.reference.cat.stars1', 'Meublé 1 étoile'],
  ['MEUBLE_2', 'touristTax.reference.cat.stars2', 'Meublé 2 étoiles'],
  ['MEUBLE_3', 'touristTax.reference.cat.stars3', 'Meublé 3 étoiles'],
  ['MEUBLE_4', 'touristTax.reference.cat.stars4', 'Meublé 4 étoiles'],
  ['MEUBLE_5', 'touristTax.reference.cat.stars5', 'Meublé 5 étoiles'],
  ['CHAMBRE_HOTES', 'touristTax.reference.cat.guestHouse', 'Chambre d’hôtes'],
];

const MA_CATEGORIES: [string, string, string][] = [
  ['RIAD_MAISON', 'touristTax.reference.ma.riad', 'Logement loué aux touristes (appartement, maison, riad)'],
  ['MAISON_HOTES', 'touristTax.reference.ma.guestHouse', 'Maison d’hôtes ou hôtel de luxe'],
  ['RESIDENCE_TOURISTIQUE', 'touristTax.reference.ma.residence', 'Résidence touristique'],
  ['HOTEL_1_2', 'touristTax.reference.ma.hotel12', 'Hôtel 1 ou 2 étoiles'],
  ['HOTEL_3', 'touristTax.reference.ma.hotel3', 'Hôtel 3 étoiles'],
  ['HOTEL_4', 'touristTax.reference.ma.hotel4', 'Hôtel 4 étoiles'],
  ['HOTEL_5', 'touristTax.reference.ma.hotel5', 'Hôtel 5 étoiles'],
  ['VILLAGE_VACANCES', 'touristTax.reference.ma.village', 'Village de vacances'],
  ['AUTRES', 'touristTax.reference.ma.other', 'Autre forme d’hébergement'],
];

const SA_CATEGORIES: [string, string, string][] = [
  ['PRIVATE', 'touristTax.reference.sa.private', 'Logement touristique privé (licence du ministère du Tourisme)'],
  ['STANDARD', 'touristTax.reference.sa.standard', 'Établissement classé 3 étoiles ou moins, économique, camp'],
  ['FOUR_STARS_PLUS', 'touristTax.reference.sa.fourPlus', 'Établissement classé 4 étoiles ou plus'],
];

export interface PropertyFormTouristTaxProps {
  control: Control<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
  setValue: UseFormSetValue<PropertyFormValues>;
}

/**
 * Création d'un logement — taxe de séjour DÉCLARÉE par l'utilisateur (France, Maroc).
 *
 * Le référentiel suggère un tarif (DGFiP pour la France, tarif de la ville ou fourchette
 * légale pour le Maroc) ; l'utilisateur le vérifie, l'ajuste et CONFIRME. Le montant
 * confirmé devient le barème propre du logement. Masquée hors France et Maroc.
 */
export default function PropertyFormTouristTax({ control, errors, setValue }: PropertyFormTouristTaxProps) {
  const { t } = useTranslation();
  const [countryCode, city, postalCode, address, noTax, mode] = useWatch({
    control,
    name: ['countryCode', 'city', 'postalCode', 'address', 'touristTaxNoTax', 'touristTaxMode'],
  });
  const country = (countryCode || '').toUpperCase();
  const categories = country === 'MA' ? MA_CATEGORIES : country === 'SA' ? SA_CATEGORIES : FR_CATEGORIES;
  const [category, setCategory] = useState<string>(categories[0][0]);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<TouristTaxSuggestion | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Arabie saoudite : la redevance est toujours un pourcentage du prix de la nuit.
  useEffect(() => {
    if (country === 'SA') {
      (setValue as (name: string, value: unknown) => void)('touristTaxMode', 'PERCENTAGE_OF_RATE');
    }
  }, [country, setValue]);

  if (country !== 'FR' && country !== 'MA' && country !== 'SA') return null;

  const currency = country === 'MA' ? 'MAD' : country === 'SA' ? 'SAR' : '€';
  const effectiveCategory = categories.some(([v]) => v === category) ? category : categories[0][0];

  const suggest = async () => {
    if (!city?.trim()) {
      setMessage(t('properties.touristTax.cityFirst', 'Renseignez d’abord la ville du logement.'));
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const s = await touristTaxReferenceApi.suggest({ countryCode: country, city, postalCode, address, category: effectiveCategory });
      setSuggestion(s);
      const set = setValue as (name: string, value: unknown, opts?: object) => void;
      set('touristTaxNoTax', false);
      set('touristTaxMode', s.calculationMode);
      set('touristTaxRate', s.ratePerPerson ?? null, { shouldValidate: true });
      set('touristTaxPercent', s.percentageRate != null ? Math.round(s.percentageRate * 10000) / 100 : null);
      set('touristTaxCap', s.capPerPersonNight ?? null);
      set('touristTaxDepartmentalPct', s.departmentalSurchargePct ?? null);
      set('touristTaxRegionalPct', s.regionalSurchargePct ?? null);
      set('touristTaxChildrenExemptUnder', s.childrenExemptUnder);
      // Une suggestion n'est jamais une confirmation : l'utilisateur recoche après vérification.
      set('touristTaxConfirmed', false);
    } catch (e) {
      setSuggestion(null);
      setMessage((e as { status?: number }).status === 404
        ? t('properties.touristTax.notFound', 'Aucun tarif connu pour cette commune et cette catégorie : saisissez le montant fixé par la commune.')
        : t('properties.touristTax.error', 'Référentiel indisponible : saisissez le montant fixé par la commune.'));
    } finally {
      setLoading(false);
    }
  };

  const numberInput = (name: 'touristTaxRate' | 'touristTaxPercent' | 'touristTaxCap' | 'touristTaxDepartmentalPct' | 'touristTaxRegionalPct',
    label: string, unit: string, id: string) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Field data-invalid={!!errors[name] || undefined}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={id}
              type="number"
              min={0}
              step="0.01"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
            />
            <InputGroupAddon align="inline-end"><InputGroupText>{unit}</InputGroupText></InputGroupAddon>
          </InputGroup>
          {errors[name] && <FieldError>{String(errors[name]?.message ?? '')}</FieldError>}
        </Field>
      )}
    />
  );

  return (
    <div>
      <p className={SECTION_TITLE_CLASS}>{t('properties.touristTax.title', 'Taxe de séjour')}</p>
      <p className="m-0 mb-3 text-xs text-muted-foreground">
        {country === 'SA'
          ? t('properties.touristTax.introSa', 'Redevance municipale d’occupation (MOMAH) : 2,5 % du prix de la nuit, 5 % pour les établissements classés 4 étoiles et plus. Même taux dans toutes les villes, déclaré chaque mois sur Balady (avant le 5, payé avant le 15). La TVA de 15 % s’ajoute si vous êtes immatriculé à la TVA.')
          : country === 'MA'
          ? t('properties.touristTax.introMa', 'Fixée par chaque commune (loi 47-06, art. 70). Au Maroc, les plateformes ne la collectent pas : vous la collectez et la reversez chaque trimestre. Enfants de moins de 12 ans exonérés.')
          : t('properties.touristTax.introFr', 'Fixée par chaque commune. Airbnb et Booking la collectent sur les séjours qu’ils encaissent ; vous la collectez sur les autres.')}
      </p>

      <div className="flex flex-wrap items-end gap-2 mb-3">
        <Field className="min-w-[200px] flex-1">
          <FieldLabel htmlFor="property-tax-category">{t('touristTax.reference.category', 'Classement du logement')}</FieldLabel>
          <NativeSelect id="property-tax-category" className="w-full" value={effectiveCategory} onChange={(e) => setCategory(e.target.value)}>
            {categories.map(([value, key, fallback]) => (
              <NativeSelectOption key={value} value={value}>{t(key, fallback)}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button type="button" variant="outline" size="sm" onClick={suggest} disabled={loading}>
          {country === 'SA'
            ? t('properties.touristTax.suggestSa', 'Proposer le taux officiel')
            : t('properties.touristTax.suggest', 'Proposer le tarif de la commune')}
        </Button>
      </div>

      {suggestion && (
        <p className="m-0 mb-3 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
          {suggestion.countryCode === 'SA'
            ? t('properties.touristTax.suggestedSa', 'Taux national : {{rate}} % du prix de la nuit.', {
                rate: suggestion.percentageRate != null ? Math.round(suggestion.percentageRate * 1000) / 10 : '—' })
            : suggestion.exact
            ? t('properties.touristTax.suggestedExact', 'Tarif de {{commune}} : {{rate}} {{currency}} par personne et par nuit.', {
                commune: suggestion.communeName ?? city, rate: suggestion.ratePerPerson ?? '—', currency: suggestion.currency })
            : t('properties.touristTax.suggestedRange', 'Tarif de la commune inconnu : fourchette légale {{min}} – {{max}} {{currency}}, le haut de la fourchette est proposé par prudence.', {
                min: suggestion.minRate ?? '—', max: suggestion.maxRate ?? '—', currency: suggestion.currency })}
          {!suggestion.verified && ' ' + t('properties.touristTax.unverified', 'Source à confirmer auprès de la commune.')}
          {' '}({suggestion.sourceLabel})
        </p>
      )}
      {message && <p className="m-0 mb-3 text-xs text-muted-foreground">{message}</p>}

      <Controller
        name="touristTaxNoTax"
        control={control}
        render={({ field }) => (
          <Field orientation="horizontal" className="mb-3 items-center">
            <Switch id="property-tax-none" checked={!!field.value} onCheckedChange={field.onChange} />
            <FieldLabel htmlFor="property-tax-none">
              {t('properties.touristTax.noTax', 'La commune n’applique pas de taxe de séjour')}
            </FieldLabel>
          </Field>
        )}
      />

      {!noTax && (
        <div className="grid gap-3 min-[600px]:grid-cols-2 mb-3">
          {country === 'FR' && (
            <Controller
              name="touristTaxMode"
              control={control}
              render={({ field }) => (
                <Field className="min-[600px]:col-span-2">
                  <FieldLabel htmlFor="property-tax-mode">{t('touristTax.dialog.mode', 'Mode de calcul')}</FieldLabel>
                  <NativeSelect id="property-tax-mode" className="w-full" value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                    <NativeSelectOption value="PER_PERSON_PER_NIGHT">{t('properties.touristTax.modePerPerson', 'Montant fixe par personne et par nuit')}</NativeSelectOption>
                    <NativeSelectOption value="PERCENTAGE_OF_RATE">{t('properties.touristTax.modePercentage', 'Non classé : % du prix de la nuitée, plafonné')}</NativeSelectOption>
                  </NativeSelect>
                </Field>
              )}
            />
          )}
          {country === 'SA' ? (
            numberInput('touristTaxPercent', t('properties.touristTax.percentSa', 'Redevance en % du prix de la nuit'), '%', 'property-tax-percent')
          ) : mode === 'PERCENTAGE_OF_RATE' && country === 'FR' ? (
            <>
              {numberInput('touristTaxPercent', t('properties.touristTax.percent', 'Pourcentage du prix par personne'), '%', 'property-tax-percent')}
              {numberInput('touristTaxCap', t('properties.touristTax.cap', 'Plafond par personne et par nuit'), currency, 'property-tax-cap')}
            </>
          ) : (
            numberInput('touristTaxRate', t('properties.touristTax.rate', 'Montant par personne et par nuit'), currency, 'property-tax-rate')
          )}
          {country === 'FR' && (
            <>
              {numberInput('touristTaxDepartmentalPct', t('touristTax.dialog.departmentalSurcharge', 'Taxe additionnelle départementale'), '%', 'property-tax-dep')}
              {numberInput('touristTaxRegionalPct', t('touristTax.dialog.regionalSurcharge', 'Taxe additionnelle régionale'), '%', 'property-tax-reg')}
            </>
          )}
        </div>
      )}

      <Controller
        name="touristTaxConfirmed"
        control={control}
        render={({ field }) => (
          <Field orientation="horizontal" className="items-start" data-invalid={!!errors.touristTaxConfirmed || undefined}>
            <Checkbox id="property-tax-confirm" checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
            <div>
              <FieldLabel htmlFor="property-tax-confirm" className="font-normal">
                {noTax
                  ? t('properties.touristTax.confirmNone', 'Je confirme que la commune n’applique pas de taxe de séjour à ce logement.')
                  : country === 'SA'
                  ? t('properties.touristTax.confirmSa', 'Je confirme ce taux de redevance municipale pour ce logement.')
                  : t('properties.touristTax.confirm', 'Je confirme que ce montant est celui fixé par la commune pour ce logement.')}
              </FieldLabel>
              <FieldDescription>
                {t('properties.touristTax.confirmHint', 'Un tarif proposé peut être périmé : vérifiez-le auprès de la commune avant de confirmer.')}
              </FieldDescription>
              {errors.touristTaxConfirmed && <FieldError>{String(errors.touristTaxConfirmed.message ?? '')}</FieldError>}
            </div>
          </Field>
        )}
      />
    </div>
  );
}
