import { ArrowRightIcon, CheckIcon, MapPinIcon } from '../../src/icons/glyphs';
import {
  formatBookingNights,
  formatBookingRange,
  getBookingDemoProperties,
} from '../lib/bookingDemoStay';
import { BOOKING_STAY_COPY } from '../lib/messages/baitlyBookingStay';
import { BOOKING_STOREFRONT_COPY } from '../lib/messages/baitlyBookingStorefront';
import { useSiteLanguage } from '../lib/siteLanguage';
import BaitlyDemoPointer from './BaitlyDemoPointer';
import type { StepProps } from './BaitlyBookingSteps';

export default function BaitlyBookingProperties({ demo, m, money }: StepProps) {
  const { language } = useSiteLanguage();
  const c = BOOKING_STAY_COPY[language];
  const s = BOOKING_STOREFRONT_COPY[language];
  const collection = demo.templateIndex === 2;
  const properties = getBookingDemoProperties(demo.templateIndex, language);
  const title =
    demo.templateIndex === 0
      ? c.roomsTitle
      : collection
      ? c.collectionTitle
      : c.villaTitle;
  return (
    <div className="bb-property-picker">
      <span className="bb-section-kicker">{s.selection}</span>
      <h4 tabIndex={-1}>{title}</h4>
      <p className="bb-small-copy">
        {collection
          ? c.collectionIntro
          : demo.templateIndex === 0
          ? c.roomIntro
          : s.templates[1].roomCopy}
      </p>
      <div className="bb-properties-dates">
        <span>{formatBookingRange(demo.dates, language)}</span>
        <button type="button" onClick={() => demo.goToStep(demo.datesStep)}>
          {c.editDates}
        </button>
      </div>
      <div
        className="bb-property-options"
        data-count={properties.length}
        role={collection ? 'group' : 'radiogroup'}
        aria-label={title}
      >
        {properties.map((property, index) => {
          const selected = demo.propertyIds.includes(property.id);
          return (
            <button
              type="button"
              key={property.id}
              role={collection ? 'checkbox' : 'radio'}
              aria-checked={selected}
              tabIndex={collection || selected ? 0 : -1}
              aria-label={`${c.choose} ${property.name}`}
              className="bb-property-option bb-demo-target"
              onClick={() => demo.selectProperty(property.id)}
              onKeyDown={(event) => {
                if (collection) return;
                const direction =
                  event.key === 'ArrowDown' || event.key === 'ArrowRight'
                    ? 1
                    : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
                    ? -1
                    : 0;
                if (!direction) return;
                event.preventDefault();
                const next =
                  (index + direction + properties.length) % properties.length;
                demo.selectProperty(properties[next].id);
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                  [next]?.focus();
              }}
            >
              <img
                src={property.photo}
                alt=""
                width="400"
                height="300"
                loading="lazy"
              />
              <span className="bb-property-description">
                <small>
                  <MapPinIcon />
                  {property.location}
                </small>
                <strong>{property.name}</strong>
                <span>{property.detail}</span>
                <span>{property.feature}</span>
                <span className="bb-property-availability">
                  <CheckIcon />
                  {c.available}
                </span>
              </span>
              <span className="bb-property-price">
                <strong>{money(property.nightly * demo.nights)}</strong>
                <small>{formatBookingNights(demo.nights, language)}</small>
                <small>
                  {money(property.nightly)} {s.night}
                </small>
                <span className="bb-property-select">
                  <span>{selected ? <CheckIcon /> : <span />}</span>
                  {selected ? c.chosen : c.choose}
                </span>
              </span>
              <BaitlyDemoPointer
                {...demo.pointer}
                show={
                  demo.pointer.target === 'property' &&
                  demo.pointer.propertyId === property.id
                }
              />
            </button>
          );
        })}
      </div>
      <div
        className="bb-properties-total"
        aria-live={demo.playing ? 'off' : 'polite'}
      >
        <span>
          {demo.propertyIds.length
            ? demo.propertyIds.length === 1
              ? c.selectedOne
              : c.selectedCount.replace(
                  '{count}',
                  new Intl.NumberFormat(language).format(
                    demo.propertyIds.length,
                  ),
                )
            : c.chooseProperty}
        </span>
        <strong>{money(demo.accommodation)}</strong>
      </div>
      <button
        type="button"
        className="bb-scene-action bb-demo-target"
        disabled={!demo.propertyIds.length}
        onClick={() => demo.goToStep(demo.propertyStep + 1)}
      >
        {demo.templateIndex === 0
          ? m.dates
          : m.templates[demo.templateIndex].steps[2]}
        <ArrowRightIcon />
        <BaitlyDemoPointer
          {...demo.pointer}
          show={demo.pointer.target === 'continue'}
        />
      </button>
    </div>
  );
}
