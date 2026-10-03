import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import IntegrationLogo, {
  type IntegrationBrand,
} from "../integrations/IntegrationLogo";

// Official partnership pages, not fake OAuth endpoints. Enable a connector only after its contract and API are ready.
const providers: Record<
  string,
  { name: string; url: string; description: IntegrationBrand }[]
> = {
  SA: [
    {
      name: "Tap Marketplace",
      url: "https://www.tap.company/en-sa/products/marketplaces",
      description: "tap",
    },
  ],
  MA: [
    {
      name: "Aslan Marketplace",
      url: "https://aslan.ma/fr/marketplace",
      description: "aslan",
    },
    {
      name: "Chari Money",
      url: "https://www.baas.ma/en/partners",
      description: "chari",
    },
  ],
};
export default function RegionalPaymentProviders({
  country,
}: {
  country: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="setup-payment-regional">
      <h3>{t("onboarding.payment.regionalTitle")}</h3>
      <p>{t("onboarding.payment.regionalHint")}</p>
      <ul>
        {(providers[country] ?? []).map((provider) => (
          <li key={provider.name}>
            <IntegrationLogo provider={provider.description} />
            <div>
              <strong>{provider.name}</strong>
              <p>{t(`onboarding.payment.${provider.description}`)}</p>
            </div>
            <a href={provider.url} target="_blank" rel="noopener noreferrer">
              {t("onboarding.payment.officialSite")}
              <ArrowUpRight size={16} />
            </a>
          </li>
        ))}
      </ul>
      <small>{t("onboarding.payment.regionalPending")}</small>
    </div>
  );
}
