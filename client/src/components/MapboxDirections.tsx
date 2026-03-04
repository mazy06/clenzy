import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { Map as MapIcon, DirectionsWalk } from '@mui/icons-material';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useThemeMode } from '../hooks/useThemeMode';

interface MapboxDirectionsProps {
  origin: [number, number]; // [lng, lat]
  destination: [number, number]; // [lng, lat]
  height?: string | number;
  destinationName?: string;
}

interface RouteInfo {
  distanceKm: number;
  durationMin: number;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ROUTE_SOURCE_ID = 'route-source';
const ROUTE_LAYER_ID = 'route-layer';

const MAP_STYLES = {
  light: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
} as const;

/**
 * Carte Mapbox affichant un itineraire entre deux points.
 * Utilise l'API Directions de Mapbox pour tracer le parcours
 * et afficher la distance et la duree estimee.
 */
export function MapboxDirections({
  origin,
  destination,
  height = 400,
  destinationName,
}: MapboxDirectionsProps) {
  const { isDark } = useThemeMode();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapStyle = isDark ? MAP_STYLES.dark : MAP_STYLES.light;

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current) return;

    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend(origin);
    bounds.extend(destination);

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      bounds,
      fitBoundsOptions: { padding: 80 },
      accessToken: MAPBOX_TOKEN,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapRef.current = map;

    // Origin marker (blue)
    const originMarker = new mapboxgl.Marker({ color: '#1976d2' })
      .setLngLat(origin)
      .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setText('Depart'))
      .addTo(map);

    // Destination marker (orange)
    const destinationPopupText = destinationName ?? 'Destination';
    const destinationMarker = new mapboxgl.Marker({ color: '#f57c00' })
      .setLngLat(destination)
      .setPopup(
        new mapboxgl.Popup({ offset: 25, closeButton: false }).setText(destinationPopupText)
      )
      .addTo(map);

    markersRef.current = [originMarker, destinationMarker];

    map.on('load', () => {
      fetchRoute(map);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // origin/destination identity drives re-mount via key or parent re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin[0], origin[1], destination[0], destination[1], destinationName, mapStyle]);

  async function fetchRoute(map: mapboxgl.Map) {
    setIsLoading(true);
    setError(null);

    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${origin[0]},${origin[1]};${destination[0]},${destination[1]}` +
      `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Directions API error: ${response.status}`);
      }

      const data = await response.json();
      const route = data.routes?.[0];
      if (!route) {
        throw new Error('Aucun itineraire trouve');
      }

      setRouteInfo({
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
      });

      // Draw route on map
      if (map.getSource(ROUTE_SOURCE_ID)) {
        (map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(route.geometry);
      } else {
        map.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: route.geometry,
        });

        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#1976d2',
            'line-width': 4,
            'line-opacity': 0.75,
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement de l\'itineraire';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

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
    <Box sx={{ position: 'relative' }}>
      <Box
        ref={mapContainerRef}
        sx={{
          height,
          width: '100%',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      />

      {/* Route info overlay */}
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            bgcolor: 'background.paper',
            borderRadius: 1,
            px: 2,
            py: 1,
            boxShadow: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Chargement de l'itineraire...
          </Typography>
        </Box>
      )}

      {!isLoading && error && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            bgcolor: 'error.light',
            color: 'error.contrastText',
            borderRadius: 1,
            px: 2,
            py: 1,
            boxShadow: 2,
          }}
        >
          <Typography variant="body2">{error}</Typography>
        </Box>
      )}

      {!isLoading && !error && routeInfo && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            bgcolor: 'background.paper',
            borderRadius: 1,
            px: 2,
            py: 1,
            boxShadow: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <DirectionsWalk sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="body2">
            {routeInfo.distanceKm.toFixed(1)} km &middot;{' '}
            {formatDuration(routeInfo.durationMin)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (remainingMinutes === 0) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}
