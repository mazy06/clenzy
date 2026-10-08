import { useSiteMoney } from './SiteMoney';
import { ArrowRightIcon, CheckIcon } from '../../src/icons/glyphs';
import SiteAcquisitionLink from './SiteAcquisitionLink';
import { acquisitionSearch } from '../../src/services/publicAcquisitionContext';
import BaitlyPricingVisual from './BaitlyPricingVisual';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PRICING_MESSAGES } from '../lib/messages/pricing';
import { BAITLY_LOYALTY_MESSAGES } from '../lib/messages/baitlyLoyalty';
import {
  loyaltyStage,
  loyaltyUnitPrice,
  loyaltyQuote,
  BAITLY_PRICING_MARKETS,
  type BaitlyPlan,
} from '../data/baitlyLoyaltyPricing';
import type { LoyaltySelection } from './BaitlyLoyaltySimulator';

export default function BaitlyPricingPlans({
  selection,
  onPlan,
}: {
  selection: LoyaltySelection;
  onPlan: (plan: BaitlyPlan) => void;
}) {
  const { language } = useSiteLanguage();
  const m = BAITLY_LOYALTY_MESSAGES[language];
  const plans = PRICING_MESSAGES[language].plans;
  const money = useSiteMoney(
    BAITLY_PRICING_MARKETS[selection.market].currency,
    language,
    BAITLY_PRICING_MARKETS[selection.market].currency,
  );
  return (
    <section
      id="offres"
      className="bp-plans site-shell"
      aria-labelledby="bp-plans-title"
    >
      <div className="bp-section-heading">
        <h2 id="bp-plans-title">{m.plansTitle}</h2>
        <p>{m.plansCopy}</p>
      </div>
      <div className="bp-needs" role="group" aria-label={m.needs}>
        {(['essential', 'pro'] as const).map((id, i) => (
          <button
            key={id}
            type="button"
            aria-pressed={selection.plan === id}
            onClick={() => onPlan(id)}
          >
            {i === 0 ? m.direct : m.automate}
            <ArrowRightIcon aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="bp-plan-pair">
        {(['essential', 'pro'] as const).map((id, i) => (
          <article
            key={id}
            className={`bp-plan bp-plan-${id}`}
            data-selected={selection.plan === id}
          >
            <BaitlyPricingVisual plan={id} />
            <div className="bp-plan-heading">
              <h3>{plans[i].name}</h3>
              {selection.plan === id && (
                <span>
                  <CheckIcon />
                  {m.selected}
                </span>
              )}
            </div>
            <p className="bp-plan-description">{m.planDescriptions[i]}</p>
            <div className="bp-plan-rate">
              <span>{m.periods[loyaltyStage(selection.month)]}</span>
              <p>
                <strong
                  key={`${selection.market}-${
                    selection.properties
                  }-${loyaltyStage(selection.month)}`}
                  data-testid={`plan-${id}-unit`}
                >
                  {money(
                    loyaltyUnitPrice(
                      selection.market,
                      id,
                      selection.month,
                      selection.properties,
                    ),
                  )}
                </strong>
                <span>{m.averageUnit}</span>
              </p>
              <div className="bp-plan-total">
                <span>
                  {m.totalFor} {selection.properties}{' '}
                  {m.propertyWords[selection.properties === 1 ? 0 : 1]}
                </span>
                <b data-testid={`plan-${id}-total`}>
                  {money(
                    loyaltyQuote(
                      selection.market,
                      id,
                      selection.month,
                      selection.properties,
                    ).total,
                  )}{' '}
                  <small>{m.tax}</small>
                </b>
              </div>
            </div>
            <div className="bp-plan-endpoints">
              <span>
                {m.initial}
                <b>
                  {money(
                    loyaltyUnitPrice(
                      selection.market,
                      id,
                      1,
                      selection.properties,
                    ),
                  )}
                </b>
              </span>
              <ArrowRightIcon aria-hidden="true" />
              <span>
                {m.later}
                <b>
                  {money(
                    loyaltyUnitPrice(
                      selection.market,
                      id,
                      13,
                      selection.properties,
                    ),
                  )}
                </b>
              </span>
            </div>
            <ul>
              {m.planHighlights[i].map((feature) => (
                <li key={feature}>
                  <CheckIcon aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <SiteAcquisitionLink
              to={`/demo${acquisitionSearch({ ...selection, plan: id }, language)}`}
              className={`baitly-button ${
                id === 'essential' ? 'bp-button-secondary' : ''
              }`}
            >
              {m.planCtas[i]}
              <ArrowRightIcon />
            </SiteAcquisitionLink>
          </article>
        ))}
      </div>
      <div className="bp-custom">
        <div>
          <h3>{m.customTitle}</h3>
          <p>{m.customCopy}</p>
          <ul>
            {plans[2].features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
        <SiteAcquisitionLink
          to={`/demo${acquisitionSearch({ market: selection.market, plan: 'custom' }, language)}`}
          className="bp-text-link"
        >
          {m.customCta}
          <ArrowRightIcon />
        </SiteAcquisitionLink>
      </div>
    </section>
  );
}
