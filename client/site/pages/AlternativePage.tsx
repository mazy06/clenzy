import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon } from '../../src/icons/glyphs';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import {
  BAITLY_ALTERNATIVE_VENDORS,
  type BaitlyAlternative,
} from '../data/baitlyAlternatives';
import { BAITLY_ALTERNATIVE_MESSAGES } from '../lib/messages/baitlyAlternatives';
import { useSiteLanguage } from '../lib/siteLanguage';

/** "Alternative to X": the vendor's own published facts, Baitly's offer, then neutral questions. */
export default function AlternativePage({
  vendor,
}: {
  vendor: BaitlyAlternative;
}) {
  const { language } = useSiteLanguage();
  const m = BAITLY_ALTERNATIVE_MESSAGES[language];
  const page = m.vendors[vendor];
  const { name, pricingUrl } = BAITLY_ALTERNATIVE_VENDORS[vendor];
  const named = (text: string) => text.replace('{name}', name);
  return (
    <div className="bjy-page">
      <section className="site-shell bjy-solutions-hero">
        <div>
          <p className="bjy-eyebrow">
            {m.eyebrow} {name}
          </p>
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
          <h2>{named(m.publishedTitle)}</h2>
          <p>{m.publishedCopy}</p>
        </div>
        <div className="bjy-country-list">
          {page.facts.map((fact) => (
            <article key={fact}>
              <span className="bjy-country-code" aria-hidden="true">
                <CheckIcon size={16} />
              </span>
              <div>
                <p>{fact}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="bjy-lead">
          <a href={pricingUrl} target="_blank" rel="noopener nofollow">
            {m.source} {name}
          </a>{' '}
          · {m.checked}
        </p>
      </section>
      <section className="bjy-countries">
        <div className="site-shell">
          <div className="bjy-section-heading">
            <h2>{m.baitlyTitle}</h2>
            <p>{m.baitlyCopy}</p>
          </div>
          <div className="bjy-country-list">
            {m.baitlyPoints.map((point, index) => (
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
        </div>
      </section>
      <section className="site-shell bjy-activity-section">
        <div className="bjy-section-heading">
          <h2>{m.questionsTitle}</h2>
          <p>{named(m.questionsCopy)}</p>
        </div>
        <div className="bjy-country-list">
          {m.questions.map((question, index) => (
            <article key={question}>
              <span className="bjy-country-code" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>{question}</h3>
              </div>
            </article>
          ))}
        </div>
        <p className="bjy-lead">{m.note}</p>
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
          <Link className="baitly-text-link" to={`/migration?lang=${language}`}>
            {m.migration}
            <ArrowRightIcon size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
