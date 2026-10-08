import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  CameraIcon,
  ClipboardListIcon,
  CircleCheckIcon,
  CalendarDaysIcon,
  Clock3Icon,
  CheckIcon,
} from "lucide-react";
import AnimatedOpsMockup from "../components/AnimatedOpsMockup";
import { useSiteLanguage } from "../lib/siteLanguage";
import { PROVIDERS_MESSAGES } from "../lib/messages/providers";
import { PROVIDER_MARKETPLACE_MESSAGES } from "../lib/providerMarketplaceMessages";
import ProviderMarketplacePreview from "../components/ProviderMarketplacePreview";
import cleaningArtwork from "../assets/providers/trades/cleaning.webp";
import maintenanceArtwork from "../assets/providers/trades/maintenance.webp";
import laundryArtwork from "../assets/providers/trades/laundry.webp";
import gardenArtwork from "../assets/providers/trades/garden.webp";
import welcomeArtwork from "../assets/providers/trades/welcome.webp";
import chefArtwork from "../assets/providers/trades/chef.webp";
import "../provider-marketplace.css";

const TRADE_ARTWORK = [
  cleaningArtwork,
  maintenanceArtwork,
  laundryArtwork,
  gardenArtwork,
  welcomeArtwork,
  chefArtwork,
];
const MISSION_ICONS = [ClipboardListIcon, CameraIcon, CircleCheckIcon];

export default function ProvidersPage() {
  const { language } = useSiteLanguage();
  const m = PROVIDERS_MESSAGES[language];
  const marketplace = PROVIDER_MARKETPLACE_MESSAGES[language];
  return (
    <div className="baitly-provider-page">
      <section className="baitly-provider-hero site-shell">
        <div>
          <p className="baitly-readiness-eyebrow">{m.eyebrow}</p>
          <h1>
            {m.titleBefore}
            <span>{m.titleAccent}</span>
          </h1>
          <p className="baitly-readiness-lead">{m.intro}</p>
          <ul className="bpr-benefits">
            {marketplace.benefits.map((benefit) => (
              <li key={benefit}>
                <CheckIcon size={16} aria-hidden="true" />
                {benefit}
              </li>
            ))}
          </ul>
          <div className="baitly-readiness-actions">
            <Link
              className="baitly-button"
              to={`/prestataires/inscription?lang=${language}`}
            >
              {m.ctaJoin}
              <ArrowRightIcon size={18} aria-hidden="true" />
            </Link>
            <a className="baitly-text-link" href="#prestataires-metiers">
              {m.ctaExplore}
              <ArrowRightIcon size={17} aria-hidden="true" />
            </a>
          </div>
          <p className="baitly-readiness-note">{m.openingNote}</p>
        </div>
        <ProviderMarketplacePreview language={language} />
      </section>
      <section className="site-shell bpr-opportunities">
        <div className="bpr-opportunities-intro">
          <p className="baitly-readiness-eyebrow">
            {marketplace.opportunityEyebrow}
          </p>
          <h2>{marketplace.opportunityTitle}</h2>
          <p>{marketplace.opportunityIntro}</p>
        </div>
        <div className="bpr-opportunity-list">
          {[
            {
              Icon: CalendarDaysIcon,
              title: marketplace.regularTitle,
              copy: marketplace.regularCopy,
              tag: marketplace.regularTag,
            },
            {
              Icon: Clock3Icon,
              title: marketplace.occasionalTitle,
              copy: marketplace.occasionalCopy,
              tag: marketplace.occasionalTag,
            },
          ].map(({ Icon, title, copy, tag }) => (
            <article key={title}>
              <Icon size={24} aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
                <span>{tag}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="site-shell py-16" id="prestataires-metiers">
        <div className="baitly-proof-heading">
          <h2>{m.categoriesTitle}</h2>
          <p>{m.categoriesCopy}</p>
        </div>
        <div className="bpr-trade-directory">
          {m.categories.map((category, index) => {
            return (
              <article key={category.name}>
                <img
                  className="bpr-trade-artwork"
                  src={TRADE_ARTWORK[index]}
                  alt=""
                  width={384}
                  height={384}
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <h3>{category.name}</h3>
                  <p>{category.copy}</p>
                  <Link
                    className="bpr-category-link"
                    to={`/prestataires/inscription?lang=${language}`}
                  >
                    {marketplace.offerService}
                    <ArrowRightIcon size={16} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="baitly-provider-process" id="prestataires-parcours">
        <div className="site-shell">
          <p className="baitly-readiness-eyebrow">{m.howBadge}</p>
          <h2>{m.howTitle}</h2>
          <ol>
            {m.steps.map((step, index) => (
              <li key={step.title}>
                <span className="baitly-provider-step-number">
                  {new Intl.NumberFormat(
                    language === "ar" ? "ar-SA-u-nu-arab" : language,
                    { minimumIntegerDigits: 2 },
                  ).format(index + 1)}
                </span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="bpr-operations-section site-shell" id="prestataires-operations">
        <div className="bpr-operations-header">
          <div>
            <p className="baitly-readiness-eyebrow">{m.appEyebrow}</p>
            <h2>{m.appTitle}</h2>
          </div>
          <div>
            <p className="baitly-readiness-lead">{m.appCopy}</p>
            <Link className="baitly-text-link" to={`/produit/operations-menage?lang=${language}`}>
              {m.appAction}<ArrowRightIcon size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="bpr-operations-preview">
          <AnimatedOpsMockup />
        </div>
        <ul className="bpr-operations-benefits">
          {m.appPoints.map((point, index) => {
            const Icon = MISSION_ICONS[index];
            return <li key={point}><Icon size={19} aria-hidden="true" />{point}</li>;
          })}
        </ul>
        <p className="baitly-readiness-note">{m.sampleNotice}</p>
      </section>
      <section className="site-shell baitly-provider-closing">
        <div className="baitly-compare-next">
          <h2>{m.finalTitle}</h2>
          <p>{m.finalCopy}</p>
          <div className="baitly-readiness-actions">
            <Link
              className="baitly-button"
              to={`/prestataires/inscription?lang=${language}`}
            >
              {m.ctaJoin}
              <ArrowRightIcon size={18} aria-hidden="true" />
            </Link>
            <a className="baitly-text-link" href="#prestataires-parcours">
              {m.finalQuestion}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
