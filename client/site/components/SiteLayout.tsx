import SiteAcquisitionLink from './SiteAcquisitionLink';
import SiteMetadata from './SiteMetadata';
import { SiteCurrencyProvider } from '../lib/siteCurrency';
import SiteCurrencyControl from './SiteCurrencyControl';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSiteAppUrl } from '../lib/useSiteAppUrl';
import { ArrowRightIcon, MenuIcon, XIcon } from 'lucide-react';
import { Button } from '../../src/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '../../src/components/ui/navigation-menu';
import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';
import NavMegaPanel from './NavMegaPanel';
import SiteMobileNav from './SiteMobileNav';
import {
  buildBaitlySiteNavigation,
  type BaitlySiteNavEntry,
} from '../data/baitlySiteNavigation';
import PublicLanguagePicker from '../../src/components/PublicLanguagePicker';
import { useSiteLanguage, type SiteLanguage } from '../lib/siteLanguage';
import { useSiteLaunch } from '../lib/siteLaunch';
import { PRELAUNCH_MESSAGES } from '../lib/messages/prelaunch';
import { LAYOUT_MESSAGES } from '../lib/messages/layout';
import { moduleText } from '../lib/messages/modules';
import { resourceText, solutionText } from '../lib/messages/solutions';
import { MODULES, RESOURCES, SOLUTIONS } from '../data/catalog';
import { LEGAL_COUNTRIES, guidePath } from '../data/legal';

function DesktopNav({ entries }: { entries: readonly BaitlySiteNavEntry[] }) {
  const { language } = useSiteLanguage();
  const m = LAYOUT_MESSAGES[language];
  return (
    <NavigationMenu className="site-nav hidden lg:flex" aria-label={m.nav.aria}>
      <NavigationMenuList>
        {entries.map((entry) => (
          <NavigationMenuItem key={entry.key}>
            {entry.kind === 'group' ? (
              <>
                <NavigationMenuTrigger>{entry.label}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <NavMegaPanel
                    items={entry.items}
                    footer={entry.footer}
                    discoverLabel={m.mega.discover}
                  />
                </NavigationMenuContent>
              </>
            ) : (
              <NavigationMenuLink
                asChild
                className={navigationMenuTriggerStyle()}
              >
                <Link to={entry.to}>{entry.label}</Link>
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export function SiteHeader() {
  const { language } = useSiteLanguage();
  const h = LAYOUT_MESSAGES[language].header;
  const entries = buildBaitlySiteNavigation(language);
  const [mobileOpen, setMobileOpen] = useState(false);
  const appUrl = useSiteAppUrl();
  const headerRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.key]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1200px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const root = document.documentElement;
    const body = document.body;
    const previous = {
      rootOverflow: root.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    const gutter = window.innerWidth - root.clientWidth;
    const padding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
    // Lock the document only: body overflow would change the sticky header's scroll container.
    root.style.overflow = 'hidden';
    if (gutter > 0) body.style.paddingRight = `${padding + gutter}px`;

    // Only the header and its navigation stay interactive while the layer is open.
    const background = [
      ...document.querySelectorAll<HTMLElement>(
        '.baitly-marketing > main, .baitly-marketing > footer',
      ),
    ].map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => {
      element.inert = true;
    });

    const handleMenuKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        menuTriggerRef.current?.focus({ preventScroll: true });
      }
      if (event.key !== 'Tab') return;
      const controls = [
        ...(headerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]):not([tabindex="-1"])',
        ) ?? []),
      ].filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', handleMenuKey);
    return () => {
      window.removeEventListener('keydown', handleMenuKey);
      root.style.overflow = previous.rootOverflow;
      body.style.paddingRight = previous.paddingRight;
      background.forEach(({ element, inert }) => {
        element.inert = inert;
      });
    };
  }, [mobileOpen]);

  return (
    <header
      ref={headerRef}
      data-menu-open={mobileOpen || undefined}
      className="site-header sticky top-0 z-40 border-b border-border bg-background"
    >
      <div className="site-shell site-header-inner flex h-16 items-center gap-5">
        <Link
          to="/"
          className="flex items-center gap-2.5"
          aria-label={h.homeAria}
        >
          <span className="text-primary">
            <BaitlyMarkLogo variant="mark" size={30} colorMode="inherit" />
          </span>
          <span className="site-wordmark text-lg font-semibold tracking-tight">
            baitly
          </span>
        </Link>
        <DesktopNav entries={entries} />
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="site-login hidden sm:inline-flex"
            asChild
          >
            <a href={appUrl} rel="noreferrer">
              {h.login}
            </a>
          </Button>
          <Button size="sm" className="site-header-cta" asChild>
            <SiteAcquisitionLink to="/demo">
              {h.demo} <ArrowRightIcon />
            </SiteAcquisitionLink>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            ref={menuTriggerRef}
            className="site-mobile-trigger lg:hidden"
            aria-label={mobileOpen ? h.closeMenu : h.openMenu}
            aria-expanded={mobileOpen}
            aria-controls="site-mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <XIcon /> : <MenuIcon />}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <div className="site-mobile-layer">
          <SiteMobileNav
            entries={entries}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      )}
    </header>
  );
}

