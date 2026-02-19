import React from 'react';
import { Autocomplete, TextField, CircularProgress, Typography, Box } from '@mui/material';
import { LocationOn as LocationOnIcon } from '@mui/icons-material';
import { useAddressAutocomplete } from '../hooks/useAddressAutocomplete';
import type { BanAddress } from '../services/banApi';

interface AddressAutocompleteProps {
  value: string;
  onSelect: (address: BanAddress) => void;
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
}

/**
 * Composant d'autocompletion d'adresses utilisant l'API BAN (Base Adresse Nationale).
 * Permet de rechercher des adresses francaises avec extraction automatique
 * du departement et de l'arrondissement.
 */
export function AddressAutocomplete({
  value,
  onSelect,
  onChange,
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
  } = useAddressAutocomplete({ debounceMs: 300, minLength: 3 });

  return (
    <Autocomplete<BanAddress, false, false, true>
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
        <li {...props} key={option.citycode + option.label}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <LocationOnIcon sx={{ color: 'text.secondary', fontSize: '1.1rem', mt: 0.3 }} />
            <Box>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                {option.street || option.label}
                {option.housenumber ? ` ${option.housenumber}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                {option.postcode} {option.city}
                {option.department ? ` (${option.department})` : ''}
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
