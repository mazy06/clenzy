import {
  CalendarDaysIcon,
  CheckIcon,
  CoffeeIcon,
  LockKeyholeIcon,
  MapPinIcon,
  MessageCircleIcon,
} from 'lucide-react';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_LOYALTY_MESSAGES } from '../lib/messages/baitlyLoyalty';
import type { BaitlyPlan } from '../data/baitlyLoyaltyPricing';
import { SITE_PHOTOS } from '../data/baitlyPhotography';

const {
  pricingEssential: guesthouse,
  pricingPro: pool,
  pricingRoom: bedroom,
} = SITE_PHOTOS;

/** Lightweight illustrations: no application runtime or simulated live data. */
export default function BaitlyPricingVisual({ plan }: { plan: BaitlyPlan }) {
  const { language } = useSiteLanguage();
  const m = BAITLY_LOYALTY_MESSAGES[language].visuals;
  return (
    <figure className={`bp-visual bp-visual-${plan}`}>
      <div className="bp-visual-scene" aria-hidden="true">
        <img
          className="bp-visual-photo"
          src={plan === 'essential' ? guesthouse : pool}
          width="1400"
          height="933"
          alt=""
          loading="lazy"
        />
        <span className="bp-visual-example">{m.example}</span>
        <div className="bp-visual-window">
          <div className="bp-visual-toolbar">
            <span>
              <i />
              <i />
              <i />
            </span>
            <span>baitly</span>
          </div>
          {plan === 'essential' ? (
            <div className="bp-mini-booking">
              <span className="bp-mini-title">{m.booking}</span>
              <div className="bp-mini-dates">
                <CalendarDaysIcon />
                <span dir="ltr">
                  12 <span>→</span> 15
                </span>
                <CheckIcon />
              </div>
              <div className="bp-mini-extra">
                <CoffeeIcon />
                <span>{m.breakfast}</span>
                <CheckIcon />
              </div>
              <span className="bp-mini-confirm">
                <CheckIcon />
                {m.confirmed}
              </span>
            </div>
          ) : (
            <div className="bp-mini-planning">
              <span className="bp-mini-title">{m.planning}</span>
              <div className="bp-mini-calendar">
                {[guesthouse, bedroom, pool].map((photo, i) => (
                  <div className="bp-mini-stay" key={photo}>
                    <img
                      src={photo}
                      width="40"
                      height="32"
                      alt=""
                      loading="lazy"
                    />
                    <span className={`bp-mini-track bp-mini-track-${i}`}>
                      <i />
                    </span>
                  </div>
                ))}
              </div>
              <span className="bp-mini-confirm">
                <CheckIcon />
                {m.approved}
              </span>
            </div>
          )}
        </div>
      </div>
      <figcaption>{m.captions[plan === 'essential' ? 0 : 1]}</figcaption>
    </figure>
  );
}

export function BaitlyOptionVisual({ index }: { index: number }) {
  return (
    <div
      className={`bp-option-visual bp-option-visual-${index}`}
      aria-hidden="true"
    >
      {index === 0 && (
        <div className="bp-mini-lock">
          <LockKeyholeIcon />
          <span>
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        </div>
      )}
      {index === 1 && (
        <div className="bp-mini-site">
          <span>
            <i />
            <i />
            <i />
          </span>
          <img
            src={SITE_PHOTOS.pricingSite}
            width="100"
            height="70"
            alt=""
            loading="lazy"
          />
          <i />
        </div>
      )}
      {index === 2 && (
        <div className="bp-mini-chat">
          <span>
            <MessageCircleIcon />
            <i />
          </span>
          <span>
            <i />
            <CheckIcon />
          </span>
        </div>
      )}
      {index === 3 && (
        <div className="bp-mini-map">
          <i />
          <i />
          <MapPinIcon />
          <MapPinIcon />
          <MapPinIcon />
        </div>
      )}
    </div>
  );
}
