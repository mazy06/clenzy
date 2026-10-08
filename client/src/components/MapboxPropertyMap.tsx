import { useThemeMode } from '../hooks/useThemeMode';
import { MapboxMapCanvas, type MapboxPropertyMapProps } from './MapboxMapCanvas';

export type { PropertyMarker, MapBounds, MapboxPropertyMapProps } from './MapboxMapCanvas';

/** The PMS supplies its theme; public projections reuse the same map renderer. */
export function MapboxPropertyMap(props: MapboxPropertyMapProps) {
  const { isDark } = useThemeMode();
  return <MapboxMapCanvas {...props} colorMode={isDark ? 'dark' : 'light'} />;
}
