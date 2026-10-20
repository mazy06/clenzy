import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import StudioHome from './StudioHome';
import { bookingEngineApi } from '../../../services/api/bookingEngineApi';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', async (original) => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => mocks.navigate }));
vi.mock('../../../services/api/bookingEngineApi', () => ({ bookingEngineApi: { listConfigs: vi.fn().mockResolvedValue([{ id: 7, name: 'Mon moteur', enabled: true, primaryColor: '#4A9B8E' }]), createConfig: vi.fn().mockResolvedValue({ id: 8 }) } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { firstName: 'Admin' } }) }));
vi.mock('../../../hooks/useAi', () => ({ useAiFeatureToggles: () => ({ data: [] }) }));
vi.mock('../../../hooks/usePropertiesList', () => ({ usePropertiesList: () => ({ properties: [{ id: '42', name: 'Villa Atlas', city: 'Marrakech', imageUrl: '/villa.jpg', photoUrls: ['/villa.jpg'] }, { id: '43', name: 'Riad Jardin', city: 'Fès', photoUrls: ['/riad.jpg'] }] }) }));
vi.mock('../../../hooks/useUserPreference', () => ({ useUserPreference: () => ['grid', vi.fn()] }));
vi.mock('../../../components/PageHeaderActionsContext', () => ({ usePageHeaderActions: () => null }));

describe('Booking Engine home workspace', () => {
  it.each([
    ['Recherche catalogue', 'Atlas Collection', 'catalogue', 'baitly-atlas'],
    ['Panier multi-séjours', 'Itinérance', 'cart', 'baitly-itinerance'],
  ])('saves all selected properties for %s', async (journey, template, funnelId, templateId) => {
    render(<MemoryRouter><StudioHome embedded /></MemoryRouter>);
    await screen.findByText('Mon moteur');
    fireEvent.click(screen.getByRole('button', { name: journey, exact: true }));
    fireEvent.keyDown(screen.getByRole('button', { name: /LogementVilla Atlas/ }), { key: 'Enter' });
    const additional = await screen.findByRole('menuitemcheckbox', { name: /Riad Jardin/ });
    fireEvent.click(additional);
    expect(additional).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.getByRole('button', { name: /Logement2 logements/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: template, exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser ce moteur' }));
    await waitFor(() => expect(bookingEngineApi.createConfig).toHaveBeenCalledWith(expect.objectContaining({ featuredPropertyIds: '[42,43]', dataSourceMode: 'REAL' })));
    expect(mocks.navigate).toHaveBeenCalledWith('/booking-engine/studio/8', { state: { templateId, funnelId, propertyId: '42', propertyIds: ['42', '43'] } });
  });
  it('shows saved engines before full-width choices and saves the selected property and theme', async () => {
    render(<MemoryRouter><StudioHome embedded /></MemoryRouter>);
    await screen.findByText('Mon moteur');
    const library = screen.getByRole('heading', { name: 'Mes booking engines' });
    const select = screen.getByRole('button', { name: /LogementVilla Atlas/ });
    expect(library.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(select.compareDocumentPosition(screen.getByRole('heading', { name: /Le parcours de réservation/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Quel booking engine créons-nous ?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Logement unique', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Patio', exact: true }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Aperçu voyageur' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Patio', exact: true })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser ce moteur' }));
    await waitFor(() => expect(bookingEngineApi.createConfig).toHaveBeenCalledWith(expect.objectContaining({ featuredPropertyIds: '[42]', designCssVariables: expect.any(String), primaryColor: '#4e5e39', componentConfig: expect.stringContaining('"sourceId":"baitly-patio"') })));
    expect(mocks.navigate).toHaveBeenCalledWith('/booking-engine/studio/8', { state: { templateId: 'baitly-patio', funnelId: 'single', propertyId: '42' } });
  });

  it('requires a journey and preserves the blank-page route', () => {
    render(<MemoryRouter><StudioHome embedded /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser ce moteur' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choisir un parcours');
    fireEvent.click(screen.getByRole('button', { name: 'Demande de devis', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: /Partir d'une page vierge/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/booking-engine/design-systems/new', { state: { flow: 'blank', funnelId: 'inquiry' } });
  });
});
