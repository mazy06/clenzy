import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  InputAdornment,
  Skeleton,
} from '@mui/material';
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
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '10.5px',
          fontWeight: 700,
          color: 'var(--ok, #4A9B8E)',
          backgroundColor: 'color-mix(in srgb, var(--ok, #4A9B8E) 12%, transparent)',
          borderRadius: '7px',
          padding: '2px 7px',
          whiteSpace: 'nowrap',
        }}
      >
        <CheckCircle size={11} strokeWidth={2} />
        {t('settings.myRates.inMarket')}
      </Box>
    );
  }

  const deltaPct = Math.round(((amount - rate.advisoryRecommended) / rate.advisoryRecommended) * 100);
  return (
    <Box
      component="span"
      sx={{
        fontSize: '10.5px',
        fontWeight: 700,
        color: 'var(--muted)',
        backgroundColor: 'var(--field)',
        border: '1px solid var(--field-line)',
        borderRadius: '7px',
        padding: '2px 7px',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {deltaPct > 0 ? '+' : ''}{deltaPct} % {t('settings.myRates.vsAdvisory')}
    </Box>
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
  const [hydrated, setHydrated] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  useEffect(() => {
    const data = ratesQuery.data;
    if (!data || hydrated) return;
    setHourly(data.hourlyAmount != null ? String(data.hourlyAmount) : '');
    const map: Record<number, string> = {};
    for (const p of data.properties) {
      if (p.flatAmount != null) map[p.propertyId] = String(p.flatAmount);
    }
    setFlats(map);
    setHydrated(true);
  }, [ratesQuery.data, hydrated]);

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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Skeleton variant="rounded" height={120} sx={{ borderRadius: '13px' }} />
        <Skeleton variant="rounded" height={260} sx={{ borderRadius: '13px' }} />
      </Box>
    );
  }

  if (ratesQuery.isError) {
    return <Alert severity="error">{t('settings.myRates.loadError')}</Alert>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ── Score qualité 30 jours (MM-3D) ───────────────────────────────── */}
      {score != null && (
        <Paper sx={{ border: '1px solid var(--line)', boxShadow: 'none', borderRadius: '13px', p: 2.5 }}>
          <Typography sx={SECTION_TITLE_SX}>{t('settings.myRates.scoreSection')}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
              {score.score}<Box component="span" sx={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>/100</Box>
            </Typography>
            <Typography sx={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              {t('settings.myRates.scoreDetail', {
                count: score.completedCount,
                proof: Math.round(score.proofRate * 100),
              })}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', mt: 1 }}>
            {t('settings.myRates.scoreHint')}
          </Typography>
        </Paper>
      )}

      {/* ── Taux horaire général ─────────────────────────────────────────── */}
      <Paper sx={{ border: '1px solid var(--line)', boxShadow: 'none', borderRadius: '13px', p: 2.5 }}>
        <Typography sx={SECTION_TITLE_SX}>{t('settings.myRates.hourlySection')}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
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
            <Typography sx={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              {t('settings.myRates.referenceRate')} : {referenceRate} €/h
            </Typography>
          )}
        </Box>
        <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', mt: 1 }}>
          {t('settings.myRates.hourlyHint')}
        </Typography>
      </Paper>

      {/* ── Forfaits par logement ────────────────────────────────────────── */}
      <Paper sx={{ border: '1px solid var(--line)', boxShadow: 'none', borderRadius: '13px', p: 2.5 }}>
        <Typography sx={SECTION_TITLE_SX}>{t('settings.myRates.flatSection')}</Typography>
        <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', mb: 2 }}>
          {t('settings.myRates.flatHint')}
        </Typography>

        {properties.length === 0 ? (
          <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)', fontStyle: 'italic' }}>
            {t('settings.myRates.noProperties')}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {properties.map((property) => {
              const raw = flats[property.propertyId] ?? '';
              const amount = raw.trim() !== '' && !isNaN(parseFloat(raw)) ? parseFloat(raw) : null;
              return (
                <Box
                  key={property.propertyId}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    py: 1.25,
                    flexWrap: 'wrap',
                    '& + &': { borderTop: '1px solid var(--line)' },
                  }}
                >
                  <Typography sx={{ flex: 1, minWidth: 160, fontSize: '13px', fontWeight: 600, color: 'var(--ink)', pt: 1 }}>
                    {property.propertyName}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                    </Box>
                    {/* Nudge : fourchette conseil, ancre médiane */}
                    <Typography sx={{ fontSize: '11px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {t('settings.myRates.advisoryLine', {
                        min: property.advisoryMin,
                        max: property.advisoryMax,
                      })}{' '}
                      · {t('settings.myRates.advisoryMedian')} <b>{property.advisoryRecommended} €</b>
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      {/* ── Enregistrer ──────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Save size={16} strokeWidth={1.75} />}
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {t('settings.myRates.save')}
        </Button>
      </Box>

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
    </Box>
  );
}
