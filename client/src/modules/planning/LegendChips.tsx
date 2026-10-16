import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipTrigger } from '../../components/ui';
import { cn } from '../../utils/cn';
import { Public as GlobeIcon, BroomFill, WrenchFill, Check } from '../../icons';
import type { ReservationStatus } from '../../services/api';
import { RESERVATION_STATUS_BAR_COLORS, INTERVENTION_TYPE_TOKEN_COLORS, PLANNING_CHANNEL_KEYS, PLANNING_STATUS_KEYS } from './constants';
import type { PlanningChannelKey } from './constants';
import { RESERVATION_SOURCE_LABELS } from '../../services/api/reservationsApi';
import { getSourceLogo } from './utils/sourceLogos';
import { PlanningTooltipContent } from './PlanningTooltip';

// ─── Options partagées (toolbar + modale de filtres) ─────────────────────────

/**
 * Statuts de la legende, dans l'ordre d'affichage.
 *
 * <p>Le LIBELLE n'est plus fige a l'import : il se lit dans
 * `planning.legend.status.<statut>` au moment du rendu. Fige, il restait
 * francais quel que soit l'etat de l'interface — un module charge une fois
 * pour toutes ne repasse pas au changement de langue.</p>
 */
export const STATUS_OPTIONS = PLANNING_STATUS_KEYS;

// Le logo de chaque canal est RESOLU, jamais figé : les assets existent pour
// presque tous les canaux (agoda, hotels.com, hometogo, mabeet, rentelly,
// gathern, expedia) et cette table les forçait à `null`, si bien que sept
// canaux sur onze s'affichaient avec un globe générique alors que leur logo
// était livré dans le bundle.
//
// « Direct » reste sans logo : ce n'est pas un canal externe mais l'absence
// d'intermédiaire — un globe, à l'encre de marque comme le reste du chrome.
export const CHANNEL_LEGEND: { key: PlanningChannelKey; label: string; logo: string | null }[] =
  PLANNING_CHANNEL_KEYS
    .map((key) => ({
      key,
      label: RESERVATION_SOURCE_LABELS[key],
      logo: key === 'direct' ? null : getSourceLogo(key),
    }));

// ─── Styles partagés (langage Signature) ─────────────────────────────────────

/** Deux registres visuels pour la MÊME chip selon le contexte :
 *  - `legend` (toolbar) : opacity .4 quand masqué.
 *  - `toggle` (modale)  : accent-soft quand actif. */
export type LegendChipVariant = 'legend' | 'toggle';

/** Equivalent en classes de `sigChipSx` + `BUTTON_RESET`, hors couleurs et transition.
 *  gap: 0.75 = 4.5px (theme.spacing vaut 6 dans ce projet, pas 8). */
const CHIP_BASE_CLS =
  'inline-flex shrink-0 items-center gap-[4.5px] min-h-[27px] px-2.5 py-[5px] rounded-[8px] border border-solid text-xs font-medium leading-none font-[inherit] appearance-none box-border cursor-pointer select-none whitespace-nowrap motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bui-primary)]';
const CHIP_IDLE_COLORS_CLS = 'text-[var(--bui-foreground)] bg-[var(--bui-card)] border-[var(--bui-border)] hover:border-[var(--bui-muted-foreground)]';
const CHIP_TOGGLE_TRANSITION_CLS =
  'transition-[border-color,background-color,color] duration-[160ms] ease-[cubic-bezier(.16,1,.3,1)]';

/** Pendant en classes de `chipSxFor` : `toggle` colore l'etat actif, `legend` l'attenue. */
export const baitlyPlanningChipClass = (variant: LegendChipVariant, selected: boolean) =>
  cn(
    CHIP_BASE_CLS,
    variant === 'toggle'
      ? cn(
          CHIP_TOGGLE_TRANSITION_CLS,
          selected
            ? 'text-[var(--bui-primary)] bg-[var(--bui-primary-soft)] border-[var(--bui-primary)]'
            : CHIP_IDLE_COLORS_CLS,
        )
      : cn(
          CHIP_IDLE_COLORS_CLS,
          'transition-[opacity,border-color] duration-[120ms]',
          selected ? 'border-[var(--bui-muted-foreground)]' : 'border-dashed text-[var(--bui-muted-foreground)]',
        ),
  );

// ─── Chips légende (source unique : toolbar ET modale) ───────────────────────

