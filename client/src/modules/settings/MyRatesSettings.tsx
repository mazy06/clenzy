import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Typography, TextField, Button, Alert, Snackbar, InputAdornment, Skeleton } from '@mui/material';
import { Euro, Save, CheckCircle } from '../../icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { housekeeperRatesApi } from '../../services/api/housekeeperRatesApi';
import type { HousekeeperRates, HousekeeperPropertyRate } from '../../services/api/housekeeperRatesApi';

// ─── « Mes tarifs » (Moteur Ménage 2A) — HOUSEKEEPER / TECHNICIAN ────────────
// Taux horaire général + forfait optionnel par logement (le forfait PRIME).
// Nudge à la saisie : fourchette conseil du logement (ancre = MÉDIANE), badge
// « dans le marché » si dedans, sinon écart % NEUTRE — jamais de blocage.

const ratesKeys = { my: ['housekeeper-rates', 'me'] as const };

const NUM_SX = {
  '& .MuiOutlinedInput-input': { fontVariantNumeric: 'tabular-nums' },
} as const;

const SECTION_TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--faint)',
  mb: 1.5,
} as const;

/** Chip d'état du nudge — vert doux si dans la fourchette, neutre sinon. */
function NudgeBadge({ amount, rate }: { amount: number | null; rate: HousekeeperPropertyRate }) {
  const { t } = useTranslation();
  if (amount == null || amount <= 0) return null;

  const inMarket = amount >= rate.advisoryMin && amount <= rate.advisoryMax;
  if (inMarket) {
    return (
      <span className="inline-flex items-center gap-[4px] text-[10.5px] font-bold whitespace-nowrap rounded-[7px] px-[7px] py-[2px] text-[var(--ok,#4A9B8E)] bg-[color-mix(in_srgb,var(--ok,#4A9B8E)_12%,transparent)]">
        <CheckCircle size={11} strokeWidth={2} />
        {t('settings.myRates.inMarket')}
      </span>
    );
  }

  const deltaPct = Math.round(((amount - rate.advisoryRecommended) / rate.advisoryRecommended) * 100);
  return (
    <span className="text-[10.5px] font-bold whitespace-nowrap tabular-nums rounded-[7px] px-[7px] py-[2px] text-[var(--muted)] bg-[var(--field)] border border-solid border-[var(--field-line)]">
      {deltaPct > 0 ? '+' : ''}{deltaPct} % {t('settings.myRates.vsAdvisory')}
    </span>
  );
}

