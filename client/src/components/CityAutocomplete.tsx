import React from 'react';
import { Autocomplete, TextField, CircularProgress, Typography, Box } from '@mui/material';
import { LocationCity as LocationCityIcon } from '@mui/icons-material';
import { useCityAutocomplete } from '../hooks/useCityAutocomplete';
import type { GeocodedAddress } from '../services/geocoderApi';

interface CityAutocompleteProps {
  value: string;
  onSelect: (city: GeocodedAddress) => void;
  onChange?: (value: string) => void;
  /** Code ISO 3166-1 alpha-2 (FR, MA, DZ, SA). Defaut FR. */
  countryCode?: string;
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
}

/**
 * Autocomplete de villes worldwide.
 * Route vers BAN (FR, type=municipality) ou Nominatim (autres, featuretype=city) selon countryCode.
 */
export function CityAutocomplete({
  value,
  onSelect,
  onChange,
  countryCode = 'FR',
  label = 'Ville',
  placeholder = 'Rechercher une ville...',
  error,
  helperText,
  required,
  size = 'small',
  fullWidth = true,
}: CityAutocompleteProps) {
  const { options, isLoading, inputValue, setInputValue } = useCityAutocomplete({
    countryCode,
    minLength: 2,
  });

  return (
    <Autocomplete<GeocodedAddress, false, false, true>
      freeSolo
      options={options}
      loading={isLoading}
      inputValue={inputValue || value || ''}
      onInputChange={(_event, newInputValue, reason) => {
        setInputValue(newInputValue);
        if (reason === 'input' && onChange) {
          onChange(newInputValue);
        }
      }}
      onChange={(_event, newValue) => {
        if (newValue && typeof newValue !== 'string') {
          onSelect(newValue);
          setInputValue(newValue.city || newValue.label);
        }
      }}
      getOptionLabel={(option) => {
        if (typeof option === 'string') return option;
        return option.city || option.label;
      }}
      isOptionEqualToValue={(option, val) => option.label === val.label}
      filterOptions={(x) => x}
      renderOption={(props, option) => (
        <li {...props} key={`${option.label}-${option.latitude}-${option.longitude}`}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <LocationCityIcon sx={{ color: 'text.secondary', fontSize: '1.1rem', mt: 0.3 }} />
            <Box>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                {option.city || option.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                {option.postcode && `${option.postcode} · `}
                {option.department && `(${option.department}) · `}
                {option.country || option.countryCode}
              </Typography>
            </Box>
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          error={error}
          helperText={helperText}
          required={required}
          size={size}
          fullWidth={fullWidth}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      noOptionsText="Aucune ville trouvee"
      loadingText="Recherche..."
      size={size}
      fullWidth={fullWidth}
    />
  );
}
