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
  Chip
} from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { Search } from '@mui/icons-material';

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

export interface FilterSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: {
    type?: {
      value: string;
      options: FilterOption[];
      onChange: (value: string) => void;
      label?: string;
    };
    status?: {
      value: string;
      options: FilterOption[];
      onChange: (value: string) => void;
      label?: string;
    };
    priority?: {
      value: string;
      options: FilterOption[];
      onChange: (value: string) => void;
      label?: string;
    };
    category?: {
      value: string;
      options: FilterOption[];
      onChange: (value: string) => void;
      label?: string;
    };
    location?: {
      value: string;
      options: FilterOption[];
      onChange: (value: string) => void;
      label?: string;
    };
    assignedTo?: {
      value: string;
      options: FilterOption[];
      onChange: (value: string) => void;
      label?: string;
    };
    host?: {
      value: string;
      options: FilterOption[];
      onChange: (value: string) => void;
      label?: string;
    };
  };
  counter: {
    label: string;
    count: number;
    singular?: string;
    plural?: string;
  };
  sx?: SxProps<Theme>;
}

export const FilterSearchBar: React.FC<FilterSearchBarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Rechercher...",
  filters,
  counter,
  sx = {}
}) => {
  // Fonction pour générer le texte du compteur
  const getCounterText = () => {
    const { count, singular, plural, label } = counter;
    const suffix = count > 1 ? (plural || 's') : (singular || '');
    return `${count} ${label}${suffix}`;
  };

  // Fonction pour rendre un filtre
  const renderFilter = (filterKey: string, filter: FilterConfig) => {
    if (!filter) return null;

    return (
      <FormControl key={filterKey} size="small" sx={{ minWidth: '140px', flex: '0 0 auto' }}>
        <InputLabel sx={{ fontSize: '0.875rem' }}>{filter.label || filterKey}</InputLabel>
        <Select
          value={filter.value}
          label={filter.label || filterKey}
          onChange={(e) => filter.onChange(e.target.value)}
          sx={{
            fontSize: '0.875rem',
            '& .MuiSelect-select': {
              fontSize: '0.875rem',
            },
          }}
        >
          {filter.options.map((option: FilterOption) => (
            <MenuItem key={option.value} value={option.value} sx={{ fontSize: '0.875rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
    <Paper sx={{ p: 3, mb: 3, ...sx }}>
      {/* Ligne unique : Recherche, Filtres et Compteur */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        {/* Champ de recherche */}
        <TextField
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          size="small"
          sx={{
            minWidth: '250px',
            flex: '0 0 auto',
            fontSize: '0.875rem',
            '& .MuiOutlinedInput-root': {
              fontSize: '0.875rem',
            },
            '& .MuiInputBase-input': {
              fontSize: '0.875rem',
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />

        {/* Filtres dynamiques */}
        {Object.entries(filters).map(([key, filter]) => 
          filter ? renderFilter(key, filter) : null
        )}

        {/* Compteur avec espace suffisant */}
        <Box sx={{ 
          ml: 'auto', 
          flex: '0 0 auto',
          minWidth: '120px',
          textAlign: 'right'
        }}>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              fontSize: '0.875rem',
              whiteSpace: 'nowrap'
            }}
          >
            {getCounterText()}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default FilterSearchBar;
