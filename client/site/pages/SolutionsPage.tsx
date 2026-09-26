import { SiteCurrencySymbol } from '../components/SiteMoney';
import type { SiteCurrency } from '../lib/siteCurrency';
import { sitePhotoAlt } from '../data/baitlyPhotography';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import BaitlySolutionNavPreview from '../components/BaitlySolutionNavPreview';
import {
  BAITLY_ACTIVITY_JOURNEYS,
  BAITLY_COUNTRY_JOURNEYS,
} from '../data/baitlyJourneys';
import { BAITLY_JOURNEY_MESSAGES } from '../lib/messages/baitlyJourneys';
import { moduleText } from '../lib/messages/modules';
import { useSiteLanguage } from '../lib/siteLanguage';
import '../baitly-journeys.css';

export default function SolutionsPage() {
  const { language } = useSiteLanguage();
  const { hash } = useLocation();
  const m = BAITLY_JOURNEY_MESSAGES[language].solutions;
  const index = Math.max(
    0,
    BAITLY_ACTIVITY_JOURNEYS.findIndex((item) => `#${item.id}` === hash),
  );
  const journey = BAITLY_ACTIVITY_JOURNEYS[index];
  const story = m.stories[index];
  return (
    <div className="bjy-page">
      <section className="site-shell bjy-solutions-hero">
        <div>
          <p className="bjy-eyebrow">{m.eyebrow}</p>
          <h1>{m.title}</h1>
        </div>
        <p className="bjy-lead">{m.intro}</p>
      </section>
      <section
        className="site-shell bjy-activity-section"
        aria-label={m.choose}
      >
        <nav className="bjy-activity-nav" aria-label={m.choose}>
          {BAITLY_ACTIVITY_JOURNEYS.map((item, i) => (
            <Link
              key={item.id}
              id={item.id}
              to={`?lang=${language}#${item.id}`}
              aria-current={i === index ? 'true' : undefined}
            >
              <span>{m.stories[i].name}</span>
              <ArrowRightIcon size={18} aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <div className="bjy-activity" key={journey.id}>
          <div className="bjy-activity-copy">
            <span className="bjy-kicker">{m.scenario}</span>
            <h2>{story.title}</h2>
            <p className="bjy-lead">{story.copy}</p>
            <ol>
              {story.steps.map((step, i) => (
                <li key={step.title}>
                  <span aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <figure className="bjy-activity-visual">
            <img
              src={journey.photo}
              alt={sitePhotoAlt(journey.photoKey, language)}
              width={720}
              height={600}
            />
            <div className="bjy-activity-preview" aria-hidden="true">
              <BaitlySolutionNavPreview
                kind={journey.kind}
                language={language}
              />
            </div>
            <figcaption>{m.demo}</figcaption>
          </figure>
          <div className="bjy-module-strip">
            <p>{m.modules}</p>
            <div>
              {journey.modules.map((slug) => (
                <Link key={slug} to={`/produit/${slug}?lang=${language}`}>
                  {moduleText(slug, language).name}
                  <ArrowRightIcon size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
          <details className="bjy-question">
            <summary>{story.question}</summary>
            <p>{story.answer}</p>
          </details>
        </div>
      </section>
      <section className="bjy-countries">
        <div className="site-shell">
          <div className="bjy-section-heading">
            <h2>{m.countriesTitle}</h2>
            <p>{m.countriesCopy}</p>
          </div>
          <div className="bjy-country-list">
            {BAITLY_COUNTRY_JOURNEYS.map((country, i) => (
              <article key={country.id} id={country.id}>
                <span className="bjy-country-code" aria-hidden="true">
                  {country.code}
                </span>
                <div>
                  <h3>{m.countries[i].name}</h3>
                  <p>{m.countries[i].copy}</p>
                </div>
                <span className="bjy-currency">
                  <SiteCurrencySymbol
                    currency={country.currency as SiteCurrency}
                  />
                </span>
                <Link
                  to={`/ressources/obligations?lang=${language}&country=${country.code}`}
                >
                  {m.guide}
                  <ArrowRightIcon size={17} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="site-shell bjy-closing">
        <div>
          <h2>{m.closingTitle}</h2>
          <p>{m.closingCopy}</p>
        </div>
        <div className="bjy-actions">
          <Link className="baitly-button" to={`/tarifs?lang=${language}`}>
            {m.pricing}
            <ArrowRightIcon size={18} aria-hidden="true" />
          </Link>
          <Link className="baitly-text-link" to={`/migration?lang=${language}`}>
            {m.migration}
            <ArrowRightIcon size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
