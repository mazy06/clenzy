import { useSiteMoney } from './SiteMoney';
import { useSiteCurrency } from '../lib/siteCurrency';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PRICING_MESSAGES } from '../lib/messages/pricing';
import { BAITLY_LOYALTY_MESSAGES } from '../lib/messages/baitlyLoyalty';
import {
  BAITLY_LOYALTY_STAGES,
  loyaltyStage,
  loyaltyFirstYear,
  loyaltyQuote,
  BAITLY_PRICING_MARKETS,
  type BaitlyMarket,
  type BaitlyPlan,
} from '../data/baitlyLoyaltyPricing';
import BaitlyVolumeControl from './BaitlyVolumeControl';

export interface LoyaltySelection {
  market: BaitlyMarket;
  plan: BaitlyPlan;
  properties: number;
  month: number;
}
export interface LoyaltySimulatorProps {
  selection: LoyaltySelection;
  onMarket: (market: BaitlyMarket) => void;
  onPlan: (plan: BaitlyPlan) => void;
  onProperties: (count: number) => void;
  onMonth: (month: number) => void;
}

const percent = (discount: number) => (discount ? `−${discount} %` : '0 %');

/** Settings on one side, the bill they produce on the other: one screen, no scroll. */
export default function BaitlyLoyaltySimulator({
  selection,
  onMarket,
  onPlan,
  onProperties,
  onMonth,
}: LoyaltySimulatorProps) {
  const { language } = useSiteLanguage();
  const currency = useSiteCurrency();
  const m = BAITLY_LOYALTY_MESSAGES[language];
  const plans = PRICING_MESSAGES[language].plans;
  const { market, plan, properties, month } = selection;
  const stageIndex = loyaltyStage(month);
  const loyaltyDiscount = BAITLY_LOYALTY_STAGES[stageIndex].discount;
  const money = useSiteMoney(
    BAITLY_PRICING_MARKETS[market].currency,
    language,
    BAITLY_PRICING_MARKETS[market].currency,
  );
  const quote = loyaltyQuote(market, plan, month, properties);
  const year = loyaltyFirstYear(market, plan, properties);
  return (
    <section
      className="bp-simulator"
      onPointerDownCapture={currency.pause}
      onFocusCapture={currency.pause}
      aria-labelledby="bp-simulator-title"
    >
      <div className="bp-simulator-heading">
        <h2 id="bp-simulator-title">{m.simulator}</h2>
        <div className="bp-config">
          <div className="bp-plan-switch" role="group" aria-label={m.planLabel}>
            {(['essential', 'pro'] as const).map((id, i) => (
              <button
                key={id}
                type="button"
                aria-pressed={plan === id}
                onClick={() => onPlan(id)}
              >
                {plans[i].name}
              </button>
            ))}
          </div>
          <select
            aria-label={m.marketLabel}
            value={market}
            onChange={(event) => onMarket(event.target.value as BaitlyMarket)}
          >
            {Object.keys(BAITLY_PRICING_MARKETS).map((id) => (
              <option key={id} value={id}>
                {m.markets[id as BaitlyMarket]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="bp-sim-body">
        <div className="bp-sim-inputs">
          <BaitlyVolumeControl
            properties={properties}
            onChange={onProperties}
          />
          <div className="bp-seniority">
            <p className="bp-control-label" id="bp-seniority-label">
              {m.seniority}
            </p>
            <div
              className="bp-tier-row"
              role="group"
              aria-labelledby="bp-seniority-label"
            >
              {BAITLY_LOYALTY_STAGES.map((stage, i) => (
                <button
                  key={stage.start}
                  type="button"
                  aria-label={`${m.periods[i]} : ${percent(stage.discount)}`}
                  aria-pressed={stageIndex === i}
                  data-applied={i <= stageIndex}
                  onClick={() => onMonth(stage.start)}
                >
                  <span>{m.periods[i]}</span>
                  <strong>{percent(stage.discount)}</strong>
                </button>
              ))}
            </div>
            <p className="bp-control-hint">{m.stageCopy[stageIndex]}</p>
          </div>
        </div>
        <div className="bp-sim-result">
          <div
            className="bp-monthly"
            role="status"
            aria-live={currency.playing ? 'off' : 'polite'}
            aria-atomic="true"
          >
            <span>{m.monthly}</span>
            <strong
              key={`${market}-${quote.total}`}
              data-testid="loyalty-monthly"
            >
              {money(quote.total)}
            </strong>
            <p>
              {m.tax} · {properties} {m.propertyWords[properties === 1 ? 0 : 1]}{' '}
              · {m.periods[stageIndex]}
            </p>
          </div>
          <dl className="bp-calculation-lines">
            <div>
              <dt>{m.beforeDiscounts}</dt>
              <dd>{money(quote.baseTotal)}</dd>
            </div>
            <div className="bp-calculation-saving">
              <dt>{m.volumeSavings}</dt>
              <dd>
                {quote.volumeSavings > 0 && '−'}
                {money(quote.volumeSavings)}
              </dd>
            </div>
            <div className="bp-calculation-saving">
              <dt>
                {m.loyaltySavings} ({percent(loyaltyDiscount)})
              </dt>
              <dd>
                {quote.loyaltySavings > 0 && '−'}
                {money(quote.loyaltySavings)}
              </dd>
            </div>
            <div className="bp-calculation-total">
              <dt>{m.averageUnit}</dt>
              <dd>{money(quote.average)}</dd>
            </div>
          </dl>
          <dl className="bp-year-summary">
            <div>
              <dt>{m.firstYear}</dt>
              <dd data-testid="loyalty-year">{money(year.total)}</dd>
            </div>
            <div>
              <dt>{m.savings}</dt>
              <dd>{money(year.savings)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
