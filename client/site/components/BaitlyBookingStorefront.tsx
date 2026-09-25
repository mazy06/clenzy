import {
  ArrowRightIcon,
  BedDoubleIcon,
  CalendarDaysIcon,
  CheckIcon,
  CoffeeIcon,
  LockKeyholeIcon,
  MapPinIcon,
  MoonIcon,
  ShoppingBagIcon,
  ShieldCheckIcon,
  SunIcon,
  TreesIcon,
  UsersIcon,
  WavesIcon,
} from 'lucide-react';
import {
  BAITLY_BOOKING_TEMPLATES,
  getBookingDemoRate,
} from '../data/baitlyBookingTemplates';
import { BAITLY_BOOKING_MESSAGES } from '../lib/messages/baitlyBooking';
import { BOOKING_STOREFRONT_COPY } from '../lib/messages/baitlyBookingStorefront';
import { useSiteLanguage } from '../lib/siteLanguage';
import BaitlyBookingSteps from './BaitlyBookingSteps';
import BaitlyBookingDirectRate from './BaitlyBookingDirectRate';
import {
  getBookingDemoExtras,
  getBookingDemoExtraTotal,
} from '../lib/bookingDemoExtras';
import type { useBaitlyBookingDemo } from './useBaitlyBookingDemo';
import {
  formatBookingDate,
  formatBookingNights,
  formatBookingRange,
  getBookingDemoProperties,
} from '../lib/bookingDemoStay';
import { BOOKING_STAY_COPY } from '../lib/messages/baitlyBookingStay';

type Demo = ReturnType<typeof useBaitlyBookingDemo>;

