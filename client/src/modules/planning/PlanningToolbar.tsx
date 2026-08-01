import React from 'react';
import {
  Badge,
  Button,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import {
  ChevronLeft,
  ChevronRight,
  TodayOutlined,
  FullscreenExit,
} from '../../icons';
import type { ZoomLevel, PlanningFilters } from './types';
import type { ReservationStatus } from '../../services/api';
import { ZOOM_LABELS } from './constants';
import type { PlanningChannelKey } from './constants';
import { formatMonthYear } from './utils/dateUtils';
import { ChannelLegendChips, StatusLegendChips, InterventionLegendChip } from './LegendChips';

interface PlanningToolbarProps {
  currentDate: Date;
  zoom: ZoomLevel;
  isFullscreen: boolean;
  filters: PlanningFilters;
  /** Quand vrai, la rangée légende (canaux/statuts/interventions) est hébergée
   *  par la modale de filtres (viewport compact OU constellation déployée) :
   *  on ne la rend PAS ici pour éviter le doublon. */
  legendInModal: boolean;
  onGoPrev: () => void;
  onGoToday: () => void;
  onGoNext: () => void;
  onZoomChange: (zoom: ZoomLevel) => void;
  onToggleFullscreen: () => void;
  onShowInterventionsChange: (show: boolean) => void;
  /** Canaux visibles (rangée Canaux) — tout sélectionné par défaut. */
  activeChannels: ReadonlySet<PlanningChannelKey>;
  onToggleChannel: (key: PlanningChannelKey) => void;
  /** Canaux presents dans les donnees — la legende ne montre que ceux-la. */
  presentChannels?: ReadonlySet<PlanningChannelKey>;
  /** Statuts visibles (rangée Statuts) — tout sélectionné par défaut. */
  activeStatuses: ReadonlySet<ReservationStatus>;
  onToggleStatus: (status: ReservationStatus) => void;
}

/** Fleches de navigation : carre 28 px filete, encre sourde qui vire accent au survol. */
const NAV_BTN_CLS =
  'size-[28px] rounded-[9px] border border-solid border-[var(--line-2)] bg-[var(--card)] text-[var(--muted)] '
  + 'transition-[color,border-color] duration-[160ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none '
  + 'hover:bg-[var(--card)] hover:text-[var(--accent)] hover:border-[var(--accent)]';

/** Segment du selecteur de zoom — l'onglet actif se detache en carte encrée. */
const ZOOM_ITEM_CLS =
  'rounded-[7px] border-0 px-[13px] py-[6px] text-[0.75rem] font-semibold leading-none normal-case tracking-[0.01em] '
  + 'text-[var(--muted)] transition-[background-color,color] duration-[140ms] motion-reduce:transition-none '
  + 'hover:bg-transparent hover:text-[var(--body)] '
  + 'data-[state=on]:bg-[var(--card)] data-[state=on]:text-[var(--ink)] '
  + 'data-[state=on]:shadow-[0_1px_3px_color-mix(in_srgb,var(--ink)_10%,transparent)]';

// ─── Main component ──────────────────────────────────────────────────────────

const PlanningToolbar: React.FC<PlanningToolbarProps> = React.memo(({
  currentDate,
  zoom,
  isFullscreen,
  filters,
  legendInModal,
  onGoPrev,
  onGoToday,
  onGoNext,
  onZoomChange,
  onToggleFullscreen,
  onShowInterventionsChange,
  activeChannels,
  onToggleChannel,
  presentChannels,
  activeStatuses,
  onToggleStatus,
}) => {
  return (
    <div className="flex flex-col gap-1.5 py-1.5 px-2 bg-[transparent] shrink-0">
      {/* ── Rangée 1 : navigation + mois + segmented + recherche + actions ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Spacer de tête flex:1 — centre le groupe nav+mois+Aujourd'hui+zoom
            dans la zone planning. Symétrique au spacer de queue → centrage qui
            s'adapte à la largeur de contenu (donc à l'écran ET à l'état de la
            sidebar, le contenu étant un flex-sibling de la sidebar). */}
        <div className="flex-1 min-w-[8px]" aria-hidden />

        {/* Navigation */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onGoPrev}
            aria-label="Période précédente"
            className={NAV_BTN_CLS}
          >
            <ChevronLeft size={15} strokeWidth={1.75} />
          </Button>

          {/* Month title : info principale (display, encre) */}
          <h6 className="cn-text-subtitle2 font-[family-name:var(--font-display)] text-[0.9375rem] font-semibold capitalize text-[var(--ink)] tracking-[-0.01em] min-w-[110px] text-center">
            {formatMonthYear(currentDate)}
          </h6>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onGoNext}
            aria-label="Période suivante"
            className={NAV_BTN_CLS}
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </Button>
        </div>

        <Badge variant="outline" className="text-[0.6875rem] font-semibold h-[28px] rounded-[9px] cursor-pointer bg-[var(--card)] border-[var(--line-2)] text-[var(--body)] hover:bg-[var(--hover)] hover:border-[var(--faint)] [&>svg]:text-[13px] [&>svg]:text-[var(--accent)]" onClick={onGoToday}><TodayOutlined size={13} strokeWidth={1.75} />Aujourd'hui</Badge>

        {/* Zoom selector — segmented control Signature (.s-seg) */}
        <ToggleGroup
          type="single"
          value={zoom}
          // Radix laisse deselectionner : on ignore la valeur vide (comportement
          // `exclusive` MUI, ou un clic sur l'onglet actif ne change rien).
          onValueChange={(value) => value && onZoomChange(value as ZoomLevel)}
          size="sm"
          spacing={0}
          className="gap-[2px] rounded-[10px] border border-solid border-[var(--field-line)] bg-[var(--field)] p-[3px]"
        >
          {(Object.keys(ZOOM_LABELS) as ZoomLevel[]).map((level) => (
            <ToggleGroupItem key={level} value={level} className={ZOOM_ITEM_CLS}>
              {ZOOM_LABELS[level]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex-1 min-w-[8px]" />

        {/* Plein écran — escape hatch : seul moment où le PageHeader (qui porte
            désormais le toggle) est masqué, donc on le réaffiche ici pour
            pouvoir TOUJOURS ressortir du plein écran. */}
        {isFullscreen && (
          <Tooltip>
            {/* Le Button du kit ne transmet pas de ref : span d'ancrage. */}
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleFullscreen}
                  aria-label="Quitter le plein écran"
                  className="size-[28px] shrink-0 text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--hover)]"
                >
                  <FullscreenExit size={18} strokeWidth={1.75} />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Quitter le plein écran</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── Rangée 2 (desktop) : filtres togglables fusionnés — canaux,
          statuts puis Interventions, sans libellés de rangée. Migrée dans la
          modale de filtres quand `legendInModal` (viewport compact OU
          constellation d'agents déployée) pour ne jamais dupliquer les chips. */}
      {!legendInModal && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Canaux : LOGO de canal (la pastille des briques), toggle masque/affiche */}
          <ChannelLegendChips activeChannels={activeChannels} onToggleChannel={onToggleChannel}
            presentChannels={presentChannels} />
          {/* Statuts : puce colorée = couleur de brique, toggle masque/affiche */}
          <StatusLegendChips activeStatuses={activeStatuses} onToggleStatus={onToggleStatus} />
          {/* Ménage & maintenance sur la grille : même chip .pl-chip que les autres */}
          <InterventionLegendChip
            active={filters.showInterventions}
            onToggle={() => onShowInterventionsChange(!filters.showInterventions)}
          />
        </div>
      )}
    </div>
  );
});

PlanningToolbar.displayName = 'PlanningToolbar';
export default PlanningToolbar;
