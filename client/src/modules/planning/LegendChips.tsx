import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { cn } from '../../utils/cn';
import { Public as GlobeIcon, BroomFill, WrenchFill } from '../../icons';
import type { ReservationStatus } from '../../services/api';
import { RESERVATION_STATUS_TOKEN_COLORS, INTERVENTION_TYPE_TOKEN_COLORS } from './constants';
import type { PlanningChannelKey } from './constants';
import { RESERVATION_STATUS_LABELS, RESERVATION_SOURCE_LABELS } from '../../services/api/reservationsApi';
import { getSourceLogo } from './utils/sourceLogos';

// ─── Options partagées (toolbar + modale de filtres) ─────────────────────────

export const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'confirmed', label: RESERVATION_STATUS_LABELS.confirmed },
  { value: 'pending', label: RESERVATION_STATUS_LABELS.pending },
  { value: 'checked_in', label: RESERVATION_STATUS_LABELS.checked_in },
  { value: 'checked_out', label: RESERVATION_STATUS_LABELS.checked_out },
  { value: 'cancelled', label: RESERVATION_STATUS_LABELS.cancelled },
];

// « Direct » n'a pas de logo (vente en direct) → globe accent.
export const CHANNEL_LEGEND: { key: PlanningChannelKey; label: string; logo: string | null }[] = [
  { key: 'airbnb', label: RESERVATION_SOURCE_LABELS.airbnb, logo: getSourceLogo('airbnb') },
  { key: 'booking', label: RESERVATION_SOURCE_LABELS.booking, logo: getSourceLogo('booking') },
  { key: 'vrbo', label: RESERVATION_SOURCE_LABELS.vrbo, logo: getSourceLogo('vrbo') },
  // Expedia n'a pas de logo dans les assets → globe accent, comme « Direct ».
  { key: 'expedia', label: RESERVATION_SOURCE_LABELS.expedia, logo: null },
  // Longue traîne : pas de logo non plus, et pas de couleur de marque inventée
  // (`getChannelChipTokens` les laisse en gris neutre). Ces chips n'apparaissent
  // que sur les organisations qui vendent réellement sur ces canaux.
  { key: 'agoda', label: RESERVATION_SOURCE_LABELS.agoda, logo: null },
  { key: 'hotels_com', label: RESERVATION_SOURCE_LABELS.hotels_com, logo: null },
  { key: 'hometogo', label: RESERVATION_SOURCE_LABELS.hometogo, logo: null },
  { key: 'mabeet', label: RESERVATION_SOURCE_LABELS.mabeet, logo: null },
  { key: 'rentelly', label: RESERVATION_SOURCE_LABELS.rentelly, logo: null },
  { key: 'gathern', label: RESERVATION_SOURCE_LABELS.gathern, logo: null },
  { key: 'direct', label: RESERVATION_SOURCE_LABELS.direct, logo: null },
];

// ─── Styles partagés (langage Signature) ─────────────────────────────────────

/** Chip pilule Signature (spec .pl-chip) : carte hairline, padding 5px 10px,
 *  11.5px fw600 var(--body) ; état actif accent-soft. */
export const sigChipSx = (active: boolean) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.75,
  fontSize: '0.71875rem',
  fontWeight: 600,
  lineHeight: 1,
  color: active ? 'var(--accent)' : 'var(--body)',
  backgroundColor: active ? 'var(--accent-soft)' : 'var(--card)',
  border: '1px solid',
  borderColor: active ? 'var(--accent)' : 'var(--line-2)',
  borderRadius: '8px',
  padding: '5px 10px',
  cursor: 'pointer',
  userSelect: 'none' as const,
  whiteSpace: 'nowrap' as const,
  transition: 'border-color 160ms cubic-bezier(.16,1,.3,1), background-color 160ms cubic-bezier(.16,1,.3,1), color 160ms cubic-bezier(.16,1,.3,1)',
  '&:hover': { borderColor: active ? 'var(--accent)' : 'var(--faint)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
});

/** Reset commun aux chips rendues comme `<button>` (a11y aria-pressed). */
const BUTTON_RESET = {
  appearance: 'none' as const,
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
  // Hauteur uniforme : les chips canaux (logo 15px), statuts (puce 9px) et
  // interventions (icônes) doivent être identiques.
  minHeight: '27px',
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
};

/** Variante « toggle » : sélectionné = accent-soft, désélectionné = pilule plate
 *  (état actif visible). Utilisée dans la modale de filtres. */
export const sigButtonSx = (active: boolean) => ({
  ...sigChipSx(active),
  ...BUTTON_RESET,
});

/** Variante « légende » : sélectionné = pilule normale, désélectionné = chip
 *  entière à opacity .4 (fond, bordure, puce inchangés). Utilisée dans la
 *  rangée légende de la toolbar. */
