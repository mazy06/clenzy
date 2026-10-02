import { renderToStaticMarkup } from 'react-dom/server';
import { createPath, Router, type Navigator } from 'react-router-dom';
import { ArrowRight, ChevronDown, Menu } from 'lucide-react';
import BaitlyMarkLogo from '../../../src/components/BaitlyMarkLogo';
import { Button } from '../../../src/components/ui/button';
import { navigationMenuTriggerStyle } from '../../../src/components/ui/navigation-menu';
import BaitlyLegalJournal, {
  BaitlyJournalHeader,
} from '../../components/BaitlyLegalJournal';
import { LAYOUT_MESSAGES } from '../../lib/messages/layout';
import { PRELAUNCH_MESSAGES } from '../../lib/messages/prelaunch';
import type { SiteLanguage } from '../../lib/siteLanguage';

const cannotNavigate = () => {
  throw new Error(
    'Navigation is unavailable while rendering the initial journal',
  );
};
// Use the public Router API, available with both React Router 6 and 7.
const staticNavigator: Navigator = {
  createHref: (to) => (typeof to === 'string' ? to : createPath(to)),
  go: cannotNavigate,
  push: cannotNavigate,
  replace: cannotNavigate,
};

/** Build-time rendering only. Articles, images and layout are the live components;
 * the header uses ordinary links so the first document remains navigable without JS.
 */
export function journalStaticHtml(language: SiteLanguage): string {
  const m = LAYOUT_MESSAGES[language];
  // No asset-bearing catalog import here: this renderer also runs in Vite's config.
  const navigation = [
    { label: m.nav.product, to: '/comparer', group: true },
    { label: m.nav.solutions, to: '/solutions', group: true },
    { label: m.nav.pricing, to: '/tarifs' },
    { label: m.nav.migration, to: '/migration' },
    { label: m.nav.providers, to: '/prestataires' },
    { label: m.nav.resources, to: '/ressources', group: true },
  ];
  return renderToStaticMarkup(
    <Router
      location={`/ressources/blog?lang=${language}`}
      navigator={staticNavigator}
      static
    >
      <div className="baitly-marketing min-h-screen">
        <a href="#site-content" className="site-skip-link">
          {m.shell.skip}
        </a>
        <header className="site-header sticky top-0 z-40 border-b border-border bg-background">
          <div className="site-shell site-header-inner flex h-16 items-center gap-5">
            <a
              href={`/?lang=${language}`}
              className="flex items-center gap-2.5"
              aria-label={m.header.homeAria}
            >
              <span className="text-primary">
                <BaitlyMarkLogo
                  variant="mark"
                  size={30}
                  colorMode="inherit"
                />
              </span>
              <span className="site-wordmark text-lg font-semibold tracking-tight">
                baitly
              </span>
            </a>
            <nav
              className="site-nav cn-navigation-menu relative hidden max-w-max flex-1 items-center justify-center lg:flex"
              aria-label={m.nav.aria}
            >
              <ul className="cn-navigation-menu-list flex flex-1 list-none items-center justify-center">
                {navigation.map((entry) => (
                  <li
                    key={entry.to}
                    className="cn-navigation-menu-item relative"
                  >
                    <a
                      className={navigationMenuTriggerStyle()}
                      href={`${entry.to}?lang=${language}`}
                    >
                      {entry.label}
                      {entry.group && (
                        <ChevronDown
                          className="cn-navigation-menu-trigger-icon"
                          aria-hidden="true"
                        />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="ms-auto flex items-center gap-2">
              <Button size="sm" className="site-header-cta" asChild>
                <a href={`/demo?lang=${language}`}>
                  {PRELAUNCH_MESSAGES[language].cta}
                  <ArrowRight aria-hidden="true" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="site-mobile-trigger lg:hidden"
                asChild
              >
                <a
                  href={`/ressources?lang=${language}`}
                  aria-label={m.nav.resources}
                >
                  <Menu aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </header>
        <main id="site-content" tabIndex={-1}>
          <div className="blg-page blg-journal">
            <div className="site-shell">
              <BaitlyJournalHeader language={language} />
              <BaitlyLegalJournal language={language} />
            </div>
          </div>
        </main>
      </div>
    </Router>,
  );
}
