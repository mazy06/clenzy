import { ArrowUpRightIcon, CheckIcon } from 'lucide-react';
import {
  BAITLY_BOOKING_TEMPLATES,
  type BookingTemplate,
} from '../data/baitlyBookingTemplates';
import { BAITLY_BOOKING_MESSAGES } from '../lib/messages/baitlyBooking';
import { useSiteLanguage } from '../lib/siteLanguage';
import '../baitly-booking.css';

export function BookingThumbnail({ template }: { template: BookingTemplate }) {
  return (
    <span className={`bb-thumbnail bb-theme-${template.id}`} aria-hidden="true">
      <span className="bb-thumbnail-bar">
        <i />
        <i />
        <i />
      </span>
      <span className="bb-thumbnail-page">
        <span className="bb-thumbnail-brand">{template.name}</span>
        <img
          src={template.photo}
          width="320"
          height="200"
          alt=""
          loading="lazy"
        />
        <span className="bb-thumbnail-lines">
          <i />
          <i />
          <b />
        </span>
        {template.id === 'collection' && (
          <img
            src={template.detail}
            width="100"
            height="70"
            alt=""
            loading="lazy"
          />
        )}
      </span>
    </span>
  );
}

/** The same template visuals connect the product menu to the page's gallery. */
export default function BaitlyBookingPreview({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { language } = useSiteLanguage();
  const m = BAITLY_BOOKING_MESSAGES[language];
  return (
    <div
      className={`bb-preview ${compact ? 'bb-preview-compact' : ''}`}
      aria-hidden="true"
    >
      <div className="bb-preview-stack">
        {BAITLY_BOOKING_TEMPLATES.map((template) => (
          <BookingThumbnail key={template.id} template={template} />
        ))}
      </div>
      {!compact && (
        <>
          <span className="bb-preview-label">
            {m.promises[0]} <ArrowUpRightIcon />
          </span>
          <div className="bb-preview-receipt">
            <CheckIcon />
            <span>
              {m.templates[0].extras[0]}
              <small>{m.added}</small>
            </span>
            <strong>+36 €</strong>
          </div>
        </>
      )}
    </div>
  );
}
