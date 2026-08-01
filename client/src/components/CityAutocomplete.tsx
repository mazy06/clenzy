import React, { useId } from 'react';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  InputGroupAddon,
  Spinner,
} from './ui';
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
  /** Conserve pour les appelants : le champ du kit n'a qu'un seul gabarit. */
  size?: 'small' | 'medium';
  /** Conserve pour les appelants : le champ du kit occupe deja toute la largeur. */
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
}: CityAutocompleteProps) {
  const inputId = useId();
  const { options, isLoading, inputValue, setInputValue } = useCityAutocomplete({
    countryCode,
    minLength: 2,
  });

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>{required ? `${label} *` : label}</FieldLabel>
      {/* `filter={null}` : la liste vient deja filtree du geocodeur — equivalent
          du `filterOptions={(x) => x}` de MUI. La saisie libre (ancien freeSolo)
          reste possible : seule l'entree est controlee, la selection est
          consommee dans onValueChange sans jamais etre imposee au champ. */}
      <Combobox<GeocodedAddress>
        items={options}
        filter={null}
        itemToStringLabel={(option) => option.city || option.label}
        isItemEqualToValue={(option, other) => option.label === other.label}
        inputValue={inputValue || value || ''}
        onInputValueChange={(next, details) => {
          setInputValue(next);
          // `input-change` est le pendant du reason 'input' de MUI : on ne
          // remonte que la frappe utilisateur, pas les recalages internes.
          if (details.reason === 'input-change' && onChange) {
            onChange(next);
          }
        }}
        onValueChange={(next) => {
          if (next) {
            onSelect(next);
            setInputValue(next.city || next.label);
          }
        }}
      >
        <ComboboxInput
          id={inputId}
          placeholder={placeholder}
          required={required}
          aria-invalid={error || undefined}
        >
          {isLoading && (
            <InputGroupAddon align="inline-end">
              <Spinner className="size-[18px]" />
            </InputGroupAddon>
          )}
        </ComboboxInput>
        <ComboboxContent>
          <ComboboxEmpty>{isLoading ? 'Recherche...' : 'Aucune ville trouvee'}</ComboboxEmpty>
          <ComboboxList>
            {(option: GeocodedAddress) => (
              <ComboboxItem key={option.label} value={option}>
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
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {helperText && (
        error
          ? <FieldError>{helperText}</FieldError>
          : <FieldDescription>{helperText}</FieldDescription>
      )}
    </Field>
  );
}
