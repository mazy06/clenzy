/* ============================================================
   <PriceAdjustmentModal> — ajustement tarifaire yield multi-segment

   Ouverte au clic sur « Ajuster les tarifs » d'une carte HITL PRICE_DROP.
   Présente les N créneaux proposés (plages + remises éditables, 3 modes de
   saisie), une PRÉVISION occupation/revenu (base→projeté) par segment et
   cumulée, puis applique les RateOverride (visibles dans « Prix dynamique »).
   ============================================================ */

import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { Close } from '../../../icons';
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
    return arr.flatMap((s: unknown) => {
      if (!s || typeof s !== 'object') return [];
      const seg = s as { from: string; to: string; percent?: number };
      return [{
        from: seg.from,
        to: seg.to,
        percent: Math.max(1, Math.min(50, Math.round(seg.percent ?? 12))),
      }];
    });
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

/** Couleur par segment (accents validés Clenzy), cyclée. */
const SEGMENT_COLORS = ['#4A9B8E', '#D4A574', '#7BA3C2', '#C97A7A', '#8E7BB5'];
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfMonth(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
/** Matrice de semaines (lundi→dimanche) couvrant le mois affiché, avec débords. */
function monthGrid(view: Date): Date[][] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // 0 = lundi
  const start = new Date(first);
  start.setDate(first.getDate() - lead);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let dow = 0; dow < 7; dow++) {
      week.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + dow));
    }
    weeks.push(week);
  }
  return weeks;
}

