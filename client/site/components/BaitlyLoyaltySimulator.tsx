import { useSiteMoney } from './SiteMoney';
import { useSiteCurrency } from '../lib/siteCurrency';
import type { CSSProperties } from 'react';
import {
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  ArrowDownRightIcon,
  PlusIcon,
} from '../../src/icons/glyphs';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PRICING_MESSAGES } from '../lib/messages/pricing';
import { BAITLY_LOYALTY_MESSAGES } from '../lib/messages/baitlyLoyalty';
import {
  BAITLY_LOYALTY_STAGES,
  loyaltyStage,
  loyaltyUnitPrice,
  loyaltyFirstYear,
  loyaltyQuote,
  BAITLY_PRICING_MARKETS,
  type BaitlyMarket,
  type BaitlyPlan,
} from '../data/baitlyLoyaltyPricing';
import { useBaitlyLoyaltyMotion } from './useBaitlyLoyaltyMotion';
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
  const motion = useBaitlyLoyaltyMotion(month, onMonth);
  const money = useSiteMoney(
    BAITLY_PRICING_MARKETS[market].currency,
    language,
    BAITLY_PRICING_MARKETS[market].currency,
  );
  const quote = loyaltyQuote(market, plan, month, properties);
  const total = quote.total;
  const year = loyaltyFirstYear(market, plan, properties);
  return (
    <section
      ref={motion.ref}
      className="bp-simulator"
      onPointerDownCapture={currency.pause}
      onFocusCapture={currency.pause}
      aria-labelledby="bp-simulator-title"
    >
      <div className="bp-simulator-heading">
        <h2 id="bp-simulator-title">{m.simulator}</h2>
        <ArrowDownRightIcon aria-hidden="true" />
      </div>
      <div className="bp-config">
        <fieldset>
          <legend>{m.planLabel}</legend>
          <div className="bp-plan-switch">
            {(['essential', 'pro'] as const).map((id, i) => (
              <button
                key={id}
                type="button"
                aria-pressed={plan === id}
                onClick={() => {
                  motion.selectMonth(month);
                  onPlan(id);
                }}
              >
                {plans[i].name}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          {m.marketLabel}
          <select
            value={market}
            onChange={(event) => {
              motion.selectMonth(month);
              onMarket(event.target.value as BaitlyMarket);
            }}
          >
            {Object.keys(BAITLY_PRICING_MARKETS).map((id) => (
              <option key={id} value={id}>
                {m.markets[id as BaitlyMarket]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <BaitlyVolumeControl
        properties={properties}
        onChange={(count) => {
          motion.selectMonth(month);
          onProperties(count);
        }}
      />
      <div className="bp-stages" role="group" aria-label={m.phase}>
        {BAITLY_LOYALTY_STAGES.map((stage, i) => (
          <button
            className="bp-stage"
            type="button"
            key={stage.start}
            aria-pressed={stageIndex === i}
            onClick={() => motion.selectMonth(stage.start)}
            style={
              {
                '--bp-tier': (100 - stage.discount) / 100,
                '--bp-delay': `${i * 100}ms`,
              } as CSSProperties
            }
          >
            <span className="bp-stage-top">
              {stage.discount ? `−${stage.discount} %` : m.base}
            </span>
            <span className="bp-stage-track">
              <span className="bp-stage-fill" />
              <strong>
                {money(loyaltyUnitPrice(market, plan, stage.start, properties))}
              </strong>
            </span>
            <span className="bp-stage-label">{m.milestones[i]}</span>
          </button>
        ))}
      </div>
      <p className="bp-chart-caption">{m.averageUnit}</p>
      <div className="bp-timeline-control">
        <label htmlFor="bp-month">
          {m.month} <strong>{month}</strong>
        </label>
        <input
          id="bp-month"
          type="range"
          min="1"
          max="18"
          value={month}
          onChange={(event) => motion.selectMonth(Number(event.target.value))}
          aria-valuetext={`${m.month} ${month}, ${m.periods[stageIndex]}`}
        />
        {!motion.reduced && (
          <button
            type="button"
            className="bp-motion-toggle"
            onClick={motion.toggle}
            aria-label={
              motion.playing ? m.pause : stageIndex === 3 ? m.replay : m.play
            }
          >
            {motion.playing ? (
              <PauseIcon />
            ) : stageIndex === 3 ? (
              <RotateCcwIcon />
            ) : (
              <PlayIcon />
            )}
          </button>
        )}
      </div>
      <div
        className="bp-monthly"
        role="status"
        aria-live={currency.playing ? 'off' : 'polite'}
        aria-atomic="true"
      >
        <div>
          <span>{m.monthly}</span>
          <p>
            {m.periods[stageIndex]} · {properties}{' '}
            {m.propertyWords[properties === 1 ? 0 : 1]}
          </p>
        </div>
        <div>
          <strong key={`${market}-${total}`} data-testid="loyalty-monthly">
            {money(total)}
          </strong>
          <span>{m.tax}</span>
        </div>
      </div>
      <details className="bp-calculation">
        <summary>
          {m.calculation}
          <PlusIcon aria-hidden="true" />
        </summary>
        <p className="bp-fine-print">{m.volumeHint}</p>
        <dl className="bp-calculation-lines">
          <div>
            <dt>{m.beforeDiscounts}</dt>
            <dd>{money(quote.baseTotal)}</dd>
          </div>
          <div className="bp-calculation-saving">
            <dt>{m.volumeSavings}</dt>
            <dd>−{money(quote.volumeSavings)}</dd>
          </div>
          <div>
            <dt>{m.volumeSubtotal}</dt>
            <dd>{money(quote.volumeTotal)}</dd>
          </div>
          <div className="bp-calculation-saving">
            <dt>
              {m.loyaltySavings} (−{BAITLY_LOYALTY_STAGES[stageIndex].discount}{' '}
              %)
            </dt>
            <dd>−{money(quote.loyaltySavings)}</dd>
          </div>
          <div className="bp-calculation-total">
            <dt>{m.monthly}</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>
        <p className="bp-volume-label">{m.volumeTitle}</p>
        <dl className="bp-calculation-lines bp-band-details">
          {quote.bands
            .filter((band) => band.count > 0)
            .map((band) => (
              <div key={band.start}>
                <dt>
                  {band.count} × {money(band.unitCents / 100)}{' '}
                  <span>(−{band.discount} %)</span>
                </dt>
                <dd>{money(band.totalCents / 100)}</dd>
              </div>
            ))}
        </dl>
      </details>
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
      <p className="bp-fine-print">{m.savingsNote}</p>
    </section>
  );
}
