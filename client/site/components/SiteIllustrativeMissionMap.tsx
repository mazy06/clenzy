import type { BaitlyPropertyMapProps } from '../../src/components/BaitlyMapCanvas';
import { useSiteLanguage } from '../lib/siteLanguage';
import './site-illustrative-map.css';

const LABEL = { fr: 'Carte illustrative · données de démonstration', en: 'Illustrative map · demo data', ar: 'خريطة توضيحية · بيانات تجريبية' };
const POINTS = [[37, 61], [60, 35], [70, 73]];

/** Local scene only: preserve mission selection without a map SDK, telemetry or
 * tile requests on the public site. Positions are illustrative, not geographic.
 */
export default function SiteIllustrativeMissionMap({ properties, selectedPropertyId, onMarkerClick }: BaitlyPropertyMapProps) {
  const { language } = useSiteLanguage();
  return <div className="site-illustrative-map" role="group" aria-label={LABEL[language]}>
    <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="600" height="600" fill="#edf1f3" />
      <path d="M-50 80 Q170 120 125 370 T200 680" fill="none" stroke="#d7e5ec" strokeWidth="76" />
      <g fill="#dce6df" stroke="#cad9ce" strokeWidth="1">
        <path d="M280 28 425 40 403 119 272 115Z" /><path d="M428 360 542 332 580 429 473 453Z" />
        <path d="M217 470 326 446 351 554 261 592Z" />
      </g>
      <g fill="none" stroke="#fbfcfd" strokeWidth="15">
        <path d="M150-20 212 152 280 314 378 620M375-20 352 186 440 410 470 620M610 135 339 188 130 233-10 200M-10 412 262 384 610 296M180 620 264 420 352 186 550-20" />
      </g>
      <g fill="none" stroke="#d7dfe4" strokeWidth="5">
        <path d="M205 12 255 150 280 242M445 12 410 120 485 210 610 208M214 315 336 283 405 262M319 481 419 479 591 508M267 213 179 287 154 382M453 400 334 366 281 384M522 48 536 114 590 166" />
      </g>
    </svg>
    {properties.map((property) => {
      const point = POINTS[((property.id ?? 1) - 1) % POINTS.length];
      return <button key={property.id} type="button" data-map-property-id={property.id}
        aria-label={property.name} aria-pressed={property.id === selectedPropertyId}
        onClick={() => onMarkerClick?.(property)}
        style={{ left: `${point[0]}%`, top: `${point[1]}%` }}>
        {property.id}<span>{property.name}</span>
      </button>;
    })}
    <p>{LABEL[language]}</p>
  </div>;
}
