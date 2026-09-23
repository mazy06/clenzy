import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    expect(await screen.findByText(i18n.t('moduleFirstUse.example'))).toBeVisible();
    expect(screen.queryByTestId('live')).not.toBeInTheDocument();
    state.properties = [{ id: '1' }];
    view.rerender(<QueryClientProvider client={view.client}><MemoryRouter><ModuleFirstUsePage module={module}><div data-testid="live">Live tools</div></ModuleFirstUsePage></MemoryRouter></QueryClientProvider>);
    expect(screen.getByTestId('live')).toBeVisible();
  });

  it('ne présente pas un chargement ou une erreur comme un compte vide', async () => {
    state.isLoading = true;
    const view = renderEntry('reservations');
    expect(screen.getByRole('status', { name: i18n.t('common.loading') })).toBeVisible();
    expect(screen.queryByText(i18n.t('moduleFirstUse.example'))).not.toBeInTheDocument();
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
  it.each(['fr', 'en', 'ar'])('traduit les 24 présentations et leurs trois étapes en %s', async (language) => {
    await i18n.changeLanguage(language);
    for (const [module, definition] of Object.entries(FIRST_USE_MODULES)) {
      for (const tab of definition.screens) {
        const prefix = `moduleFirstUse.screens.${module}.${tab}`;
        const view = renderShowcase(module as FirstUseModule, tab);
        expect(screen.getByRole('heading', { name: i18n.t(`${prefix}.title`) })).toBeVisible();
        for (const step of [0, 1, 2]) {
          const button = screen.getAllByRole('button').find((item) => item.hasAttribute('aria-expanded') && item.textContent?.includes(i18n.t(`${prefix}.steps.${step}.title`)))!;
          fireEvent.click(button);
          expect(screen.getByText(i18n.t(`${prefix}.steps.${step}.detail`))).toBeVisible();
        }
        expect(view.container.textContent).not.toMatch(/moduleFirstUse\.|propertiesFirstUse\./);
        view.unmount();
      }
    }
  });

  it('simule une réponse sans envoyer de message réel', () => {
    renderShowcase('messaging', 'messaging');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('moduleFirstUse.demo.send') }));
    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('moduleFirstUse.demo.simulated'));
    expect(screen.getByText(i18n.t('moduleFirstUse.demo.messageSent'))).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('moduleFirstUse.demo.reset') }));
    expect(screen.queryByText(i18n.t('moduleFirstUse.demo.messageSent'))).not.toBeInTheDocument();
  });

  it('distingue les échanges d’équipe et les formulaires de maintenance', () => {
    renderShowcase('messaging', 'messaging');
    fireEvent.click(screen.getByRole('button', { name: 'Équipe', exact: true }));
    expect(screen.getByText(i18n.t('moduleFirstUse.demo.teamIn'))).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('moduleFirstUse.demo.send') }));
    fireEvent.click(screen.getByRole('button', { name: 'Formulaires', exact: true }));
    expect(screen.getByText(i18n.t('moduleFirstUse.demo.formBody'))).toBeVisible();
    expect(screen.queryByText(i18n.t('moduleFirstUse.demo.formDone'))).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('moduleFirstUse.demo.advance') }));
    expect(screen.getByText(i18n.t('moduleFirstUse.demo.formDone'))).toBeVisible();
  });

  it('anime les étapes puis laisse la main dès une interaction', () => {
    vi.useFakeTimers(); renderShowcase('reservations', 'reservations');
    act(() => vi.advanceTimersByTime(6500));
    expect(screen.getByRole('button', { expanded: true })).toHaveTextContent('Préparer l’accueil');
    fireEvent.click(screen.getByRole('button', { name: /Retrouver un séjour/ }));
    act(() => vi.advanceTimersByTime(13000));
    expect(screen.getByRole('button', { expanded: true })).toHaveTextContent('Retrouver un séjour');
    expect(screen.queryByRole('button', { name: /Pause|Reprendre/ })).not.toBeInTheDocument();
  });

  it('respecte le mouvement réduit et permet encore les interactions', () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: true, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    renderShowcase('reports', 'occupancy');
    act(() => vi.advanceTimersByTime(13000));
    expect(screen.getByRole('button', { expanded: true })).toHaveTextContent('Lire le remplissage');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('moduleFirstUse.demo.comparePeriod') }));
    expect(screen.getByText(i18n.t('moduleFirstUse.demo.occupied', { count: 21 }))).toBeVisible();
  });
});
