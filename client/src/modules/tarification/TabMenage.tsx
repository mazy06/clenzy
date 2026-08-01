import React, { useMemo, useState } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Accordion, AccordionSummary, AccordionDetails, Alert, Skeleton, Switch, FormControlLabel, IconButton } from '@mui/material';
import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import { ExpandMore, Timer, Euro, CleaningServices, Speed, CalendarMonth, AutoAwesome, Add, Close } from '../../icons';
import { useQuery } from '@tanstack/react-query';
import type { PricingConfig } from '../../services/api/pricingConfigApi';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property, CleaningPreviewResponse, CleaningEstimateDetail } from '../../services/api/propertiesApi';
import { extractApiList } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Onglet « Ménage » — grille du Moteur Ménage (CleaningPricingEngine) ─────
// Édite la config JSON `cleaningEngineConfig` de PricingConfig : minutes normées
// par composant × taux horaire × multiplicateurs type → conseil + fourchette.
// Champ vide = clé omise = défaut plateforme (constantes du moteur backend).

// Défauts plateforme (miroir des constantes CleaningPricingEngine — affichés en
// placeholder ; la valeur effective reste calculée côté backend).
const ENGINE_DEFAULTS = {
  hourlyRate: 42,
  baseByBedrooms: { '0': 90, '1': 90, '2': 120, '3': 150, '4': 180, '5plus': 210 } as Record<string, number>,
  perExtraBathroom: 15,
  surfaceThresholdSqm: 80,
  perSurfaceStepSqm: 5,
  surfaceStepMinutes: 1,
  perExtraFloor: 15,
  exterior: 20,
  laundry: 15,
  perGuestAbove4: 5,
  multipliers: { EXPRESS_CLEANING: 0.65, CLEANING: 1.0, DEEP_CLEANING: 1.6 } as Record<string, number>,
  rangePercent: 15,
  roundTo: 5,
  minPrice: 30,
} as const;

const BEDROOM_KEYS = ['0', '1', '2', '3', '4', '5plus'] as const;
const MULTIPLIER_KEYS = ['EXPRESS_CLEANING', 'CLEANING', 'DEEP_CLEANING'] as const;
const BREAKDOWN_KEYS = ['base', 'bathrooms', 'surface', 'floors', 'exterior', 'laundry', 'guests'] as const;

/** Fenêtre de majoration saisonnière (MM-DD, wrap d'année autorisé, premier match gagne). */
interface SeasonalModifierDraft {
  from?: string;
  to?: string;
  percent?: number;
  label?: string;
}

/** Shape éditable de la config moteur (tous champs optionnels — omis = défaut). */
interface EngineConfigDraft {
  hourlyRate?: number;
  componentMinutes?: {
    baseByBedrooms?: Record<string, number>;
    perExtraBathroom?: number;
    surfaceThresholdSqm?: number;
    perSurfaceStepSqm?: number;
    surfaceStepMinutes?: number;
    perExtraFloor?: number;
    exterior?: number;
    laundry?: number;
    perGuestAbove4?: number;
  };
  cleaningTypeMultipliers?: Record<string, number>;
  rangePercent?: number;
  roundTo?: number;
  minPrice?: number;
  /** Majorations saisonnières appliquées au CONSEIL moteur uniquement. */
  seasonalModifiers?: SeasonalModifierDraft[];
  /** Opt-in : promotion auto vers le meilleur housekeeper de l'équipe assignée. */
  autoAssignBestPro?: boolean;
}

function parseDraft(json: string | null): EngineConfigDraft {
  if (!json) return {};
  try {
    return JSON.parse(json) as EngineConfigDraft;
  } catch {
    return {};
  }
}

