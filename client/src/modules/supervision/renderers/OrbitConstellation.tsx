/* ============================================================
   OrbitConstellation — 2e renderer (grammaire de la projection)

   Enveloppe MINCE autour d'<OrbitDiagram> (le diagramme pur de la
   projection) pour les surfaces qui consomment le contrat
   ConstellationRenderer (portefeuille, mode compact) :

   - canvas aux jetons du thème, carte arrondie hors flush ;
   - HUD « Orchestrateur » haut-gauche en large (compteurs, bilan,
     escalades) — le mode focus l'efface ;
   - mode COMPACT : rail de pastilles (Orchestrateur / En direct /
     À traiter) + tiroir bas, un seul ouvert à la fois.

   La vue LARGE par logement (accordéon Planning) n'utilise PLUS ce
   renderer : SupervisionPanel y compose la mise en page À PLAT de
   la projection (diagramme sur fond de page + file en colonne),
   cf. SupervisionPanel / ConstellationQueue.
   ============================================================ */

import { useMemo, useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { Close } from '../../../icons';
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

  /** Pastille du rail compact — teinte warn réservée à « À traiter ». */
  const pillClass = (on: boolean, warnTone = false) =>
    cn(
      'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150',
      'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
      on
        ? warnTone
          ? 'border-warning/60 bg-warning-soft text-warning-ink'
          : 'border-primary/45 bg-primary-soft text-primary'
        : warnTone
          ? 'border-warning/60 bg-card text-warning-ink hover:bg-warning-soft'
          : 'border-border bg-card text-foreground hover:bg-muted',
    );

  // ── Fragments de l'en-tête, écrits UNE fois et composés différemment selon
  //    la largeur. Les dupliquer aurait garanti que les deux versions divergent.

  /** « ● Orchestrateur » — identité et état de la liaison. */
  const identite = (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', online ? 'bg-success' : 'bg-muted-foreground/50')}
      />
      {t('supervision.hud.orchestrator')}
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

  /** L'exception, nommée — jamais masquée, jamais tassée. */
  const exception = attention.length > 0 && (
    <span className="flex min-w-0 items-center gap-1.5 text-destructive">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-destructive" />
      <span className="truncate">{attention.map((agent) => t(AGENT_META[agent.id].nameKey)).join(', ')}</span>
    </span>
  );

  /** Pastilles de tiroir (compact seulement). */
  const pastilles = compact && (
    <>
      {report && (
        <button
          type="button"
          aria-expanded={sheet === 'hud'}
          onClick={() => toggleSheet('hud')}
          className={pillClass(sheet === 'hud')}
        >
          {t('supervision.report.titleBase', 'Bilan')}
        </button>
      )}
      {belowHud && (
        <button
          type="button"
          aria-expanded={sheet === 'live'}
          onClick={() => toggleSheet('live')}
          className={pillClass(sheet === 'live')}
        >
          {t('supervision.feed.title')}
        </button>
      )}
      {hitl && (hitlCount ?? 0) > 0 && (
        <button
          type="button"
          aria-expanded={sheet === 'hitl'}
          onClick={() => toggleSheet('hitl')}
          className={pillClass(sheet === 'hitl', true)}
        >
          {t('supervision.compact.hitl', 'À traiter')}
          <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-warning-soft px-1 text-[11px] font-bold text-warning-ink tabular-nums">
            {hitlCount}
          </span>
        </button>
      )}
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
        /* ── Étroit : trois registres empilés, chacun avec un seul travail —
              qui parle, ce qu'il en est, ce qu'on peut ouvrir. Tout tenait
              auparavant sur une seule rangée en `flex-wrap` : les compteurs,
              coincés entre l'identité et les pastilles, se repliaient à une
              unité par ligne et coupaient même le nombre de son libellé. */
        <div className="flex shrink-0 flex-col gap-2 px-3 pt-3">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1">{identite}</span>
            {headerAction && <span className="shrink-0">{headerAction}</span>}
          </div>

          {/* Bande de valeurs : séparateurs fins plutôt que du blanc, pour que
              les trois nombres se lisent comme une même mesure. */}
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground [&>span+span]:before:me-2 [&>span+span]:before:text-faint [&>span+span]:before:content-['·']">
            {compteurs}
          </p>

          {exception && <p className="m-0 text-xs">{exception}</p>}

          {/* Pastilles réparties sur toute la largeur : une rangée alignée à
              gauche laissait un vide à droite qui lisait comme un oubli. */}
          {pastilles && (
            <div className="flex items-stretch gap-2 [&>button]:flex-1 [&>button]:justify-center">
              {pastilles}
            </div>
          )}
        </div>
      ) : (
        /* ── Large : tout tient sur une ligne, l'espace ne manque pas. */
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-3">
          <p className="m-0 flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            {identite}
            {compteurs}
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
      <div className="relative min-h-0 flex-1 p-3">
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
