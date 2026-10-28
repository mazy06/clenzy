import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '../../src/icons/glyphs';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import {
  articlePath,
  articlesForCountry,
  guidePath,
  legalCountry,
} from '../data/legal';
import type { BaitlyCountryPage } from '../data/baitlyCountries';
import { BAITLY_COUNTRY_MESSAGES } from '../lib/messages/baitlyCountries';
import { useSiteLanguage } from '../lib/siteLanguage';

/** Commercial landing page for one market, linked to its regulation articles. */
export default function CountryPage({ country }: { country: BaitlyCountryPage }) {
  const { language } = useSiteLanguage();
  const m = BAITLY_COUNTRY_MESSAGES[language];
  const page = m.countries[country];
  const code = legalCountry(country)!.code;
  const articles = articlesForCountry(code, language);
  return (
    <div className="bjy-page">
      <section className="site-shell bjy-solutions-hero">
        <div>
          <p className="bjy-eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
        </div>
        <div>
          <p className="bjy-lead">{page.intro}</p>
          <div className="bjy-actions">
            <SiteAcquisitionLink
              className="baitly-button"
              to={`/demo?lang=${language}`}
            >
              {m.demo}
              <ArrowRightIcon size={18} aria-hidden="true" />
            </SiteAcquisitionLink>
            <Link className="baitly-text-link" to={`/tarifs?lang=${language}`}>
              {m.pricing}
              <ArrowRightIcon size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <section className="site-shell bjy-activity-section">
        <div className="bjy-section-heading">
          <h2>{page.pointsTitle}</h2>
          <p>{page.pointsCopy}</p>
        </div>
        <div className="bjy-country-list">
          {page.points.map((point, index) => (
            <article key={point.title}>
              <span className="bjy-country-code" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>{point.title}</h3>
                <p>{point.copy}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="bjy-lead">{m.note}</p>
      </section>
      <section className="bjy-countries">
        <div className="site-shell">
          <div className="bjy-section-heading">
            <h2>{page.rulesTitle}</h2>
            <p>{page.rulesCopy}</p>
          </div>
          <div className="bjy-country-list">
            {articles.map((article) => (
              <article key={article.slug}>
                <span className="bjy-country-code" aria-hidden="true">
                  {code}
                </span>
                <div>
                  <h3>
                    {language === 'en' ? article.guide.en.title : article.title}
                  </h3>
                  <p>
                    {language === 'en' ? article.guide.en.copy : article.description}
                  </p>
                </div>
                <span aria-hidden="true" />
                <Link to={`${articlePath(article)}?lang=${language}`}>
                  {m.read}
                  <ArrowRightIcon size={17} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
          <div className="bjy-actions">
            <Link
              className="baitly-text-link"
              to={`${guidePath(code)}?lang=${language}`}
            >
              {m.guide}
              <ArrowRightIcon size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <section className="site-shell bwj-faq">
        <h2>{m.faqTitle}</h2>
        <div>
          {page.faq.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="site-shell bjy-closing">
        <div>
          <h2>{m.closingTitle}</h2>
          <p>{m.closingCopy}</p>
        </div>
        <div className="bjy-actions">
          <SiteAcquisitionLink
            className="baitly-button"
            to={`/demo?lang=${language}`}
          >
            {m.demo}
            <ArrowRightIcon size={18} aria-hidden="true" />
          </SiteAcquisitionLink>
          <Link className="baitly-text-link" to={`/tarifs?lang=${language}`}>
            {m.pricing}
            <ArrowRightIcon size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
