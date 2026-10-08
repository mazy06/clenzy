import { useState, type CSSProperties } from 'react';
import {
  Bed, Brush, CalendarDays, Check, CheckCheck, ClipboardCheck, DoorOpen, Download, FileText, GitCompare,
  Luggage, Mail, MessageSquare, Moon, Send, Users, Wrench, Euro,
} from '../../icons/glyphs';
import { StageCard } from '../baitly/NightStage';
import { useTranslation } from '../../hooks/useTranslation';
import airbnbLogo from '../../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../assets/logo/booking-logo-small.svg';
import type { DemoKind } from './catalog';

const ROWS = [0, 1, 2] as const;
const TIMES = ['10:00', '14:00', '16:00'] as const;

/**
 * Aperçus des modules : un schéma par famille d'écran (frise, colonnes d'état,
 * semaine, feuille, fil de messages, graphique…).
 *
 * Le texte se limite aux libellés déjà courts de l'écran (trois par aperçu) ;
 * le reste est dessiné — barres, icônes, logos, montants. Exemples isolés : aucun
 * client API, aucune écriture de données métier.
 */
export default function ModuleFirstUseDemo({ kind, prefix, scene, onSelect }: {
  kind: DemoKind;
  prefix: string;
  scene: number;
  onSelect: (scene: number) => void;
}) {
  const { t, currentLanguage } = useTranslation();
  const [comparison, setComparison] = useState(false);
  const number = (value: number) => value.toLocaleString(currentLanguage);
  const money = (value: number) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  const label = (row: number) => t(`${prefix}.labels.${row}`);
  const isReportDocument = kind === 'document' && (prefix.endsWith('.reports') || prefix.endsWith('.custom'));
  const documentValues = prefix.endsWith('.billing.reports')
    ? [t('moduleFirstUse.demo.period'), money(48), 'CSV']
    : [t('moduleFirstUse.demo.owner'), t('moduleFirstUse.demo.sectionReady'), 'PDF'];
  const owner = t('moduleFirstUse.demo.owner');
  const initials = owner.split(/\s+/).map((part) => part[0]).join('').slice(0, 2);

  return (
    <StageCard className="mu-card" aside={kind === 'chart' || kind === 'occupancy' ? (
      <button type="button" className="mu-compare" aria-pressed={comparison}
        aria-label={t(`moduleFirstUse.demo.${comparison ? 'referencePeriod' : 'comparePeriod'}`)}
        onClick={() => { setComparison((value) => !value); onSelect(1); }}>
        <GitCompare aria-hidden />
      </button>
    ) : undefined}>
      <div data-kind={kind}>
        {/* ── Séjour : une frise arrivée → séjour → départ ── */}
        {kind === 'reservation' && <>
          <div className="flex items-center gap-3">
            <span className="mu-avatar" aria-hidden>{initials}</span>
            <span className="min-w-0 flex-1"><strong className="mu-name">{owner}</strong><span className="ns-bar mt-1.5 block w-2/5" /></span>
            <span className="ns-chip" aria-hidden><Moon />{number(3)}</span>
            <img src={scene === 1 ? bookingLogo : airbnbLogo} alt="" className="size-6 rounded-md bg-white object-contain p-0.5" />
          </div>
          <ol className="mu-timeline">
            {ROWS.map((row) => <li key={row}>
              <button type="button" className="mu-step" data-active={scene === row} aria-pressed={scene === row} onClick={() => onSelect(row)}>
                <span className="mu-step-dot">{[<DoorOpen key="in" />, <Bed key="stay" />, <Luggage key="out" />][row]}</span>
                <span className="mu-step-label">{label(row)}</span>
                <time>{TIMES[row]}</time>
              </button>
            </li>)}
          </ol>
          <div className="mt-3 flex items-center gap-2">
            <span className="ns-chip"><Euro aria-hidden />{money(450)}</span>
            <span className="ns-bar flex-1" />
            <Check className="size-4 text-[#2DD4BF]" aria-hidden />
          </div>
        </>}

        {/* ── Missions : la carte voyage d'une colonne d'état à l'autre ── */}
        {kind === 'tasks' && <>
          <div className="flex items-center gap-3">
            <span className="mu-avatar" aria-hidden><Wrench className="size-4" /></span>
            <span className="min-w-0 flex-1"><strong className="mu-name">{t('moduleFirstUse.demo.property')}</strong><span className="ns-bar mt-1.5 block w-1/2" /></span>
            <span className="ns-chip" aria-hidden><Users />{number(1)}</span>
          </div>
          <div className="mu-kanban" role="group">
            {ROWS.map((col) => (
              <button key={col} type="button" className="mu-col text-start" data-active={scene === col} aria-pressed={scene === col} onClick={() => onSelect(col)}>
                <span className="mu-col-head">{label(col)}</span>
                {scene === col ? (
                  <span key={scene} className="mu-task ns-swap">
                    <span className="flex items-center gap-1.5"><Brush className="size-4 text-[var(--ns-brass)]" aria-hidden /><span className="ns-bar flex-1" /></span>
                    <span className="ns-bar w-3/4" />
                    <span className="flex items-center justify-between">
                      <span className="mu-avatar !size-5 !text-[0.5rem]" aria-hidden>{initials}</span>
                      {col === 2 ? <Check className="size-4 text-[#2DD4BF]" aria-hidden /> : <ClipboardCheck className="size-4 text-[#8FA3BD]" aria-hidden />}
                    </span>
                  </span>
                ) : <span className="mu-ghost" />}
              </button>
            ))}
          </div>
        </>}

        {/* ── Calendrier : un bloc par jour ── */}
        {kind === 'calendar' && <>
          <div className="flex items-center gap-2 text-xs text-[#B8CBEE]"><CalendarDays className="size-4 text-[var(--ns-brass)]" aria-hidden /><span className="ns-bar w-1/4" /></div>
          <div className="mu-days">
            {ROWS.map((day) => <button key={day} type="button" className="mu-day" aria-pressed={scene === day} onClick={() => onSelect(day)}>
              <span>{t('moduleFirstUse.demo.day', { count: day + 1 })}</span>
              <span className="mu-day-task">
                {[<Brush key="c" />, <Wrench key="m" />, <ClipboardCheck key="k" />][day]}
                <span>{TIMES[day]}</span>
                <span>{label(day)}</span>
              </span>
            </button>)}
          </div>
        </>}

        {/* ── Fil de messages ── */}
        {kind === 'messages' && <>
          <div className="mu-tabs" role="group" aria-label={t('moduleFirstUse.demo.channels')}>
            {ROWS.map((row) => <button key={row} type="button" className="mu-tab" aria-pressed={scene === row} onClick={() => onSelect(row)}>
              {[<Mail key="g" />, <MessageSquare key="t" />, <FileText key="f" />][row]}{label(row)}
            </button>)}
          </div>
          <div key={scene} className="mu-thread ns-swap">
            {scene === 2 ? (
              <div className="mu-form">
                <span className="ns-bar w-1/3" />
                <span className="ns-bar ns-bar--strong w-4/5" />
                <span className="ns-bar w-3/5" />
                <span className="mt-1 inline-flex items-center gap-1.5 self-end text-[#2DD4BF]"><Check className="size-4" aria-hidden /></span>
              </div>
            ) : <>
              <div className="mu-bubble mu-bubble--in"><span className="ns-bar ns-bar--strong w-full" /><span className="ns-bar w-2/3" /></div>
              <div className="mu-bubble mu-bubble--out"><span className="ns-bar ns-bar--strong w-full" /><span className="ns-bar w-1/2" />
                <span className="flex items-center justify-end gap-1.5"><img src={scene === 0 ? airbnbLogo : bookingLogo} alt="" className="size-4 rounded bg-white object-contain p-px" /><CheckCheck className="size-4 text-[#2DD4BF]" aria-hidden /></span>
              </div>
            </>}
          </div>
        </>}

        {/* ── Devis, contrat, facture, rapport : une feuille ── */}
        {(kind === 'quote' || kind === 'contract' || kind === 'document') && <div className="mu-sheet">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0"><span className="text-[0.6875rem] font-semibold tracking-widest text-[#5A6B76]">BAITLY</span><span className="ns-bar mt-1.5 block w-24" /></span>
            <span className="mu-sheet-stamp" style={{ opacity: scene === 2 ? 1 : 0.0, transition: 'opacity 300ms' }} aria-hidden><Check /></span>
          </div>
          <dl className="m-0 mt-3">
            {ROWS.map((row) => <div key={row} className="mu-sheet-line" data-active={scene === row}>
              <dt className="truncate">{label(row)}</dt>
              <dd>{kind === 'contract' ? [owner, '20 %', ''][row] : isReportDocument ? documentValues[row] : [money(240), money(48), money(288)][row]}</dd>
            </div>)}
          </dl>
          {kind === 'contract' && (
            <svg className="mu-sign" viewBox="0 0 112 36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {scene >= 1 && <path key={scene} className="ns-draw" pathLength={1} d="M4 26 C 14 4, 22 4, 24 20 S 38 30, 44 14 S 58 6, 62 22 S 78 28, 84 12 L 106 18" />}
            </svg>
          )}
          {kind === 'quote' && <div className="mu-sheet-total"><span className="ns-bar w-16" /><span>{money(288)}</span></div>}
          {isReportDocument && <div className="mt-3 space-y-2" aria-hidden>{[100, 80, 95, 60].map((width) => <span key={width} className="ns-bar block" style={{ inlineSize: `${width}%` }} />)}</div>}
          {kind === 'document' && !isReportDocument && <div className="mu-sheet-total"><span className="ns-bar w-16" /><span>{money(288)}</span></div>}
          {kind === 'document' && <div className="mt-3 flex items-center justify-end gap-2 text-[#3B4951]"><Download className="size-4" aria-hidden /></div>}
        </div>}

        {/* ── Flux d'argent ── */}
        {kind === 'ledger' && <div className="mu-ledger">
          {ROWS.map((row) => <button key={row} type="button" className="mu-ledger-row" aria-pressed={scene === row} onClick={() => onSelect(row)}>
            <span className="mu-step-dot" aria-hidden><Euro /></span>
            <span className="mu-ledger-label">{label(row)}</span>
            <strong>{money([480, 360, 240][row])}</strong>
            {scene === row && row === 2 ? <Check className="size-4 text-[#2DD4BF]" aria-hidden /> : <span className="size-4" />}
          </button>)}
          <div className="flex items-center gap-2"><span className="ns-bar flex-1" /><Send className="size-4 text-[#8FA3BD] rtl:-scale-x-100" aria-hidden /></div>
        </div>}

        {/* ── Graphiques ── */}
        {kind === 'chart' && <>
          <div className="mu-tabs" role="group" aria-label={t('moduleFirstUse.demo.indicators')}>
            {ROWS.map((row) => <button key={row} type="button" className="mu-tab" aria-pressed={scene === row} onClick={() => onSelect(row)}>{label(row)}</button>)}
          </div>
          <div className="mu-chart" role="img" aria-label={t('moduleFirstUse.demo.chartDescription')}>
            {[36, 52, 46, 68, 60, 80].map((value, index) => {
              const shown = Math.min(100, value + (comparison ? 8 : 0) + scene * 3);
              return <div key={index} className="mu-chart-track">
                <span className="mu-chart-bar" data-lead={index === 5 || undefined} style={{ transform: `scaleY(${shown / 100})` } as CSSProperties} />
              </div>;
            })}
          </div>
        </>}

        {kind === 'occupancy' && <>
          <div className="mu-tabs" role="group" aria-label={t('moduleFirstUse.demo.indicators')}>
            {ROWS.map((row) => <button key={row} type="button" className="mu-tab" aria-pressed={scene === row} onClick={() => onSelect(row)}>{label(row)}</button>)}
          </div>
          <div className="mu-grid28" role="img" aria-label={t('moduleFirstUse.demo.occupied', { count: comparison ? 21 : 15 })}>
            {Array.from({ length: 28 }, (_, day) => (
              <span key={day} style={day < (comparison ? 21 : 15)
                ? { background: scene === 1 && day >= 15 ? '#E0B483' : '#8FB1F2', color: '#0A1120' }
                : { background: 'rgba(143, 163, 189, 0.14)', color: '#8FA3BD' }}>{number(day + 1)}</span>
            ))}
          </div>
        </>}
      </div>
    </StageCard>
  );
}
