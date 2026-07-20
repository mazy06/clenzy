import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  housekeeperRatesApi,
  type HousekeeperRates,
  type HousekeeperPropertyRate,
} from '../../../services/api/housekeeperRatesApi';

// ─── Tarifs & score d'un prestataire — vue staff plateforme (MM-4A #6) ───────
// Consomme GET/PUT /housekeeper-rates/user/{userId} (gardes backend :
// SUPER_ADMIN / SUPER_MANAGER). Score qualité 30 j + taux horaire + forfaits
// par logement avec le nudge fourchette conseil (jamais bloquant).

const NUM_SX = {
  '& .MuiOutlinedInput-input': { fontVariantNumeric: 'tabular-nums' },
} as const;

interface HousekeeperRatesDialogProps {
  userId: number | null;
  userName?: string;
  onClose: () => void;
}

/** Badge du nudge : « dans le marché » (fourchette conseil) ou écart % neutre. */
function RateNudge({ amount, rate }: { amount: number | null; rate: HousekeeperPropertyRate }) {
  const { t } = useTranslation();
  if (amount == null || amount <= 0) return null;
  const inMarket = amount >= rate.advisoryMin && amount <= rate.advisoryMax;
  const deltaPct = rate.advisoryRecommended > 0
    ? Math.round(((amount - rate.advisoryRecommended) / rate.advisoryRecommended) * 100)
    : 0;
  return (
    <Box
      component="span"
      sx={{
        fontSize: '10.5px',
        fontWeight: 700,
        borderRadius: '7px',
        padding: '2px 7px',
        whiteSpace: 'nowrap',
        color: inMarket ? 'var(--ok)' : 'var(--muted)',
        backgroundColor: inMarket
          ? 'color-mix(in srgb, var(--ok) 12%, transparent)'
          : 'var(--hover)',
      }}
    >
      {inMarket
        ? t('users.ratesDialog.inMarket', 'Dans le marché')
        : `${deltaPct > 0 ? '+' : ''}${deltaPct} %`}
    </Box>
  );
}

export default function HousekeeperRatesDialog({ userId, userName, onClose }: HousekeeperRatesDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [hourly, setHourly] = useState('');
  const [flats, setFlats] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);

  const ratesQuery = useQuery<HousekeeperRates>({
    queryKey: ['housekeeper-rates', 'user', userId],
    queryFn: () => housekeeperRatesApi.getForUser(userId as number),
    enabled: userId != null,
    staleTime: 0,
  });

  // Hydrate les champs quand les données arrivent (dialog ré-ouvrable).
  useEffect(() => {
    const data = ratesQuery.data;
    if (!data) return;
    setHourly(data.hourlyAmount != null ? String(data.hourlyAmount) : '');
    const next: Record<number, string> = {};
    for (const p of data.properties) {
      if (p.flatAmount != null) next[p.propertyId] = String(p.flatAmount);
    }
    setFlats(next);
    setSaved(false);
  }, [ratesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const flatRates = Object.entries(flats).flatMap(([propertyId, raw]) => {
        const amount = parseFloat(raw);
        return !isNaN(amount) && amount > 0 ? [{ propertyId: Number(propertyId), amount }] : [];
      });
      return housekeeperRatesApi.updateForUser(userId as number, {
        hourlyAmount: hourly.trim() !== '' && !isNaN(parseFloat(hourly)) ? parseFloat(hourly) : null,
        flatRates,
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['housekeeper-rates', 'user', userId], data);
      setSaved(true);
    },
  });

  const data = ratesQuery.data;
  const score = data?.score;

  return (
    <Dialog open={userId != null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        {t('users.ratesDialog.title', 'Tarifs & score')}
        {userName ? ` — ${userName}` : ''}
      </DialogTitle>
      <DialogContent dividers>
        {ratesQuery.isPending && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={26} />
          </Box>
        )}
        {ratesQuery.isError && (
          <Alert severity="error">{t('users.ratesDialog.loadError', 'Impossible de charger les tarifs de ce prestataire.')}</Alert>
        )}
        {data && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* ── Score qualité 30 j ── */}
            {score != null && (
              <Box>
                <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)', mb: 0.75 }}>
                  {t('settings.myRates.scoreSection', 'Score qualité (30 jours)')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                    {score.score}
                    <Box component="span" sx={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>/100</Box>
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {t('settings.myRates.scoreDetail', {
                      count: score.completedCount,
                      proof: Math.round(score.proofRate * 100),
                    })}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* ── Taux horaire ── */}
            <Box>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)', mb: 0.75 }}>
                {t('settings.myRates.hourlySection', 'Taux horaire')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label={t('settings.myRates.hourlyRate', 'Taux horaire')}
                  type="number"
                  size="small"
                  value={hourly}
                  onChange={(e) => setHourly(e.target.value)}
                  inputProps={{ min: 0, step: 0.5 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">€/h</InputAdornment> }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ ...NUM_SX, width: 200 }}
                />
                <Typography sx={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {t('settings.myRates.referenceRate', 'Taux de référence plateforme')} : {data.referenceHourlyRate} €/h
                </Typography>
              </Box>
            </Box>

            {/* ── Forfaits par logement + nudge ── */}
            <Box>
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)', mb: 0.75 }}>
                {t('settings.myRates.flatSection', 'Forfaits par logement')}
              </Typography>
              {data.properties.length === 0 ? (
                <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)', fontStyle: 'italic' }}>
                  {t('settings.myRates.noProperties', 'Aucun logement accessible.')}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {data.properties.map((property) => {
                    const raw = flats[property.propertyId] ?? '';
                    const amount = raw.trim() !== '' && !isNaN(parseFloat(raw)) ? parseFloat(raw) : null;
                    return (
                      <Box key={property.propertyId} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        <Typography sx={{ flex: 1, minWidth: 140, fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                          {property.propertyName}
                        </Typography>
                        <TextField
                          type="number"
                          size="small"
                          value={raw}
                          placeholder={String(property.advisoryRecommended)}
                          onChange={(e) => setFlats((prev) => ({ ...prev, [property.propertyId]: e.target.value }))}
                          inputProps={{ min: 0, step: 1 }}
                          InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
                          sx={{ ...NUM_SX, width: 130 }}
                        />
                        <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {property.advisoryMin}–{property.advisoryMax} €
                        </Typography>
                        <RateNudge amount={amount} rate={property} />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            {saveMutation.isError && (
              <Alert severity="error">{t('users.ratesDialog.saveError', 'Enregistrement impossible.')}</Alert>
            )}
            {saved && !saveMutation.isPending && (
              <Alert severity="success">{t('users.ratesDialog.saved', 'Tarifs enregistrés.')}</Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>{t('common.close', 'Fermer')}</Button>
        <Button
          variant="contained"
          onClick={() => saveMutation.mutate()}
          disabled={ratesQuery.isPending || saveMutation.isPending || data == null}
        >
          {t('common.save', 'Enregistrer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
