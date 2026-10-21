import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import type { MapPlace } from '../../services/mapPlaceDetailsApi';
import { useMapCardClaim } from './MapCardCoordinator';
import { useMapSheet } from './MapSheetContext';
import BaitlyMapPlaceCard from './BaitlyMapPlaceCard';
import { keepPopupInView } from './keepPopupInView';
import { renderedMapPlaceAt } from './renderedMapPlace';

/** Les lieux OSM partagent la fermeture exclusive des logements, filtres et fiches de prestataire. */
export default function BaitlyMapPlaceInspector({ map }: { map: maplibregl.Map }) {
  const claim = useMapCardClaim();
  const sheet = useMapSheet();
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const [selection, setSelection] = useState<{ place: MapPlace; host: HTMLElement } | null>(null);
  const closeRef = useRef<() => void>(() => {});
  useEffect(() => {
    let hovered = false;
    const click = (event: maplibregl.MapMouseEvent) => {
      const target = event.originalEvent?.target;
      if (target instanceof Element && target.closest('.maplibregl-marker, .maplibregl-popup, .maplibregl-ctrl')) return;
      const feature = renderedMapPlaceAt(map, event.point);
      if (!feature || feature.geometry.type !== 'Point') return;
      const [lng, lat] = feature.geometry.coordinates;
      const place: MapPlace = { name: feature.properties.name, kind: String(feature.properties.kind ?? ''), lat, lng };
      closeRef.current();
      const mobile = sheetRef.current;
      if (mobile?.detailHost) {
        let release = () => {};
        const close = () => { release(); setSelection(null); mobile.closeDetail(); };
        closeRef.current = close;
        release = claim(close);
        setSelection({ place, host: mobile.detailHost });
        mobile.openDetail();
      } else {
        const host = document.createElement('div');
        const popup = new maplibregl.Popup({ closeButton: false, maxWidth: 'none', className: 'baitly-map-place-popup', anchor: 'bottom', offset: 20, focusAfterOpen: true })
          .setLngLat([lng, lat]).setDOMContent(host);
        let release = () => {};
        let releasePosition = () => {};
        const close = () => popup.remove();
        closeRef.current = close;
        popup.on('close', () => { release(); releasePosition(); setSelection(null); });
        release = claim(close);
        popup.addTo(map);
        releasePosition = keepPopupInView(map, popup, { bottomGap: 36 });
        setSelection({ place, host });
      }
    };
    const hover = (event: maplibregl.MapMouseEvent) => {
      const next = !!renderedMapPlaceAt(map, event.point);
      if (next || hovered) map.getCanvas().style.cursor = next ? 'pointer' : '';
      hovered = next;
    };
    map.on('click', click);
    map.on('mousemove', hover);
    return () => { map.off('click', click); map.off('mousemove', hover); closeRef.current(); if (hovered) map.getCanvas().style.cursor = ''; };
  }, [map, claim]);
  useEffect(() => {
    if (sheet && !sheet.detailOpen && selection?.host === sheet.detailHost) closeRef.current();
  }, [sheet?.detailOpen, sheet?.detailHost]);
  return selection ? createPortal(<BaitlyMapPlaceCard key={`${selection.place.name}:${selection.place.lat}:${selection.place.lng}`} place={selection.place} onClose={() => closeRef.current()} />, selection.host) : null;
}
