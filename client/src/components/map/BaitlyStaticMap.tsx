import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { createBaitlyMap } from './createBaitlyMap';
import { createBaitlyPin } from './baitlyMapPin';
import type { BaitlyMapMode } from './baitlyMapStyle';

interface BaitlyStaticMapProps {
  lat: number;
  lng: number;
  mode: BaitlyMapMode;
  zoom?: number;
}

/**
 * Vignette figée : une épingle, aucun geste, aucun contrôle. Remplace l'API
 * Mapbox Static Images (jeton + facturation) par le rendu Baitly lui-même.
 *
 * <p>Sans attribution intégrée : l'appelant DOIT afficher « © OpenStreetMap »
 * (ODbL) — cf. `MapTile`. Export par défaut pour `React.lazy` : MapLibre reste
 * hors du chunk des fiches qui n'affichent jamais de carte.</p>
 */
export default function BaitlyStaticMap({ lat, lng, mode, zoom = 13 }: BaitlyStaticMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = createBaitlyMap({
      container: containerRef.current,
      mode,
      center: [lng, lat],
      zoom,
      interactive: false,
      attribution: false,
    });
    const marker = new maplibregl.Marker({ element: createBaitlyPin({ color: 'var(--bui-navy)', icon: 'home' }), anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(map);
    return () => {
      marker.remove();
      map.remove();
    };
  }, [lat, lng, mode, zoom]);

  // MapLibre force `position: relative` sur son conteneur : le positionnement
  // absolu doit donc vivre sur une enveloppe, sinon la carte retombe à 0 px de haut.
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div ref={containerRef} className="size-full" />
    </div>
  );
}
