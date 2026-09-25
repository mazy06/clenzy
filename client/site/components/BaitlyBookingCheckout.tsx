import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  CircleCheckIcon,
  CreditCardIcon,
  LockKeyholeIcon,
  MailIcon,
  UserRoundIcon,
  UsersIcon,
} from 'lucide-react';
import { BAITLY_BOOKING_TEMPLATES } from '../data/baitlyBookingTemplates';
import { BOOKING_CHECKOUT_COPY } from '../lib/messages/baitlyBookingCheckout';
import { BOOKING_STOREFRONT_COPY } from '../lib/messages/baitlyBookingStorefront';
import { useSiteLanguage } from '../lib/siteLanguage';
import BaitlyDemoPointer from './BaitlyDemoPointer';
import type { StepProps } from './BaitlyBookingSteps';
import {
  getBookingDemoExtras,
  getBookingDemoExtraTotal,
} from '../lib/bookingDemoExtras';
import type { SiteLanguage } from '../lib/siteLanguage';
import {
  formatBookingNights,
  formatBookingRange,
  getBookingDemoProperties,
} from '../lib/bookingDemoStay';

const stayTotal = ({ demo }: StepProps, language: SiteLanguage) =>
  demo.accommodation +
  getBookingDemoExtraTotal(
    getBookingDemoExtras(demo.templateIndex, language),
    demo.extras,
  );

export default function BaitlyBookingCheckout(props: StepProps) {
  const { demo, money } = props;
  const { language } = useSiteLanguage();
  const c = BOOKING_CHECKOUT_COPY[language];
  const s = BOOKING_STOREFRONT_COPY[language];
  return (
    <div className="bb-checkout">
      <span className="bb-section-kicker">
        <LockKeyholeIcon />
        {s.secure}
      </span>
      <h4 tabIndex={-1}>{c.title}</h4>
      <p className="bb-small-copy">{c.intro}</p>
      <div className="bb-checkout-fields">
        <div>
          <span className="bb-checkout-label">01 · {c.guest}</span>
          <button
            type="button"
            className="bb-checkout-choice bb-demo-target"
            aria-label={c.guestAction}
            aria-pressed={demo.guestFilled}
            disabled={demo.guestFilled}
            onClick={demo.fillGuest}
          >
            <UserRoundIcon />
            <span>
              <strong>
                {demo.guestFilled ? 'Camille Martin' : c.guestAction}
              </strong>
              <small>
                {demo.guestFilled ? <bdi>camille@example.com</bdi> : c.guest}
              </small>
            </span>
            {demo.guestFilled ? (
              <CheckIcon aria-label={c.guestReady} />
            ) : (
              <ArrowRightIcon />
            )}
            <BaitlyDemoPointer
              {...demo.pointer}
              show={demo.pointer.target === 'guest'}
            />
          </button>
        </div>
        <div>
          <span className="bb-checkout-label">02 · {c.card}</span>
          <button
            type="button"
            className="bb-checkout-choice bb-demo-target"
            aria-label={c.cardAction}
            aria-pressed={demo.cardFilled}
            disabled={!demo.guestFilled || demo.cardFilled}
            onClick={demo.fillCard}
          >
            <CreditCardIcon />
            <span>
              <strong>
                {demo.cardFilled ? (
                  <bdi>•••• •••• •••• 4242</bdi>
                ) : (
                  c.cardAction
                )}
              </strong>
              <small>
                {demo.cardFilled ? <bdi>{c.cardDetail}</bdi> : c.card}
              </small>
            </span>
            {demo.cardFilled ? (
              <CheckIcon aria-label={c.cardReady} />
            ) : (
              <ArrowRightIcon />
            )}
            <BaitlyDemoPointer
              {...demo.pointer}
              show={demo.pointer.target === 'card'}
            />
          </button>
        </div>
      </div>
      <button
        type="button"
        className="bb-scene-action bb-payment-action bb-demo-target"
        disabled={!demo.cardFilled || demo.processing || !demo.canContinue}
        onClick={demo.submitPayment}
      >
        <LockKeyholeIcon />
        <span>
          {demo.processing
            ? c.processing
            : c.pay.replace('{amount}', money(stayTotal(props, language)))}
        </span>
        {!demo.processing && <ArrowRightIcon />}
        <BaitlyDemoPointer
          {...demo.pointer}
          show={demo.pointer.target === 'pay'}
        />
      </button>
      <div
        className="bb-payment-status"
        role="status"
        aria-live={demo.playing ? 'off' : 'polite'}
      >
        {demo.processing ? (
          <>
            <span className="bb-payment-progress" aria-hidden="true" />
            {c.processingCopy}
          </>
        ) : (
          c.simulated
        )}
      </div>
    </div>
  );
}

export function BookingConfirmation(props: StepProps) {
  const { demo, m, money } = props;
  const { language } = useSiteLanguage();
  const c = BOOKING_CHECKOUT_COPY[language];
  const properties = getBookingDemoProperties(
    demo.templateIndex,
    language,
  ).filter((property) => demo.propertyIds.includes(property.id));
  const next =
    BAITLY_BOOKING_TEMPLATES[
      (demo.templateIndex + 1) % BAITLY_BOOKING_TEMPLATES.length
    ];
  return (
    <div className="bb-confirmation">
      <span className="bb-section-kicker">{c.paid}</span>
      <CircleCheckIcon />
      <h4 tabIndex={-1}>{m.confirmation}</h4>
      <p>{m.confirmationCopy}</p>
      {properties.map((property) => (
        <div className="bb-confirmation-ticket" key={property.id}>
          <img
            src={property.photo}
            alt=""
            width="220"
            height="150"
            loading="lazy"
          />
          <div>
            <strong>{property.name}</strong>
            <span>
              {formatBookingNights(demo.nights, language)} ·{' '}
              {money(property.nightly * demo.nights)}
            </span>
            <span>
              <CalendarDaysIcon />
              {formatBookingRange(demo.dates, language)}
            </span>
            <span>
              <UsersIcon />
              {m.guestCount}
            </span>
          </div>
        </div>
      ))}
      <div className="bb-confirmation-payment">
        <div>
          <span>{c.reference}</span>
          <bdi>BT-DEMO-00{demo.templateIndex + 1}</bdi>
        </div>
        <div>
          <span>{c.paid}</span>
          <strong>{money(stayTotal(props, language))}</strong>
        </div>
      </div>
      <div className="bb-confirmation-receipt">
        <MailIcon />
        <div>
          <strong>{c.receipt}</strong>
          <p>{c.receiptCopy}</p>
        </div>
      </div>
      <button
        type="button"
        className="bb-scene-action bb-demo-target"
        onClick={demo.nextTemplate}
      >
        {c.next.replace('{name}', next.name)}
        <ArrowRightIcon />
        <BaitlyDemoPointer
          {...demo.pointer}
          show={demo.pointer.target === 'next-template'}
        />
      </button>
      <span className="bb-demo-end">{c.simulated}</span>
    </div>
  );
}
