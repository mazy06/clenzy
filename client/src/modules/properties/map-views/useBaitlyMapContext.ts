import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUserPreference } from '../../../hooks/useUserPreference';
import { DEFAULT_MAP_CONTEXT, normalizeMapContext, type BaitlyMapContext } from './baitlyMapContext';
import type { PropertyMapView } from './propertyMapView';

/** Le serveur conserve le contexte ; aucun push des valeurs par défaut avant hydratation. */
export function useBaitlyMapContext(view: PropertyMapView, onViewChange?: (view: PropertyMapView) => void) {
  const [stored, save, { isLoaded }] = useUserPreference('map.context.v1', DEFAULT_MAP_CONTEXT);
  const [context, setContext] = useState(DEFAULT_MAP_CONTEXT);
  const [ready, setReady] = useState(false);
  const touched = useRef(false);
  const [params] = useSearchParams();
  const patch = useCallback((next: Partial<BaitlyMapContext>) => {
    touched.current = true;
    setContext(current => normalizeMapContext({ ...current, ...next }));
  }, []);
  useEffect(() => {
    if (!isLoaded || ready) return;
    const restored = normalizeMapContext(stored);
    if (!touched.current) {
      const nextView = params.has('tab') ? view : restored.view;
      setContext({ ...restored, view: nextView });
      if (nextView !== view) onViewChange?.(nextView);
    }
    setReady(true);
  }, [isLoaded, ready, stored, params, view, onViewChange]);
  useEffect(() => {
    if (ready) setContext(current => current.view === view ? current : { ...current, view });
  }, [view, ready]);
  useEffect(() => {
    if (isLoaded && ready && JSON.stringify(context) !== JSON.stringify(stored)) save(context);
  }, [context, stored, isLoaded, ready, save]);
  return { context, patch, ready, reset: () => {
    patch(DEFAULT_MAP_CONTEXT);
    onViewChange?.('properties');
  } };
}
