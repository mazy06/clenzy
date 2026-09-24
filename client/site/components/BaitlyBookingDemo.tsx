import BaitlyBookingSteps from './BaitlyBookingSteps';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  LockKeyholeIcon,
  MapPinIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { BAITLY_BOOKING_TEMPLATES } from '../data/baitlyBookingTemplates';
import { BAITLY_BOOKING_MESSAGES } from '../lib/messages/baitlyBooking';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BookingThumbnail } from './BaitlyBookingPreview';
import { useBaitlyBookingDemo } from './useBaitlyBookingDemo';

type Demo = ReturnType<typeof useBaitlyBookingDemo>;

export default function BaitlyBookingDemo() {
  const { language } = useSiteLanguage();
  const m = BAITLY_BOOKING_MESSAGES[language];
  const demo = useBaitlyBookingDemo();
  const copy = m.templates[demo.templateIndex];
  return (
    <section
      className="bb-gallery site-shell"
      id="booking-templates"
      aria-labelledby="bb-gallery-title"
    >
      <div className="bb-section-heading">
        <div>
          <p className="bb-eyebrow">{m.galleryLabel}</p>
          <h2 id="bb-gallery-title">{m.galleryTitle}</h2>
        </div>
        <p>{m.galleryCopy}</p>
      </div>
      <div className="bb-gallery-layout">
        <div className="bb-template-list" role="group" aria-label={m.choose}>
          {BAITLY_BOOKING_TEMPLATES.map((template, index) => (
            <button
              type="button"
              key={template.id}
              className="bb-template-choice"
              aria-pressed={demo.templateIndex === index}
              aria-controls="bb-booking-scene"
              onClick={() => demo.selectTemplate(index)}
            >
              <BookingThumbnail template={template} />
              <span className="bb-template-copy">
                <span className="bb-template-category">
                  {m.templates[index].category}
                </span>
                <strong>{template.name}</strong>
                <span>{m.templates[index].description}</span>
              </span>
              <span className="bb-template-selection" aria-hidden="true">
                {demo.templateIndex === index ? (
                  <CheckIcon />
                ) : (
                  <ArrowRightIcon />
                )}
              </span>
            </button>
          ))}
        </div>
        <div className="bb-demo" id="bb-booking-scene" ref={demo.sceneRef}>
          <div className="bb-demo-toolbar">
            <span>
              <span className="bb-status-dot" />
              {m.demo}
            </span>
            {!demo.reduced && (
              <button type="button" onClick={demo.togglePlayback}>
                {demo.playing ? (
                  <PauseIcon />
                ) : demo.step === 3 ? (
                  <RotateCcwIcon />
                ) : (
                  <PlayIcon />
                )}
                {demo.playing ? m.pause : demo.step === 3 ? m.replay : m.play}
              </button>
            )}
          </div>
          <nav className="bb-steps" aria-label={m.demo}>
            {copy.steps.map((label, index) => (
              <button
                type="button"
                key={index}
                aria-label={`0${index + 1} ${label}`}
                aria-current={demo.step === index ? 'step' : undefined}
                onClick={() => demo.goToStep(index)}
              >
                <span aria-hidden="true">
                  {index < demo.step ? <CheckIcon /> : `0${index + 1}`}
                </span>
                {label}
              </button>
            ))}
          </nav>
          <BookingScene demo={demo} />
          <div className="bb-demo-foot">
            <p key={`${demo.templateIndex}-${demo.step}`}>
              {copy.notes[demo.step]}
            </p>
            <div>
              <button
                type="button"
                aria-label={m.previous}
                disabled={demo.step === 0}
                onClick={() => demo.goToStep(demo.step - 1)}
              >
                <ArrowLeftIcon />
              </button>
              <button
                type="button"
                aria-label={m.next}
                disabled={demo.step === 3}
                onClick={() => demo.goToStep(demo.step + 1)}
              >
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className="bb-caption">{m.caption}</p>
    </section>
  );
}

function BookingScene({ demo }: { demo: Demo }) {
  const { language } = useSiteLanguage();
  const m = BAITLY_BOOKING_MESSAGES[language];
  const template = BAITLY_BOOKING_TEMPLATES[demo.templateIndex];
  const copy = m.templates[demo.templateIndex];
  const money = (amount: number) =>
    new Intl.NumberFormat(language, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  const extraTotal = template.prices.reduce(
    (total, price, index) => total + (demo.extras[index] ? price : 0),
    0,
  );
  return (
    <div
      className={`bb-storefront bb-theme-${template.id}`}
      onFocusCapture={demo.pause}
    >
      <div className="bb-storefront-header">
        <strong>{template.name}</strong>
        <span>
          <LockKeyholeIcon /> {m.recap}
        </span>
      </div>
      <div className="bb-storefront-layout">
        <div className="bb-property-photo" key={template.id}>
          <img
            src={template.photo}
            alt={copy.category}
            width="560"
            height="640"
            loading="lazy"
          />
          <div>
            <span>
              <MapPinIcon />
              {copy.location}
            </span>
            <h3>{copy.tagline}</h3>
          </div>
        </div>
        <div className="bb-reservation">
          <div
            className="bb-reservation-content"
            key={`${template.id}-${demo.step}`}
          >
            <BaitlyBookingSteps
              demo={demo}
              template={template}
              m={m}
              money={money}
            />
          </div>
          <div
            className="bb-cart"
            aria-live={demo.playing ? 'off' : 'polite'}
            aria-atomic="true"
          >
            <div>
              <span>{m.stayLabel}</span>
              <span>{money(template.base)}</span>
            </div>
            <div className={extraTotal > 0 ? 'bb-cart-extras-active' : ''}>
              <span>{m.extrasLabel}</span>
              <span key={extraTotal}>{money(extraTotal)}</span>
            </div>
            <div className="bb-cart-total">
              <strong>{m.total}</strong>
              <strong data-testid="booking-demo-total">
                {money(template.base + extraTotal)}
              </strong>
            </div>
          </div>
        </div>
      </div>
      <div className="bb-value-line">
        <span>
          Baitly <ArrowRightIcon />
        </span>
        <p>
          <strong key={extraTotal}>+{money(extraTotal)}</strong> {m.saleNote}
        </p>
      </div>
    </div>
  );
}
