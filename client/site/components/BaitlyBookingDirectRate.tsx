import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import airbnb from '../assets/brands/airbnb.svg';
import booking from '../assets/brands/bookingdotcom.svg';
import {
  BOOKING_DEMO_DIRECT_DISCOUNT,
  getBookingDemoRate,
} from '../data/baitlyBookingTemplates';
import { BOOKING_STOREFRONT_COPY } from '../lib/messages/baitlyBookingStorefront';
import { useSiteLanguage } from '../lib/siteLanguage';

export default function BaitlyBookingDirectRate({
  amount,
  money,
  nights,
}: {
  amount: number;
  money: (amount: number) => string;
  nights: string;
}) {
  const { language } = useSiteLanguage();
  const s = BOOKING_STOREFRONT_COPY[language];
  const rate = getBookingDemoRate(amount);
  const discount = new Intl.NumberFormat(language, { style: 'percent' }).format(
    -BOOKING_DEMO_DIRECT_DISCOUNT,
  );
  return (
    <section className="bb-direct-rate" aria-label={s.rates.title}>
      <div className="bb-rate-heading">
        <span className="bb-rate-badge">
          <CheckIcon aria-hidden="true" />
          {s.rates.badge.replace('{discount}', discount)}
        </span>
        <h4>{s.rates.title}</h4>
      </div>
      <div className="bb-rate-comparison">
        <div className="bb-rate-reference">
          <span>{s.rates.reference}</span>
          <del data-testid="booking-ota-rate">{money(rate.reference)}</del>
          <span className="bb-rate-channels">
            <span>
              <img src={airbnb} alt="" />
              Airbnb
            </span>
            <span>
              <img src={booking} alt="" />
              Booking.com
            </span>
          </span>
        </div>
        <ArrowRightIcon className="bb-rate-arrow" aria-hidden="true" />
        <div className="bb-rate-host">
          <span>{s.rates.direct}</span>
          <strong data-testid="booking-direct-rate">
            {money(rate.direct)}
          </strong>
          <small>{nights}</small>
        </div>
      </div>
      <div className="bb-rate-saving">
        <strong>{money(rate.savings)}</strong>
        <span>{s.rates.savings}</span>
      </div>
      <p className="bb-rate-note">{s.rates.note}</p>
    </section>
  );
}
