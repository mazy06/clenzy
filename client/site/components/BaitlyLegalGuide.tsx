import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowRight, Check, ExternalLink } from 'lucide-react';
import {
  articlesForCountry,
  articlePath,
  articleSources,
  LEGAL_COUNTRIES,
  LEGAL_REVIEWED_AT,
  LEGAL_SOURCES,
  legalCountry,
  legalSourceLabel,
  guidePath,
  type LegalStage,
} from '../data/legal';
import { LEGAL_MESSAGES } from '../lib/messages/baitlyLegal';
import { downloadBlob } from '../lib/downloadText';
import type { SiteLanguage } from '../lib/siteLanguage';

const STAGES: LegalStage[] = ['ouvrir', 'accueillir', 'suivre'];

export default function BaitlyLegalGuide({
  language,
  initialCountry = 'MA',
}: {
  language: SiteLanguage;
  initialCountry?: string;
}) {
  const m = LEGAL_MESSAGES[language];
  const country = legalCountry(initialCountry) ?? LEGAL_COUNTRIES[0];
  const articles = articlesForCountry(country.code, language);
  // A reading-session checklist, not a persisted claim that a property is compliant.
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const done = articles.filter((a) => checked.has(a.slug)).length;
  const sources = [...new Set(articles.flatMap(articleSources))];
  /* Document Word construit dans le navigateur (aucune requête) ; le module
     n'est chargé qu'au clic pour ne pas alourdir la page. */
  const download = async () => {
    const { buildObligationsGuide } = await import('../lib/obligationsGuideDocx');
    downloadBlob(
      `baitly-obligations-${country.slug}.docx`,
      buildObligationsGuide({ language, country, articles, checked, m }),
    );
  };
  return (
    <div className="blg-guide">
      <nav className="blg-countries" aria-label={m.countries}>
        {LEGAL_COUNTRIES.map((c) => (
          <Link
            key={c.code}
            to={`${guidePath(c.code)}?lang=${language}`}
            aria-current={c.code === country.code ? 'page' : undefined}
          >
            <span className="blg-country-code" aria-hidden="true">
              {c.code}
            </span>
            {c.name[language]}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <div className="blg-guide-sheet">
        <header className="blg-country-intro">
          <div>
            <p className="blg-kicker">{m.scope}</p>
            <h2>{country.name[language]}</h2>
            <p>{country.scope[language]}</p>
          </div>
          <span className="blg-review">
            <Check size={16} aria-hidden="true" />
            {m.reviewed}
            <time dateTime={LEGAL_REVIEWED_AT}>{m.date}</time>
          </span>
        </header>
        <div className="blg-guide-layout">
          <aside className="blg-guide-aside">
            <nav aria-label={m.contents}>
              <h3>{m.contents}</h3>
              {STAGES.map((stage, i) => (
                <a key={stage} href={`#${stage}`}>
                  <span>0{i + 1}</span>
                  {m.stages[stage]}
                </a>
              ))}
              <a href="#sources">
                {m.sources}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </nav>
            <div className="blg-preparation">
              <h3>{m.checklist}</h3>
              <p aria-live="polite">
                <strong>
                  {done} / {articles.length}
                </strong>{' '}
                {m.checked}
              </p>
              <progress
                aria-label={m.checklist}
                value={done}
                max={articles.length}
              />
              <p className="blg-caption">{m.session}</p>
              <button type="button" onClick={download}>
                <ArrowDownToLine size={16} aria-hidden="true" />
                {m.download}
              </button>
            </div>
          </aside>
          <div className="blg-guide-body">
            {STAGES.map((stage, index) => (
              <section
                key={stage}
                id={stage}
                className="blg-stage"
                aria-labelledby={`heading-${stage}`}
              >
                <header>
                  <span className="blg-section-number">0{index + 1}</span>
                  <div>
                    <h3 id={`heading-${stage}`}>{m.stages[stage]}</h3>
                    <p>{m.stageCopy[stage]}</p>
                  </div>
                </header>
                {articles
                  .filter((a) => a.stage === stage)
                  .map((a) => (
                    <article key={a.slug} className="blg-obligation">
                      <label className="blg-check">
                        <input
                          type="checkbox"
                          checked={checked.has(a.slug)}
                          onChange={(e) =>
                            setChecked((previous) => {
                              const next = new Set(previous);
                              if (e.target.checked) next.add(a.slug);
                              else next.delete(a.slug);
                              return next;
                            })
                          }
                        />
                        <span className="sr-only">
                          {m.checked} :{' '}
                          {language === 'en' ? a.guide.en.title : a.title}
                        </span>
                      </label>
                      <div>
                        <h4>
                          {language === 'en' ? a.guide.en.title : a.title}
                        </h4>
                        <p>
                          {language === 'en' ? a.guide.en.copy : a.description}
                        </p>
                        {language !== 'en' && (
                          <dl className="blg-facts blg-facts-small">
                            {a.facts.map((f) => (
                              <div key={f.label}>
                                <dt>{f.label}</dt>
                                <dd>{f.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        <div className="blg-row-links">
                          <Link to={`${articlePath(a)}?lang=${language}`}>
                            {language === 'en' ? m.readFr : m.read}
                            <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                          <a
                            href={LEGAL_SOURCES[a.sections[0].sources[0]].url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {m.source}
                            <ExternalLink size={13} aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        </div>
        <section
          id="sources"
          className="blg-reference-section"
          aria-labelledby="blg-sources-title"
        >
          <div>
            <p className="blg-kicker">{m.sources}</p>
            <h3 id="blg-sources-title">{m.allSources}</h3>
            <p>{m.methodCopy}</p>
          </div>
          <ol>
            {sources.map((id) => (
              <li key={id}>
                <a
                  href={LEGAL_SOURCES[id].url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {legalSourceLabel(id, language)}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
