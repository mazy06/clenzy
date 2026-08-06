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
  /** Conserve pour les appelants : le champ du kit n'a qu'un seul gabarit. */
  size?: 'small' | 'medium';
  /** Conserve pour les appelants : le champ du kit occupe deja toute la largeur. */
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
}: AddressAutocompleteProps) {
  const inputId = useId();
  const {
    options,
    isLoading,
    inputValue,
    setInputValue,
  } = useAddressAutocomplete({ countryCode, minLength: 3 });

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>{required ? `${label} *` : label}</FieldLabel>
      {/* `filter={null}` : la liste est deja filtree par le geocodeur cote
          serveur — c'est l'equivalent du `filterOptions={(x) => x}` de MUI.
          `value` reste NON controle : seule la saisie l'est, la selection est
          consommee dans onValueChange. */}
      <Combobox<GeocodedAddress>
        items={options}
        filter={null}
        itemToStringLabel={(option) => option.label}
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
            setInputValue(next.label);
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
          <ComboboxEmpty>{isLoading ? 'Recherche...' : 'Aucune adresse trouvee'}</ComboboxEmpty>
          <ComboboxList>
            {(option: GeocodedAddress) => (
              <ComboboxItem key={option.label} value={option}>
                <div className="flex items-start gap-1.5">
                  <span className="inline-flex text-muted-foreground mt-0.5"><LocationOnIcon size={18} strokeWidth={1.75} /></span>
                  <div>
                    <p className="text-sm">
                      {option.housenumber ? `${option.housenumber} ` : ''}
                      {option.street || option.label}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {option.postcode} {option.city}
                      {option.department ? ` (${option.department})` : ''}
                      {option.countryCode && option.countryCode !== 'FR' ? ` · ${option.countryCode}` : ''}
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