export function PriceAdjustmentModal({
  suggestionId, propertyId, actionParams, onClose, onApplied,
}: PriceAdjustmentModalProps) {
  const { t } = useTranslation();
  const [segments, setSegments] = useState<PriceSegment[]>(() => parseSegments(actionParams));
  // Sens de l'ajustement porté par la carte : "up" = hausse (demande forte), sinon baisse.
  const raise = useMemo(() => {
    try { return JSON.parse(actionParams ?? '{}')?.direction === 'up'; } catch { return false; }
  }, [actionParams]);
  const [mode, setMode] = useState<Mode>('percent');
  const [sim, setSim] = useState<PricingSimulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(segments[0]?.from ?? ymd(new Date())));

  const baselineAdr = (i: number): number | undefined => sim?.segments[i]?.baseline.adr;

  /** Index du segment couvrant un jour (ou -1). Plage [from, to) exclusive. */
  const segmentIndexOfDay = (d: Date): number => {
    const iso = ymd(d);
    return segments.findIndex((s) => iso >= s.from && iso < s.to);
  };

  const setPercent = (i: number, percent: number) => {
    setSegments((prev) => prev.map((s, idx) => (idx === i ? { ...s, percent } : s)));
  };

  /** Retire un créneau proposé (l'opérateur ne veut pas ajuster cette plage). */
  const removeSegment = (i: number) => {
    setSegments((prev) => prev.filter((_, idx) => idx !== i));
    setSim(null); // la prévision cumulée n'est plus à jour → forcer une re-simulation
  };

  /** Convertit la saisie du mode courant en % de baisse (borné 1–50). */
  const applyInput = (i: number, raw: number) => {
    const adr = baselineAdr(i);
    let percent = segments[i].percent;
    if (mode === 'percent') {
      percent = raw;
    } else if (adr && adr > 0) {
      // Magnitude (le sens est fixé par `raise`) : prix cible → écart au prix de base ;
      // montant fixe → delta € par nuit.
      if (mode === 'targetPrice') percent = (Math.abs(raw - adr) / adr) * 100;
      else percent = (raw / adr) * 100;
    }
    setPercent(i, Math.max(1, Math.min(50, Math.round(percent))));
  };

  /** Valeur affichée dans le champ selon le mode (dérivée de percent + ADR + sens). */
  const inputValue = (i: number): number => {
    const adr = baselineAdr(i);
    const pct = segments[i].percent;
    if (mode === 'percent' || !adr) return pct;
    if (mode === 'targetPrice') return Math.round(adr * (1 + (raise ? 1 : -1) * pct / 100));
    return Math.round(adr * (pct / 100)); // delta € (magnitude)
  };

  const runSimulate = async () => {
    setSimulating(true);
    setError(null);
    try {
      setSim(await pricingApi.simulate(propertyId, segments, raise ? 'up' : 'down'));
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
      await pricingApi.applyCustom(suggestionId, segments, raise ? 'up' : 'down');
      onApplied();
    } catch {
      setError(t('supervision.price.applyError', "L'application des tarifs a échoué."));
      setApplying(false);
    }
  };

  // Auto-simulation à l'ouverture : l'ADR de base est dispo immédiatement, donc les modes
  // « prix cible » / « −€ » sont convertibles sans attendre un clic « Simuler ».
  useEffect(() => {
    if (segments.length > 0) void runSimulate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modeUnit = mode === 'percent' ? '%' : '€';
  const canConvert = mode === 'percent' || sim != null;
  const totalNights = useMemo(() => segments.reduce((n, s) => n + nights(s.from, s.to), 0), [segments]);
  // Deux mois consécutifs affichés côte à côte (navigation par pas de 1 mois).
  const months = useMemo(
    () => [viewMonth, new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)],
    [viewMonth],
  );

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
        {raise
          ? t('supervision.price.titleRaise', 'Relever les tarifs (demande forte)')
          : t('supervision.price.title', 'Ajuster les tarifs des créneaux creux')}
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
          {t('supervision.price.subtitle', '{{count}} créneau(x) · {{nights}} nuits', {
            count: segments.length, nights: totalNights,
          })}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {/* Calendrier DEUX MOIS côte à côte : les créneaux proposés, une couleur par segment. */}
        <Box sx={{ display: 'flex', gap: 2.5, mb: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
          {months.map((month, mi) => (
            <Box key={mi} sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                {mi === 0 ? (
                  <Button
                    size="small"
                    onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    sx={{ minWidth: 30, textTransform: 'none', color: 'text.secondary' }}
                    aria-label={t('common.previous', 'Précédent')}
                  >
                    ‹
                  </Button>
                ) : <Box sx={{ width: 30 }} />}
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize' }}>
                  {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </Typography>
                {mi === months.length - 1 ? (
                  <Button
                    size="small"
                    onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    sx={{ minWidth: 30, textTransform: 'none', color: 'text.secondary' }}
                    aria-label={t('common.next', 'Suivant')}
                  >
                    ›
                  </Button>
                ) : <Box sx={{ width: 30 }} />}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {WEEKDAYS.map((d) => (
                  <Box key={`wd-${mi}-${d}`} sx={{ textAlign: 'center', fontSize: 10, color: 'text.secondary', pb: 0.25 }}>{d}</Box>
                ))}
                {monthGrid(month).flat().map((day) => {
                  const inMonth = day.getMonth() === month.getMonth();
                  const segIdx = segmentIndexOfDay(day);
                  const color = segIdx >= 0 ? SEGMENT_COLORS[segIdx % SEGMENT_COLORS.length] : undefined;
                  return (
                    <Box
                      key={`d-${mi}-${day.getTime()}`}
                      sx={{
                        textAlign: 'center', fontSize: 11, py: 0.5, borderRadius: 1,
                        fontVariantNumeric: 'tabular-nums',
                        color: color ? '#fff' : inMonth ? 'text.primary' : 'text.disabled',
                        bgcolor: color ?? 'transparent',
                        opacity: inMonth ? 1 : 0.4,
                      }}
                    >
                      {day.getDate()}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>

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
            <ToggleButton value="fixedAmount" sx={{ textTransform: 'none', px: 1.25 }}>{raise ? '+€' : '−€'}</ToggleButton>
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
                    aria-label={t('supervision.price.segmentFrom', 'Date de début')}
                    value={seg.from}
                    onChange={(e) => setSegments((p) => p.map((s, idx) => idx === i ? { ...s, from: e.target.value } : s))}
                    style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line, #ccc)' }}
                  />
                  <Box sx={{ color: 'text.secondary', fontSize: 12 }}>→</Box>
                  <input
                    type="date"
                    aria-label={t('supervision.price.segmentTo', 'Date de fin')}
                    value={seg.to}
                    onChange={(e) => setSegments((p) => p.map((s, idx) => idx === i ? { ...s, to: e.target.value } : s))}
                    style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line, #ccc)' }}
                  />
                  <Box sx={{ flex: 1 }} />
                  <input
                    type="number"
                    aria-label={t('supervision.price.segmentValue', 'Valeur de la remise')}
                    value={inputValue(i)}
                    disabled={!canConvert}
                    onChange={(e) => applyInput(i, Number(e.target.value))}
                    style={{ width: 76, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line, #ccc)', textAlign: 'right' }}
                  />
                  <Box sx={{ fontSize: 12.5, color: 'text.secondary', width: 16 }}>{modeUnit}</Box>
                  <IconButton
                    size="small"
                    onClick={() => removeSegment(i)}
                    aria-label={t('supervision.price.removeSegment', 'Retirer ce créneau')}
                    sx={{ color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: 'transparent' } }}
                  >
                    <Close size={15} />
                  </IconButton>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                  <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                    {fmt(seg.from)}→{fmt(seg.to)} · {nights(seg.from, seg.to)} {t('supervision.price.nights', 'nuits')} · {raise ? '+' : '−'}{seg.percent}%
                  </Typography>
                </Box>
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
