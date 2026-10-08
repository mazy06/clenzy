import { MapPinIcon, StarIcon, UserRoundIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Shared presentation for illustrative marketplace listings and the applicant's draft. */
export default function ProviderProfileCard({
  name,
  trade,
  city,
  photo,
  cover,
  price,
  unit,
  rating,
  reviews,
  rhythm,
  compact = false,
}: {
  name: string;
  trade: string;
  city: string;
  photo?: string;
  cover?: string;
  price: ReactNode;
  unit?: string;
  rating?: string;
  reviews?: string;
  rhythm?: string;
  compact?: boolean;
}) {
  return (
    <article className="bpr-profile" data-compact={compact || undefined}>
      {cover && (
        <img
          className="bpr-profile-cover"
          src={cover}
          alt=""
          width={640}
          height={280}
          decoding="async"
        />
      )}
      <div className="bpr-profile-body">
        <div className="bpr-profile-person">
          {photo ? (
            <img
              className="bpr-avatar"
              src={photo}
              alt=""
              width={64}
              height={64}
              decoding="async"
            />
          ) : (
            <span
              className="bpr-avatar bpr-avatar-placeholder"
              aria-hidden="true"
            >
              <UserRoundIcon size={28} />
            </span>
          )}
          <div>
            <h3>
              <bdi>{name}</bdi>
            </h3>
            <p>{trade}</p>
          </div>
        </div>
        <p className="bpr-profile-location">
          <MapPinIcon size={14} aria-hidden="true" />
          <span>{city}</span>
        </p>
        {rating && (
          <p className="bpr-profile-rating">
            <StarIcon size={14} aria-hidden="true" />
            <strong>{rating}</strong>
            <span>{reviews}</span>
          </p>
        )}
        <div className="bpr-profile-footer">
          {rhythm && <span className="bpr-profile-rhythm">{rhythm}</span>}
          <p className="bpr-profile-price">
            <strong>{price}</strong>
            {unit && <span>{unit}</span>}
          </p>
        </div>
      </div>
    </article>
  );
}