export const legendChipSx = (selected: boolean) => ({
  ...sigChipSx(false),
  ...BUTTON_RESET,
  opacity: selected ? 1 : 0.4,
  transition: 'opacity .12s, border-color .12s',
  '&:hover': { borderColor: 'var(--faint)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
});

/** Deux registres visuels pour la MÊME chip selon le contexte :
 *  - `legend` (toolbar) : opacity .4 quand masqué.
 *  - `toggle` (modale)  : accent-soft quand actif. */
export type LegendChipVariant = 'legend' | 'toggle';

/** Equivalent en classes de `sigChipSx` + `BUTTON_RESET`, hors couleurs et transition.
 *  gap: 0.75 = 4.5px (theme.spacing vaut 6 dans ce projet, pas 8). */
const CHIP_BASE_CLS =
  'inline-flex items-center gap-[4.5px] min-h-[27px] px-2.5 py-[5px] rounded-[8px] border border-solid text-[0.71875rem] font-semibold leading-none font-[inherit] appearance-none box-border cursor-pointer select-none whitespace-nowrap motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]';
const CHIP_IDLE_COLORS_CLS = 'text-[var(--body)] bg-[var(--card)] border-[var(--line-2)] hover:border-[var(--faint)]';
const CHIP_TOGGLE_TRANSITION_CLS =
  'transition-[border-color,background-color,color] duration-[160ms] ease-[cubic-bezier(.16,1,.3,1)]';

/** Pendant en classes de `chipSxFor` : `toggle` colore l'etat actif, `legend` l'attenue. */
const chipClsFor = (variant: LegendChipVariant, selected: boolean) =>
  cn(
    CHIP_BASE_CLS,
    variant === 'toggle'
      ? cn(
          CHIP_TOGGLE_TRANSITION_CLS,
          selected
            ? 'text-[var(--accent)] bg-[var(--accent-soft)] border-[var(--accent)]'
            : CHIP_IDLE_COLORS_CLS,
        )
      : cn(
          CHIP_IDLE_COLORS_CLS,
          'transition-[opacity,border-color] duration-[120ms]',
          selected ? 'opacity-100' : 'opacity-40',
        ),
  );

// ─── Chips légende (source unique : toolbar ET modale) ───────────────────────

/** Chips togglables des canaux : logo (ou globe) + nom. Un canal désélectionné
 *  masque les briques de ce canal (état local page, non persisté). */
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
}> = ({ activeChannels, onToggleChannel, presentChannels, variant = 'legend' }) => (
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
              className={chipClsFor(variant, selected)}
            >
              {ch.logo ? (
                <img className="w-[15px] h-[15px] object-contain block shrink-0" src={ch.logo} alt="" />
              ) : (
                <span className="inline-flex text-[var(--accent)]">
                  <GlobeIcon size={15} strokeWidth={1.75} />
                </span>
              )}
              {ch.label}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {selected ? `Masquer le canal ${ch.label}` : `Afficher le canal ${ch.label}`}
          </TooltipContent>
        </Tooltip>
      );
    })}
  </>
);

/** Chips togglables de la rangée Statuts : puce colorée (couleur de brique) +
 *  libellé. Un statut désélectionné masque les briques de ce statut. */
export const StatusLegendChips: React.FC<{
  activeStatuses: ReadonlySet<ReservationStatus>;
  onToggleStatus: (status: ReservationStatus) => void;
  variant?: LegendChipVariant;
}> = ({ activeStatuses, onToggleStatus, variant = 'legend' }) => (
  <>
    {STATUS_OPTIONS.map((opt) => {
      const selected = activeStatuses.has(opt.value);
      return (
        <button
          key={opt.value}
          type="button"
          aria-pressed={selected}
          onClick={() => onToggleStatus(opt.value)}
          className={chipClsFor(variant, selected)}
        >
          {/* Puce 9px radius 3 (spec .s-dot) = couleur exacte du statut. */}
          <span className="w-[9px] h-[9px] rounded-[3px] shrink-0" style={{ backgroundColor: RESERVATION_STATUS_TOKEN_COLORS[opt.value] ?? 'var(--faint)' }} />
          {opt.label}
        </button>
      );
    })}
  </>
);

/** Chip togglable « Interventions » (ménage + maintenance sur la grille). */
export const InterventionLegendChip: React.FC<{
  active: boolean;
  onToggle: () => void;
  variant?: LegendChipVariant;
}> = ({ active, onToggle, variant = 'legend' }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onToggle}
    className={chipClsFor(variant, active)}
  >
    {/* Balai (ménage) + outil (maintenance) : la chip couvre les DEUX types. */}
    <span className="inline-flex" style={{ color: INTERVENTION_TYPE_TOKEN_COLORS.cleaning }}>
      <BroomFill size={16} />
    </span>
    <span className="inline-flex" style={{ color: INTERVENTION_TYPE_TOKEN_COLORS.maintenance }}>
      <WrenchFill size={15} />
    </span>
    Interventions
  </button>
);
