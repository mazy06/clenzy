import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export interface GuideMapPin {
  lat: number;
  lng: number;
  color: string;
  label: string;
}

interface GuideMapProps {
  center: [number, number]; // [lng, lat]
  pins: GuideMapPin[];
  height?: number;
}

/**
 * Carte Mapbox de la page guest ("autour de moi") : marqueurs colorés par catégorie
 * + pin du logement. Standalone (style clair fixe, pas de dépendance au thème PMS).
 * Rend `null` si le token Mapbox n'est pas configuré (la liste reste affichée).
 */
export const GuideMap: React.FC<GuideMapProps> = ({ center, pins, height = 220 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef({ center, pins });
  useEffect(() => {
    dataRef.current = { center, pins };
  }, [center, pins]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return undefined;
    const { center: c, pins: p } = dataRef.current;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: c,
      zoom: 13,
      accessToken: MAPBOX_TOKEN,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    const addPins = () => {
      const bounds = new mapboxgl.LngLatBounds();
      p.forEach((pin) => {
        const popup = new mapboxgl.Popup({ offset: 24, closeButton: false }).setHTML(
          `<strong>${escapeHtml(pin.label)}</strong>`,
        );
        new mapboxgl.Marker({ color: pin.color }).setLngLat([pin.lng, pin.lat]).setPopup(popup).addTo(map);
        bounds.extend([pin.lng, pin.lat]);
      });
      if (p.length > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 15 });
    };

    if (map.loaded()) addPins();
    else map.on('load', addPins);

    return () => {
      map.off('load', addPins);
      map.remove();
    };
  }, []);

  if (!MAPBOX_TOKEN) return null;
  return <Box ref={containerRef} sx={{ width: '100%', height, borderRadius: 2, overflow: 'hidden' }} />;
};

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
