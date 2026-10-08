/* ============================================================
   <PriceAdjustmentModal> — ajustement tarifaire yield multi-segment

   Ouverte au clic sur « Ajuster les tarifs » d'une carte HITL PRICE_DROP.
   Présente les N créneaux proposés (plages + remises éditables, 3 modes de
   saisie), une PRÉVISION occupation/revenu (base→projeté) par segment et
   cumulée, puis applique les RateOverride (visibles dans « Prix dynamique »).
   ============================================================ */

import { ActionModalContent, ActionModalHeader, ActionModalBody, ActionModalFooter, ActionModalFacts, ActionModalSection } from './ActionModal';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  Input,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
} from '../../../components/ui';
import { TriangleAlert } from '../../../icons/glyphs';
import { ChevronLeft, ChevronRight, Close } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';
import { Money } from '../../../components/Money';
import { pricingApi, type PriceSegment, type PricingSimulation } from '../pricingApi';
import { consequencesOf } from './actionRegistry';
import { intlLocale } from '../../../utils/localeDate';
import { isoDay } from '../core/actionDescription';

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
      if (isoDay(seg.from) == null || isoDay(seg.to) == null || seg.to <= seg.from) return [];
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

/** Nombre de nuits [from, to). */
function nights(from: string, to: string): number {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}


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
  const { t, currentLanguage } = useTranslation();
  const locale = intlLocale(currentLanguage);
  const [segments, setSegments] = useState<PriceSegment[]>(() => parseSegments(actionParams));
  // Sens de l'ajustement porté par la carte : "up" = hausse (demande forte), sinon baisse.
  const raise = useMemo(() => {
    try { return JSON.parse(actionParams ?? '{}')?.direction === 'up'; } catch { return false; }
  }, [actionParams]);
  const [mode, setMode] = useState<Mode>('percent');
  const [sim, setSim] = useState<PricingSimulation | null>(null);
  const [simKey, setSimKey] = useState('');
  const currentKey = JSON.stringify(segments);
  const freshSimulation = simKey === currentKey ? sim : null;
  const validSegments = segments.length > 0 && segments.every((s) => isoDay(s.from) != null && isoDay(s.to) != null && s.to > s.from && Number.isFinite(s.percent));
  const [simulating, setSimulating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(segments[0]?.from ?? ymd(new Date())));

  const baselineAdr = (i: number): number | undefined => sim?.segments.find((s) => s.from === segments[i].from && s.to === segments[i].to)?.baseline.adr;

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
    if (!validSegments) return;
    setSimulating(true);
    setError(null);
    try {
      const result = await pricingApi.simulate(propertyId, segments, raise ? 'up' : 'down');
      setSim(result);
      setSimKey(currentKey);
    } catch {
      setError(t('supervision.price.simError', 'Simulation impossible pour le moment.'));
    } finally {
      setSimulating(false);
    }
  };

  const runApply = async () => {
    if (!validSegments) return;
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
  const canConvert = mode === 'percent' || segments.every((_, i) => baselineAdr(i) != null);
  const totalNights = useMemo(() => segments.reduce((n, s) => n + (
    isoDay(s.from) != null && isoDay(s.to) != null && s.to > s.from ? nights(s.from, s.to) : 0
  ), 0), [segments]);
  // Deux mois consécutifs affichés côte à côte (navigation par pas de 1 mois).
  const months = useMemo(
    () => [viewMonth, new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)],
    [viewMonth],
  );

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !applying) onClose(); }}>
      <ActionModalContent className="sm:max-w-[900px]">
        <ActionModalHeader agentId="rev" title={raise
              ? t('supervision.price.titleRaise', 'Relever les tarifs (demande forte)')
              : t('supervision.price.title', 'Ajuster les tarifs des créneaux creux')} description={t('supervision.price.subtitle', '{{count}} créneau(x) · {{nights}} nuits', {
              count: segments.length, nights: totalNights,
            })} />
        <ActionModalBody>

        {/* Two months on desktop, one on mobile; navy marks the affected nights. */}
        <div className="flex gap-[15px] mb-[9px] flex-col min-[600px]:flex-row">
          {months.map((month, mi) => (
            <div className="flex-1 min-w-0" key={mi} data-price-month={mi}>
              <div className="flex items-center justify-between mb-0.5">
                {mi === 0 ? (
                  // Navigation repetee dans un en-tete : tertiaire, gabarit carre.
                  // Le chevron se retourne en RTL (sens de lecture inverse).
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    className="text-muted-foreground"
                    aria-label={t('common.previous', 'Précédent')}
                  >
                    <ChevronLeft size={16} className="rtl:rotate-180" />
                  </Button>
                ) : <div className="w-[30px]" />}
                <p className="text-xs font-semibold capitalize text-foreground">
                  {month.toLocaleDateString(locale, { month: 'long', year: 'numeric', calendar: 'gregory' })}
                </p>
                {mi === months.length - 1 || mi === 0 ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    className={cn('text-muted-foreground', mi === 0 && 'sm:invisible')}
                    aria-label={t('common.next', 'Suivant')}
                  >
                    <ChevronRight size={16} className="rtl:rotate-180" />
                  </Button>
                ) : <div className="w-[30px]" />}
              </div>
              <div className="grid grid-cols-[repeat(7,_1fr)] gap-0.5">
                {Array.from({ length: 7 }, (_, d) => (
                  <div className="text-center text-2xs font-medium text-muted-foreground pb-0.5" key={`wd-${mi}-${d}`}>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2026, 8, 28 + d))}</div>
                ))}
                {monthGrid(month).flat().map((day) => {
                  const inMonth = day.getMonth() === month.getMonth();
                  const segIdx = segmentIndexOfDay(day);
                  const highlighted = segIdx >= 0 && inMonth;
                  return (
                    <div
                      key={`d-${mi}-${day.getTime()}`}
                      className={cn(
                        'rounded-md py-[3px] text-center text-xs tabular-nums',
                        inMonth ? 'opacity-100' : 'opacity-40',
                        !highlighted && 'text-muted-foreground',
                      )}
                      style={highlighted ? { backgroundColor: 'var(--bui-supervision-navy)', color: 'var(--bui-supervision-on-navy)' } : undefined}
                    >
                      {new Intl.NumberFormat(locale).format(day.getDate())}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sélecteur de mode de saisie de la remise */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {t('supervision.modal.adjustmentMode', 'Ajustement en')}
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
            <p className="text-xs font-medium text-warning-ink">
              {t('supervision.price.simulateFirst', 'Simulez pour convertir')}
            </p>
          )}
        </div>

        <p className="baitly-action-modal-note">{t('supervision.modal.exclusiveEnd', 'La date de fin est exclue : seules les nuits précédentes seront ajustées.')}</p>
        <div>
          {segments.map((seg, i) => {
            const f = freshSimulation?.segments[i];
            const invalidDates = isoDay(seg.from) == null || isoDay(seg.to) == null || seg.to <= seg.from;
            return (
              <section className="baitly-price-segment" key={i}>
                <div className="baitly-price-segment-heading">
                  <span>{t('supervision.modal.period', 'Créneau {{n}}', { n: i + 1 })}</span>
                  {!invalidDates && <span className="font-normal text-muted-foreground tabular-nums">· {t('supervision.price.preview.nights', { count: nights(seg.from, seg.to) })}</span>}
                  <strong className="ms-auto text-[var(--bui-supervision-ink)] tabular-nums"><bdi dir="ltr">{raise ? '+' : '−'}{seg.percent}%</bdi></strong>
                </div>
                <div className="baitly-price-fields">
                  <label>{t('supervision.price.segmentFrom', 'Date de début')}
                    <Input type="date" value={seg.from} disabled={applying}
                      aria-invalid={invalidDates}
                      onChange={(e) => setSegments((p) => p.map((s, idx) => idx === i ? { ...s, from: e.target.value } : s))} />
                  </label>
                  <label>{t('supervision.modal.endExclusive', 'Fin (exclue)')}
                    <Input type="date" value={seg.to} disabled={applying}
                      aria-invalid={invalidDates}
                      onChange={(e) => setSegments((p) => p.map((s, idx) => idx === i ? { ...s, to: e.target.value } : s))} />
                  </label>
                  <label>{t('supervision.modal.adjustment', 'Ajustement')} ({modeUnit})
                    <Input type="number" value={inputValue(i)} disabled={!canConvert || applying}
                      min={mode === 'percent' ? 1 : 0} max={mode === 'percent' ? 50 : undefined}
                      onChange={(e) => applyInput(i, Number(e.target.value))} />
                  </label>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeSegment(i)} disabled={applying}
                    aria-label={t('supervision.price.removeSegment', 'Retirer ce créneau')}>
                    <Close size={15} />
                  </Button>
                </div>
                {f && <div className="baitly-price-forecast">
                  <div><span>{t('supervision.price.occ', 'Occupation')} </span>{Math.round(f.baseline.occupancyRate * 100)}% → <strong>{Math.round(f.scenario.occupancyRate * 100)}%</strong></div>
                  <div><span>{t('supervision.modal.revenueChange', 'Variation de revenu')} </span><Money value={f.deltaRevenue} from="EUR" decimals={0} /></div>
                </div>}
              </section>
            );
          })}
        </div>
        {!validSegments && <p role="status" className="text-sm text-destructive-ink">{t('supervision.modal.invalidPeriods', 'Conservez au moins un créneau avec une date de fin postérieure à la date de début.')}</p>}
        {sim && !freshSimulation && <p role="status" className="baitly-action-modal-note">{t('supervision.modal.staleForecast', 'Les créneaux ont changé. Relancez la simulation pour actualiser la prévision.')}</p>}
        {freshSimulation && <section className="baitly-price-total" aria-live="polite">
          <h3 className="text-sm font-medium">{t('supervision.price.forecastTotal', 'Prévision cumulée')}</h3>
          <dl>
            <div><dt>{t('supervision.modal.before', 'Avant ajustement')}</dt><dd><Money value={freshSimulation.totalBaselineRevenue} from="EUR" decimals={0} /></dd></div>
            <div><dt>{t('supervision.modal.projected', 'Après ajustement · estimé')}</dt><dd className="font-semibold text-[var(--bui-supervision-ink)]"><Money value={freshSimulation.totalScenarioRevenue} from="EUR" decimals={0} /></dd></div>
            <div><dt>{t('supervision.modal.revenueChange', 'Variation de revenu')}</dt><dd className={freshSimulation.totalDeltaRevenue >= 0 ? 'text-success-ink' : 'text-destructive-ink'}>{freshSimulation.totalDeltaRevenue >= 0 ? '+' : ''}<Money value={freshSimulation.totalDeltaRevenue} from="EUR" decimals={0} /></dd></div>
          </dl>
        </section>}
        <ActionModalSection title={t('supervision.modal.consequences', 'Ce qui va se passer')}>
          <ActionModalFacts facts={consequencesOf('PRICE_DROP').map((line) => t(line.key, line.fallback))} />
        </ActionModalSection>

        {error && (
          <Alert variant="destructive" className="mt-1.5">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        </ActionModalBody>
        <ActionModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={applying}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="outline"
            onClick={runSimulate}
            disabled={simulating || applying || !validSegments}
          >
            {simulating && <Spinner className="size-3.5" aria-hidden aria-label={undefined} role={undefined} />}
            {t('supervision.price.simulate', 'Simuler')}
          </Button>
          <Button
            onClick={runApply}
            disabled={applying || !validSegments}
          >
            {applying && <Spinner className="size-3.5" aria-hidden aria-label={undefined} role={undefined} />}
            {t('supervision.price.apply', 'Appliquer les tarifs')}
          </Button>
        </ActionModalFooter>
      </ActionModalContent>
    </Dialog>
  );
}
