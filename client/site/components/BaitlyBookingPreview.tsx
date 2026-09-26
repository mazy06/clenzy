import SiteMoney, { useSiteMoney } from './SiteMoney';
import { ArrowRightIcon, CheckIcon, LockKeyholeIcon } from 'lucide-react';
import {
  BAITLY_BOOKING_TEMPLATES,
  BOOKING_DEMO_DIRECT_DISCOUNT,
  getBookingDemoRate,
  type BookingTemplate,
} from '../data/baitlyBookingTemplates';
import { BAITLY_BOOKING_MESSAGES } from '../lib/messages/baitlyBooking';
import { BOOKING_STOREFRONT_COPY } from '../lib/messages/baitlyBookingStorefront';
import { useSiteLanguage } from '../lib/siteLanguage';
import '../baitly-booking.css';

function BookingPreviewRate({
  amount,
  phone = false,
}: {
  amount: number;
  phone?: boolean;
}) {
  const { language } = useSiteLanguage();
  const s = BOOKING_STOREFRONT_COPY[language];
  const rate = getBookingDemoRate(amount);
  const money = useSiteMoney('EUR', language);
  const discount = new Intl.NumberFormat(language, { style: 'percent' }).format(
    -BOOKING_DEMO_DIRECT_DISCOUNT,
  );
  return (
    <span className={phone ? 'bb-phone-rate' : 'bb-mini-rate'}>
      <span className="bb-preview-rate-benefit">
        <strong>{s.rates.badge.replace('{discount}', discount)}</strong>
        <small>{s.rates.example}</small>
      </span>
      <span className="bb-preview-rate-prices">
        <span>
          OTA <del>{money(rate.reference)}</del>
        </span>
        <b>
          {money(rate.direct)}
          <small>{s.night}</small>
        </b>
      </span>
    </span>
  );
}

/** A miniature guest website, shared by the menu, hero and template selector. */
export function BookingThumbnail({ template }: { template: BookingTemplate }) {
  const { language } = useSiteLanguage();
  const m = BAITLY_BOOKING_MESSAGES[language];
  const s = BOOKING_STOREFRONT_COPY[language];
  const index = BAITLY_BOOKING_TEMPLATES.findIndex(
    (item) => item.id === template.id,
  );
  const copy = s.templates[index];
  return (
    <span className={`bb-thumbnail bb-theme-${template.id}`} aria-hidden="true">
      <span className="bb-thumbnail-bar">
        <i />
        <i />
        <i />
        <span>{s.preview}</span>
      </span>
      <span className="bb-mini-header">
        <span className="bb-mini-brand">
          {template.name}
          <small>{copy.signature}</small>
        </span>
        <span className="bb-mini-nav">
          {copy.nav[0]}
          <span>{copy.nav[2]}</span>
        </span>
        <span className="bb-mini-book">{m.recap} ↗</span>
      </span>
      <BookingPreviewRate amount={template.base / 3} />
      <span className="bb-mini-hero">
        <img
          src={template.photo}
          width="700"
          height="460"
          alt=""
          loading="lazy"
        />
        <span className="bb-mini-hero-copy">
          <small>{m.templates[index].location}</small>
          <strong>{copy.title}</strong>
          <span>{copy.subtitle}</span>
        </span>
      </span>
      <span className="bb-mini-search">
        <span>
          {m.arrival}
          <b>12 {m.month}</b>
        </span>
        <span>
          {m.departure}
          <b>15 {m.month}</b>
        </span>
        <span>
          {m.guests}
          <b>{m.guestCount}</b>
        </span>
        <strong>
          {s.book}
          <ArrowRightIcon />
        </strong>
      </span>
      <span className="bb-mini-editorial">
        <span>
          <small>{s.selection}</small>
          <strong>{copy.room}</strong>
          <span>
            {copy.amenities[0]} · {copy.amenities[1]}
          </span>
        </span>
        <img
          src={template.detail}
          width="150"
          height="90"
          alt=""
          loading="lazy"
        />
      </span>
    </span>
  );
}

export default function BaitlyBookingPreview({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { language } = useSiteLanguage();
  const m = BAITLY_BOOKING_MESSAGES[language];
  const s = BOOKING_STOREFRONT_COPY[language];
  return (
    <div
      className={`bb-preview ${compact ? 'bb-preview-compact' : ''}`}
      aria-hidden="true"
    >
      <div className="bb-preview-desktop">
        <BookingThumbnail template={BAITLY_BOOKING_TEMPLATES[0]} />
      </div>
      {!compact && (
        <>
          <div className="bb-preview-mobile bb-theme-villa">
            <span className="bb-phone-speaker" />
            <span className="bb-phone-brand">
              Villa Naya<small>{s.templates[1].signature}</small>
            </span>
            <img
              src={BAITLY_BOOKING_TEMPLATES[1].photo}
              alt=""
              width="220"
              height="260"
            />
            <span className="bb-phone-content">
              <strong>{s.templates[1].title}</strong>
              <span>
                {m.dateRange} · {s.nights}
              </span>
              <BookingPreviewRate
                amount={BAITLY_BOOKING_TEMPLATES[1].base / 3}
                phone
              />
              <b>
                {s.book}
                <ArrowRightIcon />
              </b>
              <small>
                <LockKeyholeIcon />
                {s.direct}
              </small>
            </span>
          </div>
          <div className="bb-preview-receipt">
            <span className="bb-receipt-icon">
              <CheckIcon />
            </span>
            <span>
              {m.templates[0].extras[0]}
              <small>{m.added}</small>
            </span>
            <strong>
              +<SiteMoney value={36} from="EUR" />
            </strong>
          </div>
        </>
      )}
    </div>
  );
}
