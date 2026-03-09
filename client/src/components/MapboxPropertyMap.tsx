import React, { useRef, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { Map as MapIcon } from '@mui/icons-material';
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
  onMarkerClickRef.current = onMarkerClick;
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;

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
    map.on('moveend', () => emitBounds());
    mapRef.current = map;

    return () => {
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
  }, [properties, clearMarkers, emitBounds]);

  if (!MAPBOX_TOKEN) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.100',
          borderRadius: 1,
          gap: 1,
        }}
      >
        <MapIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography variant="body2" color="text.secondary">
          Carte indisponible : token Mapbox non configure (VITE_MAPBOX_TOKEN)
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={mapContainerRef}
      sx={{
        height,
        width: '100%',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    />
  );
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
