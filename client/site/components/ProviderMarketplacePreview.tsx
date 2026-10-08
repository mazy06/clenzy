import { PROVIDER_MARKETPLACE_MESSAGES } from "../lib/providerMarketplaceMessages";
import type { SiteLanguage } from "../lib/siteLanguage";
import ProviderProfileCard from "./ProviderProfileCard";
import SiteMoney from "./SiteMoney";
import leila from "../assets/providers/cleaning.webp";
import thomas from "../assets/providers/maintenance.webp";
import sarah from "../assets/providers/chef.webp";

export default function ProviderMarketplacePreview({
  language,
}: {
  language: SiteLanguage;
}) {
  const m = PROVIDER_MARKETPLACE_MESSAGES[language];
  const number = new Intl.NumberFormat(
    language === "ar" ? "ar-SA-u-nu-arab" : language,
  );
  const photos = [leila, thomas, sarah];
  const prices = [280, 38, 190];
  const currencies = ["MAD", "EUR", "SAR"] as const;
  const units = [m.perVisit, m.perHour, m.perPerson];
  return (
    <figure className="bpr-market-preview">
      <div className="bpr-market-heading">
        <span>{m.previewEyebrow}</span>
        <h2>{m.previewTitle}</h2>
      </div>
      <div className="bpr-market-profiles">
        {m.profiles.map((profile, index) => (
          <ProviderProfileCard
            key={profile.name}
            {...profile}
            photo={photos[index]}
            cover={index === 0 ? leila : undefined}
            compact={index > 0}
            rating={number.format([4.9, 4.8, 4.9][index])}
            reviews={`${number.format([32, 18, 24][index])} ${m.reviews}`}
            price={
              <>
                {m.from}{" "}
                <SiteMoney value={prices[index]} from={currencies[index]} />
              </>
            }
            unit={units[index]}
          />
        ))}
      </div>
      <figcaption>{m.example}</figcaption>
    </figure>
  );
}
