import {
  ArrowRightIcon,
  CarFrontIcon,
  CheckIcon,
  ShoppingBagIcon,
} from 'lucide-react';
import {
  getBookingDemoExtras,
  getBookingDemoExtraTotal,
} from '../lib/bookingDemoExtras';
import { BOOKING_CHECKOUT_COPY } from '../lib/messages/baitlyBookingCheckout';
import { BOOKING_EXTRAS_COPY } from '../lib/messages/baitlyBookingExtras';
import { useSiteLanguage } from '../lib/siteLanguage';
import type { StepProps } from './BaitlyBookingSteps';
import BaitlyDemoPointer from './BaitlyDemoPointer';
import '../baitly-booking-extras.css';

export default function BaitlyBookingExtras({ demo, m, money }: StepProps) {
  const { language } = useSiteLanguage();
  const c = BOOKING_EXTRAS_COPY[language];
  const offers = getBookingDemoExtras(demo.templateIndex, language);
  const count = demo.extras.filter(Boolean).length;
  const countLabel = (count > 1 ? c.selectedMany : c.selectedOne).replace(
    '{count}',
    new Intl.NumberFormat(language).format(count),
  );
  return (
    <div className="bb-extras-catalogue">
      <span className="bb-section-kicker">{c.catalogue}</span>
      <h4 tabIndex={-1}>{m.extrasTitle}</h4>
      <p className="bb-small-copy">{m.extrasCopy}</p>
      <div
        className="bb-extras-selection"
        aria-live={demo.playing ? 'off' : 'polite'}
      >
        <ShoppingBagIcon />
        <span>{countLabel}</span>
        <strong data-testid="booking-extras-subtotal">
          +{money(getBookingDemoExtraTotal(offers, demo.extras))}
        </strong>
      </div>
      <ul className="bb-extras-list" aria-label={c.catalogue}>
        {offers.map((offer, index) => (
          <li key={offer.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={demo.extras[index]}
              aria-label={`${offer.title} · ${money.label(offer.price)}`}
              className="bb-extras-option bb-demo-target"
              onClick={() => demo.toggleExtra(index)}
            >
              {offer.photo ? (
                <img
                  src={offer.photo}
                  alt=""
                  width="160"
                  height="130"
                  loading="lazy"
                />
              ) : (
                <span className="bb-extras-transfer" aria-hidden="true">
                  <CarFrontIcon />
                </span>
              )}
              <span className="bb-extras-description">
                <strong>{offer.title}</strong>
                <small>{offer.detail}</small>
              </span>
              <span className="bb-extras-price">+{money(offer.price)}</span>
              <span className="bb-extras-checkbox" aria-hidden="true">
                {demo.extras[index] && <CheckIcon />}
              </span>
              <BaitlyDemoPointer
                {...demo.pointer}
                show={demo.pointer.extraIndex === index && !demo.extras[index]}
              />
            </button>
          </li>
        ))}
      </ul>
      <div className="bb-extras-checkout">
        <p>{c.optional}</p>
        <button
          type="button"
          className="bb-scene-action bb-demo-target"
          onClick={() => demo.goToStep(3)}
        >
          {BOOKING_CHECKOUT_COPY[language].continue}
          <ArrowRightIcon />
          <BaitlyDemoPointer
            {...demo.pointer}
            show={demo.pointer.target === 'continue'}
          />
        </button>
        <button
          type="button"
          className="bb-extras-skip"
          onClick={demo.skipExtras}
        >
          {c.skip}
        </button>
      </div>
    </div>
  );
}
