import React from 'react';
import { Spinner } from './ui';
import { Autocomplete, TextField } from '@mui/material';
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
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <li key={key} {...optionProps}>
            <div className="flex items-start gap-1.5">
              <span className="inline-flex text-muted-foreground mt-0.5"><LocationOnIcon size={18} strokeWidth={1.75} /></span>
              <div>
                <p className="cn-text-body2 text-[0.85rem]">
                  {option.housenumber ? `${option.housenumber} ` : ''}
                  {option.street || option.label}
                </p>
                <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
                  {option.postcode} {option.city}
                  {option.department ? ` (${option.department})` : ''}
                  {option.countryCode && option.countryCode !== 'FR' ? ` · ${option.countryCode}` : ''}
                </span>
              </div>
            </div>
          </li>
        );
      }}
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
                {isLoading ? <Spinner className="size-[18px]" /> : null}
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