/** Supprime les clés undefined / objets vides avant sérialisation (omis = défaut moteur). */
function pruneDraft(draft: EngineConfigDraft): EngineConfigDraft {
  const out: EngineConfigDraft = {};
  if (draft.hourlyRate != null) out.hourlyRate = draft.hourlyRate;
  if (draft.rangePercent != null) out.rangePercent = draft.rangePercent;
  if (draft.roundTo != null) out.roundTo = draft.roundTo;
  if (draft.minPrice != null) out.minPrice = draft.minPrice;
  const cm = draft.componentMinutes ?? {};
  const cmOut: NonNullable<EngineConfigDraft['componentMinutes']> = {};
  if (cm.baseByBedrooms && Object.keys(cm.baseByBedrooms).length > 0) cmOut.baseByBedrooms = cm.baseByBedrooms;
  for (const k of ['perExtraBathroom', 'surfaceThresholdSqm', 'perSurfaceStepSqm', 'surfaceStepMinutes', 'perExtraFloor', 'exterior', 'laundry', 'perGuestAbove4'] as const) {
    if (cm[k] != null) cmOut[k] = cm[k];
  }
  if (Object.keys(cmOut).length > 0) out.componentMinutes = cmOut;
  if (draft.cleaningTypeMultipliers && Object.keys(draft.cleaningTypeMultipliers).length > 0) {
    out.cleaningTypeMultipliers = draft.cleaningTypeMultipliers;
  }
  if (draft.seasonalModifiers && draft.seasonalModifiers.length > 0) {
    out.seasonalModifiers = draft.seasonalModifiers;
  }
  if (draft.autoAssignBestPro) out.autoAssignBestPro = true;
  return out;
}

const MONTH_DAY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

function isValidPercent(value: number | undefined): boolean {
  return value != null && value >= -50 && value <= 100;
}

const numOrUndef = (value: string): number | undefined => {
  if (value.trim() === '') return undefined;
  const n = parseFloat(value);
  return isNaN(n) ? undefined : n;
};

/** Report en classes de l'ancien `NUM_FIELD_SX` (font-variant-numeric sur l'input). */
const NUM_FIELD_CLASS = 'tabular-nums';

interface TabMenageProps {
  config: PricingConfig;
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

export default function TabMenage({ config, canEdit, onUpdate, currencySymbol }: TabMenageProps) {
  const { t } = useTranslation();
  const [expandedSection, setExpandedSection] = useState<string | false>('workTime');

  const draft = useMemo(() => parseDraft(config.cleaningEngineConfig), [config.cleaningEngineConfig]);

  const handleAccordionChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSection(isExpanded ? panel : false);
  };

  // ── Écriture d'un champ : parse → modif → prune → re-stringify → onUpdate ──
  const write = (mutate: (d: EngineConfigDraft) => void) => {
    const next: EngineConfigDraft = structuredClone(draft);
    mutate(next);
    const pruned = pruneDraft(next);
    onUpdate({
      cleaningEngineConfig: Object.keys(pruned).length > 0 ? JSON.stringify(pruned) : null,
    });
  };

  const setRoot = (key: 'hourlyRate' | 'rangePercent' | 'roundTo' | 'minPrice', value: string) =>
    write((d) => { d[key] = numOrUndef(value); });

  const setComponent = (
    key: Exclude<keyof NonNullable<EngineConfigDraft['componentMinutes']>, 'baseByBedrooms'>,
    value: string,
  ) => write((d) => {
    d.componentMinutes = d.componentMinutes ?? {};
    d.componentMinutes[key] = numOrUndef(value);
  });

  const setBedroomBase = (bedroomKey: string, value: string) => write((d) => {
    d.componentMinutes = d.componentMinutes ?? {};
    const base = { ...(d.componentMinutes.baseByBedrooms ?? {}) };
    const n = numOrUndef(value);
    if (n == null) delete base[bedroomKey];
    else base[bedroomKey] = n;
    d.componentMinutes.baseByBedrooms = base;
  });

  const setMultiplier = (typeKey: string, value: string) => write((d) => {
    const mult = { ...(d.cleaningTypeMultipliers ?? {}) };
    const n = numOrUndef(value);
    if (n == null) delete mult[typeKey];
    else mult[typeKey] = n;
    d.cleaningTypeMultipliers = mult;
  });

