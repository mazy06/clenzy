/* ============================================================
   <PriceAdjustmentModal> — ajustement tarifaire yield multi-segment

   Ouverte au clic sur « Ajuster les tarifs » d'une carte HITL PRICE_DROP.
   Présente les N créneaux proposés (plages + remises éditables, 3 modes de
   saisie), une PRÉVISION occupation/revenu (base→projeté) par segment et
   cumulée, puis applique les RateOverride (visibles dans « Prix dynamique »).
   ============================================================ */

import { useMemo, useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useTranslation } from '../../../hooks/useTranslation';
import { Money } from '../../../components/Money';
import { pricingApi, type PriceSegment, type PricingSimulation } from '../pricingApi';

type Mode = 'percent' | 'targetPrice' | 'fixedAmount';

export interface PriceAdjustmentModalProps {
  /** id de la suggestion (clé apply-custom). */
  suggestionId: string;
  /** logement concerné (clé simulate). */
  propertyId: number;
  /** params bruts de la carte : {"segments":[{from,to,percent}, …]}. */
  actionParams?: string;
  onClose: () => void;
  /** Appelé après application réussie (le parent retire la carte). */
  onApplied: () => void;
}

function parseSegments(actionParams?: string): PriceSegment[] {
  if (!actionParams) return [];
  try {
    const parsed = JSON.parse(actionParams);
    const arr = Array.isArray(parsed?.segments)
      ? parsed.segments
      : parsed?.from && parsed?.to
        ? [parsed] // rétro-compat mono-segment
        : [];
    return arr
      .filter((s: unknown) => s && typeof s === 'object')
      .map((s: { from: string; to: string; percent?: number }) => ({
        from: s.from,
        to: s.to,
        percent: Math.max(1, Math.min(50, Math.round(s.percent ?? 12))),
      }));
  } catch {
    return [];
  }
}

/** dd/MM d'une date ISO (affichage compact). */
function fmt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
/** Nombre de nuits [from, to). */
function nights(from: string, to: string): number {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}

