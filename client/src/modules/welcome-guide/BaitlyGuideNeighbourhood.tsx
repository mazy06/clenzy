import React, { useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronRight, Home, MapPin, Navigation, Star, TrainFront } from '../../icons/glyphs';
import type { GuidePoi, PublicGuideProperty } from '../../services/api/welcomeGuideApi';
import { POI_CATEGORIES, poiCategory, poiLabel } from './poiCatalog';
import { GuideMap, type GuideMapPin } from './GuideMap';
import { GuideDirections } from './GuideDirections';
import { prefersReducedMotion } from '../../components/map/motion';
import type { GuideLabels, Lang } from './WelcomeBookView';
import './baitlyGuideNeighbourhood.css';

/** Missing, non-finite or out-of-range coordinates must never become a pin at 0,0. */
export function hasGuidePosition(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function distanceFrom(property: PublicGuideProperty | null, poi: GuidePoi): number | null {
  if (!hasGuidePosition(property?.latitude, property?.longitude) || !hasGuidePosition(poi.lat, poi.lng)) return null;
  const rad = Math.PI / 180;
  const a = Math.sin(((poi.lat! - property!.latitude!) * rad) / 2) ** 2
    + Math.cos(property!.latitude! * rad) * Math.cos(poi.lat! * rad) * Math.sin(((poi.lng! - property!.longitude!) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function placeIcon(poi: GuidePoi) {
  return poi.category === 'TRANSPORT' && /métro|metro|tram|train|محطة|مترو/i.test(`${poi.type} ${poi.name}`)
    ? TrainFront : poiCategory(poi.category).Icon;
}

interface Props {
  property: PublicGuideProperty | null;
  pois: GuidePoi[];
  theme: string;
  lang: Lang;
  labels: GuideLabels;
  interactive: boolean;
  compact?: boolean;
  renderMap?: boolean;
  onExplore?: () => void;
}

export function BaitlyGuideNeighbourhood({ property, pois, theme, lang, labels: L, interactive,
  compact = false, renderMap = true, onExplore }: Props) {
  const [category, setCategory] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const placeRefs = useRef(new Map<string, HTMLElement>());
  const categories = POI_CATEGORIES.filter(cat => pois.some(poi => poi.category === cat.id))
    .sort((a, b) => Number(b.id === 'TRANSPORT') - Number(a.id === 'TRANSPORT'));
  const activeCategory = categories.some(cat => cat.id === category) ? category : 'ALL';
  const places = useMemo(() => pois.filter(poi => activeCategory === 'ALL' || poi.category === activeCategory)
    .map(poi => ({ poi, distance: distanceFrom(property, poi) }))
    .sort((a, b) => Number(b.poi.featured) - Number(a.poi.featured) || (a.distance ?? Infinity) - (b.distance ?? Infinity)),
  [pois, property, activeCategory]);
  const homePositioned = hasGuidePosition(property?.latitude, property?.longitude);
  const address = property ? [property.address, property.postalCode, property.city].filter(Boolean).join(', ') : '';
  const pins = useMemo<GuideMapPin[]>(() => [
    ...(homePositioned ? [{ id: '__home', lat: property!.latitude!, lng: property!.longitude!, color: 'var(--terra-deep)',
      icon: 'home' as const, label: property?.name || L.mapHome }] : []),
    ...places.filter(({ poi }) => hasGuidePosition(poi.lat, poi.lng)).map(({ poi }) => ({ id: poi.id, lat: poi.lat!, lng: poi.lng!,
      color: `color-mix(in oklch, ${poiCategory(poi.category).color} 72%, var(--ink))`,
      label: poi.name || poiLabel(poi.category, lang), icon: placeIcon(poi) })),
  ], [homePositioned, property, places, lang, L.mapHome]);
  const center: [number, number] | null = homePositioned ? [property!.longitude!, property!.latitude!]
    : pins[0] ? [pins[0].lng, pins[0].lat] : null;
  const selected = pins.some(pin => pin.id === selectedId) || places.some(({ poi }) => poi.id === selectedId) ? selectedId : null;
  const count = new Intl.NumberFormat(lang).format(pois.length);

  const map = renderMap && center ? <GuideMap center={center} pins={pins} mode={['noir', 'minuit'].includes(theme) ? 'dark' : 'light'}
    lang={lang} labels={L} height={compact ? 220 : 310} interactive={!compact}
    selectedId={selected} onSelect={id => {
      setSelectedId(id);
      // A pin opens the same address as the list, including for keyboard users.
      requestAnimationFrame(() => {
        const place = placeRefs.current.get(id);
        place?.focus({ preventScroll: true });
        place?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
      });
    }} /> : null;

  if (compact) return <section className="wb-neighbourhood wb-home__neighbourhood">
    <div className="wb-neighbourhood__heading"><div><p className="wb-label">{L.aroundMe}</p>
      <h2>{property?.city || L.neighbourhood}</h2></div><MapPin size={25} strokeWidth={1.5} /></div>
    {map}
    <button type="button" className="wb-neighbourhood__explore" onClick={onExplore}>
      <span>{L.mapExplore}<small>{pois.length ? `${count} ${L.mapPlaces}` : L.mapHome}</small></span><ArrowUpRight size={20} />
    </button>
    <div className="wb-neighbourhood__legend">{categories.slice(0, 4).map(cat => <span key={cat.id}>
      <cat.Icon size={15} />{poiLabel(cat.id, lang)}</span>)}</div>
  </section>;

  return <section className="wb-neighbourhood wb-neighbourhood--full">
    <p className="wb-neighbourhood__intro">{L.mapIntro}</p>
    {categories.length ? <div className="wb-place-filters" role="group" aria-label={L.mapCategories}>
      <button type="button" aria-pressed={activeCategory === 'ALL'} onClick={() => { setCategory('ALL'); setSelectedId(null); }}>{L.mapAll}{' '}<span>{count}</span></button>
      {categories.map(cat => <button type="button" key={cat.id} aria-pressed={activeCategory === cat.id}
        onClick={() => { setCategory(cat.id); setSelectedId(null); }}><cat.Icon size={16} />{poiLabel(cat.id, lang)}{' '}
        <span>{new Intl.NumberFormat(lang).format(pois.filter(p => p.category === cat.id).length)}</span></button>)}
    </div> : null}
    {map || (renderMap ? <p className="wb-neighbourhood__notice">{L.mapNoPositions}</p> : null)}
    {property && (homePositioned || address) ? <article ref={node => { if (node) placeRefs.current.set('__home', node); else placeRefs.current.delete('__home'); }}
      tabIndex={-1} className="wb-place wb-place--home" data-selected={selected === '__home'}>
      <button type="button" className="wb-place__select" aria-pressed={selected === '__home'} onClick={() => setSelectedId('__home')}>
        <Home size={20} /><span><small>{L.mapHome}</small>{' '}<strong>{property.name}</strong></span><MapPin size={17} /></button>
      {address ? <p className="wb-place__address">{address}</p> : null}
      <GuideDirections target={{ lat: homePositioned ? property.latitude : null, lng: homePositioned ? property.longitude : null, address }}
        labels={L} interactive={interactive} className="wb-place__directions"><Navigation size={15} />{L.viewMap}</GuideDirections>
    </article> : null}
    <div className="wb-place-list">{places.map(({ poi, distance }) => {
      const Icon = placeIcon(poi);
      const positioned = hasGuidePosition(poi.lat, poi.lng);
      const expanded = selected === poi.id;
      const distanceText = distance == null ? null : distance < 1 ? `${new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(Math.round(distance * 1000 / 10) * 10)} m`
        : `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(distance)} km`;
      return <article key={poi.id} ref={node => { if (node) placeRefs.current.set(poi.id, node); else placeRefs.current.delete(poi.id); }}
        tabIndex={-1} className="wb-place" data-selected={expanded}>
        <button type="button" className="wb-place__select" aria-expanded={expanded} onClick={() => setSelectedId(expanded ? null : poi.id)}>
          <Icon size={22} strokeWidth={1.5} /><span><small>{poi.type || poiLabel(poi.category, lang)}</small>{' '}
            <strong>{poi.name || poiLabel(poi.category, lang)}</strong></span><ChevronRight className="cn-rtl-flip" size={18} /></button>
        <div className="wb-place__meta">{poi.featured ? <span><Star size={13} />{L.featured}</span> : null}
          {distanceText ? <span title={L.mapStraightLine}>{distanceText} · {L.mapStraightLine}</span> : null}
          {!positioned ? <span>{L.mapUnpositioned}</span> : null}</div>
        {expanded ? <div className="wb-place__detail">
          {poi.address ? <p className="wb-place__address">{poi.address}</p> : null}
          {poi.note ? <p className="wb-place__note">{poi.note}</p> : null}
          <GuideDirections target={{ lat: positioned ? poi.lat : null, lng: positioned ? poi.lng : null, address: poi.address }}
            labels={L} interactive={interactive} className="wb-place__directions"><Navigation size={15} />{L.viewMap}</GuideDirections>
        </div> : null}
      </article>;
    })}</div>
    {!places.length ? <p className="wb-neighbourhood__notice">{L.mapNoPlaces}</p> : null}
  </section>;
}
