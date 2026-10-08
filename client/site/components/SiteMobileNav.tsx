import { Link, useLocation } from 'react-router-dom';
import { ArrowRightIcon } from '../../src/icons/glyphs';
import { runtimeEnvOr } from '../../src/config/runtimeConfig';
import { useSiteLanguage } from '../lib/siteLanguage';
import { LAYOUT_MESSAGES } from '../lib/messages/layout';
import {
  isBaitlyNavCurrent,
  type BaitlySiteNavEntry,
} from '../data/baitlySiteNavigation';

export default function SiteMobileNav({
  entries,
  onNavigate,
}: {
  entries: readonly BaitlySiteNavEntry[];
  onNavigate: () => void;
}) {
  const { language } = useSiteLanguage();
  const { pathname, hash } = useLocation();
  const m = LAYOUT_MESSAGES[language];
  const current = (to: string) => isBaitlyNavCurrent(to, pathname, hash);

  return (
    <nav
      id="site-mobile-nav"
      aria-label={m.nav.mobileAria}
      className="site-mobile-nav"
    >
      <div className="site-mobile-directory">
        <div className="site-mobile-directory-inner">
          <p className="site-mobile-eyebrow">{m.mobile.explore}</p>
          <ul className="site-mobile-sections">
            {entries.map((entry) => (
              <li
                key={entry.key}
                className={`site-mobile-section site-mobile-section--${entry.kind}`}
              >
                {entry.kind === 'link' ? (
                  <Link
                    to={entry.to}
                    onClick={onNavigate}
                    className="site-mobile-top-link"
                    aria-current={current(entry.to) ? 'page' : undefined}
                  >
                    <span className="site-mobile-section-label">
                      {entry.label}
                    </span>
                    <ArrowRightIcon aria-hidden="true" />
                  </Link>
                ) : (
                  <section
                    role="group"
                    aria-labelledby={`site-mobile-${entry.key}-title`}
                  >
                    <h2
                      id={`site-mobile-${entry.key}-title`}
                      className="site-mobile-section-label"
                    >
                      {entry.label}
                    </h2>
                    <ul className="site-mobile-destinations">
                      {entry.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.key}>
                            <Link
                              to={item.to}
                              onClick={onNavigate}
                              className="site-mobile-sub-link"
                              aria-current={
                                current(item.to) ? 'page' : undefined
                              }
                            >
                              <span
                                className="site-mobile-sub-symbol"
                                aria-hidden="true"
                              >
                                {entry.key === 'solutions' && item.photo ? (
                                  <img
                                    src={item.photo}
                                    alt=""
                                    decoding="async"
                                  />
                                ) : (
                                  <Icon className="site-mobile-sub-icon" />
                                )}
                              </span>
                              <span className="site-mobile-sub-title">
                                {item.title}
                              </span>
                              <ArrowRightIcon
                                className="site-mobile-sub-arrow"
                                aria-hidden="true"
                              />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    <Link
                      to={entry.footer.to}
                      onClick={onNavigate}
                      className="site-mobile-group-footer"
                      aria-current={
                        current(entry.footer.to) ? 'page' : undefined
                      }
                    >
                      {entry.footer.label}
                      <ArrowRightIcon aria-hidden="true" />
                    </Link>
                  </section>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="site-mobile-account">
        <span className="site-mobile-account-brand">{m.mobile.account}</span>
        <a
          href={runtimeEnvOr('VITE_APP_URL', 'http://localhost:3000')}
          onClick={onNavigate}
          className="site-mobile-login"
        >
          {m.header.login}
          <ArrowRightIcon aria-hidden="true" />
        </a>
      </div>
    </nav>
  );
}
