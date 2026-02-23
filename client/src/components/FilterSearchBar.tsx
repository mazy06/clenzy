import React from 'react';
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
} from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { Search, GridView, ViewList } from '@mui/icons-material';

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
  mode: 'grid' | 'list';
  onChange: (mode: 'grid' | 'list') => void;
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
  };
  counter: {
    label: string;
    count: number;
    singular?: string;
    plural?: string;
  };
  viewToggle?: ViewToggleConfig;
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
  minWidth: '120px',
  flex: '0 0 auto',
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
  sx = {}
}) => {
  const getCounterText = () => {
    const { count, singular, plural, label } = counter;
    const suffix = count > 1 ? (plural || 's') : (singular || '');
    return `${count} ${label}${suffix}`;
  };

  const renderFilter = (filterKey: string, filter: FilterConfig) => {
    if (!filter) return null;

    return (
      <FormControl key={filterKey} size="small" sx={FILTER_SX}>
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

  return (
    <Paper sx={{ ...PAPER_SX, ...sx }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
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
                <Search sx={{ fontSize: 16, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />

        {/* Dynamic filters */}
        {Object.entries(filters).map(([key, filter]) =>
          filter ? renderFilter(key, filter) : null
        )}

        {/* Counter + View toggle */}
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
                <GridView />
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
                <ViewList />
              </IconButton>
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default FilterSearchBar;
