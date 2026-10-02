import type { AcquisitionContext } from '../../src/services/publicAcquisitionContext';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_CONTACT_MESSAGES } from '../lib/messages/baitlyContact';
import { BAITLY_LOYALTY_MESSAGES } from '../lib/messages/baitlyLoyalty';
import { PRICING_MESSAGES } from '../lib/messages/pricing';

export default function AcquisitionSummary({
  context,
}: {
  context: AcquisitionContext;
}) {
  const { language } = useSiteLanguage();
  const m = BAITLY_CONTACT_MESSAGES[language];
  const pricing = BAITLY_LOYALTY_MESSAGES[language];
  if (!context.plan && !context.market && !context.properties) return null;
  return (
    <div className="sac-summary">
      <strong>{m.selection}</strong>
      <ul>
        {context.plan && (
          <li>
            {
              PRICING_MESSAGES[language].plans[
                { essential: 0, pro: 1, custom: 2 }[context.plan]
              ].name
            }
          </li>
        )}
        {context.market && <li>{pricing.markets[context.market]}</li>}
        {context.properties && (
          <li>
            {new Intl.NumberFormat(language).format(context.properties)}{' '}
            {pricing.propertyWords[context.properties === 1 ? 0 : 1]}
          </li>
        )}
      </ul>
      <p>{m.selectionNote}</p>
    </div>
  );
}
