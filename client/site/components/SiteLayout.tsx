import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { MenuIcon, MessageCircleIcon, XIcon } from 'lucide-react';
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
import { cn } from '../../src/utils/cn';
import { MODULES, RESOURCES, SOLUTIONS } from '../data/catalog';

/** Lien de panneau du mega-menu : icône teintée + titre + description. */
function PanelLink({
  to,
  title,
  copy,
  icon: Icon,
}: {
  to: string;
  title: string;
  copy?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <NavigationMenuLink asChild>
      <Link to={to} className="group/nav-link flex flex-col items-start gap-1">
        <span className="flex items-center gap-2 text-sm leading-none font-medium whitespace-nowrap">
          {Icon && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary transition-colors group-hover/nav-link:bg-primary group-hover/nav-link:text-primary-foreground">
              <Icon className="size-4" />
            </span>
          )}
          {title}
        </span>
        {copy && <span className="line-clamp-2 text-sm leading-snug text-muted-foreground">{copy}</span>}
      </Link>
    </NavigationMenuLink>
  );
}

function DesktopNav() {
  return (
    <NavigationMenu className="hidden lg:flex">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Produit</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-1 sm:w-[480px] md:w-[620px] md:grid-cols-2">
              {MODULES.map((module) => (
                <PanelLink
                  key={module.slug}
                  to={`/produit/${module.slug}`}
                  title={module.name}
                  copy={module.menuCopy}
                  icon={module.icon}
                />
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-1 sm:w-[440px] md:w-[560px] md:grid-cols-2">
              {SOLUTIONS.map((solution) => (
                <PanelLink
                  key={solution.slug}
                  to={`/solutions#${solution.slug}`}
                  title={solution.name}
                  copy={solution.menuCopy}
                  icon={solution.icon}
                />
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/tarifs">Tarifs</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/migration">Migration</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/comparer">Comparer</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/prestataires">Prestataires</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Ressources</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-1 sm:w-[440px] md:w-[560px] md:grid-cols-2">
              {RESOURCES.map((resource) => (
                <PanelLink
                  key={resource.name}
                  to="/ressources"
                  title={resource.name}
                  copy={resource.copy}
                  icon={resource.icon}
                />
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

const MOBILE_LINKS: Array<{ to: string; label: string }> = [
  { to: '/produit/agents-ia', label: 'Produit' },
  { to: '/solutions', label: 'Solutions' },
  { to: '/tarifs', label: 'Tarifs' },
  { to: '/migration', label: 'Migration' },
  { to: '/comparer', label: 'Comparer' },
  { to: '/prestataires', label: 'Prestataires' },
  { to: '/ressources', label: 'Ressources' },
];

function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="site-shell flex h-16 items-center gap-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="text-primary">
            <BaitlyMarkLogo variant="mark" size={30} colorMode="inherit" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Baitly</span>
        </Link>
        <DesktopNav />
        <div className="ms-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
            <a href="https://app.clenzy.fr" rel="noreferrer">
              Se connecter
            </a>
          </Button>
          <Button variant="outline" size="sm" className="hidden md:inline-flex" asChild>
            <a href="https://wa.me/212600000000" target="_blank" rel="noreferrer">
              <MessageCircleIcon /> WhatsApp
            </a>
          </Button>
          <Button size="sm" asChild>
            <Link to="/demo">Réserver une démo</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <XIcon /> : <MenuIcon />}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="border-t border-border bg-background lg:hidden">
          <div className="site-shell flex flex-col py-2">
            {MOBILE_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2.5 text-sm font-medium',
                    isActive ? 'bg-primary-soft text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

/* ─── Footer ───────────────────────────────────────────────────────────────── */

const FOOTER_COLUMNS: Array<{ title: string; links: Array<{ label: string; to: string }> }> = [
  {
    title: 'Produit',
    links: MODULES.map((module) => ({ label: module.name, to: `/produit/${module.slug}` })),
  },
  {
    title: 'Solutions',
    links: SOLUTIONS.map((solution) => ({ label: solution.name, to: `/solutions#${solution.slug}` })),
  },
  {
    title: 'Ressources',
    links: [
      { label: 'Baromètre STR Maroc', to: '/ressources' },
      { label: 'Calculateur de revenus', to: '/ressources' },
      { label: 'Guide des obligations', to: '/ressources' },
      { label: 'Académie', to: '/ressources' },
      { label: 'Blog', to: '/ressources' },
    ],
  },
  {
    title: 'Entreprise',
    links: [
      { label: 'Tarifs', to: '/tarifs' },
      { label: 'Migration', to: '/migration' },
      { label: 'Comparer', to: '/comparer' },
      { label: 'Devenir prestataire', to: '/prestataires' },
      { label: 'Réserver une démo', to: '/demo' },
    ],
  },
];

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="site-shell py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="text-primary">
                <BaitlyMarkLogo variant="mark" size={26} colorMode="inherit" />
              </span>
              <span className="font-semibold">Baitly</span>
            </Link>
            <p className="mt-3 max-w-xs text-xs text-muted-foreground">
              Le PMS avec une équipe d'agents IA, conçu pour le Maroc et la France. Fiche police,
              taxe de séjour et facturation conformes, dès le premier jour.
            </p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {column.title}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
          <span>© 2026 Baitly. Tous droits réservés.</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {[
              { label: 'Mentions légales', to: '/legal/mentions-legales' },
              { label: 'Confidentialité', to: '/legal/confidentialite' },
              { label: 'CGV', to: '/legal/cgv' },
              { label: 'Statut du service', to: '/statut' },
            ].map((link) => (
              <Link key={link.to} to={link.to} className="transition-colors hover:text-foreground">
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
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [pathname, hash]);
  return null;
}

export default function SiteLayout(): ReactNode {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ScrollRestore />
      <SiteHeader />
      <main>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
