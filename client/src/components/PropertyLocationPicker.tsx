import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Alert, Tooltip, CircularProgress } from '@mui/material';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { LocationOn, DirectionsWalk } from '../icons';
import { useThemeMode } from '../hooks/useThemeMode';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const MAP_STYLES = {
  light: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
} as const;

// Fallback : centre de la France métropolitaine
const DEFAULT_FALLBACK: [number, number] = [2.3522, 48.8566];

export interface PropertyLocationPickerProps {
  /** Latitude actuelle (null/undefined si non définie) */
  latitude: number | null | undefined;
  /** Longitude actuelle (null/undefined si non définie) */
  longitude: number | null | undefined;
  /** Appelé chaque fois que le pin bouge (drag ou clic carte) */
  onChange: (lat: number, lng: number) => void;
  /** Centre de repli si pas de coords (ex : centre ville) */
  fallbackCenter?: { lat: number; lng: number } | null;
  /** Hauteur du conteneur de carte */
  height?: number;
  /** Texte d'aide affiché en haut */
  helperText?: string;
}

export function PropertyLocationPicker({
  latitude,
  longitude,
  onChange,
  fallbackCenter,
  height = 280,
  helperText,
}: PropertyLocationPickerProps) {
  const { isDark } = useThemeMode();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const hasCoords = latitude != null && longitude != null;

  // Calcule le centre de départ : coords actuelles > fallback > défaut
  const initialCenter: [number, number] = hasCoords
    ? [longitude as number, latitude as number]
    : fallbackCenter
      ? [fallbackCenter.lng, fallbackCenter.lat]
      : DEFAULT_FALLBACK;
  const initialZoom = hasCoords ? 15 : fallbackCenter ? 12 : 5;

  const movePin = useCallback((lng: number, lat: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
        background: #ef4444; transform: rotate(-45deg);
        border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: grab;
      `;
      markerRef.current = new mapboxgl.Marker({ element: el, draggable: true, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map);
      markerRef.current.on('dragend', () => {
        const lngLat = markerRef.current?.getLngLat();
        if (lngLat) onChangeRef.current(lngLat.lat, lngLat.lng);
      });
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
  }, []);

  // Init map (une seule fois)
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current) return;
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: isDark ? MAP_STYLES.dark : MAP_STYLES.light,
      center: initialCenter,
      zoom: initialZoom,
      accessToken: MAPBOX_TOKEN,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      movePin(lng, lat);
      onChangeRef.current(lat, lng);
    });

    if (hasCoords) {
      movePin(longitude as number, latitude as number);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch style quand le thème change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(isDark ? MAP_STYLES.dark : MAP_STYLES.light);
  }, [isDark]);

  // Sync pin quand lat/lng changent depuis l'extérieur (ex : autocomplete d'adresse)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasCoords) return;
    movePin(longitude as number, latitude as number);
    map.flyTo({ center: [longitude as number, latitude as number], zoom: 15, duration: 600 });
  }, [latitude, longitude, hasCoords, movePin]);

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non supportée par ce navigateur');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        onChangeRef.current(lat, lng);
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Permission refusée — autorise la géolocalisation dans ton navigateur');
        } else {
          setGeoError("Impossible d'obtenir votre position");
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !hasCoords) return;
    map.flyTo({ center: [longitude as number, latitude as number], zoom: 16, duration: 600 });
  }, [hasCoords, latitude, longitude]);

  if (!MAPBOX_TOKEN) {
    return (
      <Alert severity="warning" sx={{ fontSize: '0.8125rem' }}>
        Mapbox n'est pas configuré — impossible d'afficher la carte de sélection.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Helper / status text */}
      {!hasCoords && (
        <Alert
          severity="warning"
          icon={<LocationOn size={16} strokeWidth={2} />}
          sx={{ fontSize: '0.8125rem', py: 0.5 }}
        >
          {helperText ||
            "Aucune coordonnée GPS n'a été trouvée pour cette adresse. Cliquez sur la carte ou faites glisser le pin pour positionner manuellement le logement."}
        </Alert>
      )}

      {/* Map container */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: hasCoords ? 'success.main' : 'warning.main',
        }}
      >
        <Box ref={mapContainerRef} sx={{ width: '100%', height: '100%' }} />

        {/* Floating coordinates badge */}
        {hasCoords && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              px: 1,
              py: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.6875rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}>
              <LocationOn size={11} strokeWidth={2} />
            </Box>
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'text.primary' }}>
              {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
            </Typography>
          </Box>
        )}

        {/* Floating action buttons */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Tooltip title="Utiliser ma position actuelle" placement="right">
            <Button
              onClick={handleGeolocate}
              disabled={geoLoading}
              size="small"
              variant="contained"
              sx={{
                minWidth: 0,
                px: 1,
                py: 0.75,
                bgcolor: 'background.paper',
                color: 'primary.main',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {geoLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DirectionsWalk size={16} strokeWidth={1.75} />
              )}
            </Button>
          </Tooltip>
          {hasCoords && (
            <Tooltip title="Centrer sur le marqueur" placement="right">
              <Button
                onClick={handleRecenter}
                size="small"
                variant="contained"
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.75,
                  bgcolor: 'background.paper',
                  color: 'primary.main',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <LocationOn size={16} strokeWidth={1.75} />
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      {geoError && (
        <Alert severity="error" onClose={() => setGeoError(null)} sx={{ fontSize: '0.75rem', py: 0.5 }}>
          {geoError}
        </Alert>
      )}

      {hasCoords && (
        <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
          Astuce : clique sur la carte ou fais glisser le pin pour ajuster la position exacte.
        </Typography>
      )}
    </Box>
  );
}

export default PropertyLocationPicker;
