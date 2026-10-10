import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import BaitlyPaidServiceDetail from './BaitlyPaidServiceDetail';
import type { UpsellOffer } from '../../services/api/upsellApi';
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, organizationId: 1 } }) }));
vi.mock('../../components/Money', () => ({ Money: ({value}:{value:number}) => <span>{value} €</span> }));
vi.mock('../../hooks/useMarketplaceProperties', () => ({ useMarketplaceProperties: () => ({ data: [{ id: 7, name: 'Villa Atlas', city: 'Marrakech' }] }) }));
vi.mock('../../services/api/upsellFulfillmentApi', () => ({ upsellFulfillmentApi: {
  get: async () => ({ serviceItemCode: 'cleaning-turnover', overrideCode: null, preferredProviderId: null, preferredProvider: null }),
  providers: async () => ({ page: { totalElements: 4, size: 12, totalPages: 1, items: ['Amina Cherif','Salma Chraibi','Youssef Ait Taleb','Naima Bennani'].map((name,index) => ({
    id: index + 1, displayName: name, baseCity: 'Marrakech', coverageCities: ['Marrakech'], categoryCodes: ['CLEANING'], own: index === 1,
    offers: [{ id: index + 1, serviceItemCode: 'cleaning-turnover', label: 'Ménage entre deux séjours', amount: 35, currency: 'EUR', pricingModel: 'HOURLY' }],
  })) }, availability: {} }),
} }));
it('keeps management actions available while providers are compared', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['service-reference'], [{ code: 'cleaning-turnover', labelFr: 'Ménage entre deux séjours', labelEn: 'Turnover cleaning', legacyType: 'CLEANING', categoryCode: 'CLEANING' }]);
  const offer = { id: 11, title: 'Ménage supplémentaire', type: 'CLEANING', price: 60, currency: 'EUR',
    propertyId: 7, description: 'Idéal pour les séjours prolongés.', active: true, diffuseOnLivret: true, diffuseOnBooking: true } as UpsellOffer;
  const onBack = vi.fn(), onEdit = vi.fn(), onPreview = vi.fn(), onChannel = vi.fn();
  render(<QueryClientProvider client={client}><MemoryRouter><BaitlyPaidServiceDetail
    offer={offer} image="/images/catalog/cleaning.webp" category="Ménage" property="Villa Atlas | Marrakech"
    performance={{count:3,revenue:180}} busy={false} onBack={onBack} onEdit={onEdit} onPreview={onPreview} onChannel={onChannel} />
  </MemoryRouter></QueryClientProvider>);
  await screen.findByText('Amina Cherif');
  expect(screen.getByText('Villa Atlas | Marrakech', { selector: 'strong' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
  fireEvent.click(screen.getByText('Diffusion, conditions et résultats'));
  fireEvent.click(screen.getByRole('switch', { name: "Livret d'accueil" }));
  expect(onPreview).toHaveBeenCalledOnce();
  expect(onEdit).toHaveBeenCalledOnce();
  expect(onChannel).toHaveBeenCalledWith('livret', false);
  fireEvent.click(screen.getByRole('button', { name: 'Services payants' }));
  expect(onBack).toHaveBeenCalledOnce();
});
