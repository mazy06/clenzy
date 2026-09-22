import SiteAcquisitionLink from './SiteAcquisitionLink';
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { runtimeEnvOr } from '../../src/config/runtimeConfig';
import { ArrowRightIcon, MenuIcon, XIcon } from 'lucide-react';
import {
  Button,
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '../../src/components/ui';
import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';
import NavMegaPanel, { type NavMegaItem } from './NavMegaPanel';
import PublicLanguagePicker from '../../src/components/PublicLanguagePicker';
import { useSiteLanguage, type SiteLanguage } from '../lib/siteLanguage';
import { useSiteLaunch } from '../lib/siteLaunch';
import { PRELAUNCH_MESSAGES } from '../lib/messages/prelaunch';
import { LAYOUT_MESSAGES, type LayoutMessages } from '../lib/messages/layout';
import { moduleText } from '../lib/messages/modules';
import { resourceText, solutionText } from '../lib/messages/solutions';
import { cn } from '../../src/utils/cn';
import { MODULES, RESOURCES, SOLUTIONS } from '../data/catalog';
import { MODULE_PHOTO, SOLUTION_PHOTO } from '../data/navVisuals';

function DesktopNav() {
  const { language } = useSiteLanguage();
  const m = LAYOUT_MESSAGES[language].nav;
  const mega = LAYOUT_MESSAGES[language].mega;

  /* Les trois volets partagent la meme piece : seule la matiere change. Les
     points viennent des VRAIES fonctionnalites deja ecrites pour les pages —
     rien n'est redige pour le menu, rien n'est donc a retraduire. */
  const modules: NavMegaItem[] = MODULES.map((module) => {
    const text = moduleText(module.slug, language);
    return {
      key: module.slug,
      to: `/produit/${module.slug}`,
      icon: module.icon,
      title: text.name,
      copy: text.menuCopy,
      points: text.features.map((feature) => feature.title),
      photo: MODULE_PHOTO[module.slug],
    };
  });

  const solutions: NavMegaItem[] = SOLUTIONS.map((solution) => {
    const text = solutionText(solution.slug, language);
    return {
      key: solution.slug,
      to: `/solutions#${solution.slug}`,
      icon: solution.icon,
      title: text.name,
      copy: text.copy,
      points: text.points,
      photo: SOLUTION_PHOTO[solution.slug],
    };
  });

  /* Les ressources sont des documents et des outils, pas des lieux : elles
     n'ont pas de photo, et portent leur etiquette a la place. */
  const resources: NavMegaItem[] = RESOURCES.map((resource) => {
    const text = resourceText(resource.id, language);
    return {
      key: resource.id,
      to: '/ressources',
      icon: resource.icon,
      title: text.name,
      copy: text.copy,
      tag: text.tag,
    };
  });

  return (
    <NavigationMenu className="site-nav hidden lg:flex" aria-label={m.aria}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>{m.product}</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavMegaPanel
              items={modules}
              discoverLabel={mega.discover}
              footer={{ to: '/comparer', label: mega.productAll }}
            />
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>{m.solutions}</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavMegaPanel
              items={solutions}
              discoverLabel={mega.discover}
              footer={{ to: '/solutions', label: mega.solutionsAll }}
            />
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/tarifs">{m.pricing}</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/migration">{m.migration}</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        {/* La place de marche des prestataires vivait dans le menu mobile et
            le pied de page seulement : introuvable pour qui navigue au large. */}
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/prestataires">{m.providers}</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>{m.resources}</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavMegaPanel
              items={resources}
              discoverLabel={mega.discover}
              footer={{ to: '/ressources', label: mega.resourcesAll }}
            />
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

const MOBILE_LINKS: Array<{ to: string; key: keyof LayoutMessages['nav'] }> = [
  { to: '/produit/agents-ia', key: 'product' },
  { to: '/solutions', key: 'solutions' },
  { to: '/tarifs', key: 'pricing' },
  { to: '/migration', key: 'migration' },
  { to: '/comparer', key: 'compare' },
  { to: '/prestataires', key: 'providers' },
  { to: '/ressources', key: 'resources' },
];

function SiteHeader() {
  const { language } = useSiteLanguage();
  const h = LAYOUT_MESSAGES[language].header;
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.key]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileOpen(false);
      menuTriggerRef.current?.focus();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  return (
    <header className="site-header sticky top-0 z-40 border-b border-border bg-background">
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
        <DesktopNav />
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="site-login hidden sm:inline-flex"
            asChild
          >
            <a
              href={runtimeEnvOr('VITE_APP_URL', 'http://localhost:3000')}
              rel="noreferrer"
            >
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
        <nav
          id="site-mobile-nav"
          aria-label={LAYOUT_MESSAGES[language].nav.mobileAria}
          className="site-mobile-nav border-t border-border bg-background lg:hidden"
        >
          <div className="site-shell flex flex-col py-2">
            {MOBILE_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2.5 text-sm font-medium',
                    isActive
                      ? 'bg-primary-soft text-foreground'
                      : 'text-muted-foreground',
                  )
                }
              >
                {LAYOUT_MESSAGES[language].nav[link.key]}
              </NavLink>
            ))}
          </div>
        </nav>
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
      links: m.resources.map((label) => ({ label, to: '/ressources' })),
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
  useEffect(() => {
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
    <div className="baitly-marketing min-h-screen">
      <a href="#site-content" className="site-skip-link">
        {m.skip}
      </a>
      <ScrollRestore />
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
    </div>
  );
}
