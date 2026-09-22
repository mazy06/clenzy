import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../Dashboard';

const state = vi.hoisted(() => ({
  role: 'HOST',
  stats: null as null | { properties: { total: number; active: number; growth: number } },
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { roles: [state.role] },
    hasAnyRole: (roles: string[]) => roles.includes(state.role),
  }),
}));
vi.mock('../../../hooks/useDashboardOverview', () => ({
  useDashboardOverview: () => ({
    stats: state.stats, loading: state.loading, error: state.error, refreshAll: state.refresh,
  }),
}));
vi.mock('../../../hooks/useDashboardOperations', () => ({ useDashboardActionItems: () => ({ data: undefined }) }));
vi.mock('../../../components/PageHeader', () => ({
  default: ({ title, actions }: { title: string; actions: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header>,
}));
vi.mock('../DashboardOverview', () => ({
  default: () => <div data-testid="live-widgets">Live widgets</div>,
  OverviewSkeleton: () => <div role="status">Loading dashboard</div>,
}));
vi.mock('../UpgradeBanner', () => ({ default: () => null }));
vi.mock('../../settings/components/ChannexMappingDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => open
    ? <div role="dialog" aria-label="Connect channels"><button onClick={onClose}>Close connection</button></div>
    : null,
}));

function renderDashboard() {
  return render(<MemoryRouter><Dashboard /></MemoryRouter>);
}

beforeEach(() => {
  state.role = 'HOST';
  state.stats = { properties: { total: 0, active: 0, growth: 0 } };
  state.loading = false;
  state.error = null;
  state.refresh.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Première visite du tableau de bord', () => {
  it('présente le démarrage sans monter les widgets ni leurs commandes', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Votre activité, lisible en un coup d’œil' })).toBeVisible();
    expect(screen.queryByTestId('live-widgets')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réservation', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('30j')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pause|Reprendre/ })).not.toBeInTheDocument();
  });

  it('attend le portefeuille et ne confond pas une erreur avec un compte vide', () => {
    state.stats = null;
    state.loading = true;
    const view = renderDashboard();
    expect(screen.getByRole('status')).toHaveTextContent('Loading dashboard');
    expect(screen.queryByRole('heading', { name: 'Votre activité, lisible en un coup d’œil' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('live-widgets')).not.toBeInTheDocument();

    state.loading = false;
    state.error = 'Impossible de charger le tableau de bord';
    view.rerender(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent(state.error);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(state.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('live-widgets')).not.toBeInTheDocument();
  });

  it('affiche les vrais widgets dès le premier logement, même sans activité ni canal', () => {
    const view = renderDashboard();
    state.stats = { properties: { total: 1, active: 0, growth: 0 } };
    view.rerender(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(screen.getByTestId('live-widgets')).toBeVisible();
    expect(screen.getByRole('button', { name: /Réservation/ })).toBeVisible();
    expect(screen.getByText('30j')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Votre activité, lisible en un coup d’œil' })).not.toBeInTheDocument();
  });

  it('préserve la vue des intervenants qui ne possèdent pas de logements', () => {
    state.role = 'HOUSEKEEPER';
    renderDashboard();
    expect(screen.getByTestId('live-widgets')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ajouter un logement' })).not.toBeInTheDocument();
  });

  it('ouvre la connexion guidée et actualise le portefeuille à son retour', () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Connecter mes canaux' }));
    expect(screen.getByRole('dialog', { name: 'Connect channels' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close connection' }));
    expect(state.refresh).toHaveBeenCalledOnce();
  });

  it('permet de traiter une priorité et ajouter un widget dans la démonstration seulement', () => {
    renderDashboard();
    const demo = screen.getByRole('group', { name: /Démonstration interactive/ });
    fireEvent.click(within(demo).getByRole('button', { name: 'Essayer' }));
    expect(within(demo).getByText('Ménage attribué dans l’exemple')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Composer une vue/ }));
    fireEvent.click(within(demo).getByRole('button', { name: 'Ajouter l’occupation' }));
    expect(within(demo).getByText('Occupation des logements')).toBeVisible();
    expect(state.refresh).not.toHaveBeenCalled();
    expect(screen.queryByTestId('live-widgets')).not.toBeInTheDocument();
  });

  it('anime automatiquement puis laisse la main au clic sur une étape', () => {
    vi.useFakeTimers();
    renderDashboard();
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByRole('button', { name: /Comprendre vos résultats/ })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Préparer la journée/ }));
    act(() => vi.advanceTimersByTime(12000));
    expect(screen.getByRole('button', { name: /Préparer la journée/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('garde une démonstration manuelle lorsque les animations sont réduites', () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'), media: query,
      onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    renderDashboard();
    act(() => vi.advanceTimersByTime(12000));
    expect(screen.getByRole('button', { name: /Préparer la journée/ })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Comprendre vos résultats/ }));
    expect(screen.getByRole('button', { name: /Comprendre vos résultats/ })).toHaveAttribute('aria-expanded', 'true');
  });
});
