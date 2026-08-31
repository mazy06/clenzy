/* ============================================================
   OrbitConstellation — 2e renderer (grammaire de la projection)

   Enveloppe MINCE autour d'<OrbitDiagram> (le diagramme pur de la
   projection) pour les surfaces qui consomment le contrat
   ConstellationRenderer (portefeuille, mode compact) :

   - canvas aux jetons du thème, carte arrondie hors flush ;
   - HUD « Orchestrateur » haut-gauche en large (compteurs, bilan,
     escalades) — le mode focus l'efface ;
   - mode COMPACT : en-tête sur UNE ligne (identité + effectif à
     gauche, bascules en icônes à droite) + tiroir bas, un seul
     ouvert à la fois.

   La vue LARGE par logement (accordéon Planning) n'utilise PLUS ce
   renderer : SupervisionPanel y compose la mise en page À PLAT de
   la projection (diagramme sur fond de page + file en colonne),
   cf. SupervisionPanel / ConstellationQueue.
   ============================================================ */

import { useMemo, useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { Checklist, Close, Info, Timeline } from '../../../icons';
import { cn } from '../../../utils/cn';
import { AGENT_META, STATUS } from '../constants';
import { OrbitDiagram, busiestAgent } from './OrbitDiagram';
import type { ConstellationRendererProps } from './ConstellationRenderer';
import type { AgentId } from '../types';

// ─── Feuille locale (tiroir compact) ─────────────────────────────────────────

const SHEET_STYLES = `
.oc-sheet { animation: oc-sheet-up .22s cubic-bezier(.22,1,.36,1); }
@keyframes oc-sheet-up { from { transform: translateY(14%); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .oc-sheet { animation: none; } }
`;

// ─── Fenêtres du bilan (mêmes options que le renderer historique) ────────────
// Exportées : la mise à plat de SupervisionPanel rend les mêmes chips.

export const REPORT_WINDOWS: { days: number; key: string; fallback: string }[] = [
  { days: 1, key: 'supervision.report.win.day', fallback: 'Jour' },
  { days: 7, key: 'supervision.report.win.week', fallback: 'Sem.' },
  { days: 15, key: 'supervision.report.win.fortnight', fallback: 'Quinz.' },
  { days: 30, key: 'supervision.report.win.month', fallback: 'Mois' },
];

// ─── Renderer ────────────────────────────────────────────────────────────────

export function OrbitConstellation({
  agents,
  hud,
  online,
  paused,
  focused,
  onToggleFocus,
  onSelectAgent,
  headerAction,
  report,
  reportWindow,
  onReportWindowChange,
  belowHud,
  compact,
  hitl,
  hitlCount,
  flush,
  onHeadAgentSettled,
  pendingItems,
}: ConstellationRendererProps) {
  const { t } = useTranslation();

  // Mode compact : quel tiroir est ouvert (un seul à la fois, null = fermé).
  const [sheet, setSheet] = useState<'hud' | 'live' | 'hitl' | null>(null);
  const toggleSheet = (key: 'hud' | 'live' | 'hitl') => setSheet((s) => (s === key ? null : key));

  const [selected, setSelected] = useState<AgentId | null>(() => busiestAgent(agents));
  const selectAgent = (id: AgentId) => {
    setSelected(id);
    onSelectAgent?.(id);
  };

  const attention = useMemo(
    () => agents.filter((agent) => agent.status === 'esc' || agent.status === 'err'),
    [agents],
  );

  // Bilan de valeur — servi dans le TIROIR compact uniquement : la ligne
  // d'en-tête porte déjà l'identité, les compteurs et les escalades, il ne
  // reste que le bilan à déplier. Le tiroir est déjà une surface : pas de
  // carte dans la carte.
  const hudDetail = () =>
    report && (
      <div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t('supervision.report.windowLabel', 'Fenêtre')}
            </span>
            {onReportWindowChange ? (
              <span className="flex gap-0.5" role="group" aria-label={t('supervision.report.titleBase', 'Bilan')}>
                {REPORT_WINDOWS.map((option) => {
                  const active = (reportWindow ?? report.windowDays) === option.days;
                  return (
                    <button
                      key={option.days}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onReportWindowChange(option.days)}
                      className={cn(
                        'cursor-pointer rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors duration-100',
                        'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                        active ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {t(option.key, option.fallback)}
                    </button>
                  );
                })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {t('supervision.report.windowDays', { count: report.windowDays, defaultValue: '{{count}} jours' })}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-4 text-xs">
            <span className="flex flex-col">
              <b className="font-semibold text-foreground tabular-nums">{report.estimatedTimeSaved}</b>
              <span className="text-muted-foreground">{t('supervision.report.timeSaved', 'Temps gagné')}</span>
            </span>
            <span className="flex flex-col">
              <b className="font-semibold text-foreground tabular-nums">{report.autoActions}</b>
              <span className="text-muted-foreground">{t('supervision.report.autoActions', 'Actions auto')}</span>
            </span>
            <span className="flex flex-col">
              <b className="font-semibold text-foreground tabular-nums">{Math.round(report.acceptanceRate * 100)} %</b>
              <span className="text-muted-foreground">{t('supervision.report.acceptance', 'Acceptation')}</span>
            </span>
          </div>
        </div>
      </div>
    );

  const sheetTitle =
    sheet === 'hud'
      ? t('supervision.report.titleBase', 'Bilan')
      : sheet === 'live'
        ? t('supervision.feed.title')
        : t('supervision.compact.hitl', 'À traiter');

  /**
   * Bascule de tiroir du mode compact, réduite à son ICÔNE.
   *
   * <p>Le rail portait deux pastilles pleine largeur, sous les compteurs, eux
   * sous l'identité : trois rangées pour dire ce qui tient en une, et autant de
   * hauteur prise à la constellation — la seule chose qu'on soit venu voir. Le
   * libellé passe en `aria-label`, comme les actions de la barre de titre
   * (cf. compactHeaderActions) ; le compte, lui, reste écrit : c'est lui qui
   * appelle.</p>
   */
  const toggleTiroir = (
    key: 'live' | 'hitl',
    label: string,
    icon: React.ReactNode,
    badge?: number,
  ) => (
    <button
      type="button"
      aria-label={badge != null ? `${label} — ${badge}` : label}
      aria-expanded={sheet === key}
      onClick={() => toggleSheet(key)}
      className={cn(
        'inline-flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full px-1.5',
        'transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        badge != null
          ? sheet === key
            ? 'bg-warning-soft text-warning-ink'
            : 'text-warning-ink hover:bg-warning-soft'
          : sheet === key
            ? 'bg-primary-soft text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {icon}
      {badge != null && <b className="text-[11px] font-bold tabular-nums">{badge}</b>}
    </button>
  );

  // ── Fragments de l'en-tête, écrits UNE fois et composés différemment selon
  //    la largeur. Les dupliquer aurait garanti que les deux versions divergent.

  /** « ● Orchestrateur » — identité et état de la liaison. */
  const identite = (
    <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', online ? 'bg-success' : 'bg-muted-foreground/50')}
      />
      <span className="truncate">{t('supervision.hud.orchestrator')}</span>
    </span>
  );

  /**
   * Les trois compteurs. `whitespace-nowrap` sur CHAQUE unité : sans lui, en
   * étroit, le nombre se séparait de son libellé (« 10 » sur une ligne,
   * « agents » sur la suivante) — une valeur orpheline ne veut plus rien dire.
   */
  const compteurs = (
    <>
      <span className="whitespace-nowrap">
        <b className="font-semibold text-foreground tabular-nums">{hud.agentsCount}</b> {t('supervision.hud.agents')}
      </span>
      <span className="whitespace-nowrap">
        <b className="font-semibold text-foreground tabular-nums">{hud.actingCount}</b> {t('supervision.hud.acting')}
      </span>
      <span className={cn('whitespace-nowrap', hud.awaitingCount > 0 && 'text-warning-ink')}>
        <b className="font-semibold tabular-nums">{hud.awaitingCount}</b> {t('supervision.hud.awaiting')}
      </span>
    </>
  );

  /**
   * Le bilan, réduit à une icône sur la ligne des compteurs.
   *
   * <p>Il tenait une pastille pleine largeur dans le rail, à égalité avec
   * « À traiter » — une information qu'on consulte de loin en loin au même
   * rang que celle sur laquelle on agit. Le rail ne porte plus que les deux
   * surfaces actionnables.</p>
   *
   * <p>Le tiroir reste sa surface : en étroit l'écran est tactile, et un
   * panneau qui monte du bas se lit et se ferme au pouce, là où une bulle
   * ancrée à une icône de 24 px se manipule mal.</p>
   */
  const bilan = report && (
    <button
      type="button"
      aria-label={t('supervision.report.titleBase', 'Bilan')}
      aria-expanded={sheet === 'hud'}
      onClick={() => toggleSheet('hud')}
      className={cn(
        // 24 px de cible tactile : en dessous, le pouce manque l'icône.
        'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        sheet === 'hud' ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Info size={14} strokeWidth={1.75} />
    </button>
  );

  /** L'exception, nommée — jamais masquée, jamais tassée. */
  const exception = attention.length > 0 && (
    <span className="flex min-w-0 items-center gap-1.5 text-destructive">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-destructive" />
      <span className="truncate">{attention.map((agent) => t(AGENT_META[agent.id].nameKey)).join(', ')}</span>
    </span>
  );

  /** Les deux surfaces qu'on peut ouvrir, en icônes (compact seulement). */
  const bascules = compact && (
    <>
      {belowHud && toggleTiroir('live', t('supervision.feed.title'), <Timeline size={14} strokeWidth={1.75} />)}
      {hitl && (hitlCount ?? 0) > 0
        && toggleTiroir('hitl', t('supervision.compact.hitl', 'À traiter'), <Checklist size={14} strokeWidth={1.75} />, hitlCount)}
    </>
  );

  return (
    <div
      role="group"
      aria-label={t('supervision.hud.orchestrator')}
      className={cn(
        'relative flex min-h-[380px] flex-1 flex-col overflow-hidden bg-card',
        !flush && 'rounded-2xl border border-border',
        !online && 'saturate-50',
      )}
    >
      <style>{SHEET_STYLES}</style>

      {/* ── En-tête sur UNE ligne (masqué en mode focus) : identité et
             compteurs à gauche, contrôles alignés à droite — même grammaire
             que l'en-tête du panneau large. Plus de carte flottante ni de rail
             posés SUR le canvas : la surface entière revient au diagramme. */}
      {!focused && (compact ? (
        /* ── Étroit : UNE ligne. Trois rangées empilées — qui parle, ce qu'il en
              est, ce qu'on peut ouvrir — mangeaient une centaine de pixels de
              haut au seul écran où la hauteur manque, et c'est la constellation
              qui payait. Ce qui tient sur la ligne : l'identité et l'effectif
              en toutes lettres ; ce qui n'y tient pas devient une icône dont le
              libellé passe en `aria-label`, ou disparaît quand il ne dit rien.
              « En attente » n'est PAS perdu : la bascule « À traiter » porte le
              même nombre — il s'écrivait deux fois. */
        <div className="flex shrink-0 flex-col gap-1 px-3 pt-3">
          <div className="flex items-center gap-2">
            <p className="m-0 flex min-w-0 flex-1 items-baseline gap-1.5 text-xs text-muted-foreground">
              {identite}
              <span aria-hidden className="text-faint">·</span>
              <span className="whitespace-nowrap">
                <b className="font-semibold text-foreground tabular-nums">{hud.agentsCount}</b>{' '}
                {t('supervision.hud.agents')}
              </span>
              {/* L'activité en cours n'apparaît que lorsqu'il y en a : « 0
                  agissent » occupait une place fixe pour ne rien annoncer. */}
              {hud.actingCount > 0 && (
                <span className="whitespace-nowrap text-primary">
                  <b className="font-semibold tabular-nums">{hud.actingCount}</b>{' '}
                  {t('supervision.hud.acting')}
                </span>
              )}
            </p>

            <span className="flex shrink-0 items-center gap-0.5">
              {bascules}
              {bilan}
              {headerAction}
            </span>
          </div>

          {/* L'exception garde sa ligne : elle est rare, et c'est une alerte —
              la tasser entre deux nombres serait la faire disparaître. */}
          {exception && <p className="m-0 text-xs">{exception}</p>}
        </div>
      ) : (
        /* ── Large : tout tient sur une ligne, l'espace ne manque pas. */
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3">
          <p className="m-0 flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            {identite}
            {compteurs}
            {bilan}
            {exception}
          </p>
          {headerAction && <span className="shrink-0">{headerAction}</span>}
        </div>
      ))}

      {/* Contenu optionnel sous l'en-tête (feed en large) — le compact le sert
          dans son tiroir « En direct ». */}
      {!compact && !focused && belowHud && <div className="shrink-0 px-3 pt-2">{belowHud}</div>}

      {/* ── Diagramme orbital (projection) : il occupe TOUTE la surface
             restante. Il MESURE la boîte qu'on lui donne (`size-full`) —
             une boîte sans dimension calculerait un carré nul. ─────────── */}
      {/* La gouttiere tombe a 4 px en etroit : sur telephone, 12 px de chaque
          cote retiraient 24 px au diametre du dessin — un gabarit de confort
          preleve sur la seule chose qu'on regarde. */}
      <div className={cn('relative min-h-0 flex-1', compact ? 'p-1' : 'p-3')}>
        <OrbitDiagram
          className="size-full"
          agents={agents}
          selected={selected}
          onSelect={selectAgent}
          flowEnabled={online && !paused}
          onHeadAgentSettled={onHeadAgentSettled}
          onCoreClick={onToggleFocus}
          corePressed={focused}
          pendingItems={pendingItems}
        />
      </div>

      {/* ── Compact : tiroir bas (un seul à la fois) + voile de fermeture ── */}
      {compact && sheet && (
        <>
          <button
            type="button"
            aria-label={t('common.close', 'Fermer')}
            onClick={() => setSheet(null)}
            className="absolute inset-0 z-[8] cursor-default border-0 bg-foreground/25 p-0"
          />
          <div
            role="dialog"
            aria-label={sheetTitle}
            className="oc-sheet absolute inset-x-0 bottom-0 z-[9] flex max-h-[68%] flex-col rounded-t-2xl border-t border-border bg-card"
          >
            <span aria-hidden className="mx-auto mt-2 mb-0.5 h-1 w-9 shrink-0 rounded-full bg-border" />
            <div className="flex shrink-0 items-center gap-2 px-3.5 pt-1.5 pb-2 text-[13px] font-semibold text-foreground">
              {sheetTitle}
              {sheet === 'hitl' && (hitlCount ?? 0) > 0 && (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-warning-soft px-1 text-[11px] font-bold text-warning-ink tabular-nums">
                  {hitlCount}
                </span>
              )}
              <button
                type="button"
                aria-label={t('common.close', 'Fermer')}
                onClick={() => setSheet(null)}
                className="ms-auto inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Close size={16} />
              </button>
            </div>
            {/* data-vertical-scroll : le planning ne détourne pas la molette ici. */}
            <div
              className="min-h-0 overflow-y-auto px-3.5 pb-3.5 [overscroll-behavior:contain]"
              data-vertical-scroll
            >
              {sheet === 'hud' ? hudDetail() : sheet === 'live' ? belowHud : hitl}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
