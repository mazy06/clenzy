import BaitlyBookingStorefront from './BaitlyBookingStorefront';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PauseIcon,
  PlayIcon,
} from '../../src/icons/glyphs';
import { BAITLY_BOOKING_TEMPLATES } from '../data/baitlyBookingTemplates';
import { BAITLY_BOOKING_MESSAGES } from '../lib/messages/baitlyBooking';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BookingThumbnail } from './BaitlyBookingPreview';
import { useBaitlyBookingDemo } from './useBaitlyBookingDemo';

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
        <div className="bb-demo" id="bb-booking-scene">
          <div className="bb-demo-toolbar">
            <span>
              <span className="bb-status-dot" />
              {m.demo}
            </span>
            {!demo.reduced && (
              <button type="button" onClick={demo.togglePlayback}>
                {demo.playing ? <PauseIcon /> : <PlayIcon />}
                {demo.playing ? m.pause : m.play}
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
          <BaitlyBookingStorefront demo={demo} />
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
                disabled={demo.step === 4}
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
