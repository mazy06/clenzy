import SiteMoney from '../components/SiteMoney';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, BookOpen, Play, TrendingUp } from 'lucide-react';
import Reveal from '../components/Reveal';
import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_RESOURCE_MESSAGES } from '../lib/messages/baitlyResources';
import {
  normalizeResourceSearch,
  type ResourceKind,
} from '../data/baitlyResources';
import { RESOURCES } from '../data/catalog';
import { SITE_PHOTOS, sitePhotoAlt } from '../data/baitlyPhotography';
import { ACADEMY_EPISODES, academyPosterUrl } from '../data/baitlyAcademyVideos';
import { BAITLY_ACADEMY_MESSAGES } from '../lib/messages/baitlyAcademy';
import { formatClock } from '../components/academy/BaitlyVideoPlayer';

const {
  resourcesReading: terrace,
  resourcesObligations: guesthouse,
  resourcesJournal: food,
} = SITE_PHOTOS;

const ORDER: ResourceKind[] = [
  'calculateur',
  'barometre',
  'obligations',
  'academie',
  'blog',
  'glossaire',
];

export default function ResourcesPage() {
  const { language } = useSiteLanguage();
  const m = BAITLY_RESOURCE_MESSAGES[language];
  const academy = BAITLY_ACADEMY_MESSAGES[language];
  const academySeconds = Math.round(ACADEMY_EPISODES.reduce((sum, episode) => sum + episode.duration, 0));
  const academyTotal = `${Math.floor(academySeconds / 60)} ${academy.ui.minutes} ${String(academySeconds % 60).padStart(2, '0')}`;
  const [query, setQuery] = useState('');
  const search = normalizeResourceSearch(query);
  const visible = ORDER.filter((id) =>
    normalizeResourceSearch(Object.values(m.modules[id]).join(' ')).includes(
      search,
    ),
  );
  return (
    <div className="brs-page">
      <section className="brs-hero site-shell">
        <div className="brs-hero-copy">
          <span className="brs-eyebrow">
            <BookOpen size={17} />
            {m.hero.eyebrow}
          </span>
          <h1>
            {m.hero.title}
            <br />
            <em>{m.hero.accent}</em>
          </h1>
          <p>{m.hero.intro}</p>
          <div className="brs-hero-actions">
            <a className="brs-button" href="#bibliotheque">
              {m.hero.action}
              <ArrowRight size={18} />
            </a>
            <Link
              className="brs-text-link"
              to={`/ressources/calculateur?lang=${language}`}
            >
              {m.hero.secondary}
              <ArrowRight size={17} />
            </Link>
          </div>
          <small>{m.hero.note}</small>
        </div>
        <div className="brs-hero-visual">
          <img
            src={terrace}
            alt={sitePhotoAlt('resourcesReading', language)}
            loading="eager"
          />
          <div className="brs-visual-label">
            <span className="brs-book-spine" aria-hidden="true">
              B
            </span>
            <p>{m.hero.caption}</p>
            <BookOpen size={25} />
          </div>
          <div className="brs-floating-index" aria-hidden="true">
            <span>01</span>
            <span>02</span>
            <span>03</span>
            <span>04</span>
            <span>05</span>
            <span>06</span>
          </div>
        </div>
      </section>
      <section className="brs-library" id="bibliotheque">
        <div className="site-shell">
          <div className="brs-library-heading">
            <div>
              <span className="brs-eyebrow">BAITLY / 06</span>
              <h2>{m.library}</h2>
              <p>{m.libraryCopy}</p>
            </div>
            <div className="brs-search">
              <Search size={19} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={m.search}
                placeholder={m.search}
              />
            </div>
          </div>
          {query && (
            <p className="brs-small" role="status">
              {m.results} : {visible.length}
            </p>
          )}
          <div className={`brs-library-grid ${query ? 'is-filtered' : ''}`}>
            {visible.map((id) => {
              const resource = m.modules[id];
              const Icon = RESOURCES.find((item) => item.id === id)!.icon;
              return (
                <Reveal key={id} className={`brs-entry-wrap brs-entry-${id}`}>
                  <Link
                    className={`brs-entry brs-entry-${id}`}
                    to={`/ressources/${id}?lang=${language}`}
                  >
                    <div className="brs-entry-copy">
                      <span className="brs-eyebrow">
                        <Icon className="brs-inline-icon" />
                        {resource.tag}
                      </span>
                      <h3>{resource.name}</h3>
                      <p>{resource.copy}</p>
                      <span className="brs-entry-action">
                        {m.open}
                        <ArrowRight size={20} />
                      </span>
                    </div>
                    {id === 'calculateur' && (
                      <div className="brs-calc-cover" aria-hidden="true">
                        <div>
                          <span>{m.calc.fields[3]}</span>
                          <strong>
                            <SiteMoney value={850} from="MAD" />
                          </strong>
                        </div>
                        <div className="brs-cover-slider">
                          <i />
                        </div>
                        <div>
                          <span>{m.calc.fields[2]}</span>
                          <strong>
                            65 <small>%</small>
                          </strong>
                        </div>
                        <div className="brs-cover-bars">
                          {[35, 48, 40, 65, 55, 78, 88].map((height, index) => (
                            <i
                              key={index}
                              style={{
                                height: `${height}%`,
                                animationDelay: `${index * 70}ms`,
                              }}
                            />
                          ))}
                        </div>
                        <span className="brs-small">{m.calc.output}</span>
                      </div>
                    )}
                    {id === 'barometre' && (
                      <div className="brs-market-cover" aria-hidden="true">
                        <TrendingUp size={48} strokeWidth={1.3} />
                        <span>{m.market.scope}</span>
                        <div>
                          {['MA', 'AG', 'CA', 'TA', 'RA', 'ES'].map(
                            (city, index) => (
                              <i
                                key={city}
                                style={{
                                  height: `${[60, 66, 66, 60, 95, 36][index]}%`,
                                }}
                              >
                                <small>{city}</small>
                              </i>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                    {id === 'obligations' && (
                      <div className="brs-guide-cover">
                        <img
                          src={guesthouse}
                          alt={sitePhotoAlt('resourcesObligations', language)}
                          loading="lazy"
                        />
                        <span>{m.guide.countries.join(' · ')}</span>
                      </div>
                    )}
                    {id === 'academie' && (
                      <div className="brs-academy-cover" aria-hidden="true">
                        <div className="brs-academy-posters">
                          <span className="brs-academy-wide">
                            <img
                              src={academyPosterUrl(ACADEMY_EPISODES[0], '16x9')}
                              alt=""
                              loading="lazy"
                            />
                            <small>
                              <Play size={13} />
                              {formatClock(Math.round(ACADEMY_EPISODES[0].duration))}
                            </small>
                          </span>
                          <span className="brs-academy-tall">
                            <img
                              src={academyPosterUrl(
                                ACADEMY_EPISODES[1] ?? ACADEMY_EPISODES[0],
                                '9x16',
                              )}
                              alt=""
                              loading="lazy"
                            />
                          </span>
                        </div>
                        <small>
                          {ACADEMY_EPISODES.length} {academy.ui.episodes} ·{' '}
                          {academyTotal} · {academy.ui.formats}
                        </small>
                      </div>
                    )}
                    {id === 'blog' && (
                      <div className="brs-blog-cover">
                        <img
                          src={food}
                          alt={sitePhotoAlt('resourcesJournal', language)}
                          loading="lazy"
                        />
                      </div>
                    )}
                    {id === 'glossaire' && (
                      <div className="brs-glossary-cover" aria-hidden="true">
                        <span>ADR</span>
                        <span>RevPAR</span>
                        <span lang="ar" dir="rtl">
                          الإشغال
                        </span>
                        <small>FR ↔ EN ↔ AR</small>
                      </div>
                    )}
                  </Link>
                </Reveal>
              );
            })}
          </div>
          {!visible.length && (
            <div className="brs-empty">
              <Search size={28} />
              <p>{m.empty}</p>
              <button className="brs-button" onClick={() => setQuery('')}>
                {m.reset}
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="brs-cta">
        <div className="site-shell">
          <div>
            <h2>{m.cta.title}</h2>
            <p>{m.cta.copy}</p>
          </div>
          <SiteAcquisitionLink
            className="brs-button"
            to={`/demo?lang=${language}`}
          >
            {m.cta.action}
            <ArrowRight size={18} />
          </SiteAcquisitionLink>
        </div>
      </section>
    </div>
  );
}
