import { useSiteCurrency } from '../lib/siteCurrency';
import { useCallback, useState } from 'react';
import { ArrowDownIcon, ArrowRightIcon, CheckIcon } from 'lucide-react';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import BaitlyLoyaltySimulator, {
  type LoyaltySelection,
} from '../components/BaitlyLoyaltySimulator';
import BaitlyPricingPlans from '../components/BaitlyPricingPlans';
import BaitlyPricingDetails from '../components/BaitlyPricingDetails';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_LOYALTY_MESSAGES } from '../lib/messages/baitlyLoyalty';
import {
  DEFAULT_PRICING_MARKET,
  BAITLY_PRICING_MARKETS,
  type BaitlyMarket,
  type BaitlyPlan,
} from '../data/baitlyLoyaltyPricing';
import { acquisitionSearch } from '../../src/services/publicAcquisitionContext';

export default function PricingPage() {
  const { language } = useSiteLanguage();
  const m = BAITLY_LOYALTY_MESSAGES[language];
  // A public, ephemeral simulation; no account preference or billing change.
  const [storedSelection, setSelection] = useState<LoyaltySelection>(() => ({
    market: DEFAULT_PRICING_MARKET[language],
    plan: 'pro',
    properties: 1,
    month: 1,
  }));
  const currency = useSiteCurrency();
  const marketForCurrency = { MAD: 'MA', EUR: 'EU', SAR: 'SA' } as const;
  const selection = {
    ...storedSelection,
    market: currency.currency
      ? marketForCurrency[currency.currency]
      : storedSelection.market,
  };
  const onMonth = useCallback(
    (month: number) => setSelection((current) => ({ ...current, month })),
    [],
  );
  const onPlan = (plan: BaitlyPlan) => {
    currency.pause();
    setSelection((current) => ({ ...current, plan }));
  };
  const onMarket = (market: BaitlyMarket) => {
    currency.select(BAITLY_PRICING_MARKETS[market].currency);
    setSelection((current) => ({ ...current, market }));
  };
  const onProperties = (properties: number) => {
    currency.pause();
    setSelection((current) => ({ ...current, properties }));
  };
  return (
    <div className="bp-page">
      <section className="bp-hero site-shell">
        <div className="bp-hero-copy">
          <p className="bp-eyebrow">{m.eyebrow}</p>
          <h1>
            {m.title[0]}
            <br />
            <span>{m.title[1]}</span>
          </h1>
          <p className="bp-intro">{m.intro}</p>
          <div className="bp-hero-actions">
            <a href="#offres" className="baitly-button">
              {m.explore}
              <ArrowDownIcon />
            </a>
            <a href="#services" className="bp-text-link">
              {m.compare}
              <ArrowRightIcon />
            </a>
          </div>
          <ul className="bp-promises">
            {m.promises.map((promise) => (
              <li key={promise}>
                <CheckIcon aria-hidden="true" />
                {promise}
              </li>
            ))}
          </ul>
          <p className="bp-proposal">{m.proposal}</p>
        </div>
        <div>
          <BaitlyLoyaltySimulator
            selection={selection}
            onMonth={onMonth}
            onPlan={onPlan}
            onMarket={onMarket}
            onProperties={onProperties}
          />
          <p className="bp-fine-print bp-simulation-note">{m.simulationNote}</p>
        </div>
      </section>
      <BaitlyPricingPlans selection={selection} onPlan={onPlan} />
      <BaitlyPricingDetails />
      <section className="bp-final site-shell">
        <div>
          <h2>{m.finalTitle}</h2>
          <p>{m.finalCopy}</p>
        </div>
        <SiteAcquisitionLink
          to={`/demo${acquisitionSearch(selection, language)}`}
          className="baitly-button"
        >
          {m.finalCta}
          <ArrowRightIcon />
        </SiteAcquisitionLink>
      </section>
    </div>
  );
}
