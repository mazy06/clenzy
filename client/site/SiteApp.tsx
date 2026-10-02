import { lazy, startTransition, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import SiteLayout from './components/SiteLayout';
import { SiteLanguageProvider, type SiteLanguage } from './lib/siteLanguage';
import { SiteLaunchProvider } from './lib/siteLaunch';

// Shared by pre-rendering and hydration. Only the requested route is loaded at boot.
const loaders = {
  HomePage: () => import('./pages/HomePage'),
  ModulePage: () => import('./pages/ModulePage'),
  SolutionsPage: () => import('./pages/SolutionsPage'),
  PricingPage: () => import('./pages/PricingPage'),
  MigrationPage: () => import('./pages/MigrationPage'),
  ComparePage: () => import('./pages/ComparePage'),
  ResourcesPage: () => import('./pages/ResourcesPage'),
  BaitlyResourcePage: () => import('./pages/BaitlyResourcePage'),
  BaitlyLegalPage: () => import('./pages/BaitlyLegalPage'),
  ProvidersPage: () => import('./pages/ProvidersPage'),
  ProviderSignupPage: () => import('./pages/ProviderSignupPage'),
  ProviderActivationPage: () => import('./pages/ProviderActivationPage'),
  PrelaunchPage: () => import('./pages/PrelaunchPage'),
  LegalPage: () => import('./pages/legal/LegalPage'),
  StatusPage: () => import('./pages/StatusPage'),
  ContactPage: () => import('./pages/ContactPage'),
  NotFoundPage: () => import('./pages/NotFoundPage'),
  DemoRoute: () =>
    import('./components/AcquisitionRoutes').then((module) => ({
      default: module.DemoRoute,
    })),
  RegistrationRoute: () =>
    import('./components/AcquisitionRoutes').then((module) => ({
      default: module.RegistrationRoute,
    })),
};
type PageKey = keyof typeof loaders;
type PreparedPages = {
  [K in PageKey]?: Awaited<ReturnType<(typeof loaders)[K]>>['default'];
};
const lazyPages = {
  HomePage: lazy(loaders.HomePage),
  ModulePage: lazy(loaders.ModulePage),
  SolutionsPage: lazy(loaders.SolutionsPage),
  PricingPage: lazy(loaders.PricingPage),
  MigrationPage: lazy(loaders.MigrationPage),
  ComparePage: lazy(loaders.ComparePage),
  ResourcesPage: lazy(loaders.ResourcesPage),
  BaitlyResourcePage: lazy(loaders.BaitlyResourcePage),
  BaitlyLegalPage: lazy(loaders.BaitlyLegalPage),
  ProvidersPage: lazy(loaders.ProvidersPage),
  ProviderSignupPage: lazy(loaders.ProviderSignupPage),
  ProviderActivationPage: lazy(loaders.ProviderActivationPage),
  PrelaunchPage: lazy(loaders.PrelaunchPage),
  LegalPage: lazy(loaders.LegalPage),
  StatusPage: lazy(loaders.StatusPage),
  ContactPage: lazy(loaders.ContactPage),
  NotFoundPage: lazy(loaders.NotFoundPage),
  DemoRoute: lazy(loaders.DemoRoute),
  RegistrationRoute: lazy(loaders.RegistrationRoute),
};

export function initialPageKey(pathname: string): PageKey {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/') return 'HomePage';
  if (path.startsWith('/produit/')) return 'ModulePage';
  if (/^\/ressources\/(blog|obligations)(\/|$)/.test(path))
    return 'BaitlyLegalPage';
  if (
    /^\/ressources\/(calculateur|barometre|academie|glossaire)(\/|$)/.test(path)
  )
    return 'BaitlyResourcePage';
  if (path.startsWith('/legal/')) return 'LegalPage';
  const fixed: Record<string, PageKey> = {
    '/solutions': 'SolutionsPage',
    '/tarifs': 'PricingPage',
    '/migration': 'MigrationPage',
    '/comparer': 'ComparePage',
    '/ressources': 'ResourcesPage',
    '/prestataires': 'ProvidersPage',
    '/prestataires/inscription': 'ProviderSignupPage',
    '/prestataires/activation': 'ProviderActivationPage',
    '/demo': 'DemoRoute',
    '/bientot-disponible': 'PrelaunchPage',
    '/pre-lancement': 'PrelaunchPage',
    '/inscription': 'RegistrationRoute',
    '/register': 'RegistrationRoute',
    '/statut': 'StatusPage',
    '/contact': 'ContactPage',
  };
  return fixed[path] ?? 'NotFoundPage';
}

export async function prepareSitePage(
  pathname: string,
): Promise<PreparedPages> {
  const key = initialPageKey(pathname);
  return { [key]: (await loaders[key]()).default };
}

export interface SiteAppProps {
  prepared: PreparedPages;
  initialLanguage?: SiteLanguage;
  /** Published URL, excluding personal parameters. Applied only for the hydration render. */
  initialUrl?: string;
}

export default function SiteApp({
  prepared,
  initialLanguage,
  initialUrl,
}: SiteAppProps) {
  const location = useLocation();
  const [publishedUrl, setPublishedUrl] = useState(initialUrl);
  useEffect(() => {
    startTransition(() => setPublishedUrl(undefined));
  }, []);
  const {
    HomePage,
    ModulePage,
    SolutionsPage,
    PricingPage,
    MigrationPage,
    ComparePage,
    ResourcesPage,
    BaitlyResourcePage,
    BaitlyLegalPage,
    ProvidersPage,
    ProviderSignupPage,
    ProviderActivationPage,
    PrelaunchPage,
    LegalPage,
    StatusPage,
    ContactPage,
    NotFoundPage,
    DemoRoute,
    RegistrationRoute,
  } = { ...lazyPages, ...prepared };
  return (
    <SiteLanguageProvider initialLanguage={initialLanguage}>
      <SiteLaunchProvider>
        <Routes location={publishedUrl ?? location}>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/produit/:slug" element={<ModulePage />} />
            <Route path="/solutions" element={<SolutionsPage />} />
            <Route path="/tarifs" element={<PricingPage />} />
            <Route path="/migration" element={<MigrationPage />} />
            <Route path="/comparer" element={<ComparePage />} />
            <Route path="/ressources" element={<ResourcesPage />} />
            <Route
              path="/ressources/calculateur"
              element={<BaitlyResourcePage kind="calculateur" />}
            />
            <Route
              path="/ressources/barometre"
              element={<BaitlyResourcePage kind="barometre" />}
            />
            <Route
              path="/ressources/obligations"
              element={<BaitlyLegalPage kind="guide" />}
            />
            <Route
              path="/ressources/obligations/:country"
              element={<BaitlyLegalPage kind="guide" />}
            />
            <Route
              path="/ressources/academie"
              element={<BaitlyResourcePage kind="academie" />}
            />
            <Route
              path="/ressources/academie/:episode"
              element={<BaitlyResourcePage kind="academie" />}
            />
            <Route
              path="/ressources/blog"
              element={<BaitlyLegalPage kind="journal" />}
            />
            <Route
              path="/ressources/blog/:article"
              element={<BaitlyLegalPage kind="article" />}
            />
            <Route
              path="/ressources/glossaire"
              element={<BaitlyResourcePage kind="glossaire" />}
            />
            <Route path="/prestataires" element={<ProvidersPage />} />
            {/* Le parcours prestataire : candidature + dépôt de pièces sur la
  première, définition du mot de passe sur la seconde. */}
            <Route
              path="/prestataires/inscription"
              element={<ProviderSignupPage />}
            />
            <Route
              path="/prestataires/activation"
              element={<ProviderActivationPage />}
            />
            <Route path="/demo" element={<DemoRoute />} />
            <Route path="/bientot-disponible" element={<PrelaunchPage />} />
            <Route path="/pre-lancement" element={<PrelaunchPage />} />
            <Route path="/inscription" element={<RegistrationRoute />} />
            <Route path="/register" element={<RegistrationRoute />} />
            <Route path="/legal/:slug" element={<LegalPage />} />
            <Route path="/statut" element={<StatusPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </SiteLaunchProvider>
    </SiteLanguageProvider>
  );
}
