import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModuleFirstUsePage from '../ModuleFirstUsePage';
import ModuleFirstUseShowcase from '../ModuleFirstUseShowcase';
import { FIRST_USE_MODULES, type FirstUseModule } from '../catalog';
import i18n from '../../../i18n/config';

const state = vi.hoisted(() => ({
  properties: [] as { id: string }[], isLoading: false, isError: false,
  user: { roles: ['SUPER_ADMIN'], permissions: ['reports:view', 'payments:manage', 'interventions:view', 'service-requests:view'], platformRole: 'SUPER_ADMIN' },
}));
vi.mock('../../../hooks/usePropertiesList', () => ({ usePropertiesList: () => state, propertiesListKeys: { all: ['properties-list'] } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: state.user, hasAnyRole: (roles: string[]) => roles.some((role) => state.user.roles.includes(role)) }) }));
vi.mock('../../PageHeader', () => ({ default: ({ title }: { title: string }) => <header><h1>{title}</h1></header> }));
vi.mock('../../PageTabs', () => ({ default: ({ options, value, onChange }: { options: { key: string; label: string; hidden?: boolean }[]; value: number; onChange: (value: number) => void }) => <nav>{options.filter((option) => !option.hidden).map((option, index) => <button key={option.key} aria-current={value === index || undefined} onClick={() => onChange(index)}>{option.label}</button>)}</nav> }));
vi.mock('../../../modules/settings/components/ChannexMappingDialog', () => ({ default: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="Import"><button onClick={onClose}>Close import</button></div> }));

const clients: QueryClient[] = [];
function Location() { return <output data-testid="location">{useLocation().pathname + useLocation().search}</output>; }
function renderEntry(module: FirstUseModule, path = FIRST_USE_MODULES[module].path, props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const tree = <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><ModuleFirstUsePage module={module} {...props}><div data-testid="live">Live tools</div></ModuleFirstUsePage><Location /></MemoryRouter></QueryClientProvider>;
  return { ...render(tree), client, tree };
}
function renderShowcase(module: FirstUseModule, tab: string) {
  const client = new QueryClient(); clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter><ModuleFirstUseShowcase module={module} screen={tab} title={tab} onOpenWorkspace={vi.fn()} /></MemoryRouter></QueryClientProvider>);
}

beforeEach(async () => {
  state.properties = []; state.isLoading = false; state.isError = false;
  state.user = { roles: ['SUPER_ADMIN'], permissions: ['reports:view', 'payments:manage', 'interventions:view', 'service-requests:view'], platformRole: 'SUPER_ADMIN' };
  await i18n.changeLanguage('fr');
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Initialisation des espaces Baitly', () => {
  it.each(Object.keys(FIRST_USE_MODULES) as FirstUseModule[])('%s retrouve ses outils dès le premier logement', async (module) => {
    const view = renderEntry(module);
    expect(await screen.findByRole('heading', { level: 2 })).toBeVisible();
    expect(screen.queryByTestId('live')).not.toBeInTheDocument();
    state.properties = [{ id: '1' }];
    view.rerender(<QueryClientProvider client={view.client}><MemoryRouter><ModuleFirstUsePage module={module}><div data-testid="live">Live tools</div></ModuleFirstUsePage></MemoryRouter></QueryClientProvider>);
    expect(screen.getByTestId('live')).toBeVisible();
  });

  it('ne présente pas un chargement ou une erreur comme un compte vide', async () => {
    state.isLoading = true;
    const view = renderEntry('reservations');
    expect(screen.getByRole('status', { name: i18n.t('common.loading') })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    view.unmount(); state.isLoading = false; state.isError = true;
    const errorView = renderEntry('reservations');
    expect(screen.getByRole('alert')).toBeVisible();
    const invalidate = vi.spyOn(errorView.client, 'invalidateQueries');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.retry') }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['properties-list'] });
  });

  it('conserve les données existantes et les profils terrain', () => {
    const view = renderEntry('messaging', '/contact', { hasContent: true });
    expect(screen.getByTestId('live')).toBeVisible(); view.unmount();
    state.user.roles = ['TECHNICIAN'];
    renderEntry('interventions');
    expect(screen.getByTestId('live')).toBeVisible();
  });

  it('reste accessible sans logement et conserve les clés des onglets autorisés', async () => {
    state.user = { roles: ['HOST'], permissions: ['reports:view'], platformRole: 'HOST' };
    renderEntry('billing', '/billing?tab=invoices');
    expect(await screen.findByRole('heading', { name: i18n.t('moduleFirstUse.screens.billing.invoices.title') })).toBeVisible();
    expect(screen.queryByRole('button', { name: i18n.t('billing.tabs.payouts') })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('billing.tabs.payments') }));
    expect(await screen.findByRole('heading', { name: i18n.t('moduleFirstUse.screens.billing.payments.title') })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('moduleFirstUse.openWorkspace') }));
    expect(screen.getByTestId('live')).toBeVisible();
  });

  it('ouvre le vrai parcours de création ou d’import', async () => {
    const view = renderEntry('reports');
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('propertiesFirstUse.import') }));
    expect(await screen.findByRole('dialog', { name: 'Import' })).toBeVisible();
    const invalidate = vi.spyOn(view.client, 'invalidateQueries');
    fireEvent.click(screen.getByRole('button', { name: 'Close import' }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['properties-list'] });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('propertiesFirstUse.add') }));
    expect(screen.getByTestId('location')).toHaveTextContent('/properties/new');
  });
});

