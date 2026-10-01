import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import {
  articlesForCountry,
  articleLanguage,
  legalSourceLabel,
  LEGAL_COUNTRIES,
  LEGAL_REVIEWED_AT,
  LEGAL_SOURCES,
  articlePath,
  articleReadingMinutes,
  articleSources,
  guidePath,
  legalArticle,
  legalCountry,
  type LegalArticle,
} from '../data/legal';
import { LEGAL_MESSAGES } from '../lib/messages/baitlyLegal';
import { useSiteLanguage } from '../lib/siteLanguage';
import { SITE_PHOTOS } from '../data/baitlyPhotography';
import { ARABIC_ARTICLES } from '../data/legal/localization';
import { legalArticleImage } from '../data/legal/articleImages';
import BaitlyLegalGuide from '../components/BaitlyLegalGuide';
import BaitlyLegalJournal from '../components/BaitlyLegalJournal';
import { JOURNAL_ARTICLE_COUNT } from '../data/baitlyJournal';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import NotFoundPage from './NotFoundPage';
import '../baitly-resources.css';
import '../baitly-legal.css';

function Article({ article }: { article: LegalArticle }) {
  const { language: navigationLanguage } = useSiteLanguage();
  const language = articleLanguage(navigationLanguage);
  const m = LEGAL_MESSAGES[language];
  const country = legalCountry(article.country)!;
  const photo = legalArticleImage(article.slug);
  const related = articlesForCountry(article.country, language)
    .filter((a) => a.country === article.country && a.slug !== article.slug)
    .sort(
      (a, b) =>
        Number(b.topic === article.topic) - Number(a.topic === article.topic),
    )
    .slice(0, 3);
  return (
    <div
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="blg-article-page"
    >
      <header className="blg-article-header">
        <Link className="blg-back" to={`/ressources/blog?lang=${language}`}>
          <ArrowLeft size={16} aria-hidden="true" />
          {m.back}
        </Link>
        <div className="blg-article-meta">
          <Link to={`${guidePath(article.country)}?lang=${language}`}>
            {country.name[language]}
          </Link>
          <span>{m.topics[article.topic]}</span>
          <span>
            {articleReadingMinutes(article)} {m.minute}
          </span>
        </div>
        <h1>{article.title}</h1>
        <p>{article.description}</p>
        <div className="blg-byline">
          <span>{m.byline}</span>
          <span>
            {m.reviewed} <time dateTime={LEGAL_REVIEWED_AT}>{m.date}</time>
          </span>
        </div>
        <img
          className="blg-article-cover"
          src={photo.src}
          srcSet={`${photo.thumbnail} 480w, ${photo.src} 1200w`}
          sizes="(max-width: 960px) calc(100vw - 40px), 920px"
          alt={
            language === 'ar'
              ? ARABIC_ARTICLES[article.slug].imageAlt
              : photo.alt
          }
          width="1200"
          height="800"
        />
      </header>
      <div className="blg-reading-layout">
        <aside className="blg-reading-nav">
          <nav aria-label={m.articleContents}>
            <p className="blg-kicker">{m.articleContents}</p>
            {article.sections.map((s, i) => (
              <a key={s.title} href={`#partie-${i + 1}`}>
                {s.title}
              </a>
            ))}
            <a href="#actions">{m.actions}</a>
            <a href="#references">{m.sources}</a>
          </nav>
          <Link
            className="blg-country-back"
            to={`${guidePath(article.country)}?lang=${language}`}
          >
            {m.countryGuide} · {country.name[language]}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
        <article className="blg-reading-body">
          <section className="blg-essentials" aria-labelledby="essentiel">
            <p className="blg-kicker" id="essentiel">
              {m.summary}
            </p>
            <dl className="blg-facts">
              {article.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
            <p className="blg-scope">
              <strong>{m.audience}</strong> {article.scope}
            </p>
          </section>
          {article.sections.map((section, i) => (
            <section
              key={section.title}
              id={`partie-${i + 1}`}
              className="blg-prose-section"
            >
              <span className="blg-section-number">0{i + 1}</span>
              <h2>{section.title}</h2>
              {section.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
              <ul className="blg-inline-sources" aria-label={m.sectionSources}>
                {section.sources.map((id) => (
                  <li key={id}>
                    <a
                      href={LEGAL_SOURCES[id].url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {legalSourceLabel(id, language)}
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section id="actions" className="blg-action-list">
            <h2>{m.actions}</h2>
            <ol>
              {article.checklist.map((item, i) => (
                <li key={item}>
                  <span>{i + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </section>
          <section className="blg-faq">
            <p className="blg-kicker">{m.faq}</p>
            {article.faq.map((f) => (
              <div key={f.q}>
                <h2>{f.q}</h2>
                <p>{f.a}</p>
              </div>
            ))}
          </section>
          <section id="references" className="blg-article-references">
            <h2>{m.sourcesMethod}</h2>
            <p>
              {m.methodCopy} {m.reviewed}{' '}
              <time dateTime={LEGAL_REVIEWED_AT}>{m.date}</time>.
            </p>
            <ul>
              {articleSources(article).map((id) => (
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
            </ul>
          </section>
        </article>
      </div>
      <section className="blg-related">
        <p className="blg-kicker">
          {m.further} · {country.name[language]}
        </p>
        {related.map((a) => (
          <Link key={a.slug} to={`${articlePath(a)}?lang=${language}`}>
            {a.title}
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        ))}
      </section>
    </div>
  );
}

export default function BaitlyLegalPage({
  kind,
}: {
  kind: 'guide' | 'journal' | 'article';
}) {
  const { language } = useSiteLanguage();
  const { country: countrySlug, article: articleSlug } = useParams();
  const [params] = useSearchParams();
  const m = LEGAL_MESSAGES[language];
  const country = legalCountry(countrySlug) ?? LEGAL_COUNTRIES[0];
  const article = legalArticle(articleSlug, language);
  if (kind === 'guide' && countrySlug && !legalCountry(countrySlug))
    return <NotFoundPage />;
  if (kind === 'article' && !article) return <NotFoundPage />;
  const queryCountry = legalCountry(params.get('country'));
  if (kind === 'guide' && !countrySlug && queryCountry)
    return (
      <Navigate
        replace
        to={`${guidePath(queryCountry.code)}?lang=${language}`}
      />
    );
  return (
    <div className={`blg-page blg-${kind}`}>
      <div className="site-shell">
        {kind === 'article' && article ? (
          <>
            {m.french && <p className="blg-language-note">{m.french}</p>}
            <Article article={article} />
          </>
        ) : (
          <>
            <header className="blg-hero">
              <div>
                <Link to={`/ressources?lang=${language}`} className="blg-back">
                  <ArrowLeft size={16} aria-hidden="true" />
                  {language === 'ar'
                    ? 'الموارد'
                    : language === 'en'
                      ? 'Resources'
                      : 'Ressources'}
                </Link>
                <p className="blg-kicker">
                  {kind === 'guide' ? m.eyebrow : m.journal}
                </p>
                <h1>
                  {kind === 'guide'
                    ? countrySlug
                      ? `${m.eyebrow} · ${country.name[language]}`
                      : m.title
                    : m.journalTitle}
                </h1>
                <p className="blg-hero-lead">
                  {kind === 'guide' ? m.intro : m.journalIntro}
                </p>
                <div className="blg-hero-foot">
                  <span>
                    {kind === 'guide'
                      ? m.sources
                      : `${JOURNAL_ARTICLE_COUNT} ${m.count}`}
                  </span>
                  <Link
                    to={`/ressources/${kind === 'guide' ? 'blog' : 'obligations'}?lang=${language}`}
                  >
                    {kind === 'guide' ? m.open : m.eyebrow}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
              {kind === 'guide' && (
                <figure>
                  <img
                    src={SITE_PHOTOS.resourcesObligations}
                    alt=""
                    width="720"
                    height="560"
                    fetchPriority="high"
                  />
                  <figcaption>
                    <span>{country.name[language]}</span>
                    <span>
                      {m.stages.ouvrir} · {m.stages.accueillir} ·{' '}
                      {m.stages.suivre}
                    </span>
                  </figcaption>
                </figure>
              )}
            </header>
            {kind === 'guide' ? (
              <BaitlyLegalGuide
                language={language}
                initialCountry={country.code}
              />
            ) : (
              <BaitlyLegalJournal language={language} />
            )}
          </>
        )}
        <section className="blg-product">
          <div>
            <p className="blg-kicker">Baitly</p>
            <h2>{m.productTitle}</h2>
            <p>{m.productCopy}</p>
          </div>
          <SiteAcquisitionLink
            to={`/demo?lang=${language}`}
            className="blg-button"
          >
            {m.productLink}
            <ArrowRight size={18} aria-hidden="true" />
          </SiteAcquisitionLink>
        </section>
      </div>
    </div>
  );
}
