import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  IconButton,
  Badge,
  Popover,
  Chip,
} from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import {
  GridView,
  ViewList,
  MapIcon,
  FilterList as FilterListIcon,
  Close as CloseIcon,
} from '../icons';
import HeaderSearchField from './HeaderSearchField';

export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface FilterConfig {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  label?: string;
}

export interface ViewToggleConfig {
  mode: 'grid' | 'list' | 'map';
  onChange: (mode: 'grid' | 'list' | 'map') => void;
  /** Boutons de vue à afficher. Défaut : les 3 (grid/list/map). */
  modes?: Array<'grid' | 'list' | 'map'>;
}

export interface FilterSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: {
    type?: FilterConfig;
    status?: FilterConfig;
    priority?: FilterConfig;
    category?: FilterConfig;
    location?: FilterConfig;
    assignedTo?: FilterConfig;
    host?: FilterConfig;
    source?: FilterConfig;
  };
  counter: {
    label: string;
    count: number;
    singular?: string;
    plural?: string;
  };
  viewToggle?: ViewToggleConfig;
  /** When true, renders without Paper wrapper (for inline use in PageHeader) */
  bare?: boolean;
  sx?: SxProps<Theme>;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

// SEARCH_SX retiré : la recherche est désormais une loupe → modale top-centrée
// (HeaderSearchField), plus un TextField inline.

const PAPER_SX = {
  p: 1,
  mb: 1,
  boxShadow: 'none',
  border: '1px solid var(--line)',
  borderRadius: '14px',
  bgcolor: 'var(--card)',
} as const;


const FILTER_SX = {
  minWidth: '160px',
  '& .MuiOutlinedInput-root': {
    fontSize: '12.5px',
    height: 38,
  },
  '& .MuiInputLabel-root': {
    fontSize: '11.5px',
    fontWeight: 600,
    color: 'var(--muted)',
  },
  '& .MuiInputLabel-shrink': {
    fontSize: '11.5px',
  },
  '& .MuiSelect-select': {
    fontSize: '12.5px',
    py: '8px !important',
  },
} as const;

const MENU_ITEM_SX = {
  fontSize: '12.5px',
  py: 0.5,
  minHeight: 32,
} as const;

const COUNTER_SX = {
  fontSize: '11.5px',
  fontWeight: 600,
  color: 'var(--muted)',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
} as const;