/** Chips togglables des canaux : logo (ou globe) + nom. Un canal désélectionné
 *  masque les briques de ce canal (préférence persistée côté backend). */
export const ChannelLegendChips: React.FC<{
  activeChannels: ReadonlySet<PlanningChannelKey>;
  onToggleChannel: (key: PlanningChannelKey) => void;
  /**
   * Canaux effectivement présents dans les données affichées. Seuls ceux-là
   * reçoivent un chip : un filtre sur un canal où l'organisation ne vend pas
   * n'a aucun effet et encombre la barre. Absent → toute la légende, ce qui
   * préserve les appelants qui n'ont pas la donnée sous la main.
   */
  presentChannels?: ReadonlySet<PlanningChannelKey>;
  variant?: LegendChipVariant;
}> = ({ activeChannels, onToggleChannel, presentChannels, variant = 'legend' }) => {
  const { t } = useTranslation();
  return (
  <>
    {CHANNEL_LEGEND.filter((ch) => !presentChannels || presentChannels.has(ch.key)).map((ch) => {
      const selected = activeChannels.has(ch.key);
      return (
        <Tooltip key={ch.key}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onToggleChannel(ch.key)}
              className={baitlyPlanningChipClass(variant, selected)}
            >
              <span className="inline-flex w-3 shrink-0" aria-hidden="true">{selected && <Check size={12} />}</span>
              {ch.logo ? (
                <img className="w-[15px] h-[15px] object-contain block shrink-0" src={ch.logo} alt="" />
              ) : (
                <span className="inline-flex text-[var(--brand-ink)]">
                  <GlobeIcon size={15} strokeWidth={1.75} />
                </span>
              )}
              {ch.label}
            </button>
          </TooltipTrigger>
          <PlanningTooltipContent>
            {selected
              ? t('planning.legend.hideChannel', { channel: ch.label })
              : t('planning.legend.showChannel', { channel: ch.label })}
          </PlanningTooltipContent>
        </Tooltip>
      );
    })}
  </>
  );
};

/** Chips togglables de la rangée Statuts : puce colorée (couleur de brique) +
 *  libellé. Un statut désélectionné masque les briques de ce statut. */
export const StatusLegendChips: React.FC<{
  activeStatuses: ReadonlySet<ReservationStatus>;
  onToggleStatus: (status: ReservationStatus) => void;
  variant?: LegendChipVariant;
}> = ({ activeStatuses, onToggleStatus, variant = 'legend' }) => {
  const { t } = useTranslation();
  return (
  <>
    {STATUS_OPTIONS.map((status) => {
      const selected = activeStatuses.has(status);
      return (
        <button
          key={status}
          type="button"
          aria-pressed={selected}
          onClick={() => onToggleStatus(status)}
          className={baitlyPlanningChipClass(variant, selected)}
        >
          <span className="inline-flex w-3 shrink-0" aria-hidden="true">{selected && <Check size={12} />}</span>
          {/* Puce 9px radius 3 (spec .s-dot) = couleur exacte du statut. */}
          <span className="w-[9px] h-[9px] rounded-[3px] shrink-0" style={{ backgroundColor: RESERVATION_STATUS_BAR_COLORS[status] ?? 'var(--bui-muted-foreground)' }} />
          {t(`planning.legend.status.${status}`)}
        </button>
      );
    })}
  </>
  );
};

/** Chip togglable « Interventions » (ménage + maintenance sur la grille). */
export const InterventionLegendChip: React.FC<{
  active: boolean;
  onToggle: () => void;
  variant?: LegendChipVariant;
}> = ({ active, onToggle, variant = 'legend' }) => {
  const { t } = useTranslation();
  return (
  <button
    type="button"
    aria-pressed={active}
    onClick={onToggle}
    className={baitlyPlanningChipClass(variant, active)}
  >
    <span className="inline-flex w-3 shrink-0" aria-hidden="true">{active && <Check size={12} />}</span>
    {/* Balai (ménage) + outil (maintenance) : la chip couvre les DEUX types. */}
    <span className="inline-flex" style={{ color: INTERVENTION_TYPE_TOKEN_COLORS.cleaning }}>
      <BroomFill size={16} />
    </span>
    <span className="inline-flex" style={{ color: INTERVENTION_TYPE_TOKEN_COLORS.maintenance }}>
      <WrenchFill size={15} />
    </span>
    {t('planning.legend.interventions', 'Interventions')}
  </button>
  );
};
