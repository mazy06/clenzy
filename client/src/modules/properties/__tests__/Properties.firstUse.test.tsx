import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PropertiesPage from '../PropertiesPage';
import PropertiesEmptyShowcase, { type PropertyIntroduction } from '../PropertiesEmptyShowcase';
import i18n from '../../../i18n/config';

const state = vi.hoisted(() => ({ properties: [] as { id: string; status: string }[], isLoading: false, isError: false }));
vi.mock('../../../hooks/usePropertiesList', () => ({
  usePropertiesList: () => state,
  propertiesListKeys: { all: ['properties-list'] },
}));
vi.mock('../../../hooks/useScreenTabs', () => ({
  useScreenTabs: () => ['properties', 'pricing', 'vouchers'].map((key) => ({ key, label: key, hidden: false })),
}));
vi.mock('../../../components/PageHeader', () => ({ default: ({ title, actions, filters }: { title: string; actions: React.ReactNode; filters: React.ReactNode }) => <header><h1>{title}</h1>{actions}{filters}</header> }));
vi.mock('../../../components/PageTabs', () => ({ default: () => null }));
vi.mock('../PropertiesList', () => ({ default: () => <div data-testid="live-properties">Properties and filters</div> }));
vi.mock('../../pricing/DynamicPricing', () => ({ default: () => <div data-testid="live-pricing">Pricing and filters</div> }));
vi.mock('../../vouchers/VouchersPage', () => ({ default: () => <div data-testid="live-vouchers">Vouchers and filters</div> }));
vi.mock('../../connected-objects/ConnectedObjectsHub', () => ({ default: () => <div data-testid="live-connected-objects">Devices and filters</div> }));
vi.mock('../../settings/components/ChannexMappingDialog', () => ({ default: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="Import"><button onClick={onClose}>Close import</button></div> }));