  const setSeasonalField = (index: number, key: keyof SeasonalModifierDraft, value: string) => write((d) => {
    const list = [...(d.seasonalModifiers ?? [])];
    const mod = { ...(list[index] ?? {}) };
    if (key === 'percent') {
      const n = numOrUndef(value);
      if (n == null) delete mod.percent;
      else mod.percent = n;
    } else if (value.trim() === '') {
      delete mod[key];
    } else {
      mod[key] = value;
    }
    list[index] = mod;
    d.seasonalModifiers = list;
  });

  const addSeasonalModifier = () => write((d) => {
    d.seasonalModifiers = [...(d.seasonalModifiers ?? []), {}];
  });

  const removeSeasonalModifier = (index: number) => write((d) => {
    const list = [...(d.seasonalModifiers ?? [])];
    list.splice(index, 1);
    d.seasonalModifiers = list;
  });

  const setAutoAssignBestPro = (enabled: boolean) => write((d) => {
    d.autoAssignBestPro = enabled || undefined;
  });

  const cm = draft.componentMinutes ?? {};
  const seasonalModifiers = draft.seasonalModifiers ?? [];

  // ── Simulateur : propriété → estimate résolu + preview (grille ENREGISTRÉE) ──
  const [simPropertyId, setSimPropertyId] = useState<number | ''>('');
  const [simServiceDate, setSimServiceDate] = useState<string>('');

  const propertiesQuery = useQuery({
    queryKey: ['tarification-menage-properties'],
    queryFn: async () => extractApiList<Property>(await propertiesApi.getAll({ size: 500 })),
    staleTime: 120_000,
  });
  const simProperty = (propertiesQuery.data ?? []).find((p) => p.id === simPropertyId);

  const estimateQuery = useQuery<CleaningEstimateDetail>({
    queryKey: ['tarification-menage-estimate', simPropertyId],
    queryFn: () => propertiesApi.getCleaningEstimateDetail(simPropertyId as number),
    enabled: typeof simPropertyId === 'number',
    staleTime: 0,
  });

  const previewQuery = useQuery<CleaningPreviewResponse>({
    queryKey: ['tarification-menage-preview', simPropertyId, simServiceDate],
    queryFn: () => propertiesApi.previewCleaningEstimate({
      bedrooms: simProperty?.bedroomCount ?? null,
      bathrooms: simProperty?.bathroomCount ?? null,
      squareMeters: simProperty?.squareMeters ?? null,
      floors: simProperty?.numberOfFloors ?? null,
      hasExterior: simProperty?.hasExterior ?? null,
      hasLaundry: simProperty?.hasLaundry ?? null,
      maxGuests: simProperty?.maxGuests ?? null,
      serviceDate: simServiceDate || null,
    }),
    enabled: !!simProperty,
    staleTime: 0,
  });

