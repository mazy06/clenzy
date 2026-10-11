import { useThemeMode } from '../hooks/useThemeMode';
import { BaitlyMapCanvas, type BaitlyPropertyMapProps } from './BaitlyMapCanvas';

export type { PropertyMarker, PropertyMarkerType, MapBounds, BaitlyPropertyMapProps } from './BaitlyMapCanvas';

/** The PMS supplies its theme; public projections reuse the same map renderer. */
export function BaitlyPropertyMap(props: BaitlyPropertyMapProps) {
  const { isDark } = useThemeMode();
  return <BaitlyMapCanvas {...props} colorMode={isDark ? 'dark' : 'light'} />;
}
