import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material';
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
  /** Statuts visibles (rangée Statuts) — tout sélectionné par défaut. */
  activeStatuses: ReadonlySet<ReservationStatus>;
  onToggleStatus: (status: ReservationStatus) => void;
}

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
  activeStatuses,
  onToggleStatus,
}) => {
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
          statuts puis Interventions, sans libellés de rangée. Migrée dans la
          modale de filtres quand `legendInModal` (viewport compact OU
          constellation d'agents déployée) pour ne jamais dupliquer les chips. */}
      {!legendInModal && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* Canaux : LOGO de canal (la pastille des briques), toggle masque/affiche */}
          <ChannelLegendChips activeChannels={activeChannels} onToggleChannel={onToggleChannel} />
          {/* Statuts : puce colorée = couleur de brique, toggle masque/affiche */}
          <StatusLegendChips activeStatuses={activeStatuses} onToggleStatus={onToggleStatus} />
          {/* Ménage & maintenance sur la grille : même chip .pl-chip que les autres */}
          <InterventionLegendChip
            active={filters.showInterventions}
            onToggle={() => onShowInterventionsChange(!filters.showInterventions)}
          />
        </Box>
      )}
    </Box>
  );
});

PlanningToolbar.displayName = 'PlanningToolbar';
export default PlanningToolbar;