  // `id` est explicite (et non derive du libelle traduit) : c'est lui qui relie
  // le FieldLabel a son champ, il doit rester stable quelle que soit la langue.
  const numberField = (
    id: string,
    label: string,
    value: number | undefined,
    placeholder: number,
    onChange: (v: string) => void,
    adornment?: string,
    step = 1,
  ) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {adornment ? (
        <InputGroup>
          <InputGroupInput
            id={id}
            type="number"
            min={0}
            step={step}
            className={NUM_FIELD_CLASS}
            value={value ?? ''}
            placeholder={String(placeholder)}
            onChange={(e) => onChange(e.target.value)}
            disabled={!canEdit}
          />
          <InputGroupAddon align="inline-end">{adornment}</InputGroupAddon>
        </InputGroup>
      ) : (
        <Input
          id={id}
          type="number"
          min={0}
          step={step}
          className={`w-full ${NUM_FIELD_CLASS}`}
          value={value ?? ''}
          placeholder={String(placeholder)}
          onChange={(e) => onChange(e.target.value)}
          disabled={!canEdit}
        />
      )}
    </Field>
  );

  return (
    <div>
      <Alert severity="info" icon={false} sx={{ mb: 2, fontSize: '12.5px' }}>
        {t('tarification.cleaning.intro')}
      </Alert>

      {/* ─── Temps de travail (minutes normées par composant) ─────────────── */}
      <Accordion expanded={expandedSection === 'workTime'} onChange={handleAccordionChange('workTime')}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--accent)]"><Timer size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 font-semibold text-[14px]">{t('tarification.cleaning.workTime')}</p>
          </div>
        </AccordionSummary>
        <AccordionDetails>
          <p className="cn-text-body1 text-[12px] text-[var(--muted)] mb-2">
            {t('tarification.cleaning.baseByBedrooms')}
          </p>
          <div className="grid grid-cols-12 gap-[9px] mb-[15px]">
            {BEDROOM_KEYS.map((key) => (
              <div className="col-span-6 min-[600px]:col-span-4 min-[900px]:col-span-2" key={key}>
                {numberField(
                  `menage-base-bedrooms-${key}`,
                  key === '5plus' ? t('tarification.cleaning.bedrooms5plus') : t('tarification.cleaning.bedroomsN', { n: key }),
                  cm.baseByBedrooms?.[key],
                  ENGINE_DEFAULTS.baseByBedrooms[key],
                  (v) => setBedroomBase(key, v),
                  'min',
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-12 gap-[9px]">
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-per-extra-bathroom', t('tarification.cleaning.perExtraBathroom'), cm.perExtraBathroom, ENGINE_DEFAULTS.perExtraBathroom, (v) => setComponent('perExtraBathroom', v), 'min')}
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-surface-threshold', t('tarification.cleaning.surfaceThreshold'), cm.surfaceThresholdSqm, ENGINE_DEFAULTS.surfaceThresholdSqm, (v) => setComponent('surfaceThresholdSqm', v), 'm²')}
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-surface-step', t('tarification.cleaning.surfaceStep'), cm.perSurfaceStepSqm, ENGINE_DEFAULTS.perSurfaceStepSqm, (v) => setComponent('perSurfaceStepSqm', v), 'm²')}
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-surface-step-minutes', t('tarification.cleaning.surfaceStepMinutes'), cm.surfaceStepMinutes, ENGINE_DEFAULTS.surfaceStepMinutes, (v) => setComponent('surfaceStepMinutes', v), 'min')}
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-per-extra-floor', t('tarification.cleaning.perExtraFloor'), cm.perExtraFloor, ENGINE_DEFAULTS.perExtraFloor, (v) => setComponent('perExtraFloor', v), 'min')}
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-exterior', t('tarification.cleaning.exterior'), cm.exterior, ENGINE_DEFAULTS.exterior, (v) => setComponent('exterior', v), 'min')}
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-laundry', t('tarification.cleaning.laundry'), cm.laundry, ENGINE_DEFAULTS.laundry, (v) => setComponent('laundry', v), 'min')}
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-per-guest-above-4', t('tarification.cleaning.perGuestAbove4'), cm.perGuestAbove4, ENGINE_DEFAULTS.perGuestAbove4, (v) => setComponent('perGuestAbove4', v), 'min')}
            </div>
          </div>
        </AccordionDetails>
      </Accordion>

      {/* ─── Taux & arrondis ───────────────────────────────────────────────── */}
      <Accordion expanded={expandedSection === 'rates'} onChange={handleAccordionChange('rates')}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--accent)]"><Euro size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 font-semibold text-[14px]">{t('tarification.cleaning.ratesAndRounding')}</p>
          </div>
        </AccordionSummary>
        <AccordionDetails>
          <div className="grid grid-cols-12 gap-[9px]">
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-hourly-rate', t('tarification.cleaning.hourlyRate'), draft.hourlyRate, ENGINE_DEFAULTS.hourlyRate, (v) => setRoot('hourlyRate', v), `${currencySymbol}/h`, 0.5)}
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-range-percent', t('tarification.cleaning.rangePercent'), draft.rangePercent, ENGINE_DEFAULTS.rangePercent, (v) => setRoot('rangePercent', v), '%')}
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-round-to', t('tarification.cleaning.roundTo'), draft.roundTo, ENGINE_DEFAULTS.roundTo, (v) => setRoot('roundTo', v), currencySymbol)}
            </div>
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
              {numberField('menage-min-price', t('tarification.cleaning.minPrice'), draft.minPrice, ENGINE_DEFAULTS.minPrice, (v) => setRoot('minPrice', v), currencySymbol)}
            </div>
          </div>
        </AccordionDetails>
      </Accordion>

      {/* ─── Types de ménage (multiplicateurs) ─────────────────────────────── */}
      <Accordion expanded={expandedSection === 'types'} onChange={handleAccordionChange('types')}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--accent)]"><CleaningServices size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 font-semibold text-[14px]">{t('tarification.cleaning.cleaningTypes')}</p>
          </div>
        </AccordionSummary>
        <AccordionDetails>
          <div className="grid grid-cols-12 gap-[9px]">
            {MULTIPLIER_KEYS.map((key) => (
              <div className="col-span-12 min-[600px]:col-span-4" key={key}>
                {numberField(
                  `menage-multiplier-${key}`,
                  t(`properties.priceEstimation.cleaningTypes.${key}`),
                  draft.cleaningTypeMultipliers?.[key],
                  ENGINE_DEFAULTS.multipliers[key],
                  (v) => setMultiplier(key, v),
                  '×',
                  0.05,
                )}
              </div>
            ))}
          </div>
        </AccordionDetails>
      </Accordion>

      {/* ─── Majorations saisonnières (conseil moteur uniquement) ──────────── */}
      <Accordion expanded={expandedSection === 'seasonal'} onChange={handleAccordionChange('seasonal')}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--accent)]"><CalendarMonth size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 font-semibold text-[14px]">{t('tarification.cleaning.seasonal.title')}</p>
          </div>
        </AccordionSummary>
        <AccordionDetails>
          <p className="cn-text-body1 text-[12px] text-[var(--muted)] mb-2">
            {t('tarification.cleaning.seasonal.hint')}
          </p>
          {seasonalModifiers.map((mod, index) => {
            const fromInvalid = mod.from != null && mod.from !== '' && !MONTH_DAY_RE.test(mod.from);
            const toInvalid = mod.to != null && mod.to !== '' && !MONTH_DAY_RE.test(mod.to);
            const percentInvalid = mod.percent != null && !isValidPercent(mod.percent);
            return (
              <div className="flex gap-2 items-start mb-2 flex-wrap" key={index}>
                <Field className="w-[110px]">
                  <FieldLabel htmlFor={`menage-seasonal-${index}-from`}>
                    {t('tarification.cleaning.seasonal.from')}
                  </FieldLabel>
                  <Input
                    id={`menage-seasonal-${index}-from`}
                    className={NUM_FIELD_CLASS}
                    value={mod.from ?? ''}
                    placeholder="07-01"
                    onChange={(e) => setSeasonalField(index, 'from', e.target.value)}
                    disabled={!canEdit}
                    aria-invalid={fromInvalid}
                  />
                  {fromInvalid && <FieldError>{t('tarification.cleaning.seasonal.formatHint')}</FieldError>}
                </Field>
                <Field className="w-[110px]">
                  <FieldLabel htmlFor={`menage-seasonal-${index}-to`}>
                    {t('tarification.cleaning.seasonal.to')}
                  </FieldLabel>
                  <Input
                    id={`menage-seasonal-${index}-to`}
                    className={NUM_FIELD_CLASS}
                    value={mod.to ?? ''}
                    placeholder="08-31"
                    onChange={(e) => setSeasonalField(index, 'to', e.target.value)}
                    disabled={!canEdit}
                    aria-invalid={toInvalid}
                  />
                  {toInvalid && <FieldError>{t('tarification.cleaning.seasonal.formatHint')}</FieldError>}
                </Field>
                <Field className="w-[130px]">
                  <FieldLabel htmlFor={`menage-seasonal-${index}-percent`}>
                    {t('tarification.cleaning.seasonal.percent')}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={`menage-seasonal-${index}-percent`}
                      type="number"
                      min={-50}
                      max={100}
                      step={1}
                      className={NUM_FIELD_CLASS}
                      value={mod.percent ?? ''}
                      placeholder="20"
                      onChange={(e) => setSeasonalField(index, 'percent', e.target.value)}
                      disabled={!canEdit}
                      aria-invalid={percentInvalid}
                    />
                    <InputGroupAddon align="inline-end">%</InputGroupAddon>
                  </InputGroup>
                  {percentInvalid && <FieldError>{t('tarification.cleaning.seasonal.percentHint')}</FieldError>}
                </Field>
                <Field className="flex-1 min-w-[160px]">
                  <FieldLabel htmlFor={`menage-seasonal-${index}-label`}>
                    {t('tarification.cleaning.seasonal.label')}
                  </FieldLabel>
                  <Input
                    id={`menage-seasonal-${index}-label`}
                    value={mod.label ?? ''}
                    onChange={(e) => setSeasonalField(index, 'label', e.target.value)}
                    disabled={!canEdit}
                  />
                </Field>
                {canEdit && (
                  <IconButton
                    size="small"
                    onClick={() => removeSeasonalModifier(index)}
                    aria-label={t('tarification.cleaning.seasonal.remove')}
                    sx={{ mt: 0.5 }}
                  >
                    <Close size={16} strokeWidth={1.75} />
                  </IconButton>
                )}
              </div>
            );
          })}
          {seasonalModifiers.length === 0 && (
            <p className="cn-text-body1 text-[12.5px] text-[var(--faint)] mb-2">
              {t('tarification.cleaning.seasonal.empty')}
            </p>
          )}
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={addSeasonalModifier}>
              <Add size={15} strokeWidth={1.75} />
              {t('tarification.cleaning.seasonal.add')}
            </Button>
          )}
          {seasonalModifiers.length > 1 && (
            <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] mt-1.5">
              {t('tarification.cleaning.seasonal.firstMatchHint')}
            </p>
          )}
        </AccordionDetails>
      </Accordion>

      {/* ─── Assignation (auto-assignation du meilleur pro) ────────────────── */}
      <Accordion expanded={expandedSection === 'assignment'} onChange={handleAccordionChange('assignment')}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--accent)]"><AutoAwesome size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 font-semibold text-[14px]">{t('tarification.cleaning.assignment.title')}</p>
          </div>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Switch
                checked={draft.autoAssignBestPro ?? false}
                onChange={(e) => setAutoAssignBestPro(e.target.checked)}
                disabled={!canEdit}
              />
            }
            label={
              <div>
                <p className="cn-text-body1 text-[13.5px] font-semibold">{t('tarification.cleaning.assignment.autoBestPro')}</p>
                <p className="cn-text-body1 text-[12px] text-[var(--muted)]">{t('tarification.cleaning.assignment.autoBestProHint')}</p>
              </div>
            }
          />
        </AccordionDetails>
      </Accordion>

      {/* ─── Simulateur (grille ENREGISTRÉE côté serveur) ──────────────────── */}
      <Accordion expanded={expandedSection === 'simulator'} onChange={handleAccordionChange('simulator')}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-[var(--accent)]"><Speed size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 font-semibold text-[14px]">{t('tarification.cleaning.simulator')}</p>
          </div>
        </AccordionSummary>
        <AccordionDetails>
          {/* La preview backend calcule avec la config SAUVEGARDÉE — pas la grille en cours d'édition. */}
          <Alert severity="warning" icon={false} sx={{ mb: 2, fontSize: '12px' }}>
            {t('tarification.cleaning.simulatorSavedConfigHint')}
          </Alert>

          <div className="flex gap-2 mb-3 flex-wrap">
            <Field className="w-auto min-w-[280px]">
              <FieldLabel htmlFor="menage-sim-property">
                {t('tarification.cleaning.simulatorProperty')}
              </FieldLabel>
              <NativeSelect
                id="menage-sim-property"
                className="w-full"
                value={simPropertyId === '' ? '' : simPropertyId}
                onChange={(e) => setSimPropertyId(Number(e.target.value))}
              >
                <NativeSelectOption value="" disabled>
                  {t('tarification.cleaning.simulatorSelectProperty')}
                </NativeSelectOption>
                {(propertiesQuery.data ?? []).map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field className="w-[180px]">
              <FieldLabel htmlFor="menage-sim-date">
                {t('tarification.cleaning.simulatorDate')}
              </FieldLabel>
              <Input
                id="menage-sim-date"
                type="date"
                className={NUM_FIELD_CLASS}
                value={simServiceDate}
                onChange={(e) => setSimServiceDate(e.target.value)}
              />
            </Field>
          </div>

          {typeof simPropertyId === 'number' && (estimateQuery.isPending || previewQuery.isPending) && (
            <Skeleton variant="rounded" height={140} sx={{ borderRadius: '11px' }} />
          )}

          {(estimateQuery.isError || previewQuery.isError) && (
            <UiAlert variant="destructive" className="mb-2 text-[12.5px]">
              <TriangleAlert />
              <AlertDescription>{t('tarification.cleaning.simulatorError')}</AlertDescription>
            </UiAlert>
          )}

          {simProperty && !simProperty.bedroomCount && !simProperty.squareMeters && (
            <Alert severity="info" icon={false} sx={{ mb: 1.5, fontSize: '12.5px' }}>
              {t('tarification.cleaning.simulatorInsufficientData')}
            </Alert>
          )}

          {estimateQuery.data && (
            <div className="flex items-baseline gap-2 mb-2 flex-wrap">
              <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[22px] font-semibold text-[var(--accent)] tabular-nums">
                {estimateQuery.data.estimate} {currencySymbol}
              </p>
              <p className="cn-text-body1 text-[12px] text-[var(--muted)] tabular-nums">
                {estimateQuery.data.min}–{estimateQuery.data.max} {currencySymbol} · {estimateQuery.data.durationMinutes} min
              </p>
              <p className="cn-text-body1 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-[.04em]">
                {estimateQuery.data.source === 'PROPERTY_OVERRIDE'
                  ? t('tarification.cleaning.sourceOverride')
                  : estimateQuery.data.source === 'HOUSEKEEPER_RATE'
                    ? t('tarification.cleaning.sourceHousekeeperRate')
                    : t('tarification.cleaning.sourceEngine')}
              </p>
            </div>
          )}

          {previewQuery.data && (
            <>
              {/* Quotes par type */}
              <div className="mb-3 grid grid-cols-[repeat(3,_1fr)] gap-[9px] max-[700px]:grid-cols-[1fr]">
                {MULTIPLIER_KEYS.map((type) => {
                  const q = previewQuery.data.quotes?.[type];
                  if (!q) return null;
                  return (
                    <div className="border border-[var(--line)] rounded-[11px] px-2.5 py-2" key={type}>
                      <p className="cn-text-body1 text-[11px] font-bold text-[var(--faint)] uppercase tracking-[.05em] mb-0.5">
                        {t(`properties.priceEstimation.cleaningTypes.${type}`)}
                      </p>
                      <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--ink)] tabular-nums">
                        {q.recommended} {currencySymbol}
                      </p>
                      <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] tabular-nums">
                        {q.min}–{q.max} {currencySymbol} · {q.durationMinutes} min
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Décomposition minutes */}
              <div className="border border-[var(--line)] rounded-[11px] overflow-hidden max-w-[420px]">
                <div className="px-2.5 py-1 bg-[var(--surface-2)]">
                  <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--faint)]">
                    {t('properties.cleaningEstimator.breakdownTitle')}
                  </p>
                </div>
                {BREAKDOWN_KEYS.flatMap((key) => {
                  const minutes = previewQuery.data.minutesBreakdown?.[key] ?? 0;
                  if (!(key === 'base' || minutes > 0)) return [];
                  return [
                    <div className="flex justify-between px-2.5 py-1 border-t border-[var(--line)]" key={key}>
                      <p className="cn-text-body1 text-[12.5px] text-[var(--body)]">
                        {t(`properties.cleaningEstimator.breakdown.${key}`)}
                      </p>
                      <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--ink)] tabular-nums">
                        {minutes} min
                      </p>
                    </div>,
                  ];
                })}
              </div>
            </>
          )}
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
