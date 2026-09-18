import { useCallback, useRef, useState, type SetStateAction } from 'react';
import { useUserPreference } from '../../hooks/useUserPreference';

/** Le backend porte le filtre ; une panne de préférences permet une utilisation locale temporaire. */
export function useMarketplaceFilterState<T>(key: string, initial: T) {
  const [stored, save, status] = useUserPreference<T>('marketplace.admin.' + key, initial);
  const [temporary, setTemporary] = useState(initial);
  const valid = Array.isArray(initial)
    ? Array.isArray(stored) && stored.every(item => typeof item === 'string')
    : typeof stored === typeof initial;
  const value = status.isLoaded ? (valid ? stored : initial) : temporary;
  const current = useRef(value);
  current.current = value;
  const setValue = useCallback((action: SetStateAction<T>) => {
    const next = typeof action === 'function'
      ? (action as (previous: T) => T)(current.current) : action;
    current.current = next;
    if (status.isLoaded) save(next);
    else setTemporary(next);
  }, [save, status.isLoaded]);
  return [value, setValue, status] as const;
}
