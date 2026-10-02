import { ArrowRight, BookOpen, Check, FileCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SITE_PHOTOS, sitePhotoAlt } from '../data/baitlyPhotography';
import { HOME_RESOURCE_MESSAGES } from '../lib/messages/homeResources';
import { useSiteLanguage } from '../lib/siteLanguage';
import Reveal from './Reveal';
import SiteMoney from './SiteMoney';
import BaitlyLegalHighlights from './BaitlyLegalHighlights';

export default function BaitlyHomeResources() {
  const { language } = useSiteLanguage();
  const m = HOME_RESOURCE_MESSAGES[language];

  return (
    <section className="bhr-section" aria-labelledby="home-resources-title">
      <div className="site-shell">
        <Reveal className="baitly-section-heading">
          <div>
            <p className="baitly-section-label">{m.label}</p>
            <h2 id="home-resources-title">{m.title}</h2>
          </div>
          <p>{m.intro}</p>
        </Reveal>
        <div className="bhr-layout">
          <Reveal className="bhr-library-wrap">
            <Link
              className="bhr-library"
              to={`/ressources?lang=${language}`}
              aria-labelledby="home-library-title"
            >
              <div className="bhr-photo">
                <img
                  src={SITE_PHOTOS.homeResources}
                  alt={sitePhotoAlt('homeResources', language)}
                  width="1200"
                  height="800"
                  loading="lazy"
                />
                <span className="bhr-photo-label">
                  <BookOpen size={17} />
                  {m.library.label}
                </span>
              </div>
              <div className="bhr-library-copy">
                <ul className="bhr-topics">
                  {m.library.topics.map((topic) => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
                <h3 id="home-library-title">{m.library.title}</h3>
                <p>{m.library.copy}</p>
                <span className="bhr-action">
                  {m.library.action}
                  <ArrowRight size={20} />
                </span>
                <small>{m.library.note}</small>
              </div>
            </Link>
          </Reveal>
          <div className="bhr-tools">
            <Reveal delay={1}>
              <Link
                className="bhr-tool bhr-calculator"
                to={`/ressources/calculateur?lang=${language}`}
                aria-labelledby="home-calculator-title"
              >
                <div className="bhr-tool-copy">
                  <span className="bhr-label">{m.calculator.label}</span>
                  <h3 id="home-calculator-title">{m.calculator.title}</h3>
                  <p>{m.calculator.copy}</p>
                  <span className="bhr-action">
                    {m.calculator.action}
                    <ArrowRight size={18} />
                  </span>
                </div>
                <div className="bhr-calculation" aria-hidden="true">
                  <div className="bhr-calculation-input">
                    <strong>
                      <SiteMoney value={90} decimals={0} />
                    </strong>
                    <span>{m.calculator.night}</span>
                  </div>
                  <span className="bhr-times">×</span>
                  <div className="bhr-calculation-input">
                    <strong>20</strong>
                    <span>{m.calculator.nights}</span>
                  </div>
                  <div className="bhr-calculation-total">
                    <span>{m.calculator.result}</span>
                    <strong>
                      <SiteMoney value={1800} decimals={0} />
                    </strong>
                  </div>
                </div>
              </Link>
            </Reveal>
            <Reveal delay={2}>
              <Link
                className="bhr-tool bhr-obligations"
                to={`/ressources/obligations?lang=${language}`}
                aria-labelledby="home-obligations-title"
              >
                <div className="bhr-tool-copy">
                  <span className="bhr-label">{m.obligations.label}</span>
                  <h3 id="home-obligations-title">{m.obligations.title}</h3>
                  <p>{m.obligations.copy}</p>
                  <span className="bhr-action">
                    {m.obligations.action}
                    <ArrowRight size={18} />
                  </span>
                </div>
                <div className="bhr-checklist" aria-hidden="true">
                  <FileCheck2 size={26} strokeWidth={1.5} />
                  <span className="bhr-countries">
                    {m.obligations.countries}
                  </span>
                  <ul>
                    {m.obligations.checks.map((check) => (
                      <li key={check}>
                        <Check size={14} />
                        {check}
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            </Reveal>
          </div>
        </div>
        <BaitlyLegalHighlights language={language} />
      </div>
    </section>
  );
}
