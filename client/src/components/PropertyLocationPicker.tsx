import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from './ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner, Tooltip, TooltipContent, TooltipTrigger } from './ui';
import { cn } from '../utils/cn';
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
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
      // Element DOM reel : les custom properties Baitly s'y resolvent, le pin
      // suit donc le theme clair / sombre sans table de couleurs dupliquee.
      const el = document.createElement('div');
      el.style.cssText = `
        width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
        background: var(--bui-destructive); transform: rotate(-45deg);
        border: 3px solid var(--bui-card); box-shadow: 0 2px 6px rgba(0,0,0,0.3);
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

    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      movePin(lng, lat);
      onChangeRef.current(lat, lng);
    };
    map.on('click', handleMapClick);

    if (hasCoords) {
      movePin(longitude as number, latitude as number);
    }

    return () => {
      map.off('click', handleMapClick);
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
      <BuiAlert variant="warning" className="text-xs">
        <TriangleAlert />
        <AlertDescription>Mapbox n'est pas configuré — impossible d'afficher la carte de sélection.</AlertDescription>
      </BuiAlert>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Helper / status text */}
      {!hasCoords && (
        <BuiAlert variant="warning" className="text-xs py-[3px]">
          <LocationOn size={16} strokeWidth={2} />
          <AlertDescription>
            {helperText ||
              "Aucune coordonnée GPS n'a été trouvée pour cette adresse. Cliquez sur la carte ou faites glisser le pin pour positionner manuellement le logement."}
          </AlertDescription>
        </BuiAlert>
      )}

      {/* Map container */}
      {/* `height` est une prop : elle reste en style inline. */}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-xl border border-solid',
          hasCoords ? 'border-success' : 'border-warning',
        )}
        style={{ height }}
      >
        <div className="w-full h-full" ref={mapContainerRef} />

        {/* Floating coordinates badge */}
        {hasCoords && (
          <div className="absolute bottom-[8px] start-[8px] flex items-center gap-[3px] rounded-lg border border-solid border-border bg-card px-1.5 py-[3px] shadow-[0_2px_6px_rgba(0,0,0,0.12)]">
            <span className="inline-flex text-success-ink">
              <LocationOn size={11} strokeWidth={2} />
            </span>
            <p className="font-mono text-2xs tabular-nums text-foreground">
              {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
            </p>
          </div>
        )}

        {/* Floating action buttons */}
        <div className="absolute top-[8px] start-[8px] flex flex-col gap-0.5">
          {/* Commandes flottantes de la carte : outline (cadre sur surface) plutot
              que default — ce sont des outils, pas l'action de l'ecran. Le span
              porte la ref que Tooltip pose sur son enfant (Button = fonction). */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <BuiButton
                  variant="outline"
                  size="icon-sm"
                  aria-label="Utiliser ma position actuelle"
                  onClick={handleGeolocate}
                  disabled={geoLoading}
                  className="shadow-[0_2px_6px_rgba(0,0,0,0.12)]"
                >
                  {geoLoading ? (
                    <Spinner className="size-4" />
                  ) : (
                    <DirectionsWalk size={16} strokeWidth={1.75} />
                  )}
                </BuiButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">Utiliser ma position actuelle</TooltipContent>
          </Tooltip>
          {hasCoords && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <BuiButton
                    variant="outline"
                    size="icon-sm"
                    aria-label="Centrer sur le marqueur"
                    onClick={handleRecenter}
                    className="shadow-[0_2px_6px_rgba(0,0,0,0.12)]"
                  >
                    <LocationOn size={16} strokeWidth={1.75} />
                  </BuiButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">Centrer sur le marqueur</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {geoError && (
        <BuiAlert variant="destructive" className="text-xs py-0.5">
          <TriangleAlert />
          <AlertDescription>{geoError}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setGeoError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {hasCoords && (
        <p className="text-2xs text-faint">
          Astuce : clique sur la carte ou fais glisser le pin pour ajuster la position exacte.
        </p>
      )}
    </div>
  );
}

export default PropertyLocationPicker;
