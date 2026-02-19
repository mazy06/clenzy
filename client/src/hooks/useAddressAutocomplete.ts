import { useState, useCallback, useRef, useEffect } from 'react';
import { banApi } from '../services/banApi';
import type { BanAddress } from '../services/banApi';

interface UseAddressAutocompleteOptions {
  debounceMs?: number;
  minLength?: number;
  limit?: number;
}

interface UseAddressAutocompleteReturn {
  options: BanAddress[];
  isLoading: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  reset: () => void;
}

/**
 * Hook pour l'autocompletion d'adresses via l'API BAN.
 * Debounce integre pour eviter les appels excessifs.
 */
export function useAddressAutocomplete(
  opts: UseAddressAutocompleteOptions = {}
): UseAddressAutocompleteReturn {
  const { debounceMs = 300, minLength = 3, limit = 5 } = opts;

  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<BanAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAddresses = useCallback(
    async (query: string) => {
      if (query.trim().length < minLength) {
        setOptions([]);
        return;
      }

      // Cancel previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      setIsLoading(true);
      try {
        const results = await banApi.search(query, limit);
        setOptions(results);
      } catch {
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [minLength, limit]
  );

  // Debounced search on inputValue change
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      fetchAddresses(inputValue);
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [inputValue, debounceMs, fetchAddresses]);

  const reset = useCallback(() => {
    setInputValue('');
    setOptions([]);
  }, []);

  return {
    options,
    isLoading,
    inputValue,
    setInputValue,
    reset,
  };
}