describe('Aperçus pédagogiques', () => {
  const railButtons = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLButtonElement>('.ns-rail-btn'));

  it.each(['fr', 'en', 'ar'])('traduit les 24 présentations et leurs trois étapes en %s', async (language) => {
    await i18n.changeLanguage(language);
    for (const [module, definition] of Object.entries(FIRST_USE_MODULES)) {
      for (const tab of definition.screens) {
        const prefix = `moduleFirstUse.screens.${module}.${tab}`;
        const view = renderShowcase(module as FirstUseModule, tab);
        expect(screen.getByRole('heading', { name: i18n.t(`${prefix}.title`) })).toBeVisible();
        const steps = railButtons(view.container);
        expect(steps).toHaveLength(3);
        steps.forEach((button, step) => {
          expect(button).toHaveTextContent(i18n.t(`${prefix}.steps.${step}`));
          fireEvent.click(button);
          expect(button).toHaveAttribute('aria-current', 'step');
        });
        expect(view.container.textContent).not.toMatch(/moduleFirstUse\.|propertiesFirstUse\./);
        view.unmount();
      }
    }
  });

  it('montre un schéma et des illustrations plutôt que des paragraphes', () => {
    const view = renderShowcase('reservations', 'reservations');
    // Chaque étape du rail porte une illustration générée, décorative.
    const images = Array.from(view.container.querySelectorAll('.ns-rail-btn img'));
    expect(images).toHaveLength(3);
    images.forEach((image) => expect(image.getAttribute('src')).toMatch(/^\/images\/.+\.webp$/));
    // La scène est un îlot bleu nuit, et l'écran ne porte plus de bloc de texte long.
    expect(view.container.querySelector('.ns')).not.toBeNull();
    const paragraphs = Array.from(view.container.querySelectorAll('p')).map((node) => node.textContent ?? '');
    expect(paragraphs.every((text) => text.length < 80)).toBe(true);
  });

  it('suit la frise d’un séjour étape par étape', () => {
    renderShowcase('reservations', 'reservations');
    const stay = screen.getByRole('button', { name: new RegExp(i18n.t('moduleFirstUse.screens.reservations.reservations.labels.1')) });
    fireEvent.click(stay);
    expect(stay).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Accueillir/ })).toHaveAttribute('aria-current', 'step');
  });

  it('distingue les échanges voyageurs, équipe et formulaires sans rien envoyer', () => {
    renderShowcase('messaging', 'messaging');
    const tabs = within(screen.getByRole('group', { name: i18n.t('moduleFirstUse.demo.channels') }));
    for (const label of ['Équipe', 'Formulaires', 'Voyageurs']) {
      const tab = tabs.getByRole('button', { name: label });
      fireEvent.click(tab);
      expect(tab).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('anime les étapes puis laisse la main dès une interaction', () => {
    vi.useFakeTimers(); renderShowcase('reservations', 'reservations');
    act(() => vi.advanceTimersByTime(5600));
    expect(screen.getByRole('button', { name: /Accueillir/ })).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: /Retrouver/ }));
    act(() => vi.advanceTimersByTime(13000));
    expect(screen.getByRole('button', { name: /Retrouver/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByRole('button', { name: /Pause|Reprendre/ })).not.toBeInTheDocument();
  });

  it('respecte le mouvement réduit et permet encore les interactions', () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: true, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    renderShowcase('reports', 'occupancy');
    act(() => vi.advanceTimersByTime(13000));
    expect(screen.getByRole('button', { name: /Remplissage/ })).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('moduleFirstUse.demo.comparePeriod') }));
    expect(screen.getByRole('img', { name: i18n.t('moduleFirstUse.demo.occupied', { count: 21 }) })).toBeVisible();
  });
});