/* ─── Footer ───────────────────────────────────────────────────────────────── */

/**
 * Colonnes du pied de page, dans la langue du lecteur.
 *
 * <p>C'etait une constante de module, donc figee sur le francais du
 * chargement : elle ne pouvait pas suivre la langue. Les noms de modules et de
 * solutions viennent encore du catalogue, lui non traduit a ce jour.</p>
 */
function footerColumns(language: SiteLanguage) {
  const m = LAYOUT_MESSAGES[language].footer;
  return [
    {
      title: m.columns.product,
      links: MODULES.map((module) => ({
        label: moduleText(module.slug, language).name,
        to: `/produit/${module.slug}`,
      })),
    },
    {
      title: m.columns.solutions,
      links: SOLUTIONS.map((solution) => ({
        label: solutionText(solution.slug, language).name,
        to: `/solutions#${solution.slug}`,
      })),
    },
    {
      title: m.columns.resources,
      links: [
        ...RESOURCES.map(({ id }) => ({
          label: resourceText(id, language).name,
          to: `/ressources/${id}?lang=${language}`,
        })),
        ...LEGAL_COUNTRIES.map((country) => ({
          label: `${resourceText('obligations', language).name} · ${country.name[language]}`,
          to: `${guidePath(country.code)}?lang=${language}`,
        })),
      ],
    },
    {
      title: m.columns.company,
      links: m.company.map((label, index) => ({
        label,
        to: ['/tarifs', '/migration', '/comparer', '/prestataires', '/demo'][
          index
        ],
      })),
    },
  ];
}

/** Libelle accessible du groupe de langues, dans la langue affichee. */
const LANGUAGE_LABEL = { fr: 'Langue', en: 'Language', ar: 'اللغة' } as const;

function SiteFooter() {
  const { language, changeLanguage } = useSiteLanguage();
  const { paused } = useSiteLaunch();
  const m = LAYOUT_MESSAGES[language].footer;
  return (
    <footer className="site-footer border-t border-border bg-card">
      <div className="site-shell py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="text-primary">
                <BaitlyMarkLogo variant="mark" size={26} colorMode="inherit" />
              </span>
              <span className="site-wordmark font-semibold">baitly</span>
            </Link>
            <p className="mt-3 max-w-xs text-xs text-muted-foreground">
              {m.pitch}
            </p>
            {/* Le choix de langue vit ici depuis qu'il a quitte l'en-tete :
                dans la colonne d'identite, il se trouve a toute largeur — il
                etait masque sous 640 px la-haut. */}
            <PublicLanguagePicker
              value={language}
              onChange={changeLanguage}
              label={LANGUAGE_LABEL[language]}
              className="mt-5"
            />
          </div>
          {footerColumns(language).map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {column.title}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={
                        paused && link.to === '/demo'
                          ? `/bientot-disponible?lang=${language}`
                          : link.to
                      }
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {paused && link.to === '/demo'
                        ? PRELAUNCH_MESSAGES[language].cta
                        : link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
          <span>{m.rights}</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {[
              { label: m.legal.notice, to: '/legal/mentions-legales' },
              { label: m.legal.privacy, to: '/legal/confidentialite' },
              { label: m.legal.terms, to: '/legal/cgv' },
              { label: m.legal.status, to: '/statut' },
              {
                label: { fr: 'Contact', en: 'Contact', ar: 'تواصل معنا' }[
                  language
                ],
                to: `/contact?lang=${language}`,
              },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Remonte en haut à chaque navigation (sauf ancres). */
function ScrollRestore() {
  const { pathname, hash } = useLocation();
  const previous = useRef({ pathname, hash });
  useEffect(() => {
    // Hydration must not pull a visitor back to the top of an already readable page.
    if (
      previous.current.pathname === pathname &&
      previous.current.hash === hash
    )
      return;
    previous.current = { pathname, hash };
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [pathname, hash]);
  return null;
}

export default function SiteLayout(): ReactNode {
  const { language } = useSiteLanguage();
  const m = LAYOUT_MESSAGES[language].shell;
  return (
    <SiteCurrencyProvider>
      <div className="baitly-marketing min-h-screen">
        <a href="#site-content" className="site-skip-link">
          {m.skip}
        </a>
        <ScrollRestore />
        <SiteMetadata />
        <SiteHeader />
        <main id="site-content" tabIndex={-1}>
          <Suspense
            fallback={
              <div className="site-shell site-route-loading" role="status">
                <span>{m.loading}</span>
                <div />
                <div />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
        <SiteFooter />
        <SiteCurrencyControl />
      </div>
    </SiteCurrencyProvider>
  );
}
