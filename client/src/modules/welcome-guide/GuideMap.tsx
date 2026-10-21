import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import type { IconComponent } from '../../icons/glyphs';
import { createBaitlyMap, prefersReducedMotion } from '../../components/map/createBaitlyMap';
import { createBaitlyPin, pinIconSlot } from '../../components/map/baitlyMapPin';
import type { BaitlyMapMode } from '../../components/map/baitlyMapStyle';
import type { GuideLabels, Lang } from './WelcomeBookView';

export interface GuideMapPin {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label: string;
  icon?: IconComponent | 'home';
}

interface GuideMapProps {
  center: [number, number];
  pins: GuideMapPin[];
  height?: number;
  mode?: BaitlyMapMode;
  lang: Lang;
  labels: GuideLabels;
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

/** Real Baitly tiles and category pins, shared by the guest book and its live preview. */
export function GuideMap({ center, pins, height = 300, mode = 'light', lang, labels: L,
  interactive = true, selectedId, onSelect }: GuideMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ center, onSelect });
  latest.current = { center, onSelect };
  const [visible, setVisible] = useState(false);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const markersRef = useRef<Array<{ id: string; marker: maplibregl.Marker }>>([]);
  const [icons, setIcons] = useState<Array<{ target: HTMLElement; Icon: IconComponent }>>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '160px' });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !containerRef.current) return;
    setStatus('loading');
    let instance: maplibregl.Map;
    try {
      instance = createBaitlyMap({ container: containerRef.current, center: latest.current.center,
        zoom: 14, mode, language: lang, interactive, compass: false, perspective: interactive });
    } catch { setStatus('error'); setMap(null); return; }
    setMap(instance);
    // Scrolling the book must not zoom the map accidentally.
    instance.scrollZoom.disable();
    const loaded = () => setStatus(current => current === 'error' ? current : 'ready');
    const failed = (event: maplibregl.ErrorEvent) => {
      const source = (event as maplibregl.ErrorEvent & { sourceId?: string }).sourceId;
      if (source !== 'baitly-world' && source !== 'baitly-terrain') setStatus('error');
    };
    instance.on('load', loaded);
    instance.on('error', failed);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => instance.resize());
    observer?.observe(containerRef.current);
    return () => {
      observer?.disconnect();
      instance.off('load', loaded);
      instance.off('error', failed);
      instance.remove();
    };
  }, [visible, mode, lang, interactive, retry]);

  useEffect(() => {
    if (!map) return;
    const bounds = new maplibregl.LngLatBounds();
    const mounts: Array<{ target: HTMLElement; Icon: IconComponent }> = [];
    const entries = pins.filter(pin => Number.isFinite(pin.lat) && Number.isFinite(pin.lng)
      && Math.abs(pin.lat) <= 90 && Math.abs(pin.lng) <= 180).map(pin => {
      const element = createBaitlyPin({ color: pin.color, icon: pin.icon === 'home' ? 'home' : pin.icon ? 'slot' : 'dot',
        label: pin.label, interactive });
      if (pin.icon && pin.icon !== 'home') mounts.push({ target: pinIconSlot(element), Icon: pin.icon });
      element.addEventListener('click', () => latest.current.onSelect?.(pin.id));
      const marker = new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([pin.lng, pin.lat]).addTo(map);
      bounds.extend([pin.lng, pin.lat]);
      return { id: pin.id, marker };
    });
    markersRef.current = entries;
    setIcons(mounts);
    if (entries.length) map.fitBounds(bounds, { padding: { top: interactive ? 104 : 54, bottom: 42, left: 46, right: 46 },
      maxZoom: entries.length === 1 ? 14 : 15, duration: 0 });
    else map.jumpTo({ center: [center[0], center[1]], zoom: 14 });
    return () => {
      entries.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
    };
  }, [map, pins, center[0], center[1], interactive]);

  useEffect(() => {
    markersRef.current.forEach(({ id, marker }) => marker.getElement().setAttribute('aria-pressed', String(id === selectedId)));
    const selected = pins.find(pin => pin.id === selectedId);
    if (map && selected && !map.getBounds().contains([selected.lng, selected.lat])) {
      map.easeTo({ center: [selected.lng, selected.lat], duration: prefersReducedMotion() ? 0 : 220 });
    }
  }, [map, pins, selectedId]);

  return <div className="wb-guide-map" data-mode={mode} style={{ height }} role="region" aria-label={L.mapLabel}>
    <div ref={containerRef} className="wb-guide-map__canvas" />
    {visible && status === 'loading' ? <span className="wb-guide-map__status" role="status">{L.mapLoading}</span> : null}
    {status === 'error' ? <div className="wb-guide-map__status" role="status"><span>{L.mapUnavailable}</span>
      <button type="button" onClick={() => setRetry(value => value + 1)}>{L.mapRetry}</button></div> : null}
    {icons.map(({ target, Icon }, index) => createPortal(<Icon size={18} weight="filled" aria-hidden />, target, `pin-${index}`))}
  </div>;
}
