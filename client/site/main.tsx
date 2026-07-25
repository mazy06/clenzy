import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import '../src/theme/baitly-ui.css';
import './site.css';
import SiteLayout from './components/SiteLayout';
import HomePage from './pages/HomePage';
import ModulePage from './pages/ModulePage';
import SolutionsPage from './pages/SolutionsPage';
import PricingPage from './pages/PricingPage';
import MigrationPage from './pages/MigrationPage';
import ComparePage from './pages/ComparePage';
import ResourcesPage from './pages/ResourcesPage';
import ProvidersPage from './pages/ProvidersPage';
import DemoPage from './pages/DemoPage';
import LegalPage from './pages/legal/LegalPage';
import StatusPage from './pages/StatusPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/produit/:slug" element={<ModulePage />} />
          <Route path="/solutions" element={<SolutionsPage />} />
          <Route path="/tarifs" element={<PricingPage />} />
          <Route path="/migration" element={<MigrationPage />} />
          <Route path="/comparer" element={<ComparePage />} />
          <Route path="/ressources" element={<ResourcesPage />} />
          <Route path="/prestataires" element={<ProvidersPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/legal/:slug" element={<LegalPage />} />
          <Route path="/statut" element={<StatusPage />} />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
