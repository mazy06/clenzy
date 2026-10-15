/** Surface mobile publique : partage le moteur, la palette et les tuiles du PMS. */
import * as maplibregl from 'maplibre-gl';
import { ensureMapRuntime } from './mapRuntime';
import { buildBaitlyMapStyle } from './baitlyMapStyle';
import type { BaitlyMapLanguage } from './baitlyMapStyle';
import './baitly-provider-map.css';

interface Position { latitude: number; longitude: number }
interface Point extends Position { id: number; radiusKm: number | null; zones: Position[] }
interface Payload { points: Point[]; labels: { map: string; pin: string }; reduced: boolean }
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (value: string) => void };
    setBaitlyProviders: (payload: Payload) => void;
    selectBaitlyProvider: (id: number) => void;
  }
}
const send = (value: unknown) => window.ReactNativeWebView?.postMessage(JSON.stringify(value));
const params = new URLSearchParams(location.search);
const mode = params.get('theme') === 'dark' ? 'dark' : 'light';
const lang = params.get('lang');
const language: BaitlyMapLanguage = lang === 'ar' || lang === 'en' ? lang : 'fr';
document.documentElement.lang = language;
document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
document.documentElement.dataset.theme = mode;
document.documentElement.dataset.surface = params.get('surface') === 'coverage' ? 'coverage' : 'catalog';
ensureMapRuntime();
const map = new maplibregl.Map({
  container: 'map', style: buildBaitlyMapStyle(mode, language),
  center: [-7.99, 31.63], zoom: 10, attributionControl: false,
  dragRotate: false, touchPitch: false, fadeDuration: 0,
});
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
map.once('load', () => {
  map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
});
let points: Point[] = [];
let markers: { marker: maplibregl.Marker; button: HTMLButtonElement; ids: number[] }[] = [];
let reduced = true;
const valid = (p: Position) => p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
const coordinate = (p: Position): [number, number] => [p.longitude, p.latitude];
const boundsFor = (items: Position[]) => items.reduce((bounds, p) => bounds.extend(coordinate(p)), new maplibregl.LngLatBounds());
window.selectBaitlyProvider = id => {
  const p = points.find(point => point.id === id);
  if (!p || !map.getSource('provider-zones')) return;
  markers.forEach(m => m.button.setAttribute('aria-pressed', String(m.ids.includes(id))));
  const outline: Position[] = [];
  if (p.radiusKm && p.radiusKm > 0 && p.radiusKm <= 500) {
    // Cercle géodésique : rayon déclaré, jamais une limite administrative inventée.
    const angular = p.radiusKm / 6371, lat = p.latitude * Math.PI / 180, lng = p.longitude * Math.PI / 180;
    for (let i = 0; i <= 64; i++) {
      const angle = i * Math.PI / 32;
      const latitude = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(angle));
      const longitude = lng + Math.atan2(Math.sin(angle) * Math.sin(angular) * Math.cos(lat), Math.cos(angular) - Math.sin(lat) * Math.sin(latitude));
      outline.push({ latitude: latitude * 180 / Math.PI, longitude: longitude * 180 / Math.PI });
    }
  }
  const features: GeoJSON.Feature[] = p.zones.filter(valid).map(z => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: coordinate(z) } }));
  if (outline.length) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outline.map(coordinate)] } });
  (map.getSource('provider-zones') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features });
  map.fitBounds(boundsFor([p, ...outline, ...p.zones.filter(valid)]), { padding: 40, maxZoom: 12, duration: reduced ? 0 : 220 });
};
window.setBaitlyProviders = payload => {
  if (!map.getSource('provider-zones') || !Array.isArray(payload?.points)) return;
  points = payload.points.filter(p => Number.isSafeInteger(p.id) && valid(p));
  reduced = payload.reduced;
  (map.getSource('provider-zones') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
  document.getElementById('map')?.setAttribute('aria-label', payload.labels.map);
  markers.forEach(m => m.marker.remove()); markers = [];
  const groups = new Map<string, Point[]>();
  points.forEach(p => { const key = `${p.latitude},${p.longitude}`; groups.set(key, [...(groups.get(key) ?? []), p]); });
  let index = 0;
  groups.forEach(group => {
    index++;
    const ids = group.map(p => p.id), button = document.createElement('button');
    button.className = 'provider-pin'; button.textContent = String(group.length > 1 ? group.length : index);
    button.setAttribute('aria-label', `${payload.labels.pin} ${index}`); button.setAttribute('aria-pressed', 'false');
    button.onclick = () => { window.selectBaitlyProvider(ids[0]); send({ type: 'select', ids }); };
    const marker = new maplibregl.Marker({ element: button }).setLngLat(coordinate(group[0])).addTo(map);
    markers.push({ marker, button, ids });
  });
  if (points.length) map.fitBounds(boundsFor(points), { padding: 48, maxZoom: 12, duration: 0 });
};
// Le pont et les pastilles sont prêts dès le style, indépendamment du réseau de tuiles.
map.once('style.load', () => {
  map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  map.addSource('provider-zones', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'provider-area', type: 'fill', source: 'provider-zones', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#0C7166', 'fill-opacity': 0.14 } });
  map.addLayer({ id: 'provider-outline', type: 'line', source: 'provider-zones', filter: ['==', '$type', 'Polygon'], paint: { 'line-color': '#0C7166', 'line-width': 2 } });
  map.addLayer({ id: 'provider-cities', type: 'circle', source: 'provider-zones', filter: ['==', '$type', 'Point'], paint: { 'circle-color': '#0C7166', 'circle-radius': 7 } });
  send({ type: 'ready' });
});
map.on('error', event => {
  const source = (event as maplibregl.ErrorEvent & { sourceId?: string }).sourceId;
  if (source === 'protomaps') send({ type: 'tilesError' });
});
window.addEventListener('error', () => send({ type: 'error' }));
