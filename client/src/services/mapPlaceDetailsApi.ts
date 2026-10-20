/** Enrichissement ponctuel OSM : aucune collecte des logements ni recherche en arrière-plan. */
export interface MapPlace {
  name: string;
  kind: string;
  lat: number;
  lng: number;
}

export interface MapPlaceDetails {
  sourceUrl: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  openingHours?: string;
  cuisine?: string;
  wheelchair?: string;
  photo?: { url: string; sourceUrl: string };
}

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Liens sortants : ni schéma actif, ni identifiants, ni destination réseau locale. */
export function safePlaceWebsite(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value) ? `https://${value}` : value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined;
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return undefined;
    return url.href;
  } catch { return undefined; }
}

const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const text = (tags: Record<string, string>, ...keys: string[]) => keys.map(key => tags[key]).find(value => typeof value === 'string' && value.trim())?.trim().slice(0, 1500);

function commonsPhoto(tags: Record<string, string>): MapPlaceDetails['photo'] {
  let file = text(tags, 'wikimedia_commons');
  if (!file?.startsWith('File:')) {
    const image = safePlaceWebsite(text(tags, 'image'));
    if (!image) return undefined;
    const url = new URL(image);
    if (url.hostname !== 'commons.wikimedia.org' || !url.pathname.startsWith('/wiki/File:')) return undefined;
    try { file = decodeURIComponent(url.pathname.slice('/wiki/'.length)); } catch { return undefined; }
  }
  const name = file.slice('File:'.length);
  if (!/\.(jpe?g|png|webp)$/i.test(name)) return undefined;
  return {
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=800`,
    sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(file)}`,
  };
}

/** Correspondance stricte nom + proximité, pour ne jamais attribuer la fiche d'un voisin. */
export function matchMapPlace(place: MapPlace, elements: OsmElement[]): MapPlaceDetails | null {
  const candidates = elements.flatMap(element => {
    const tags = element.tags;
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (!tags || !Number.isFinite(lat) || !Number.isFinite(lng) || !['node', 'way', 'relation'].includes(element.type) || !Number.isSafeInteger(element.id) || element.id <= 0) return [];
    const names = Object.entries(tags).filter(([key]) => key === 'name' || key.startsWith('name:') || key === 'alt_name').flatMap(([, value]) => typeof value === 'string' ? value.split(';') : []);
    if (!names.some(name => normalize(name) === normalize(place.name))) return [];
    const distance = Math.hypot(((lat as number) - place.lat) * 111_320, ((lng as number) - place.lng) * 111_320 * Math.cos(place.lat * Math.PI / 180));
    return distance <= 150 ? [{ element, tags, distance }] : [];
  }).sort((a, b) => a.distance - b.distance);
  const matched = candidates[0];
  if (!matched) return null;
  const { element, tags } = matched;
  const street = [text(tags, 'addr:housenumber', 'contact:housenumber'), text(tags, 'addr:street', 'contact:street')].filter(Boolean).join(' ');
  const city = [text(tags, 'addr:postcode', 'contact:postcode'), text(tags, 'addr:city', 'contact:city')].filter(Boolean).join(' ');
  const phone = text(tags, 'contact:phone', 'phone', 'contact:mobile');
  const email = text(tags, 'contact:email', 'email');
  return {
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    address: text(tags, 'addr:full') || [street, city, text(tags, 'addr:country')].filter(Boolean).join(', ') || undefined,
    phone: phone && /^[+\d\s().;/-]{5,100}$/.test(phone) ? phone : undefined,
    email: email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : undefined,
    website: safePlaceWebsite(text(tags, 'contact:website', 'website', 'url')),
    openingHours: text(tags, 'opening_hours'), cuisine: text(tags, 'cuisine'), wheelchair: text(tags, 'wheelchair'),
    photo: commonsPhoto(tags),
  };
}

// Les clics rapides restent séquentiels et espacés ; les fiches sont mises en cache par React Query.
let queue: Promise<unknown> = Promise.resolve();
let lastStarted = 0;

async function readPublicJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('MAP_PLACE_UNAVAILABLE');
  const body = await response.text();
  if (body.length > 2_000_000) throw new Error('MAP_PLACE_TOO_LARGE');
  return JSON.parse(body);
}

interface NominatimPlace {
  osm_type: string; osm_id: number; lat: string; lon: string; name: string;
  namedetails?: Record<string, string>; extratags?: Record<string, string>;
  address?: Record<string, string>;
}

export function fetchMapPlaceDetails(place: MapPlace, signal?: AbortSignal): Promise<MapPlaceDetails | null> {
  if (!Number.isFinite(place.lat) || Math.abs(place.lat) > 90 || !Number.isFinite(place.lng) || Math.abs(place.lng) > 180 || !place.name.trim()) return Promise.resolve(null);
  const request = queue.catch(() => undefined).then(async () => {
    const wait = Math.max(0, 1500 - (Date.now() - lastStarted));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    signal?.throwIfAborted();
    lastStarted = Date.now();
    // Le géocodeur déjà utilisé par Baitly fournit aussi les tags publics des lieux.
    // Recherche bornée au lieu cliqué, jamais une recherche au fil de la saisie.
    const latSpan = 0.0018;
    const lngSpan = Math.min(0.1, latSpan / Math.max(0.02, Math.cos(place.lat * Math.PI / 180)));
    const params = new URLSearchParams({ q: place.name.slice(0, 500), format: 'jsonv2', bounded: '1', limit: '5',
      viewbox: `${Math.max(-180, place.lng - lngSpan)},${Math.min(90, place.lat + latSpan)},${Math.min(180, place.lng + lngSpan)},${Math.max(-90, place.lat - latSpan)}`,
      extratags: '1', namedetails: '1', addressdetails: '1' });
    try {
      const results = await readPublicJson(`https://nominatim.openstreetmap.org/search?${params}`, signal);
      if (Array.isArray(results)) {
        const elements = (results as NominatimPlace[]).map(result => ({
          type: result.osm_type, id: result.osm_id, lat: Number(result.lat), lon: Number(result.lon),
          tags: { ...result.extratags, ...result.namedetails, name: result.name,
            'addr:housenumber': result.address?.house_number ?? '', 'addr:street': result.address?.road ?? result.address?.pedestrian ?? '',
            'addr:postcode': result.address?.postcode ?? '', 'addr:city': result.address?.city ?? result.address?.town ?? result.address?.village ?? '',
            'addr:country': result.address?.country ?? '',
          },
        }));
        const details = matchMapPlace(place, elements);
        if (details) return details;
      }
    } catch { signal?.throwIfAborted(); }
    // Repli sur les données OSM brutes si l'index du géocodeur n'a pas ce lieu.
    await new Promise(resolve => setTimeout(resolve, 1500));
    signal?.throwIfAborted();
    lastStarted = Date.now();
    const query = `[out:json][timeout:12];nwr(around:150,${place.lat.toFixed(6)},${place.lng.toFixed(6)})["name"=${JSON.stringify(place.name.slice(0, 500))}];out center tags 20;`;
    const data = await readPublicJson(`https://overpass-api.de/api/interpreter?${new URLSearchParams({ data: query })}`, signal) as { elements?: OsmElement[]; remark?: string };
    if (data.remark || !Array.isArray(data.elements)) throw new Error('MAP_PLACE_INCOMPLETE');
    return matchMapPlace(place, data.elements);
  });
  queue = request;
  return request;
}
