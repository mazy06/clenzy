import React, { useRef, useEffect, useCallback } from 'react';
import { MapIcon } from '../icons';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useThemeMode } from '../hooks/useThemeMode';

export interface PropertyMarker {
  lat: number;
  lng: number;
  name: string;
  id?: number;
  type?: 'property' | 'key_exchange';
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface MapboxPropertyMapProps {
  properties: PropertyMarker[];
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  height?: string | number;
  onMarkerClick?: (property: PropertyMarker) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DEFAULT_CENTER: [number, number] = [2.3522, 48.8566]; // Paris
const DEFAULT_ZOOM = 12;

const MAP_STYLES = {
  light: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
} as const;

const MARKER_COLORS: Record<string, string> = {
  property: '#1976d2',
  key_exchange: '#f57c00',
};

/**
 * Carte Mapbox affichant des marqueurs de proprietes.
 * Supporte deux types de marqueurs (property / key_exchange) avec des couleurs distinctes.
 * Affiche un popup au clic sur un marqueur.
 */
export function MapboxPropertyMap({
  properties,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  height = 400,
  onMarkerClick,
  onBoundsChange,
}: MapboxPropertyMapProps) {
  const { isDark } = useThemeMode();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onBoundsChangeRef = useRef(onBoundsChange);
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onBoundsChangeRef.current = onBoundsChange;
  }, [onMarkerClick, onBoundsChange]);

  const mapStyle = isDark ? MAP_STYLES.dark : MAP_STYLES.light;

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
  }, []);

  const emitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !onBoundsChangeRef.current) return;
    const b = map.getBounds();
    if (!b) return;
    onBoundsChangeRef.current({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center,
      zoom,
      accessToken: MAPBOX_TOKEN,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    const handleMoveEnd = () => emitBounds();
    map.on('moveend', handleMoveEnd);
    mapRef.current = map;

    return () => {
      map.off('moveend', handleMoveEnd);
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom, clearMarkers, mapStyle, emitBounds]);

  // Sync markers with properties
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const addMarkers = () => {
      clearMarkers();

      properties.forEach((property) => {
        const markerType = property.type ?? 'property';
        const color = MARKER_COLORS[markerType] ?? MARKER_COLORS.property;

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
          `<strong>${escapeHtml(property.name)}</strong>`
        );

        const marker = new mapboxgl.Marker({ color })
          .setLngLat([property.lng, property.lat])
          .setPopup(popup)
          .addTo(map);

        marker.getElement().addEventListener('click', () => {
          onMarkerClickRef.current?.(property);
        });

        markersRef.current.push(marker);
      });

      // Fit bounds when there are multiple markers
      if (properties.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        properties.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
      }

      // Emit initial bounds after markers settle
      requestAnimationFrame(() => emitBounds());
    };

    if (map.loaded()) {
      addMarkers();
    } else {
      map.on('load', addMarkers);
    }

    return () => {
      map.off('load', addMarkers);
    };
  }, [properties, clearMarkers, emitBounds]);

  if (!MAPBOX_TOKEN) {
    return (
      // `height` vient des props (valeur d'execution) : elle reste en style inline.
      <div
        className="flex flex-col items-center justify-center gap-1.5 rounded-lg bg-[var(--hover)]"
        style={{ height }}
      >
        <span className="inline-flex text-muted-foreground opacity-60"><MapIcon size={48} strokeWidth={1.5} /></span>
        <p className="cn-text-body2 text-muted-foreground">
          Carte indisponible : token Mapbox non configure (VITE_MAPBOX_TOKEN)
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="w-full rounded-lg overflow-hidden"
      style={{ height }}
    />
  );
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