export default function BaitlyBookingStorefront({ demo }: { demo: Demo }) {
  const { language } = useSiteLanguage();
  const m = BAITLY_BOOKING_MESSAGES[language];
  const s = BOOKING_STOREFRONT_COPY[language];
  const c = BOOKING_STAY_COPY[language];
  const properties = getBookingDemoProperties(
    demo.templateIndex,
    language,
  ).filter((property) => demo.propertyIds.includes(property.id));
  const nights = demo.dates.departure
    ? formatBookingNights(demo.nights, language)
    : c.chooseDeparture;
  const template = BAITLY_BOOKING_TEMPLATES[demo.templateIndex];
  const copy = m.templates[demo.templateIndex];
  const site = s.templates[demo.templateIndex];
  const amenityIcons =
    template.id === 'villa'
      ? [BedDoubleIcon, WavesIcon, TreesIcon]
      : template.id === 'collection'
      ? [MapPinIcon, MoonIcon, ShoppingBagIcon]
      : [BedDoubleIcon, SunIcon, CoffeeIcon];
  const money = (amount: number) =>
    new Intl.NumberFormat(language, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  const offers = getBookingDemoExtras(demo.templateIndex, language);
  const extraTotal = getBookingDemoExtraTotal(offers, demo.extras);
  return (
    <div className={`bb-storefront bb-theme-${template.id}`}>
      <header className="bb-storefront-header">
        <button
          type="button"
          className="bb-hotel-brand"
          onClick={() => demo.goToStep(0)}
        >
          <span className="bb-hotel-monogram" aria-hidden="true">
            {['Z', 'N', 'é'][demo.templateIndex]}
          </span>
          <span>
            {template.name}
            <small>{site.signature}</small>
          </span>
        </button>
        <nav className="bb-hotel-nav" aria-label={template.name}>
          {site.nav.map((label, index) => (
            <button
              type="button"
              key={label}
              onClick={() =>
                demo.goToStep(
                  index === 0
                    ? demo.propertyStep
                    : index === 1
                    ? demo.datesStep
                    : 2,
                )
              }
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="bb-hotel-book"
          onClick={() => demo.goToStep(demo.datesStep)}
        >
          {m.recap}
          <ArrowRightIcon />
        </button>
      </header>
      <div className="bb-hotel-intro" key={template.id}>
        <img
          src={template.photo}
          alt={copy.category}
          width="1400"
          height="600"
          loading="lazy"
        />
        <div className="bb-hotel-intro-copy">
          <span className="bb-hotel-location">
            <MapPinIcon />
            {copy.location}
          </span>
          <h3>{site.title}</h3>
          <p>{site.subtitle}</p>
        </div>
        {template.id === 'riad' && (
          <span className="bb-hotel-seal" aria-hidden="true">
            MZ<span>MARRAKECH</span>
          </span>
        )}
      </div>
      <div className="bb-stay-strip">
        <span>
          <CalendarDaysIcon />
          <span>
            {m.arrival}
            <strong>{formatBookingDate(demo.dates.arrival, language)}</strong>
          </span>
        </span>
        <span>
          <CalendarDaysIcon />
          <span>
            {m.departure}
            <strong>
              {demo.dates.departure
                ? formatBookingDate(demo.dates.departure, language)
                : c.chooseDeparture}
            </strong>
          </span>
        </span>
        <span>
          <UsersIcon />
          <span>
            {m.guests}
            <strong>{m.guestCount}</strong>
          </span>
        </span>
        <span className="bb-direct-note">
          <CheckIcon />
          {s.direct}
        </span>
      </div>
      <div
        className={!demo.canContinue ? 'bb-rate-pending' : undefined}
        aria-hidden={!demo.canContinue || undefined}
      >
        <BaitlyBookingDirectRate
          amount={demo.accommodation}
          money={money}
          nights={nights}
        />
      </div>
      <div className="bb-storefront-layout">
        <div className="bb-reservation" ref={demo.visibilityRef}>
          <div
            className="bb-reservation-content"
            ref={demo.sceneRef}
            key={`${template.id}-${demo.step}`}
          >
            <BaitlyBookingSteps
              demo={demo}
              template={template}
              m={m}
              money={money}
            />
          </div>
        </div>
        <aside className="bb-stay-summary" aria-label={s.summary}>
          <div className="bb-summary-heading">
            <span>{m.recap}</span>
            <small>
              {nights} · {m.guestCount}
            </small>
          </div>
          <div className="bb-summary-properties">
            {properties.map((property) => (
              <div className="bb-summary-property" key={property.id}>
                <img
                  src={property.photo}
                  alt=""
                  width="100"
                  height="90"
                  loading="lazy"
                />
                <div>
                  <strong>{property.name}</strong>
                  <span>{property.location}</span>
                  <small>{formatBookingRange(demo.dates, language)}</small>
                  <small>
                    {demo.dates.departure
                      ? money(property.nightly * demo.nights)
                      : c.chooseDeparture}
                  </small>
                </div>
              </div>
            ))}
            {!properties.length && (
              <p className="bb-summary-empty">{c.chooseProperty}</p>
            )}
          </div>
          <div
            className="bb-cart"
            aria-live={demo.playing ? 'off' : 'polite'}
            aria-atomic="true"
          >
            <div>
              <span>{m.stayLabel}</span>
              <span>{money(demo.accommodation)}</span>
            </div>
            {demo.extras.map(
              (selected, index) =>
                selected && (
                  <div className="bb-cart-service" key={index}>
                    <span>
                      <CheckIcon />
                      {offers[index].title}
                    </span>
                    <span>{money(offers[index].price)}</span>
                  </div>
                ),
            )}
            {!extraTotal && (
              <div>
                <span>{m.extrasLabel}</span>
                <span>{money(0)}</span>
              </div>
            )}
            <div className="bb-cart-total">
              <span>
                {m.total}
                <small>{nights}</small>
              </span>
              <strong data-testid="booking-demo-total">
                {demo.canContinue
                  ? money(demo.accommodation + extraTotal)
                  : '…'}
              </strong>
            </div>
            {demo.canContinue && (
              <div className="bb-cart-saving">
                <span>
                  <CheckIcon aria-hidden="true" />
                  {s.rates.included}
                </span>
                <strong data-testid="booking-direct-savings">
                  {money(getBookingDemoRate(demo.accommodation).savings)}
                </strong>
              </div>
            )}
          </div>
          <div className="bb-summary-assurance">
            <ShieldCheckIcon />
            <span>
              {s.direct}
              <small>{s.secure}</small>
            </span>
          </div>
          <p className="bb-summary-demo">{m.demo}</p>
        </aside>
      </div>
      <div className="bb-hotel-inclusions">
        {amenityIcons.map((Icon, i) => (
          <span key={i}>
            <Icon />
            {template.id === 'collection' && i === 0
              ? properties.length === 1
                ? c.selectedOne
                : c.selectedCount.replace(
                    '{count}',
                    new Intl.NumberFormat(language).format(properties.length),
                  )
              : template.id === 'collection' && i === 1
              ? nights
              : site.amenities[i]}
          </span>
        ))}
      </div>
      <footer className="bb-value-line">
        <span>
          Baitly <ArrowRightIcon />
        </span>
        <p>
          <strong key={extraTotal}>+{money(extraTotal)}</strong> {m.saleNote}
        </p>
        <LockKeyholeIcon />
      </footer>
    </div>
  );
}
