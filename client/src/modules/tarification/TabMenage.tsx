import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  MenuItem,
  Alert,
  Skeleton,
} from '@mui/material';
import { ExpandMore, Timer, Euro, CleaningServices, Speed } from '../../icons';
import { useQuery } from '@tanstack/react-query';
import type { PricingConfig } from '../../services/api/pricingConfigApi';
import { propertiesApi } from '../../services/api';
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
  return out;
}

const NUM_FIELD_SX = {
  '& .MuiOutlinedInput-input': { fontVariantNumeric: 'tabular-nums' },
} as const;

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
    const next: EngineConfigDraft = JSON.parse(JSON.stringify(draft));
    mutate(next);
    const pruned = pruneDraft(next);
    onUpdate({
      cleaningEngineConfig: Object.keys(pruned).length > 0 ? JSON.stringify(pruned) : null,
    });
  };

  const numOrUndef = (value: string): number | undefined => {
    if (value.trim() === '') return undefined;
    const n = parseFloat(value);
    return isNaN(n) ? undefined : n;
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

  const cm = draft.componentMinutes ?? {};

  // ── Simulateur : propriété → estimate résolu + preview (grille ENREGISTRÉE) ──
  const [simPropertyId, setSimPropertyId] = useState<number | ''>('');

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
    queryKey: ['tarification-menage-preview', simPropertyId],
    queryFn: () => propertiesApi.previewCleaningEstimate({
      bedrooms: simProperty?.bedroomCount ?? null,
      bathrooms: simProperty?.bathroomCount ?? null,
      squareMeters: simProperty?.squareMeters ?? null,
      floors: simProperty?.numberOfFloors ?? null,
      hasExterior: simProperty?.hasExterior ?? null,
      hasLaundry: simProperty?.hasLaundry ?? null,
      maxGuests: simProperty?.maxGuests ?? null,
    }),
    enabled: !!simProperty,
    staleTime: 0,
  });

  const numberField = (
    label: string,
    value: number | undefined,
    placeholder: number,
    onChange: (v: string) => void,
    adornment?: string,
    step = 1,
  ) => (
    <TextField
      label={label}
      type="number"
      size="small"
      fullWidth
      value={value ?? ''}
      placeholder={String(placeholder)}
      onChange={(e) => onChange(e.target.value)}
      disabled={!canEdit}
      inputProps={{ min: 0, step }}
      InputProps={adornment ? { endAdornment: <InputAdornment position="end">{adornment}</InputAdornment> } : undefined}
      InputLabelProps={{ shrink: true }}
      sx={NUM_FIELD_SX}
    />
  );

  return (
    <Box>
      <Alert severity="info" icon={false} sx={{ mb: 2, fontSize: '12.5px' }}>
        {t('tarification.cleaning.intro')}
      </Alert>

      {/* ─── Temps de travail (minutes normées par composant) ─────────────── */}
      <Accordion expanded={expandedSection === 'workTime'} onChange={handleAccordionChange('workTime')}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Timer size={18} strokeWidth={1.75} /></Box>
            <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{t('tarification.cleaning.workTime')}</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography sx={{ fontSize: '12px', color: 'var(--muted)', mb: 1.5 }}>
            {t('tarification.cleaning.baseByBedrooms')}
          </Typography>
          <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
            {BEDROOM_KEYS.map((key) => (
              <Grid item xs={6} sm={4} md={2} key={key}>
                {numberField(
                  key === '5plus' ? t('tarification.cleaning.bedrooms5plus') : t('tarification.cleaning.bedroomsN', { n: key }),
                  cm.baseByBedrooms?.[key],
                  ENGINE_DEFAULTS.baseByBedrooms[key],
                  (v) => setBedroomBase(key, v),
                  'min',
                )}
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.perExtraBathroom'), cm.perExtraBathroom, ENGINE_DEFAULTS.perExtraBathroom, (v) => setComponent('perExtraBathroom', v), 'min')}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.surfaceThreshold'), cm.surfaceThresholdSqm, ENGINE_DEFAULTS.surfaceThresholdSqm, (v) => setComponent('surfaceThresholdSqm', v), 'm²')}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.surfaceStep'), cm.perSurfaceStepSqm, ENGINE_DEFAULTS.perSurfaceStepSqm, (v) => setComponent('perSurfaceStepSqm', v), 'm²')}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.surfaceStepMinutes'), cm.surfaceStepMinutes, ENGINE_DEFAULTS.surfaceStepMinutes, (v) => setComponent('surfaceStepMinutes', v), 'min')}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.perExtraFloor'), cm.perExtraFloor, ENGINE_DEFAULTS.perExtraFloor, (v) => setComponent('perExtraFloor', v), 'min')}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.exterior'), cm.exterior, ENGINE_DEFAULTS.exterior, (v) => setComponent('exterior', v), 'min')}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.laundry'), cm.laundry, ENGINE_DEFAULTS.laundry, (v) => setComponent('laundry', v), 'min')}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.perGuestAbove4'), cm.perGuestAbove4, ENGINE_DEFAULTS.perGuestAbove4, (v) => setComponent('perGuestAbove4', v), 'min')}
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ─── Taux & arrondis ───────────────────────────────────────────────── */}
      <Accordion expanded={expandedSection === 'rates'} onChange={handleAccordionChange('rates')}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Euro size={18} strokeWidth={1.75} /></Box>
            <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{t('tarification.cleaning.ratesAndRounding')}</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.hourlyRate'), draft.hourlyRate, ENGINE_DEFAULTS.hourlyRate, (v) => setRoot('hourlyRate', v), `${currencySymbol}/h`, 0.5)}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.rangePercent'), draft.rangePercent, ENGINE_DEFAULTS.rangePercent, (v) => setRoot('rangePercent', v), '%')}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.roundTo'), draft.roundTo, ENGINE_DEFAULTS.roundTo, (v) => setRoot('roundTo', v), currencySymbol)}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {numberField(t('tarification.cleaning.minPrice'), draft.minPrice, ENGINE_DEFAULTS.minPrice, (v) => setRoot('minPrice', v), currencySymbol)}
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ─── Types de ménage (multiplicateurs) ─────────────────────────────── */}
      <Accordion expanded={expandedSection === 'types'} onChange={handleAccordionChange('types')}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><CleaningServices size={18} strokeWidth={1.75} /></Box>
            <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{t('tarification.cleaning.cleaningTypes')}</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={1.5}>
            {MULTIPLIER_KEYS.map((key) => (
              <Grid item xs={12} sm={4} key={key}>
                {numberField(
                  t(`properties.priceEstimation.cleaningTypes.${key}`),
                  draft.cleaningTypeMultipliers?.[key],
                  ENGINE_DEFAULTS.multipliers[key],
                  (v) => setMultiplier(key, v),
                  '×',
                  0.05,
                )}
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ─── Simulateur (grille ENREGISTRÉE côté serveur) ──────────────────── */}
      <Accordion expanded={expandedSection === 'simulator'} onChange={handleAccordionChange('simulator')}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Speed size={18} strokeWidth={1.75} /></Box>
            <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{t('tarification.cleaning.simulator')}</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {/* La preview backend calcule avec la config SAUVEGARDÉE — pas la grille en cours d'édition. */}
          <Alert severity="warning" icon={false} sx={{ mb: 2, fontSize: '12px' }}>
            {t('tarification.cleaning.simulatorSavedConfigHint')}
          </Alert>

          <TextField
            select
            size="small"
            label={t('tarification.cleaning.simulatorProperty')}
            value={simPropertyId === '' ? '' : simPropertyId}
            onChange={(e) => setSimPropertyId(Number(e.target.value))}
            sx={{ minWidth: 280, mb: 2 }}
            InputLabelProps={{ shrink: true }}
            SelectProps={{ displayEmpty: true }}
          >
            <MenuItem value="" disabled>{t('tarification.cleaning.simulatorSelectProperty')}</MenuItem>
            {(propertiesQuery.data ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </TextField>

          {typeof simPropertyId === 'number' && (estimateQuery.isPending || previewQuery.isPending) && (
            <Skeleton variant="rounded" height={140} sx={{ borderRadius: '11px' }} />
          )}

          {estimateQuery.data && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mb: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                {estimateQuery.data.estimate} {currencySymbol}
              </Typography>
              <Typography sx={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                {estimateQuery.data.min}–{estimateQuery.data.max} {currencySymbol} · {estimateQuery.data.durationMinutes} min
              </Typography>
              <Typography sx={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {estimateQuery.data.source === 'PROPERTY_OVERRIDE'
                  ? t('tarification.cleaning.sourceOverride')
                  : t('tarification.cleaning.sourceEngine')}
              </Typography>
            </Box>
          )}

          {previewQuery.data && (
            <>
              {/* Quotes par type */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2, '@media (max-width: 700px)': { gridTemplateColumns: '1fr' } }}>
                {MULTIPLIER_KEYS.map((type) => {
                  const q = previewQuery.data.quotes?.[type];
                  if (!q) return null;
                  return (
                    <Box key={type} sx={{ border: '1px solid var(--line)', borderRadius: '11px', px: 1.75, py: 1.25 }}>
                      <Typography sx={{ fontSize: '11px', fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.05em', mb: 0.5 }}>
                        {t(`properties.priceEstimation.cleaningTypes.${type}`)}
                      </Typography>
                      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                        {q.recommended} {currencySymbol}
                      </Typography>
                      <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {q.min}–{q.max} {currencySymbol} · {q.durationMinutes} min
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              {/* Décomposition minutes */}
              <Box sx={{ border: '1px solid var(--line)', borderRadius: '11px', overflow: 'hidden', maxWidth: 420 }}>
                <Box sx={{ px: 1.75, py: 0.75, bgcolor: 'var(--surface-2)' }}>
                  <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)' }}>
                    {t('properties.cleaningEstimator.breakdownTitle')}
                  </Typography>
                </Box>
                {BREAKDOWN_KEYS
                  .map((key) => ({ key, minutes: previewQuery.data.minutesBreakdown?.[key] ?? 0 }))
                  .filter(({ key, minutes }) => key === 'base' || minutes > 0)
                  .map(({ key, minutes }) => (
                    <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', px: 1.75, py: 0.6, borderTop: '1px solid var(--line)' }}>
                      <Typography sx={{ fontSize: '12.5px', color: 'var(--body)' }}>
                        {t(`properties.cleaningEstimator.breakdown.${key}`)}
                      </Typography>
                      <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                        {minutes} min
                      </Typography>
                    </Box>
                  ))}
              </Box>
            </>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
