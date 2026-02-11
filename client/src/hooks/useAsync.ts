import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook générique pour la gestion des opérations asynchrones.
 * Centralise la gestion de loading, error, et data.
 *
 * @example
 * // Chargement automatique au montage
 * const { data, loading, error, retry } = useAsync(
 *   () => propertiesApi.getAll(),
 *   { immediate: true }
 * );
 *
 * @example
 * // Exécution manuelle (ex: soumission de formulaire)
 * const { execute, loading, error } = useAsync(
 *   (formData) => propertiesApi.create(formData),
 *   { immediate: false }
 * );
 * const handleSubmit = () => execute(formData);
 */

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncOptions {
  /** Exécuter automatiquement au montage (default: true) */
  immediate?: boolean;
  /** Callback appelé en cas de succès */
  onSuccess?: (data: any) => void;
  /** Callback appelé en cas d'erreur */
  onError?: (error: string) => void;
  /** Message d'erreur par défaut */
  defaultErrorMessage?: string;
}

export function useAsync<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions = {}
) {
  const {
    immediate = true,
    onSuccess,
    onError,
    defaultErrorMessage = 'Une erreur est survenue',
  } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const mountedRef = useRef(true);
  const asyncFunctionRef = useRef(asyncFunction);
  asyncFunctionRef.current = asyncFunction;

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const result = await asyncFunctionRef.current(...args);
        if (mountedRef.current) {
          setState({ data: result, loading: false, error: null });
          onSuccess?.(result);
        }
        return result;
      } catch (err: any) {
        const errorMessage = err?.message || defaultErrorMessage;
        if (mountedRef.current) {
          setState(prev => ({ ...prev, loading: false, error: errorMessage }));
          onError?.(errorMessage);
        }
        return null;
      }
    },
    [onSuccess, onError, defaultErrorMessage]
  );

  const retry = useCallback(() => {
    return execute();
  }, [execute]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      execute();
    }
    return () => {
      mountedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    execute,
    retry,
    setData,
    setError,
    clearError,
    reset,
  };
}

/**
 * Hook pour les opérations de mutation (create, update, delete).
 * Ne s'exécute PAS automatiquement.
 *
 * @example
 * const { execute: createProperty, loading: creating } = useMutation(
 *   (data) => propertiesApi.create(data),
 *   { onSuccess: () => navigate('/properties') }
 * );
 */
export function useMutation<T, TArgs extends any[] = any[]>(
  mutationFunction: (...args: TArgs) => Promise<T>,
  options: Omit<UseAsyncOptions, 'immediate'> = {}
) {
  return useAsync<T>(mutationFunction as any, { ...options, immediate: false });
}

export default useAsync;
