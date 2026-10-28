import { BAITLY_VOLUME_TIERS } from '../data/baitlyLoyaltyPricing';
import { BAITLY_LOYALTY_MESSAGES } from '../lib/messages/baitlyLoyalty';
import { useSiteLanguage } from '../lib/siteLanguage';

export default function BaitlyVolumeControl({
  properties,
  onChange,
}: {
  properties: number;
  onChange: (count: number) => void;
}) {
  const { language } = useSiteLanguage();
  const m = BAITLY_LOYALTY_MESSAGES[language];
  return (
    <div className="bp-volume-control">
      <label className="bp-control-label" htmlFor="bp-properties">
        {m.properties}
        <output htmlFor="bp-properties" aria-hidden="true">
          {properties}
        </output>
      </label>
      <input
        id="bp-properties"
        type="range"
        min="1"
        max="49"
        value={properties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="bp-tier-row" role="group" aria-label={m.volumeTitle}>
        {BAITLY_VOLUME_TIERS.map((tier) => (
          <button
            key={tier.start}
            type="button"
            aria-label={`${tier.start}–${tier.end} ${m.propertyWords[1]} : ${
              tier.discount ? '−' : ''
            }${tier.discount} %`}
            aria-pressed={properties >= tier.start && properties <= tier.end}
            data-applied={properties >= tier.start}
            onClick={() => onChange(tier.start)}
          >
            <span dir="ltr">
              {tier.start}–{tier.end}
            </span>
            <strong>{tier.discount ? `−${tier.discount} %` : '0 %'}</strong>
          </button>
        ))}
      </div>
      <p className="bp-control-hint">{m.volumeHint}</p>
    </div>
  );
}
