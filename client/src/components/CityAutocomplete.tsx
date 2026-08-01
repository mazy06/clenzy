import React from 'react';
import { Spinner } from './ui';
// Autocomplete + TextField restent MUI et ensemble : `renderInput` recoit des
// props internes de l'Autocomplete (ref d'ancrage, handlers de clavier, etat de
// popup) qu'aucun primitif du kit ne sait accepter.
import { Autocomplete, TextField } from '@mui/material';
import { LocationCity as LocationCityIcon } from '../icons';
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
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <li key={key} {...optionProps}>
            <div className="flex items-start gap-1.5">
              <span className="inline-flex text-muted-foreground mt-0.5"><LocationCityIcon size={18} strokeWidth={1.75} /></span>
              <div>
                <p className="cn-text-body2 text-[0.85rem]">
                  {option.city || option.label}
                </p>
                <span className="cn-text-caption text-muted-foreground text-[0.72rem]">
                  {option.postcode && `${option.postcode} · `}
                  {option.department && `(${option.department}) · `}
                  {option.country || option.countryCode}
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
      noOptionsText="Aucune ville trouvee"
      loadingText="Recherche..."
      size={size}
      fullWidth={fullWidth}
    />
  );
}