const SCREENS = ['properties', 'vouchers', 'connected-objects'] as const;
const clients: QueryClient[] = [];
function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
function renderPage(tab: PropertyIntroduction) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const tree = <QueryClientProvider client={client}><MemoryRouter initialEntries={[`/properties?tab=${tab}`]}><PropertiesPage /><Location /></MemoryRouter></QueryClientProvider>;
  return { ...render(tree), client, tree };
}
function renderDemo(tab: PropertyIntroduction) { return render(<MemoryRouter><PropertiesEmptyShowcase screen={tab} onImport={vi.fn()} /></MemoryRouter>); }
beforeEach(async () => { state.properties = []; state.isLoading = false; state.isError = false; await i18n.changeLanguage('fr'); });
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Première visite des écrans Propriétés', () => {
  it('redirige l’ancien onglet objets connectés vers son espace dédié', () => {
    renderPage('connected-objects');
    expect(screen.getByTestId('location')).toHaveTextContent('/connected-objects');
  });
  it.each(SCREENS.filter(tab => tab !== 'connected-objects'))('%s : présente le module puis retrouve ses outils au premier logement, même inactif', (tab) => {
    const view = renderPage(tab);
    expect(screen.getByRole('heading', { name: i18n.t(`propertiesFirstUse.${tab}.title`) })).toBeVisible();
    expect(screen.queryByTestId(`live-${tab}`)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pause|Reprendre/ })).not.toBeInTheDocument();
    state.properties = [{ id: '1', status: 'inactive' }];
    view.rerender(<QueryClientProvider client={view.client}><MemoryRouter initialEntries={[`/properties?tab=${tab}`]}><PropertiesPage /><Location /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByTestId(`live-${tab}`)).toBeVisible();
    expect(screen.queryByRole('heading', { name: i18n.t(`propertiesFirstUse.${tab}.title`) })).not.toBeInTheDocument();
  });

  it('ne confond ni le chargement ni une erreur avec un portefeuille vide et propose de réessayer', () => {
    state.isLoading = true;
    const view = renderPage('properties');
    expect(screen.getByRole('status', { name: 'Chargement...' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ajouter un logement' })).not.toBeInTheDocument();
    state.isLoading = false; state.isError = true;
    view.rerender(<QueryClientProvider client={view.client}><MemoryRouter><PropertiesPage /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger vos logements');
    const invalidate = vi.spyOn(view.client, 'invalidateQueries');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['properties-list'] });
    expect(screen.queryByRole('button', { name: 'Ajouter un logement' })).not.toBeInTheDocument();
  });

  it('conserve les outils si le cache contient déjà un logement malgré une erreur de rafraîchissement', () => {
    state.properties = [{ id: '1', status: 'active' }]; state.isError = true;
    renderPage('vouchers');
    expect(screen.getByTestId('live-vouchers')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('relie les actions de démarrage au formulaire et au parcours d’import existants', () => {
    const view = renderPage('properties');
    const invalidate = vi.spyOn(view.client, 'invalidateQueries');
    fireEvent.click(screen.getByRole('button', { name: 'Importer depuis un canal' }));
    expect(screen.getByRole('dialog', { name: 'Import' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close import' }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['properties-list'] });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un logement' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/properties/new');
  });
});

describe('Démonstrations isolées du compte', () => {
  const railButtons = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLButtonElement>('.ns-rail-btn'));
  const roomImage = (container: HTMLElement) => container.querySelector('.ns-room-canvas > img')!.getAttribute('src');

  it('change la fiche lorsque l’on choisit un autre logement', () => {
    renderDemo('properties');
    fireEvent.click(screen.getByRole('button', { name: 'Villa des Oliviers' }));
    expect(screen.getByText('Villa des Oliviers', { selector: 'strong' })).toBeVisible();
    expect(screen.getByRole('img', { name: '6 voyageurs' })).toBeVisible();
    expect(screen.getByText('Marrakech')).toBeVisible();
  });
  it('reflète le prix essayé puis simule un envoi', () => {
    renderDemo('pricing');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '145' } });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '145\u00a0€');
    expect(screen.getByRole('button', { name: /145.*ajuster/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Simuler l’envoi' }));
    expect(screen.getByText('Envoi simulé, aucun tarif modifié')).toBeInTheDocument();
  });
  it('calcule la remise sans créer de code réel', () => {
    renderDemo('vouchers');
    fireEvent.click(screen.getByRole('button', { name: '20 %', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Tester le code' }));
    expect(screen.getByText(/240\s*€/)).toBeVisible();
    expect(screen.getByText(/−60\s*€/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Code appliqué' })).toBeDisabled();
  });
  it('ouvre la porte d’entrée avec la serrure, puis explore les vraies pièces', () => {
    const view = renderDemo('connected-objects');
    expect(roomImage(view.container)).toContain('baitly-entrance.webp');
    fireEvent.click(screen.getAllByRole('button', { name: 'Serrure connectée' })[0]);
    expect(roomImage(view.container)).toContain('baitly-entrance-door-open.webp');
    // Les sept pièces livrées restent explorables, avec leurs appareils.
    const rooms = within(screen.getByRole('group', { name: i18n.t('connectedObjects.title') }));
    for (const room of ['Entrée', 'Salon', 'Chambre', 'Cuisine', 'Salle de bain', 'Couloir', 'Extérieur']) {
      expect(rooms.getByRole('button', { name: room })).toBeVisible();
    }
    fireEvent.click(rooms.getByRole('button', { name: 'Chambre' }));
    expect(roomImage(view.container)).toContain('baitly-bedroom.webp');
    expect(screen.getAllByRole('button', { name: 'Détecteur de fumée' }).length).toBeGreaterThan(0);
    // Le capteur de la fenêtre ouvre la variante « fenêtre ouverte » de la pièce.
    fireEvent.click(screen.getAllByRole('button', { name: 'Capteur porte et fenêtre' })[1]);
    expect(roomImage(view.container)).toContain('baitly-bedroom-window-open.webp');
  });
  it('anime les scènes puis laisse la lecture au visiteur dès une interaction', () => {
    vi.useFakeTimers(); renderDemo('pricing');
    act(() => vi.advanceTimersByTime(5600));
    expect(screen.getByRole('button', { name: /Ajustements/ })).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: /Minimum/ }));
    act(() => vi.advanceTimersByTime(13000));
    expect(screen.getByRole('button', { name: /Minimum/ })).toHaveAttribute('aria-current', 'step');
  });
  it('respecte les préférences de mouvement réduit', () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: true, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    renderDemo('properties'); act(() => vi.advanceTimersByTime(13000));
    expect(screen.getByRole('button', { name: /Fiche/ })).toHaveAttribute('aria-current', 'step');
  });
  it('porte chaque étape du rail par une illustration, et les objets connectés par leurs pièces', () => {
    for (const tab of SCREENS) {
      const view = renderDemo(tab);
      const images = Array.from(view.container.querySelectorAll('.ns-rail-btn img')).map((image) => image.getAttribute('src'));
      expect(images).toHaveLength(4);
      if (tab === 'connected-objects') expect(images.every((src) => /connected-rooms\/baitly-\w+-thumb\.webp$/.test(src ?? ''))).toBe(true);
      view.unmount();
    }
  });
  it.each(['fr', 'en', 'ar'])('traduit les quatre présentations en %s', async (language) => {
    await i18n.changeLanguage(language);
    for (const tab of SCREENS) {
      const view = renderDemo(tab);
      expect(screen.getByRole('heading', { name: i18n.t(`propertiesFirstUse.${tab}.title`) })).toBeVisible();
      for (const button of railButtons(view.container)) {
        expect(button.textContent?.trim().length).toBeGreaterThan(0);
        fireEvent.click(button);
      }
      expect(view.container.textContent).not.toMatch(/propertiesFirstUse\.|propertiesPage\.tabs\.|connectedRooms\.|connectedObjects\./);
      view.unmount();
    }
  });
});
