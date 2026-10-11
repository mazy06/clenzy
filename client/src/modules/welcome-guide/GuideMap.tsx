import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import type { IconComponent } from '../../icons/glyphs';
import { createBaitlyMap, prefersReducedMotion } from '../../components/map/createBaitlyMap';
import { createBaitlyPin, pinIconSlot, pinPopupContent, PIN_POPUP_OFFSET } from '../../components/map/baitlyMapPin';

export interface GuideMapPin {
  lat: number;
  lng: number;
  color: string;
  label: string;
  /** Icône de la catégorie ; `home` pour le logement lui-même. Absente : simple point. */
  icon?: IconComponent | 'home';
}

interface GuideMapProps {
  center: [number, number]; // [lng, lat]
  pins: GuideMapPin[];
  height?: number;
}

interface IconMount {
  target: HTMLElement;
  Icon: IconComponent;
}

/**
 * Carte Baitly de la page guest ("autour de moi") : épingles à l'icône de leur
 * catégorie + épingle du logement. Standalone (style clair fixe, pas de dépendance
 * au thème PMS). Tuiles servies par Baitly : aucun jeton requis.
 *
 * <p>Les icônes de catégorie sont des composants React : on les monte par portail
 * dans le badge de chaque épingle (élément DOM géré par MapLibre).</p>
 */
export const GuideMap: React.FC<GuideMapProps> = ({ center, pins, height = 220 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef({ center, pins });
  const [iconMounts, setIconMounts] = useState<IconMount[]>([]);
  useEffect(() => {
    dataRef.current = { center, pins };
  }, [center, pins]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const { center: c, pins: p } = dataRef.current;

    const map = createBaitlyMap({
      container: containerRef.current,
      mode: 'light',
      center: c,
      zoom: 13,
      compass: false,
      perspective: true,
    });

    const addPins = () => {
      const bounds = new maplibregl.LngLatBounds();
      const mounts: IconMount[] = [];
      p.forEach((pin) => {
        const popup = new maplibregl.Popup({ offset: PIN_POPUP_OFFSET, closeButton: false }).setDOMContent(
          pinPopupContent(pin.label),
        );
        const pinIcon = pin.icon === 'home' ? 'home' : pin.icon ? 'slot' : 'dot';
        const element = createBaitlyPin({ color: pin.color, icon: pinIcon, label: pin.label, interactive: true });
        if (pin.icon && pin.icon !== 'home') mounts.push({ target: pinIconSlot(element), Icon: pin.icon });
        new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([pin.lng, pin.lat]).setPopup(popup).addTo(map);
        bounds.extend([pin.lng, pin.lat]);
      });
      setIconMounts(mounts);
      if (p.length > 1) {
        map.fitBounds(bounds, { padding: 48, maxZoom: 15, ...(prefersReducedMotion() ? { duration: 0 } : {}) });
      }
    };

    if (map.loaded()) addPins();
    else map.on('load', addPins);

    return () => {
      map.off('load', addPins);
      map.remove();
      setIconMounts([]);
    };
  }, []);

  // height vient des props (valeur d'execution) → style ; borderRadius 2 = 16px (shape 8).
  return (
    <>
      <div ref={containerRef} className="w-full rounded-[16px] overflow-hidden" style={{ height }} />
      {iconMounts.map(({ target, Icon }, index) => createPortal(<Icon size={18} weight="filled" aria-hidden />, target, `pin-icon-${index}`))}
    </>
  );
};
