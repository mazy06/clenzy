import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Menu,
  Badge,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  TodayOutlined,
  FullscreenExit,
  TuneOutlined,
  Public as GlobeIcon,
  CleaningServices,
} from '../../icons';
import type { ZoomLevel, PlanningFilters } from './types';
import type { ReservationStatus } from '../../services/api';
import { ZOOM_LABELS, RESERVATION_STATUS_TOKEN_COLORS, INTERVENTION_TYPE_TOKEN_COLORS } from './constants';
import type { PlanningChannelKey } from './constants';
import { RESERVATION_STATUS_LABELS, RESERVATION_SOURCE_LABELS } from '../../services/api/reservationsApi';
import { getSourceLogo } from './utils/sourceLogos';
import { formatMonthYear } from './utils/dateUtils';

interface PlanningToolbarProps {
  currentDate: Date;
  zoom: ZoomLevel;
  isFullscreen: boolean;
  filters: PlanningFilters;
  /** Sert au point indicateur (badge dot) du menu compact Canaux. */
  hasActiveFilters: boolean;
  onGoPrev: () => void;
  onGoToday: () => void;
  onGoNext: () => void;
  onZoomChange: (zoom: ZoomLevel) => void;
  onToggleFullscreen: () => void;
  onShowInterventionsChange: (show: boolean) => void;
  /** Canaux visibles (rangée Canaux) — tout sélectionné par défaut. */
  activeChannels: ReadonlySet<PlanningChannelKey>;
  onToggleChannel: (key: PlanningChannelKey) => void;
  /** Statuts visibles (rangée Statuts) — tout sélectionné par défaut. */
  activeStatuses: ReadonlySet<ReservationStatus>;
  onToggleStatus: (status: ReservationStatus) => void;
}

const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'confirmed', label: RESERVATION_STATUS_LABELS.confirmed },
  { value: 'pending', label: RESERVATION_STATUS_LABELS.pending },
  { value: 'checked_in', label: RESERVATION_STATUS_LABELS.checked_in },
  { value: 'checked_out', label: RESERVATION_STATUS_LABELS.checked_out },
  { value: 'cancelled', label: RESERVATION_STATUS_LABELS.cancelled },
];

// ─── Styles partagés (langage Signature) ────────────────────────────────────

/** Chip pilule Signature (spec .pl-chip) : carte hairline, padding 5px 10px,
 *  11.5px fw600 var(--body) ; état actif accent-soft. */
