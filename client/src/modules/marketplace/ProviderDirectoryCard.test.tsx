import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProviderDirectoryCard from './ProviderDirectoryCard';
import type { ServiceCategoryDto } from '../../services/api/marketplaceProvidersApi';

afterEach(cleanup);

const categories = new Map<string, ServiceCategoryDto>([['CLEANING', {
  id: 1, code: 'CLEANING', labelFr: 'Ménage', labelEn: 'Cleaning', family: 'OPERATIONS',
  common: true, sortOrder: 1, items: [],
}]]);

it('preserves provider information and profile navigation in the shared card', () => {
  render(<MemoryRouter><Routes>
    <Route path="/" element={<ProviderDirectoryCard
      provider={{ displayName: 'Amina Services', headline: 'Entretien des logements', verified: true,
        categoryCodes: ['CLEANING'], ratingAvg: 4.8, ratingCount: 12, priceFrom: 45, currency: 'EUR' }}
      categoriesByCode={categories} to="/prestataires/42" metadata={<span>Lyon</span>} badges={<span>Disponible</span>} />} />
    <Route path="/prestataires/42" element={<h1>Fiche prestataire</h1>} />
  </Routes></MemoryRouter>);
  expect(screen.getByText('Ménage')).toBeInTheDocument();
  expect(screen.getByText('Lyon')).toBeInTheDocument();
  expect(screen.getByText('Disponible')).toBeInTheDocument();
  expect(screen.getByText(/4.8 · Avis : 12/)).toBeInTheDocument();
  expect(screen.getByText(/dès 45/)).toBeInTheDocument();
  expect(screen.getByLabelText('Professionnel vérifié')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Ouvrir la fiche de Amina Services' }));
  expect(screen.getByRole('heading', { name: 'Fiche prestataire' })).toBeInTheDocument();
});

it('keeps quote-only pricing and the absence of reviews explicit', () => {
  render(<MemoryRouter><ProviderDirectoryCard
    provider={{ displayName: 'Atelier Martin', verified: false, categoryCodes: [], ratingAvg: 0, ratingCount: 0 }}
    categoriesByCode={categories} to="/prestataires/43" /></MemoryRouter>);
  expect(screen.getByText('Sur devis')).toBeInTheDocument();
  expect(screen.getByText('Pas encore noté')).toBeInTheDocument();
  expect(screen.queryByLabelText('Professionnel vérifié')).not.toBeInTheDocument();
});
