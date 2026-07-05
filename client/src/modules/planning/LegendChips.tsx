import React from 'react';
import { Box, Tooltip } from '@mui/material';
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
const chipSxFor = (variant: LegendChipVariant, selected: boolean) =>
  variant === 'toggle' ? sigButtonSx(selected) : legendChipSx(selected);

// ─── Chips légende (source unique : toolbar ET modale) ───────────────────────

/** Chips togglables des canaux : logo (ou globe) + nom. Un canal désélectionné
 *  masque les briques de ce canal (état local page, non persisté). */
export const ChannelLegendChips: React.FC<{
  activeChannels: ReadonlySet<PlanningChannelKey>;
  onToggleChannel: (key: PlanningChannelKey) => void;
  variant?: LegendChipVariant;
}> = ({ activeChannels, onToggleChannel, variant = 'legend' }) => (
  <>
    {CHANNEL_LEGEND.map((ch) => {
      const selected = activeChannels.has(ch.key);
      return (
        <Tooltip key={ch.key} title={selected ? `Masquer le canal ${ch.label}` : `Afficher le canal ${ch.label}`} arrow>
          <Box
            component="button"
            type="button"
            aria-pressed={selected}
            onClick={() => onToggleChannel(ch.key)}
            sx={chipSxFor(variant, selected)}
          >
            {ch.logo ? (
              <Box
                component="img"
                src={ch.logo}
                alt=""
                sx={{ width: 15, height: 15, objectFit: 'contain', display: 'block', flexShrink: 0 }}
              />
            ) : (
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}>
                <GlobeIcon size={15} strokeWidth={1.75} />
              </Box>
            )}
            {ch.label}
          </Box>
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
        <Box
          key={opt.value}
          component="button"
          type="button"
          aria-pressed={selected}
          onClick={() => onToggleStatus(opt.value)}
          sx={chipSxFor(variant, selected)}
        >
          {/* Puce 9px radius 3 (spec .s-dot) = couleur exacte du statut. */}
          <Box
            component="span"
            sx={{
              width: 9,
              height: 9,
              borderRadius: '3px',
              flexShrink: 0,
              backgroundColor: RESERVATION_STATUS_TOKEN_COLORS[opt.value] ?? 'var(--faint)',
            }}
          />
          {opt.label}
        </Box>
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
  <Box
    component="button"
    type="button"
    aria-pressed={active}
    onClick={onToggle}
    sx={chipSxFor(variant, active)}
  >
    {/* Balai (ménage) + outil (maintenance) : la chip couvre les DEUX types. */}
    <Box component="span" sx={{ display: 'inline-flex', color: INTERVENTION_TYPE_TOKEN_COLORS.cleaning }}>
      <BroomFill size={16} />
    </Box>
    <Box component="span" sx={{ display: 'inline-flex', color: INTERVENTION_TYPE_TOKEN_COLORS.maintenance }}>
      <WrenchFill size={15} />
    </Box>
    Interventions
  </Box>
);
