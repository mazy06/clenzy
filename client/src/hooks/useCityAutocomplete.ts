import { useState, useCallback, useRef, useEffect } from 'react';
import { geocoderApi, type GeocodedAddress } from '../services/geocoderApi';

interface UseCityAutocompleteOptions {
  debounceMs?: number;
  minLength?: number;
  limit?: number;
  /** Code ISO 3166-1 alpha-2 (FR, MA, DZ, SA). Defaut FR. */
  countryCode?: string;
}

interface UseCityAutocompleteReturn {
  options: GeocodedAddress[];
  isLoading: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  reset: () => void;
}

/**
 * Hook pour l'autocompletion de villes uniquement.
 * Route automatiquement vers BAN (FR, type=municipality) ou Nominatim (autres, featuretype=city).
 */
export function useCityAutocomplete(
  opts: UseCityAutocompleteOptions = {}
): UseCityAutocompleteReturn {
  const { minLength = 2, limit = 5, countryCode = 'FR' } = opts;
  const debounceMs = opts.debounceMs ?? (countryCode.toUpperCase() === 'FR' ? 300 : 600);

  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<GeocodedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCities = useCallback(
    async (query: string) => {
      if (query.trim().length < minLength) {
        setOptions([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await geocoderApi.searchCities(query, countryCode, limit);
        setOptions(results);
      } catch {
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [minLength, limit, countryCode]
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchCities(inputValue), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inputValue, debounceMs, fetchCities]);

  useEffect(() => {
    setOptions([]);
  }, [countryCode]);

  const reset = useCallback(() => {
    setInputValue('');
    setOptions([]);
  }, []);

  return { options, isLoading, inputValue, setInputValue, reset };
}
