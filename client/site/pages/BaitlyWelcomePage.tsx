import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BookOpenIcon,
  MapPinIcon,
  ShoppingBagIcon,
} from '../../src/icons/glyphs';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import ScrollGuideSection from '../components/ScrollGuideSection';
import { BAITLY_JOURNEY_MESSAGES } from '../lib/messages/baitlyJourneys';
import { useSiteLanguage } from '../lib/siteLanguage';
import { SITE_PHOTOS, sitePhotoAlt } from '../data/baitlyPhotography';

const { guideCatalog: food } = SITE_PHOTOS;

const JOURNEY_ICONS = [MapPinIcon, BookOpenIcon, ShoppingBagIcon];

export default function BaitlyWelcomePage() {
  const { language } = useSiteLanguage();
  const m = BAITLY_JOURNEY_MESSAGES[language].welcome;
  return (
    <div className="bjy-page bwj-page">
      <header className="bwj-introduction site-shell">
        <div>
          <p className="bjy-eyebrow">{m.eyebrow}</p>
          <h1>{m.title}</h1>
        </div>
        <div>
          <p className="bjy-lead">{m.intro}</p>
          <div className="bjy-actions">
            <a className="baitly-button" href="#livret-demo">
              {m.demo}
              <ArrowRightIcon size={18} aria-hidden="true" />
            </a>
            <Link className="baitly-text-link" to={`/tarifs?lang=${language}`}>
              {m.pricing}
            </Link>
          </div>
        </div>
      </header>
      <ScrollGuideSection />
      <section
        className="bwj-journey site-shell"
        aria-labelledby="welcome-journey-title"
      >
        <h2 id="welcome-journey-title">{m.journeyTitle}</h2>
        <ol>
          {m.journey.map((item, i) => {
            const Icon = JOURNEY_ICONS[i];
            return (
              <li key={item.title}>
                <Icon size={24} aria-hidden="true" />
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="bwj-catalog site-shell" id="livret-services">
        <div className="bwj-catalog-photo">
          <img
            src={food}
            alt={sitePhotoAlt('guideCatalog', language)}
            width={650}
            height={480}
            loading="lazy"
          />
          <span>{m.catalogCaption}</span>
        </div>
        <div>
          <h2>{m.catalogTitle}</h2>
          <p className="bjy-lead">{m.catalogCopy}</p>
          <Link
            className="baitly-text-link"
            to={`/produit/booking-engine?lang=${language}#booking-upsells`}
          >
            {m.bookingLink}
            <ArrowRightIcon size={18} aria-hidden="true" />
          </Link>
          <p className="bwj-example-note">{m.catalogNote}</p>
        </div>
      </section>
      <section className="site-shell bwj-faq">
        <h2>{m.faqTitle}</h2>
        <div>
          {m.faq.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="site-shell bjy-closing">
        <div>
          <h2>{m.closing}</h2>
          <p>{m.closingCopy}</p>
        </div>
        <SiteAcquisitionLink
          className="baitly-button"
          to={`/demo?lang=${language}`}
        >
          {m.contact}
          <ArrowRightIcon size={18} aria-hidden="true" />
        </SiteAcquisitionLink>
      </section>
    </div>
  );
}
