import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  TextField,
  InputAdornment,
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
  Search,
  GridView,
  ViewList,
  MapIcon,
  FilterList as FilterListIcon,
  Close as CloseIcon,
} from '../icons';

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

const PAPER_SX = {
  p: 1,
  mb: 1,
  boxShadow: 'none',
  border: '1px solid',
  borderColor: 'divider',
} as const;

const SEARCH_SX = {
  minWidth: '200px',
  flex: '0 0 auto',
  '& .MuiOutlinedInput-root': {
    fontSize: '0.8125rem',
    height: 34,
  },
  '& .MuiInputBase-input': {
    fontSize: '0.8125rem',
    py: 0.5,
  },
  '& .MuiInputBase-input::placeholder': {
    fontSize: '0.8125rem',
  },
} as const;

const FILTER_SX = {
  minWidth: '160px',
  '& .MuiOutlinedInput-root': {
    fontSize: '0.8125rem',
    height: 34,
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.01em',
  },
  '& .MuiInputLabel-shrink': {
    fontSize: '0.75rem',
  },
  '& .MuiSelect-select': {
    fontSize: '0.8125rem',
    py: '6px !important',
  },
} as const;

const MENU_ITEM_SX = {
  fontSize: '0.8125rem',
  py: 0.5,
  minHeight: 32,
} as const;

const COUNTER_SX = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'primary.main',
  whiteSpace: 'nowrap',
  letterSpacing: '0.01em',
} as const;

const VIEW_TOGGLE_BUTTON_SX = {
  p: 0.5,
  borderRadius: 1,
  '& .MuiSvgIcon-root': { fontSize: 18 },
} as const;

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

  const content = (
    <>
      {/* Search field */}
      <TextField
        placeholder={searchPlaceholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        size="small"
        sx={SEARCH_SX}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={16} color="currentColor" style={{ color: 'rgba(0,0,0,0.6)' }} />
            </InputAdornment>
          ),
        }}
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
              deleteIcon={<CloseIcon size={14} />}
              sx={{
                height: 24,
                fontSize: '0.6875rem',
                fontWeight: 500,
                bgcolor: 'rgba(107,138,154,0.08)',
                color: 'text.primary',
                flexShrink: 0,
                '& .MuiChip-deleteIcon': {
                  color: 'text.secondary',
                  '&:hover': { color: 'error.main' },
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

        {viewToggle && (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <IconButton
              size="small"
              onClick={() => viewToggle.onChange('grid')}
              sx={{
                ...VIEW_TOGGLE_BUTTON_SX,
                color: viewToggle.mode === 'grid' ? 'primary.main' : 'text.disabled',
                bgcolor: viewToggle.mode === 'grid' ? 'rgba(107,138,154,0.08)' : 'transparent',
              }}
            >
              <GridView size={18} strokeWidth={1.75} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => viewToggle.onChange('list')}
              sx={{
                ...VIEW_TOGGLE_BUTTON_SX,
                color: viewToggle.mode === 'list' ? 'primary.main' : 'text.disabled',
                bgcolor: viewToggle.mode === 'list' ? 'rgba(107,138,154,0.08)' : 'transparent',
              }}
            >
              <ViewList size={18} strokeWidth={1.75} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => viewToggle.onChange('map')}
              sx={{
                ...VIEW_TOGGLE_BUTTON_SX,
                color: viewToggle.mode === 'map' ? 'primary.main' : 'text.disabled',
                bgcolor: viewToggle.mode === 'map' ? 'rgba(107,138,154,0.08)' : 'transparent',
              }}
            >
              <MapIcon size={18} strokeWidth={1.75} />
            </IconButton>
          </Box>
        )}

        {/* Filter button with badge */}
        <IconButton
          size="small"
          onClick={(e) => setFilterAnchor(e.currentTarget)}
          sx={{
            ...VIEW_TOGGLE_BUTTON_SX,
            color: filterOpen || activeFilterCount > 0 ? 'primary.main' : 'text.secondary',
            bgcolor: filterOpen || activeFilterCount > 0 ? 'rgba(107,138,154,0.08)' : 'transparent',
            border: '1px solid',
            borderColor: filterOpen || activeFilterCount > 0 ? 'primary.main' : 'divider',
          }}
        >
          <Badge
            badgeContent={activeFilterCount}
            color="primary"
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.625rem',
                height: 16,
                minWidth: 16,
              },
            }}
          >
            <FilterListIcon size={18} strokeWidth={1.75} />
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
              sx: {
                mt: 1,
                p: 2,
                minWidth: 280,
                maxWidth: 340,
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              },
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
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
            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'primary.main',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.75rem',
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