const renderFilter = (filterKey: string, filter: FilterConfig) => {
  if (!filter) return null;

  return (
    <FormControl key={filterKey} size="small" sx={FILTER_SX} fullWidth>
      <InputLabel>{filter.label || filterKey}</InputLabel>
      <Select
        value={filter.value}
        label={filter.label || filterKey}
        onChange={(e) => filter.onChange(e.target.value)}
      >
        {filter.options.map((option: FilterOption) => (
          <MenuItem key={option.value} value={option.value} sx={MENU_ITEM_SX}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {option.icon}
              {option.label}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

// Segmented (bascule de vue) — pattern .s-seg (PlanningToolbar) : conteneur
// --field r10 p3, bouton actif fond --card + texte accent + ombre 0 1px 3px
const VIEW_TOGGLE_GROUP_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  backgroundColor: 'var(--field)',
  border: '1px solid var(--field-line)',
  borderRadius: '10px',
  p: '3px',
} as const;

const viewToggleButtonSx = (active: boolean) => ({
  p: 0.5,
  borderRadius: '7px',
  color: active ? 'var(--accent)' : 'var(--muted)',
  backgroundColor: active ? 'var(--card)' : 'transparent',
  boxShadow: active ? '0 1px 3px color-mix(in srgb, var(--ink) 10%, transparent)' : 'none',
  transition: 'background-color 140ms, color 140ms',
  '&:hover': {
    backgroundColor: active ? 'var(--card)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--body)',
  },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
});

export const FilterSearchBar: React.FC<FilterSearchBarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Rechercher...",
  filters,
  counter,
  viewToggle,
  bare = false,
  sx = {}
}) => {
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const filterOpen = Boolean(filterAnchor);

  const getCounterText = () => {
    const { count, singular, plural, label } = counter;
    const suffix = count > 1 ? (plural || 's') : (singular || '');
    return `${count} ${label}${suffix}`;
  };

  // Count active filters (value not empty and not the first "all" option)
  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((f) => {
      if (!f) return false;
      // A filter is "active" if its value is not empty/blank (= first option = "all")
      return f.value !== '' && f.value !== 'all';
    }).length;
  }, [filters]);

  // Get active filter labels for chips
  const activeFilters = useMemo(() => {
    const result: { key: string; label: string; displayValue: string; onClear: () => void }[] = [];
    Object.entries(filters).forEach(([key, filter]) => {
      if (!filter || !filter.value || filter.value === '' || filter.value === 'all') return;
      const selectedOption = filter.options.find((o) => o.value === filter.value);
      if (selectedOption) {
        result.push({
          key,
          label: filter.label || key,
          displayValue: selectedOption.label,
          onClear: () => filter.onChange(''),
        });
      }
    });
    return result;
  }, [filters]);


  const content = (
    <>
      {/* Recherche repliée : loupe → modale top-centrée (cf. HeaderSearchField). */}
      <HeaderSearchField
        value={searchTerm}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
      />

      {/* Active filter chips (inline) */}
      {activeFilters.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', overflow: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
          {activeFilters.map((af) => (
            <Chip
              key={af.key}
              label={`${af.label}: ${af.displayValue}`}
              size="small"
              onDelete={af.onClear}
              deleteIcon={<CloseIcon size={13} strokeWidth={1.75} />}
              sx={{
                // Filtre actif — pattern FilterChipRow : accent-soft / accent
                bgcolor: 'var(--accent-soft)',
                color: 'var(--accent)',
                flexShrink: 0,
                '& .MuiChip-deleteIcon': {
                  color: 'var(--accent)',
                  '&:hover': { color: 'var(--err)' },
                },
              }}
            />
          ))}
        </Box>
      )}

      {/* Counter + Filter button + View toggle */}
      <Box sx={{ ml: 'auto', flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Typography variant="body2" sx={COUNTER_SX}>
          {getCounterText()}
        </Typography>

        {viewToggle ? (() => {
          const shownModes = viewToggle.modes ?? ['grid', 'list', 'map'];
          const modeIcons: Record<'grid' | 'list' | 'map', React.ReactNode> = {
            grid: <GridView size={16} strokeWidth={viewToggle.mode === 'grid' ? 2 : 1.75} />,
            list: <ViewList size={16} strokeWidth={viewToggle.mode === 'list' ? 2 : 1.75} />,
            map: <MapIcon size={16} strokeWidth={viewToggle.mode === 'map' ? 2 : 1.75} />,
          };
          return (
            <Box sx={VIEW_TOGGLE_GROUP_SX}>
              {shownModes.map((mode) => (
                <IconButton
                  key={mode}
                  size="small"
                  onClick={() => viewToggle.onChange(mode)}
                  aria-pressed={viewToggle.mode === mode}
                  sx={viewToggleButtonSx(viewToggle.mode === mode)}
                >
                  {modeIcons[mode]}
                </IconButton>
              ))}
            </Box>
          );
        })() : null}

        {/* Filter button with badge */}
        <IconButton
          size="small"
          onClick={(e) => setFilterAnchor(e.currentTarget)}
          aria-label="Filtres"
          sx={{
            p: 0.5,
            borderRadius: '9px',
            color: filterOpen || activeFilterCount > 0 ? 'var(--accent)' : 'var(--muted)',
            bgcolor: filterOpen || activeFilterCount > 0 ? 'var(--accent-soft)' : 'transparent',
            border: '1px solid',
            borderColor: filterOpen || activeFilterCount > 0 ? 'var(--accent)' : 'var(--line-2)',
            '&:hover': {
              bgcolor: filterOpen || activeFilterCount > 0 ? 'var(--accent-soft)' : 'var(--hover)',
              color: filterOpen || activeFilterCount > 0 ? 'var(--accent)' : 'var(--ink)',
            },
          }}
        >
          <Badge
            badgeContent={activeFilterCount}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '10.5px',
                fontWeight: 700,
                height: 16,
                minWidth: 16,
                bgcolor: 'var(--accent)',
                color: 'var(--on-accent)',
              },
            }}
          >
            <FilterListIcon size={16} strokeWidth={1.75} />
          </Badge>
        </IconButton>

        {/* Filter popover */}
        <Popover
          open={filterOpen}
          anchorEl={filterAnchor}
          onClose={() => setFilterAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              // r12 + hairline + --shadow-pop hérités du thème global (MuiPopover)
              sx: {
                mt: 1,
                p: 2,
                minWidth: 280,
                maxWidth: 340,
              },
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontSize: '10.5px',
                fontWeight: 700,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--faint)',
              }}
            >
              Filtres
            </Typography>
            <IconButton size="small" onClick={() => setFilterAnchor(null)} sx={{ p: 0.25 }}>
              <CloseIcon size={16} />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {Object.entries(filters).map(([key, filter]) =>
              filter ? renderFilter(key, filter) : null
            )}
          </Box>
          {activeFilterCount > 0 && (
            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid var(--line)' }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12px',
                  '&:hover': { textDecoration: 'underline' },
                }}
                onClick={() => {
                  Object.values(filters).forEach((f) => f?.onChange(''));
                }}
              >
                Effacer tous les filtres
              </Typography>
            </Box>
          )}
        </Popover>
      </Box>

    </>
  );

  if (bare) {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 1, alignItems: 'center', width: '100%', overflow: 'hidden' }}>
        {content}
      </Box>
    );
  }

  return (
    <Paper sx={{ ...PAPER_SX, ...sx }}>
      <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 1, alignItems: 'center', overflow: 'hidden' }}>
        {content}
      </Box>
    </Paper>
  );
};

export default FilterSearchBar;
