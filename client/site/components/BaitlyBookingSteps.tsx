import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  CircleCheckIcon,
  PlusIcon,
  UsersIcon,
} from 'lucide-react';
import type { BookingTemplate } from '../data/baitlyBookingTemplates';
import type { BaitlyBookingMessages } from '../lib/messages/baitlyBooking';
import type { useBaitlyBookingDemo } from './useBaitlyBookingDemo';

interface StepProps {
  demo: ReturnType<typeof useBaitlyBookingDemo>;
  template: BookingTemplate;
  m: BaitlyBookingMessages;
  money: (amount: number) => string;
}

export default function BaitlyBookingSteps(props: StepProps) {
  const { demo, template, m } = props;
  const copy = m.templates[demo.templateIndex];
  if (demo.step === 3)
    return (
      <div className="bb-confirmation">
        <CircleCheckIcon />
        <h4>{m.confirmation}</h4>
        <p>{m.confirmationCopy}</p>
        <span>{copy.stay}</span>
        <span>{m.dateRange}</span>
      </div>
    );
  if (demo.step === 2) return <ExtraOptions {...props} />;
  if (template.id === 'collection' && demo.step === 1)
    return <MultiStayCart {...props} />;
  if (
    template.id !== 'collection' &&
    demo.step === (template.id === 'villa' ? 0 : 1)
  )
    return <StayDates {...props} />;
  return <DiscoverProperty {...props} />;
}

function ExtraOptions({ demo, template, m, money }: StepProps) {
  const copy = m.templates[demo.templateIndex];
  return (
    <>
      <h4>{m.extrasTitle}</h4>
      <p className="bb-small-copy">{m.extrasCopy}</p>
      <div className="bb-extras">
        {copy.extras.map((extra, index) => (
          <button
            type="button"
            key={extra}
            className="bb-extra"
            aria-pressed={demo.extras[index]}
            onClick={() => demo.toggleExtra(index)}
          >
            <img
              src={template.extras[index]}
              alt=""
              width="64"
              height="64"
              loading="lazy"
            />
            <span>
              <strong>{extra}</strong>
              <span>+{money(template.prices[index])}</span>
            </span>
            <span className="bb-extra-check">
              {demo.extras[index] ? <CheckIcon /> : <PlusIcon />}
              <span className="bb-sr-only">
                {demo.extras[index] ? m.added : m.add}
              </span>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="bb-scene-action bb-review-action"
        onClick={() => demo.goToStep(3)}
      >
        {copy.steps[3]}
        <ArrowRightIcon />
      </button>
    </>
  );
}

function StayDates({ demo, m }: StepProps) {
  return (
    <>
      <h4>{m.dates}</h4>
      <div className="bb-date-pair">
        <div>
          <span>{m.arrival}</span>
          <strong>12</strong>
          <span>{m.month}</span>
        </div>
        <ArrowRightIcon />
        <div>
          <span>{m.departure}</span>
          <strong>15</strong>
          <span>{m.month}</span>
        </div>
      </div>
      <p className="bb-guest-line">
        <UsersIcon />
        {m.guestCount}
      </p>
      <button
        type="button"
        className="bb-scene-action"
        onClick={() => demo.goToStep(demo.step + 1)}
      >
        {m.availability}
        <ArrowRightIcon />
      </button>
    </>
  );
}

function MultiStayCart({ demo, template, m, money }: StepProps) {
  // These two illustrative line items always reconcile with the collection's base price.
  const firstAmount = (template.base * 2) / 3;
  const stays = [
    { label: m.firstStay, photo: template.photo, amount: firstAmount },
    {
      label: m.secondStay,
      photo: template.detail,
      amount: template.base - firstAmount,
    },
  ];
  return (
    <>
      <h4>{m.cartTitle}</h4>
      <div className="bb-multi-cart">
        {stays.map((stay) => (
          <div key={stay.label}>
            <img
              src={stay.photo}
              alt=""
              width="64"
              height="60"
              loading="lazy"
            />
            <span>
              {stay.label}
              <strong>{money(stay.amount)}</strong>
            </span>
            <CheckIcon />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="bb-scene-action"
        onClick={() => demo.goToStep(2)}
      >
        {m.templates[demo.templateIndex].steps[2]}
        <ArrowRightIcon />
      </button>
    </>
  );
}

function DiscoverProperty({ demo, template, m }: StepProps) {
  const copy = m.templates[demo.templateIndex];
  const collection = template.id === 'collection';
  return (
    <>
      <h4>
        {collection
          ? m.destination
          : template.id === 'villa'
          ? template.name
          : m.room}
      </h4>
      <div
        className={`bb-room-preview ${collection ? 'bb-room-collection' : ''}`}
      >
        <img
          src={collection ? template.photo : template.detail}
          alt=""
          width="300"
          height="130"
          loading="lazy"
        />
        <span>{collection ? m.firstStay : copy.stay}</span>
        {collection && (
          <>
            <img
              src={template.detail}
              alt=""
              width="300"
              height="130"
              loading="lazy"
            />
            <span>{m.secondStay}</span>
          </>
        )}
      </div>
      <p className="bb-guest-line">
        <CalendarDaysIcon />
        {m.dateRange}
        <span>·</span>
        {m.guestCount}
      </p>
      <button
        type="button"
        className="bb-scene-action"
        onClick={() => demo.goToStep(demo.step + 1)}
      >
        {copy.steps[demo.step + 1]}
        <ArrowRightIcon />
      </button>
    </>
  );
}
