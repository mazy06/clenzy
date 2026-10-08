import { CheckIcon, ArrowUpRightIcon, PlusIcon } from '../../src/icons/glyphs';
import { Link } from 'react-router-dom';
import { BaitlyOptionVisual } from './BaitlyPricingVisual';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PRICING_MESSAGES } from '../lib/messages/pricing';
import { BAITLY_LOYALTY_MESSAGES } from '../lib/messages/baitlyLoyalty';

const ADDON_LINKS = [
  '/produit/objets-connectes',
  '/produit/booking-engine',
  '/produit/agents-ia',
  '/produit/revenue-market-data',
];

export default function BaitlyPricingDetails() {
  const { language } = useSiteLanguage();
  const m = BAITLY_LOYALTY_MESSAGES[language];
  const legacy = PRICING_MESSAGES[language];
  return (
    <>
      <section
        id="services"
        className="bp-comparison site-shell"
        aria-labelledby="bp-comparison-title"
      >
        <div className="bp-section-heading">
          <h2 id="bp-comparison-title">{m.comparisonTitle}</h2>
          <p>{m.comparisonCopy}</p>
        </div>
        <details className="bp-comparison-disclosure">
          <summary>
            <span>{m.comparisonToggle}</span>
            <PlusIcon aria-hidden="true" />
          </summary>
          <div
            className="bp-table-scroll"
            role="region"
            aria-label={m.comparisonTitle}
            tabIndex={0}
          >
            <table>
              <caption className="sr-only">{m.comparisonTitle}</caption>
              <thead>
                <tr>
                  <th scope="col">{m.service}</th>
                  <th scope="col">{legacy.plans[0].name}</th>
                  <th scope="col">{legacy.plans[1].name}</th>
                </tr>
              </thead>
              {m.groups.map((group) => (
                <tbody key={group.title}>
                  <tr className="bp-group-row">
                    <th scope="rowgroup" colSpan={3}>
                      {group.title}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">
                        <span>{row.label}</span>
                        <small>{row.detail}</small>
                      </th>
                      {[row.essential, row.pro].map((included, i) => (
                        <td key={i}>
                          {included ? (
                            <span className="bp-included">
                              <CheckIcon aria-hidden="true" />
                              <span>{m.included}</span>
                            </span>
                          ) : (
                            <span className="bp-not-included">
                              {m.excluded}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </details>
      </section>
      <section className="bp-options">
        <div className="site-shell bp-options-layout">
          <div>
            <div className="bp-section-heading">
              <h2>{m.optionsTitle}</h2>
              <p>{m.optionsCopy}</p>
            </div>
            <p className="bp-fine-print">{m.thirdParty}</p>
          </div>
          <div className="bp-options-list">
            {legacy.addons.map((addon, i) => (
              <article key={addon.name}>
                <BaitlyOptionVisual index={i} />
                <div>
                  <Link
                    className="bp-text-link"
                    to={`${ADDON_LINKS[i]}?lang=${language}`}
                  >
                    <h3>{addon.name}</h3>
                    <ArrowUpRightIcon />
                  </Link>
                  <p>{addon.copy}</p>
                  <span className="bp-option-fee">{m.optional}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="bp-rules site-shell">
        <h2>{m.rulesTitle}</h2>
        <div>
          {m.rules.map((rule) => (
            <details key={rule.q}>
              <summary>
                <h3>{rule.q}</h3>
                <PlusIcon aria-hidden="true" />
              </summary>
              <p>{rule.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