export function PriceAdjustmentModal({
  suggestionId, propertyId, actionParams, onClose, onApplied,
}: PriceAdjustmentModalProps) {
  const { t } = useTranslation();
  const [segments, setSegments] = useState<PriceSegment[]>(() => parseSegments(actionParams));
  const [mode, setMode] = useState<Mode>('percent');
  const [sim, setSim] = useState<PricingSimulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baselineAdr = (i: number): number | undefined => sim?.segments[i]?.baseline.adr;

  const setPercent = (i: number, percent: number) => {
    setSegments((prev) => prev.map((s, idx) => (idx === i ? { ...s, percent } : s)));
  };

  /** Convertit la saisie du mode courant en % de baisse (borné 1–50). */
  const applyInput = (i: number, raw: number) => {
    const adr = baselineAdr(i);
    let percent = segments[i].percent;
    if (mode === 'percent') {
      percent = raw;
    } else if (adr && adr > 0) {
      if (mode === 'targetPrice') percent = ((adr - raw) / adr) * 100; // prix cible
      else percent = (raw / adr) * 100; // montant fixe −€
    }
    setPercent(i, Math.max(1, Math.min(50, Math.round(percent))));
  };

  /** Valeur affichée dans le champ selon le mode (dérivée de percent + ADR). */
  const inputValue = (i: number): number => {
    const adr = baselineAdr(i);
    const pct = segments[i].percent;
    if (mode === 'percent' || !adr) return pct;
    if (mode === 'targetPrice') return Math.round(adr * (1 - pct / 100));
    return Math.round(adr * (pct / 100)); // −€
  };

  const runSimulate = async () => {
    setSimulating(true);
    setError(null);
    try {
      setSim(await pricingApi.simulate(propertyId, segments));
    } catch {
      setError(t('supervision.price.simError', 'Simulation impossible pour le moment.'));
    } finally {
      setSimulating(false);
    }
  };

  const runApply = async () => {
    setApplying(true);
    setError(null);
    try {
      await pricingApi.applyCustom(suggestionId, segments);
      onApplied();
    } catch {
      setError(t('supervision.price.applyError', "L'application des tarifs a échoué."));
      setApplying(false);
    }
  };

  const modeUnit = mode === 'percent' ? '%' : '€';
  const canConvert = mode === 'percent' || sim != null;
  const totalNights = useMemo(() => segments.reduce((n, s) => n + nights(s.from, s.to), 0), [segments]);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
        {t('supervision.price.title', 'Ajuster les tarifs des créneaux creux')}
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
          {t('supervision.price.subtitle', '{{count}} créneau(x) · {{nights}} nuits', {
            count: segments.length, nights: totalNights,
          })}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {/* Sélecteur de mode de saisie de la remise */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
            {t('supervision.price.discountMode', 'Remise en')}
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={(_, m) => m && setMode(m)}
          >
            <ToggleButton value="percent" sx={{ textTransform: 'none', px: 1.25 }}>%</ToggleButton>
            <ToggleButton value="targetPrice" sx={{ textTransform: 'none', px: 1.25 }}>
              {t('supervision.price.modeTarget', 'Prix cible')}
            </ToggleButton>
            <ToggleButton value="fixedAmount" sx={{ textTransform: 'none', px: 1.25 }}>−€</ToggleButton>
          </ToggleButtonGroup>
          {!canConvert && (
            <Typography sx={{ fontSize: 11, color: 'warning.main' }}>
              {t('supervision.price.simulateFirst', 'Simulez pour convertir')}
            </Typography>
          )}
        </Box>

        {/* Segments éditables */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {segments.map((seg, i) => {
            const f = sim?.segments[i];
            return (
              <Box
                key={i}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={seg.from}
                    onChange={(e) => setSegments((p) => p.map((s, idx) => idx === i ? { ...s, from: e.target.value } : s))}
                    style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line, #ccc)' }}
                  />
                  <Box sx={{ color: 'text.secondary', fontSize: 12 }}>→</Box>
                  <input
                    type="date"
                    value={seg.to}
                    onChange={(e) => setSegments((p) => p.map((s, idx) => idx === i ? { ...s, to: e.target.value } : s))}
                    style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line, #ccc)' }}
                  />
                  <Box sx={{ flex: 1 }} />
                  <input
                    type="number"
                    value={inputValue(i)}
                    disabled={!canConvert}
                    onChange={(e) => applyInput(i, Number(e.target.value))}
                    style={{ width: 76, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line, #ccc)', textAlign: 'right' }}
                  />
                  <Box sx={{ fontSize: 12.5, color: 'text.secondary', width: 16 }}>{modeUnit}</Box>
                </Box>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.5 }}>
                  {fmt(seg.from)}→{fmt(seg.to)} · {nights(seg.from, seg.to)} {t('supervision.price.nights', 'nuits')} · −{seg.percent}%
                </Typography>
                {f && (
                  <Typography sx={{ fontSize: 11.5, color: 'text.primary', mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                    {t('supervision.price.occ', 'Occupation')} {Math.round(f.baseline.occupancyRate * 100)}%
                    {' → '}<b>{Math.round(f.scenario.occupancyRate * 100)}%</b>
                    {'  ·  '}{t('supervision.price.revenue', 'Revenu')} <Money value={f.deltaRevenue} from="EUR" decimals={0} />
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Cumul de la prévision */}
        {sim && (
          <Box sx={{ mt: 1.5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>
              {t('supervision.price.forecastTotal', 'Prévision cumulée')}
            </Typography>
            <Typography sx={{ fontSize: 12.5, mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>
              {t('supervision.price.revenue', 'Revenu')} <Money value={sim.totalBaselineRevenue} from="EUR" decimals={0} />
              {' → '}<b><Money value={sim.totalScenarioRevenue} from="EUR" decimals={0} /></b>
              {'  ('}
              <Box component="span" sx={{ color: sim.totalDeltaRevenue >= 0 ? 'success.main' : 'error.main' }}>
                {sim.totalDeltaRevenue >= 0 ? '+' : ''}<Money value={sim.totalDeltaRevenue} from="EUR" decimals={0} />
              </Box>
              {')'}
            </Typography>
          </Box>
        )}

        {error && <Typography sx={{ fontSize: 12, color: 'error.main', mt: 1 }}>{error}</Typography>}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }} disabled={applying}>
          {t('common.cancel', 'Annuler')}
        </Button>
        <Button
          onClick={runSimulate}
          variant="outlined"
          disabled={simulating || applying || segments.length === 0}
          startIcon={simulating ? <CircularProgress size={14} /> : undefined}
          sx={{ textTransform: 'none' }}
        >
          {t('supervision.price.simulate', 'Simuler')}
        </Button>
        <Button
          onClick={runApply}
          variant="contained"
          disableElevation
          disabled={applying || segments.length === 0}
          startIcon={applying ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {t('supervision.price.apply', 'Appliquer les tarifs')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