export default function MyRatesSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const ratesQuery = useQuery({
    queryKey: ratesKeys.my,
    queryFn: () => housekeeperRatesApi.getMy(),
    staleTime: 30_000,
  });

  // ── État éditable local (hydraté depuis la query) ──
  const [hourly, setHourly] = useState<string>('');
  const [flats, setFlats] = useState<Record<number, string>>({});
  // Gate d'hydratation one-shot (jamais lu au render) : ref, pas de re-render.
  const hydratedRef = useRef(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  useEffect(() => {
    const data = ratesQuery.data;
    if (!data || hydratedRef.current) return;
    setHourly(data.hourlyAmount != null ? String(data.hourlyAmount) : '');
    const map: Record<number, string> = {};
    for (const p of data.properties) {
      if (p.flatAmount != null) map[p.propertyId] = String(p.flatAmount);
    }
    setFlats(map);
    hydratedRef.current = true;
  }, [ratesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<typeof housekeeperRatesApi.updateMy>[0]) =>
      housekeeperRatesApi.updateMy(payload),
    onSuccess: (updated: HousekeeperRates) => {
      queryClient.setQueryData(ratesKeys.my, updated);
      setSnackbar({ open: true, message: t('settings.myRates.saveSuccess'), severity: 'success' });
    },
    onError: () => {
      setSnackbar({ open: true, message: t('settings.myRates.saveError'), severity: 'error' });
    },
  });

  const handleSave = () => {
    const hourlyAmount = hourly.trim() !== '' && !isNaN(parseFloat(hourly)) ? parseFloat(hourly) : null;
    const flatRates = Object.entries(flats).flatMap(([propertyId, value]) => {
      const amount = parseFloat(value);
      return !isNaN(amount) && amount > 0 ? [{ propertyId: Number(propertyId), amount }] : [];
    });
    saveMutation.mutate({ hourlyAmount, flatRates });
  };

  const referenceRate = ratesQuery.data?.referenceHourlyRate;
  const score = ratesQuery.data?.score;
  const properties = useMemo(() => ratesQuery.data?.properties ?? [], [ratesQuery.data]);

  if (ratesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton variant="rounded" height={120} sx={{ borderRadius: '13px' }} />
        <Skeleton variant="rounded" height={260} sx={{ borderRadius: '13px' }} />
      </div>
    );
  }

  if (ratesQuery.isError) {
    return <UiAlert variant="destructive">
      <TriangleAlert />
      <AlertDescription>{t('settings.myRates.loadError')}</AlertDescription>
    </UiAlert>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Score qualité 30 jours (MM-3D) ───────────────────────────────── */}
      {score != null && (
        <Card className="gap-0 py-0 p-3.5">
          <Typography sx={SECTION_TITLE_SX}>{t('settings.myRates.scoreSection')}</Typography>
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="cn-text-body1 font-[var(--font-display)] text-[26px] font-semibold text-[var(--accent)] tabular-nums">
              {score.score}<span className="text-[14px] text-[var(--muted)] font-medium">/100</span>
            </p>
            <p className="cn-text-body1 text-[12px] text-[var(--muted)] tabular-nums">
              {t('settings.myRates.scoreDetail', {
                count: score.completedCount,
                proof: Math.round(score.proofRate * 100),
              })}
            </p>
          </div>
          <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] mt-1.5">
            {t('settings.myRates.scoreHint')}
          </p>
        </Card>
      )}

      {/* ── Taux horaire général ─────────────────────────────────────────── */}
      <Card className="gap-0 py-0 p-3.5">
        <Typography sx={SECTION_TITLE_SX}>{t('settings.myRates.hourlySection')}</Typography>
        <div className="flex items-center gap-3 flex-wrap">
          <TextField
            label={t('settings.myRates.hourlyRate')}
            type="number"
            size="small"
            value={hourly}
            onChange={(e) => setHourly(e.target.value)}
            inputProps={{ min: 0, step: 0.5 }}
            InputProps={{ endAdornment: <InputAdornment position="end">€/h</InputAdornment> }}
            InputLabelProps={{ shrink: true }}
            sx={{ ...NUM_SX, width: 220 }}
          />
          {referenceRate != null && (
            <p className="cn-text-body1 text-[12px] text-[var(--muted)] tabular-nums">
              {t('settings.myRates.referenceRate')} : {referenceRate} €/h
            </p>
          )}
        </div>
        <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] mt-1.5">
          {t('settings.myRates.hourlyHint')}
        </p>
      </Card>

      {/* ── Forfaits par logement ────────────────────────────────────────── */}
      <Card className="gap-0 py-0 p-3.5">
        <Typography sx={SECTION_TITLE_SX}>{t('settings.myRates.flatSection')}</Typography>
        <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] mb-3">
          {t('settings.myRates.flatHint')}
        </p>

        {properties.length === 0 ? (
          <p className="cn-text-body1 text-[12.5px] text-[var(--muted)] italic">
            {t('settings.myRates.noProperties')}
          </p>
        ) : (
          <div className="flex flex-col">
            {properties.map((property) => {
              const raw = flats[property.propertyId] ?? '';
              const amount = raw.trim() !== '' && !isNaN(parseFloat(raw)) ? parseFloat(raw) : null;
              return (
                // Le `& + &` d'origine ne separait que les lignes suivantes :
                // filet sur toutes, puis annule sur la premiere.
                <div
                  key={property.propertyId}
                  className="flex items-start flex-wrap gap-3 py-[7.5px] border-t border-solid border-t-[var(--line)] first:border-t-0"
                >
                  <p className="cn-text-body1 flex-1 min-w-[160px] text-[13px] font-semibold text-[var(--ink)] pt-1.5">
                    {property.propertyName}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <TextField
                        type="number"
                        size="small"
                        placeholder={String(property.advisoryRecommended)}
                        value={raw}
                        onChange={(e) => setFlats((prev) => ({ ...prev, [property.propertyId]: e.target.value }))}
                        inputProps={{ min: 0, step: 5, 'aria-label': t('settings.myRates.flatFieldAria', { name: property.propertyName }) }}
                        InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
                        sx={{ ...NUM_SX, width: 150 }}
                      />
                      <NudgeBadge amount={amount} rate={property} />
                    </div>
                    {/* Nudge : fourchette conseil, ancre médiane */}
                    <p className="cn-text-body1 text-[11px] text-[var(--muted)] tabular-nums">
                      {t('settings.myRates.advisoryLine', {
                        min: property.advisoryMin,
                        max: property.advisoryMax,
                      })}{' '}
                      · {t('settings.myRates.advisoryMedian')} <b>{property.advisoryRecommended} €</b>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Enregistrer ──────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button
          variant="contained"
          size="small"
          startIcon={saveMutation.isPending ? <Spinner className="size-4" /> : <Save size={16} strokeWidth={1.75} />}
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {t('settings.myRates.save')}
        </Button>
      </div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
