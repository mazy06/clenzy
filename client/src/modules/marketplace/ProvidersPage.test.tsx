import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProvidersPage, { LegacyProvidersRedirect } from './ProvidersPage';

const auth = vi.hoisted(() => ({ roles: [] as string[] }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ hasAnyRole: (roles: string[]) => roles.some(role => auth.roles.includes(role)) }) }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../components/PageHeader', () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('../../components/PageTabs', () => ({ default: ({ options, onChange }: { options: { value: string; label: string }[]; onChange: (value: string) => void }) => <nav>{options.map(option => <button key={option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</nav> }));
vi.mock('./MarketplaceProvidersPage', () => ({ default: () => <p>Management API mounted</p> }));
vi.mock('../provider-catalog/ProviderCatalogPage', () => ({ default: () => <p>Catalog API mounted</p> }));
function Location() { const location = useLocation(); return <output>{location.pathname + location.search}</output>; }
function setup(url = '/prestataires') {
  return render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/prestataires" element={<ProvidersPage />} />
    <Route path="/marketplace/providers" element={<LegacyProvidersRedirect />} />
  </Routes><Location /></MemoryRouter>);
}
describe('Providers directory access', () => {
  beforeEach(() => { auth.roles = []; });
  it.each(['HOST', 'TECHNICIAN', 'HOUSEKEEPER', 'SUPERVISOR'])('does not mount management for %s even with a crafted URL', async role => {
    auth.roles = [role]; setup('/prestataires?view=management');
    expect(await screen.findByText('Catalog API mounted')).toBeInTheDocument();
    expect(screen.queryByText('Management API mounted')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
  it.each(['SUPER_ADMIN', 'SUPER_MANAGER'])('lets %s switch without mounting both data sources', async role => {
    auth.roles = [role]; setup();
    expect(await screen.findByText('Management API mounted')).toBeInTheDocument();
    expect(screen.queryByText('Catalog API mounted')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('providerDirectory.catalog'));
    expect(await screen.findByText('Catalog API mounted')).toBeInTheDocument();
    expect(screen.queryByText('Management API mounted')).not.toBeInTheDocument();
    expect(screen.getByText('/prestataires?view=catalog')).toBeInTheDocument();
  });
  it('preserves quote replacement context through the legacy URL', async () => {
    auth.roles = ['SUPER_ADMIN']; setup('/marketplace/providers?replaceQuoteId=42&propertyId=7');
    expect(await screen.findByText('Catalog API mounted')).toBeInTheDocument();
    expect(screen.getByText('/prestataires?replaceQuoteId=42&propertyId=7')).toBeInTheDocument();
  });
});