const sigChipSx = (active: boolean) => ({
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

/**
 * Chip-bouton togglable des rangées légende (Canaux / Statuts).
 * Spec .pl-chip / .pl-chip.off : sélectionné = look hairline normal ;
 * désélectionné = chip entière à opacity .4 (fond, bordure, puce inchangés).
 */
const legendToggleSx = (selected: boolean) => ({
  ...sigChipSx(false),
  appearance: 'none' as const,
  fontFamily: 'inherit',
  // Hauteur uniforme : les chips canaux (logo 15px) et statuts (puce 9px)
  // doivent etre identiques — on fixe la hauteur du contenu le plus haut.
  boxSizing: 'border-box' as const,
  minHeight: '27px',
  opacity: selected ? 1 : 0.4,
  transition: 'opacity .12s, border-color .12s',
  '&:hover': { borderColor: 'var(--faint)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
});

/** Overline des sections du popover de filtres. */
const OVERLINE_SX = {
  fontSize: '0.5625rem',
  fontWeight: 700,
  color: 'var(--faint)',
  letterSpacing: '0.08em',
  mb: 0.75,
  display: 'block',
};

// ─── Canaux (maquette : chips avec LOGO de canal, togglables) ────────────────
//
// Les briques encodent le canal via la pastille logo ; cette rangée sert de
// légende ET de filtre : un canal désélectionné masque ses briques.
// « Direct » n'a pas de logo (vente en direct) → globe accent.
const CHANNEL_LEGEND: { key: PlanningChannelKey; label: string; logo: string | null }[] = [
  { key: 'airbnb', label: RESERVATION_SOURCE_LABELS.airbnb, logo: getSourceLogo('airbnb') },
  { key: 'booking', label: RESERVATION_SOURCE_LABELS.booking, logo: getSourceLogo('booking') },
  { key: 'direct', label: RESERVATION_SOURCE_LABELS.direct, logo: null },
];

// ─── Shared sub-components for desktop & menu ────────────────────────────────

/** Chips togglables de la rangée Statuts : un statut désélectionné masque
 *  les briques de ce statut (état local page, non persisté). */
const StatusToggleChips: React.FC<{
  activeStatuses: ReadonlySet<ReservationStatus>;
  onToggleStatus: (status: ReservationStatus) => void;
}> = ({ activeStatuses, onToggleStatus }) => (
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
          sx={legendToggleSx(selected)}
        >
          {/* Puce 9px radius 3 (spec .s-dot) = couleur exacte du statut,
              mêmes constantes que les briques */}
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

// ─── Main component ──────────────────────────────────────────────────────────

const PlanningToolbar: React.FC<PlanningToolbarProps> = React.memo(({
  currentDate,
  zoom,
  isFullscreen,
  filters,
  hasActiveFilters,
  onGoPrev,
  onGoToday,
  onGoNext,
  onZoomChange,
  onToggleFullscreen,
  onShowInterventionsChange,
  activeChannels,
  onToggleChannel,
  activeStatuses,
  onToggleStatus,
}) => {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('lg'));
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchor);

  // Point indicateur du menu compact Canaux : filtres actifs OU recherche en cours.
  const hasBadge = hasActiveFilters || filters.searchQuery.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        py: 0.875,
        px: 1.25,
        backgroundColor: 'transparent',
        flexShrink: 0,
      }}
    >
      {/* ── Rangée 1 : navigation + mois + segmented + recherche + actions ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.875 }}>
        {/* Spacer de tête flex:1 — centre le groupe nav+mois+Aujourd'hui+zoom
            dans la zone planning. Symétrique au spacer de queue → centrage qui
            s'adapte à la largeur de contenu (donc à l'écran ET à l'état de la
            sidebar, le contenu étant un flex-sibling de la sidebar). */}
        <Box sx={{ flex: 1, minWidth: 8 }} aria-hidden />

        {/* Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={onGoPrev}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '9px',
              border: '1px solid var(--line-2)',
              backgroundColor: 'var(--card)',
              color: 'var(--muted)',
              transition: 'color 160ms cubic-bezier(.16,1,.3,1), border-color 160ms cubic-bezier(.16,1,.3,1)',
              '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--card)' },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            <ChevronLeft size={15} strokeWidth={1.75} />
          </IconButton>

          {/* Month title : info principale (display, encre) */}
          <Typography
            variant="subtitle2"
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              textTransform: 'capitalize',
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
              minWidth: 110,
              textAlign: 'center',
            }}
          >
            {formatMonthYear(currentDate)}
          </Typography>

          <IconButton
            size="small"
            onClick={onGoNext}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '9px',
              border: '1px solid var(--line-2)',
              backgroundColor: 'var(--card)',
              color: 'var(--muted)',
              transition: 'color 160ms cubic-bezier(.16,1,.3,1), border-color 160ms cubic-bezier(.16,1,.3,1)',
              '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--card)' },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </IconButton>
        </Box>

        <Chip
          icon={<TodayOutlined size={13} strokeWidth={1.75} />}
          label="Aujourd'hui"
          size="small"
          variant="outlined"
          onClick={onGoToday}
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            height: 28,
            borderRadius: '9px',
            cursor: 'pointer',
            backgroundColor: 'var(--card)',
            borderColor: 'var(--line-2)',
            color: 'var(--body)',
            '&:hover': { backgroundColor: 'var(--hover)', borderColor: 'var(--faint)' },
            '& .MuiChip-icon': { fontSize: 13, color: 'var(--accent)' },
          }}
        />

        {/* Zoom selector — segmented control Signature (.s-seg) */}
        <ToggleButtonGroup
          value={zoom}
          exclusive
          onChange={(_, value) => value && onZoomChange(value)}
          size="small"
          sx={{
            backgroundColor: 'var(--field)',
            border: '1px solid var(--field-line)',
            borderRadius: '10px',
            p: '3px',
            gap: '2px',
            '& .MuiToggleButtonGroup-grouped': {
              border: 0,
              m: 0,
              borderRadius: '7px !important',
            },
            '& .MuiToggleButton-root': {
              fontSize: '0.75rem',
              fontWeight: 600,
              lineHeight: 1,
              padding: '6px 13px',
              textTransform: 'none',
              letterSpacing: '0.01em',
              color: 'var(--muted)',
              transition: 'background-color 140ms, color 140ms',
              '&:hover': { backgroundColor: 'transparent', color: 'var(--body)' },
              '&.Mui-selected': {
                backgroundColor: 'var(--card)',
                color: 'var(--ink)',
                boxShadow: '0 1px 3px color-mix(in srgb, var(--ink) 10%, transparent)',
                '&:hover': { backgroundColor: 'var(--card)' },
              },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            },
          }}
        >
          {(Object.keys(ZOOM_LABELS) as ZoomLevel[]).map((level) => (
            <ToggleButton key={level} value={level}>
              {ZOOM_LABELS[level]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ flex: 1, minWidth: 8 }} />

        {/* ════════════════════════════════════════════════════════════════
            COMPACT: burger menu — canaux uniquement.
            (filtres/statuts/affichage/bloquer/plein écran remontés dans le
            PageHeader ; les canaux n'ont pas de rangée légende en compact, on
            les conserve donc ici.)
            ════════════════════════════════════════════════════════════════ */}
        {isCompact && (
          <>
            <Tooltip title="Canaux">
              <IconButton
                size="small"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ width: 22, height: 22, color: 'var(--muted)', '&:hover': { color: 'var(--accent)' } }}
              >
                <Badge
                  variant="dot"
                  invisible={!hasBadge}
                  sx={{
                    '& .MuiBadge-dot': { width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent)' },
                  }}
                >
                  <TuneOutlined size={14} strokeWidth={1.75} />
                </Badge>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={menuAnchor}
              open={menuOpen}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  sx: {
                    width: 320,
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--line-2)',
                    backgroundColor: 'var(--card)',
                    boxShadow: 'var(--shadow-pop)',
                    mt: 0.5,
                  },
                },
              }}
            >
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Canaux (toggle masque/affiche) */}
                <Box>
                  <Typography variant="overline" sx={OVERLINE_SX}>
                    Canaux
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <ChannelToggleChips activeChannels={activeChannels} onToggleChannel={onToggleChannel} />
                  </Box>
                </Box>
              </Box>
            </Menu>
          </>
        )}

        {/* Plein écran — escape hatch : seul moment où le PageHeader (qui porte
            désormais le toggle) est masqué, donc on le réaffiche ici pour
            pouvoir TOUJOURS ressortir du plein écran. */}
        {isFullscreen && (
          <Tooltip title="Quitter le plein écran">
            <IconButton
              size="small"
              onClick={onToggleFullscreen}
              sx={{
                width: 28,
                height: 28,
                flexShrink: 0,
                color: 'var(--muted)',
                '&:hover': { color: 'var(--accent)', backgroundColor: 'var(--hover)' },
              }}
            >
              <FullscreenExit size={18} strokeWidth={1.75} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* ── Rangée 2 (desktop) : filtres togglables fusionnés — canaux,
          statuts puis Interventions, sans libellés de rangée ─────────────── */}
      {!isCompact && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* Canaux : LOGO de canal (la pastille des briques), toggle masque/affiche */}
          <ChannelToggleChips activeChannels={activeChannels} onToggleChannel={onToggleChannel} />
          {/* Statuts : puce colorée = couleur de brique, toggle masque/affiche */}
          <StatusToggleChips activeStatuses={activeStatuses} onToggleStatus={onToggleStatus} />
          {/* Ménage & maintenance sur la grille : même chip .pl-chip que les
              autres (icône balai 15px à la place du logo/dot), off = opacity .4 */}
          <Box
            component="button"
            type="button"
            aria-pressed={filters.showInterventions}
            onClick={() => onShowInterventionsChange(!filters.showInterventions)}
            sx={legendToggleSx(filters.showInterventions)}
          >
            {/* Icône balai à la couleur ménage (spec --menage) */}
            <Box component="span" sx={{ display: 'inline-flex', color: INTERVENTION_TYPE_TOKEN_COLORS.cleaning }}>
              <CleaningServices size={15} strokeWidth={1.75} />
            </Box>
            Interventions
          </Box>
        </Box>
      )}
    </Box>
  );
});

/** Chips togglables des canaux : logo + nom. Un canal désélectionné masque
 *  les briques de ce canal (état local page, non persisté). */
const ChannelToggleChips: React.FC<{
  activeChannels: ReadonlySet<PlanningChannelKey>;
  onToggleChannel: (key: PlanningChannelKey) => void;
}> = ({ activeChannels, onToggleChannel }) => (
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
            sx={legendToggleSx(selected)}
          >
            {ch.logo ? (
              <Box
                component="img"
                src={ch.logo}
                alt=""
                sx={{
                  width: 15,
                  height: 15,
                  objectFit: 'contain',
                  display: 'block',
                  flexShrink: 0,
                }}
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

PlanningToolbar.displayName = 'PlanningToolbar';
export default PlanningToolbar;
