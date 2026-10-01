import { lazy, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import SiteLayout from './components/SiteLayout';
import { SiteLanguageProvider } from './lib/siteLanguage';
import { SiteLaunchProvider } from './lib/siteLaunch';
import {
  DemoRoute,
  RegistrationRoute,
} from './components/AcquisitionRoutes';
import PrelaunchPage from './pages/PrelaunchPage';
import HomePage from './pages/HomePage';
import SolutionsPage from './pages/SolutionsPage';
import PricingPage from './pages/PricingPage';
import MigrationPage from './pages/MigrationPage';
import ComparePage from './pages/ComparePage';
import ResourcesPage from './pages/ResourcesPage';
import ProviderSignupPage from './pages/ProviderSignupPage';
import ProviderActivationPage from './pages/ProviderActivationPage';
import LegalPage from './pages/legal/LegalPage';
import StatusPage from './pages/StatusPage';
import ContactPage from './pages/ContactPage';
import NotFoundPage from './pages/NotFoundPage';

// Product projections are only needed after the visitor opens their route.
const ModulePage = lazy(() => import('./pages/ModulePage'));
const ProvidersPage = lazy(() => import('./pages/ProvidersPage'));
const BaitlyResourcePage = lazy(() => import('./pages/BaitlyResourcePage'));
const loadLegalPage = () => import('./pages/BaitlyLegalPage');
const LazyLegalPage = lazy(loadLegalPage);

async function mountSite() {
  // Keep the styled editorial HTML visible until its interactive route is ready.
  // A direct visit must not replace readable articles with a Suspense skeleton.
  const BaitlyLegalPage = /^\/ressources\/(blog|obligations)(\/|$)/.test(
    window.location.pathname,
  )
    ? (await loadLegalPage()).default
    : LazyLegalPage;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <SiteLanguageProvider>
          <SiteLaunchProvider>
            <Routes>
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
                <Route
                  path="/bientot-disponible"
                  element={<PrelaunchPage />}
                />
                <Route path="/pre-lancement" element={<PrelaunchPage />} />
                <Route
                  path="/inscription"
                  element={<RegistrationRoute />}
                />
                <Route path="/register" element={<RegistrationRoute />} />
                <Route path="/legal/:slug" element={<LegalPage />} />
                <Route path="/statut" element={<StatusPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </SiteLaunchProvider>
        </SiteLanguageProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

void mountSite();
