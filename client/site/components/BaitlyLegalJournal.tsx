import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronDown, Search } from 'lucide-react';
import {
  legalArticle,
  articleLanguage,
  LEGAL_COUNTRIES,
  articlePath,
  legalCountry,
} from '../data/legal';
import { LEGAL_MESSAGES } from '../lib/messages/baitlyLegal';
import { normalizeResourceSearch } from '../data/baitlyResources';
import type { SiteLanguage } from '../lib/siteLanguage';
import { legalArticleImage } from '../data/legal/articleImages';
import {
  JOURNAL_ARTICLE_COUNT,
  journalArticles,
  type JournalArticle,
} from '../data/baitlyJournal';
import { BAITLY_RESOURCE_MESSAGES } from '../lib/messages/baitlyResources';

/** The initial HTML and the interactive journal share the same editorial layout. */
export function BaitlyJournalHeader({
  language,
}: {
  language: SiteLanguage;
}) {
  const m = LEGAL_MESSAGES[language];
  return (
    <header className="blg-hero">
      <div>
        <Link to={`/ressources?lang=${language}`} className="blg-back">
          <ArrowLeft size={16} aria-hidden="true" />
          {{ fr: 'Ressources', en: 'Resources', ar: 'الموارد' }[language]}
        </Link>
        <p className="blg-kicker">{m.journal}</p>
        <h1>{m.journalTitle}</h1>
        <p className="blg-hero-lead">{m.journalIntro}</p>
        <div className="blg-hero-foot">
          <span>
            {JOURNAL_ARTICLE_COUNT} {m.count}
          </span>
          <Link to={`/ressources/obligations?lang=${language}`}>
            {m.eyebrow}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function BaitlyLegalJournal({
  language,
}: {
  language: SiteLanguage;
}) {
  const m = LEGAL_MESSAGES[language];
  const [params, setParams] = useSearchParams();
  const country = legalCountry(params.get('country'))?.code ?? '';
  const topic = params.get('topic') ?? '';
  const query = params.get('q') ?? '';
  const search = normalizeResourceSearch(query);
  const update = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  const reset = () =>
    setParams(
      { lang: language },
      { replace: true, preventScrollReset: true },
    );
  const articles = journalArticles(language).filter(
    (a) =>
      (!country || !a.country || a.country === country) &&
      (!topic || a.topic === topic) &&
      (!search || normalizeResourceSearch(a.searchText).includes(search)),
  );
  const featured =
    !country && !topic && !query
      ? legalArticle(
          'arabie-saoudite-reservation-paiement-unite-privee',
          language,
        )!
      : undefined;
  return (
    <>
      {m.french && <p className="blg-language-note">{m.french}</p>}
      {featured && (
        <Link
          to={`${articlePath(featured)}?lang=${language}`}
          className="blg-featured"
          lang={articleLanguage(language)}
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          <img
            src={legalArticleImage(featured.slug).src}
            srcSet={`${legalArticleImage(featured.slug).thumbnail} 480w, ${legalArticleImage(featured.slug).src} 1200w`}
            sizes="(max-width: 700px) calc(100vw - 40px), 50vw"
            alt=""
            width="1200"
            height="800"
          />
          <div>
            <span className="blg-kicker">
              {m.featured} · {legalCountry('SA')!.name[language]}
            </span>
            <h2>{featured.title}</h2>
            <p>{featured.description}</p>
            <span className="blg-text-link">
              {language === 'en' ? m.readFr : m.read}
              <ArrowRight size={18} aria-hidden="true" />
            </span>
          </div>
        </Link>
      )}
      <div className="blg-journal-controls">
        <div
          className="blg-filter-countries"
          role="group"
          aria-label={m.countries}
        >
          <button
            aria-pressed={!country}
            onClick={() => update('country', '')}
          >
            {m.all}
          </button>
          {LEGAL_COUNTRIES.map((c) => (
            <button
              key={c.code}
              aria-pressed={country === c.code}
              onClick={() => update('country', c.code)}
            >
              {c.name[language]}
            </button>
          ))}
        </div>
        <div className="blg-search-row">
          <label className="blg-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">{m.search}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => update('q', e.target.value)}
              placeholder={m.placeholder}
            />
          </label>
          <label>
            <span className="sr-only">{m.allTopics}</span>
            <select
              value={topic}
              onChange={(e) => update('topic', e.target.value)}
            >
              <option value="">{m.allTopics}</option>
              {Object.entries(m.topics).map(([id, name]) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="blg-list-heading">
        <h2>{m.articles}</h2>
        <span role="status">
          {articles.length} {articles.length === 1 ? m.countOne : m.count}
        </span>
      </div>
      {!articles.length ? (
        <div className="blg-empty">
          <p>{m.noResults}</p>
          <button onClick={reset}>{m.reset}</button>
        </div>
      ) : (
        <div className="blg-article-list">
          {articles.map((a) => (
            <article
              key={a.id}
              lang={a.language}
              dir={a.language === 'ar' ? 'rtl' : 'ltr'}
            >
              {a.reading ? (
                <details id={a.id} className="blg-practical-article">
                  <summary className="blg-article-link">
                    <ArticlePreview article={a} expandable />
                  </summary>
                  <div className="blg-practical-body">
                    <p className="blg-kicker">
                      {BAITLY_RESOURCE_MESSAGES[language].blog.byline}
                    </p>
                    {a.reading.sections.map((section) => (
                      <section key={section.title}>
                        <h4>{section.title}</h4>
                        <p>{section.copy}</p>
                      </section>
                    ))}
                    <section className="blg-practical-takeaway">
                      <h4>
                        {BAITLY_RESOURCE_MESSAGES[language].blog.takeaway}
                      </h4>
                      <p>{a.reading.takeaway}</p>
                    </section>
                  </div>
                </details>
              ) : (
                <Link
                  to={`${a.href}?lang=${language}`}
                  className="blg-article-link"
                >
                  <ArticlePreview article={a} />
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function ArticlePreview({
  article,
  expandable = false,
}: {
  article: JournalArticle;
  expandable?: boolean;
}) {
  return (
    <>
      <img
        src={article.image}
        alt=""
        width="480"
        height="320"
        loading="lazy"
        decoding="async"
      />
      <div>
        <div className="blg-article-meta">
          <span>{article.countryLabel}</span>
          <span>{article.topicLabel}</span>
          <span>
            {article.readingMinutes}{' '}
            {LEGAL_MESSAGES[article.language].minute}
          </span>
        </div>
        <h3>{article.title}</h3>
        <p>{article.description}</p>
      </div>
      {expandable ? (
        <ChevronDown
          className="blg-expand-icon"
          size={22}
          aria-hidden="true"
        />
      ) : (
        <ArrowRight size={22} aria-hidden="true" />
      )}
    </>
  );
}
