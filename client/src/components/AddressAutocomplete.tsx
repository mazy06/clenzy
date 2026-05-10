import React from 'react';
import { Autocomplete, TextField, CircularProgress, Typography, Box } from '@mui/material';
import { LocationOn as LocationOnIcon } from '../icons';
import { useAddressAutocomplete } from '../hooks/useAddressAutocomplete';
import type { GeocodedAddress } from '../services/geocoderApi';

interface AddressAutocompleteProps {
  value: string;
  onSelect: (address: GeocodedAddress) => void;
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
 * Composant d'autocompletion d'adresses worldwide.
 * Route automatiquement vers BAN (France) ou Nominatim (autres pays) selon countryCode.
 */
export function AddressAutocomplete({
  value,
  onSelect,
  onChange,
  countryCode = 'FR',
  label = 'Adresse',
  placeholder = 'Rechercher une adresse...',
  error,
  helperText,
  required,
  size = 'small',
  fullWidth = true,
}: AddressAutocompleteProps) {
  const {
    options,
    isLoading,
    inputValue,
    setInputValue,
  } = useAddressAutocomplete({ countryCode, minLength: 3 });

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
          setInputValue(newValue.label);
        }
      }}
      getOptionLabel={(option) => {
        if (typeof option === 'string') return option;
        return option.label;
      }}
      isOptionEqualToValue={(option, val) => option.label === val.label}
      filterOptions={(x) => x}
      renderOption={(props, option) => (
        <li {...props} key={`${option.label}-${option.latitude}-${option.longitude}`}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mt: 0.3 }}><LocationOnIcon size={18} strokeWidth={1.75} /></Box>
            <Box>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                {option.housenumber ? `${option.housenumber} ` : ''}
                {option.street || option.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                {option.postcode} {option.city}
                {option.department ? ` (${option.department})` : ''}
                {option.countryCode && option.countryCode !== 'FR' ? ` · ${option.countryCode}` : ''}
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
      noOptionsText="Aucune adresse trouvee"
      loadingText="Recherche..."
      size={size}
      fullWidth={fullWidth}
    />
  );
}
