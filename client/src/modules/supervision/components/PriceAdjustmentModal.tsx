/* ============================================================
   <PriceAdjustmentModal> — ajustement tarifaire yield multi-segment

   Ouverte au clic sur « Ajuster les tarifs » d'une carte HITL PRICE_DROP.
   Présente les N créneaux proposés (plages + remises éditables, 3 modes de
   saisie), une PRÉVISION occupation/revenu (base→projeté) par segment et
   cumulée, puis applique les RateOverride (visibles dans « Prix dynamique »).
   ============================================================ */

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
} from '../../../components/ui';
import { Close } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
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
    // maxWidth="md" MUI = 900 px ; `fullWidth` est deja le defaut du gabarit du kit.
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-extrabold">
            {raise
              ? t('supervision.price.titleRaise', 'Relever les tarifs (demande forte)')
              : t('supervision.price.title', 'Ajuster les tarifs des créneaux creux')}
          </DialogTitle>
          <DialogDescription className="text-[12.5px]">
            {t('supervision.price.subtitle', '{{count}} créneau(x) · {{nights}} nuits', {
              count: segments.length, nights: totalNights,
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Calendrier DEUX MOIS côte à côte : les créneaux proposés, une couleur par segment. */}
        <div className="flex gap-[15px] mb-[9px] flex-col min-[600px]:flex-row">
          {months.map((month, mi) => (
            <div className="flex-1 min-w-0" key={mi}>
              <div className="flex items-center justify-between mb-0.5">
                {mi === 0 ? (
                  // Navigation repetee dans un en-tete : tertiaire, gabarit carre.
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    className="text-[var(--muted)]"
                    aria-label={t('common.previous', 'Précédent')}
                  >
                    ‹
                  </Button>
                ) : <div className="w-[30px]" />}
                <p className="cn-text-body1 text-[12.5px] font-bold capitalize">
                  {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </p>
                {mi === months.length - 1 ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    className="text-[var(--muted)]"
                    aria-label={t('common.next', 'Suivant')}
                  >
                    ›
                  </Button>
                ) : <div className="w-[30px]" />}
              </div>
              <div className="grid grid-cols-[repeat(7,_1fr)] gap-0.5">
                {WEEKDAYS.map((d) => (
                  <div className="text-center text-[10px] text-muted-foreground pb-0.5" key={`wd-${mi}-${d}`}>{d}</div>
                ))}
                {monthGrid(month).flat().map((day) => {
                  const inMonth = day.getMonth() === month.getMonth();
                  const segIdx = segmentIndexOfDay(day);
                  const color = segIdx >= 0 ? SEGMENT_COLORS[segIdx % SEGMENT_COLORS.length] : undefined;
                  return (
                    <div
                      key={`d-${mi}-${day.getTime()}`}
                      className={cn(
                        'rounded-[8px] py-[3px] text-center text-[11px] tabular-nums',
                        inMonth ? 'opacity-100' : 'opacity-40',
                        color ? 'text-white' : inMonth ? 'text-[var(--ink)]' : 'text-[var(--faint)]',
                      )}
                      // La teinte du segment n'est connue qu'a l'execution.
                      style={{ backgroundColor: color ?? 'transparent' }}
                    >
                      {day.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sélecteur de mode de saisie de la remise */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <p className="cn-text-body1 text-[12.5px] text-muted-foreground">
            {t('supervision.price.discountMode', 'Remise en')}
          </p>
          {/* `exclusive` MUI = type="single" ; Radix renvoie '' a la deselection,
              d'ou le garde qui conserve le mode courant. */}
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={mode}
            onValueChange={(m) => m && setMode(m as Mode)}
          >
            <ToggleGroupItem value="percent" aria-label="%">%</ToggleGroupItem>
            <ToggleGroupItem value="targetPrice">
              {t('supervision.price.modeTarget', 'Prix cible')}
            </ToggleGroupItem>
            <ToggleGroupItem value="fixedAmount">{raise ? '+€' : '−€'}</ToggleGroupItem>
          </ToggleGroup>
          {!canConvert && (
            <p className="cn-text-body1 text-[11px] text-[var(--bui-warning-ink)]">
              {t('supervision.price.simulateFirst', 'Simulez pour convertir')}
            </p>
          )}
        </div>

        {/* Segments éditables */}
        <div className="flex flex-col gap-1.5">
          {segments.map((seg, i) => {
            const f = sim?.segments[i];
            return (
              <div className="border border-[var(--line)] rounded-[1.5px] p-2" key={i}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="date"
                    aria-label={t('supervision.price.segmentFrom', 'Date de début')}
                    value={seg.from}
                    onChange={(e) => setSegments((p) => p.map((s, idx) => idx === i ? { ...s, from: e.target.value } : s))}
                    style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line, #ccc)' }}
                  />
                  <div className="text-muted-foreground text-[12px]">→</div>
                  <input
                    type="date"
                    aria-label={t('supervision.price.segmentTo', 'Date de fin')}
                    value={seg.to}
                    onChange={(e) => setSegments((p) => p.map((s, idx) => idx === i ? { ...s, to: e.target.value } : s))}
                    style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line, #ccc)' }}
                  />
                  <div className="flex-1" />
                  <input
                    type="number"
                    aria-label={t('supervision.price.segmentValue', 'Valeur de la remise')}
                    value={inputValue(i)}
                    disabled={!canConvert}
                    onChange={(e) => applyInput(i, Number(e.target.value))}
                    style={{ width: 76, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line, #ccc)', textAlign: 'right' }}
                  />
                  <div className="text-[12.5px] text-muted-foreground w-[16px]">{modeUnit}</div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeSegment(i)}
                    aria-label={t('supervision.price.removeSegment', 'Retirer ce créneau')}
                    className="text-[var(--faint)] hover:bg-transparent hover:text-[var(--err)]"
                  >
                    <Close size={15} />
                  </Button>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-[8px] h-[8px] rounded-[50%] shrink-0" style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                  <p className="cn-text-body1 text-[11.5px] text-muted-foreground">
                    {fmt(seg.from)}→{fmt(seg.to)} · {nights(seg.from, seg.to)} {t('supervision.price.nights', 'nuits')} · {raise ? '+' : '−'}{seg.percent}%
                  </p>
                </div>
                {f && (
                  <p className="cn-text-body1 text-[11.5px] text-foreground mt-0.5 tabular-nums">
                    {t('supervision.price.occ', 'Occupation')} {Math.round(f.baseline.occupancyRate * 100)}%
                    {' → '}<b>{Math.round(f.scenario.occupancyRate * 100)}%</b>
                    {'  ·  '}{t('supervision.price.revenue', 'Revenu')} <Money value={f.deltaRevenue} from="EUR" decimals={0} />
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Cumul de la prévision */}
        {sim && (
          <div className="mt-2 p-2 bg-[var(--hover)] rounded-[1.5px]">
            <p className="cn-text-body1 text-[12.5px] font-bold">
              {t('supervision.price.forecastTotal', 'Prévision cumulée')}
            </p>
            <p className="cn-text-body1 text-[12.5px] mt-0.5 tabular-nums">
              {t('supervision.price.revenue', 'Revenu')} <Money value={sim.totalBaselineRevenue} from="EUR" decimals={0} />
              {' → '}<b><Money value={sim.totalScenarioRevenue} from="EUR" decimals={0} /></b>
              {'  ('}
              <span className={sim.totalDeltaRevenue >= 0 ? 'text-[#4A9B8E]' : 'text-[#C97A7A]'}>
                {sim.totalDeltaRevenue >= 0 ? '+' : ''}<Money value={sim.totalDeltaRevenue} from="EUR" decimals={0} />
              </span>
              {')'}
            </p>
          </div>
        )}

        {error && <p className="cn-text-body1 text-[12px] text-destructive mt-1.5">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={applying}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="outline"
            onClick={runSimulate}
            disabled={simulating || applying || segments.length === 0}
          >
            {simulating && <Spinner className="size-3.5" />}
            {t('supervision.price.simulate', 'Simuler')}
          </Button>
          <Button
            onClick={runApply}
            disabled={applying || segments.length === 0}
          >
            {applying && <Spinner className="size-3.5" />}
            {t('supervision.price.apply', 'Appliquer les tarifs')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
