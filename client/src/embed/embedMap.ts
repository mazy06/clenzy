/**
 * Carte Baitly embarquée dans l'app mobile (WebView) : même style, mêmes épingles et
 * mêmes secteurs que le PMS, sans écran autour.
 *
 * <p>La page ne voit aucun jeton : l'app charge les données avec sa propre session et
 * les lui transmet par message. Elle ne contacte que les tuiles (`/maps/`, même origine).</p>
 *
 * <p>Protocole — app → page : {@code window.baitlyMap.receive({ type: 'sectors', map, mode })}
 * (ou {@code postMessage}). Page → app : {@code { type: 'ready' }} puis
 * {@code { type: 'propertyPress', propertyId }} au toucher d'une épingle.</p>
 */
import * as maplibregl from 'maplibre-gl';
import i18n, { i18nInitPromise } from '../i18n/config';
import { createBaitlyMap } from '../components/map/createBaitlyMap';
import { createBaitlyPin } from '../components/map/baitlyMapPin';
import { BaitlySectorLayer, sectorBounds, type SectorMode, type SectorTheme } from '../components/map/sectorLayer';
import type { SectorMap } from '../services/api/sectorMapApi';
import '../theme/signature/tokens.css';
import '../theme/base.css';
import '../theme/baitly-ui.css';

type IncomingMessage = { type: 'sectors'; map: SectorMap; mode?: SectorMode; highlightedProviderId?: number | null };

interface NativeBridge { postMessage(message: string): void }

const params = new URLSearchParams(window.location.search);
const theme: SectorTheme = params.get('theme') === 'dark' ? 'dark' : 'light';
const language = ['fr', 'en', 'ar'].includes(params.get('lang') ?? '') ? params.get('lang')! : 'fr';

function toApp(message: object): void {
  const bridge = (window as unknown as { ReactNativeWebView?: NativeBridge }).ReactNativeWebView;
  bridge?.postMessage(JSON.stringify(message));
}

async function start(): Promise<void> {
  await i18nInitPromise;
  await i18n.changeLanguage(language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.body.dataset.theme = theme;
  if (theme === 'dark') document.documentElement.classList.add('dark');

  const map = createBaitlyMap({
    container: document.getElementById('map')!,
    mode: theme,
    center: [2.35, 48.85],
    zoom: 5,
    perspective: true,
  });
  const sectors = new BaitlySectorLayer(map);
  let markers: maplibregl.Marker[] = [];
  let framed = false;

  const receive = (message: IncomingMessage) => {
    if (message?.type !== 'sectors' || !message.map) return;
    const data = message.map;
    sectors.set({
      providers: data.providers.map((p) => ({ id: p.providerId, geometry: p.geometry })),
      merged: data.merged,
      mode: message.mode ?? 'merged',
      highlightedProviderId: message.highlightedProviderId ?? null,
    }, theme);

    markers.forEach((marker) => marker.remove());
    markers = data.properties
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => {
        const element = createBaitlyPin({ color: 'var(--bui-navy)', icon: 'home', label: p.name, interactive: true });
        element.dataset.state = p.coveredBy.length > 0 ? 'covered' : 'uncovered';
        element.addEventListener('click', () => toApp({ type: 'propertyPress', propertyId: p.id }));
        return new maplibregl.Marker({ element, anchor: 'bottom' })
          .setLngLat([Number(p.longitude), Number(p.latitude)])
          .addTo(map);
      });

    if (framed) return;
    const points = markers.map((marker) => marker.getLngLat());
    const bounds = new maplibregl.LngLatBounds();
    points.forEach((point) => bounds.extend(point));
    if (data.merged) {
      const [west, south, east, north] = sectorBounds(data.merged);
      bounds.extend([west, south]).extend([east, north]);
    }
    if (bounds.isEmpty()) return;
    framed = true;
    map.fitBounds(bounds, { padding: 40, maxZoom: 13, duration: 0 });
  };

  const fromEvent = (event: Event) => {
    const raw = (event as MessageEvent).data;
    try {
      receive(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch {
      // Message étranger au protocole : ignoré.
    }
  };
  window.addEventListener('message', fromEvent);
  document.addEventListener('message', fromEvent); // Android : la WebView émet sur document
  (window as unknown as { baitlyMap: { receive: typeof receive } }).baitlyMap = { receive };
  map.once('load', () => toApp({ type: 'ready' }));
}

void start();
