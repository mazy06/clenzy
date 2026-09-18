import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PagedMissionMap from '../PagedMissionMap';
import apiClient from '../../services/apiClient';
import { TooltipProvider } from '../ui';

vi.mock('../../services/apiClient', () => ({ default: { get: vi.fn() } }));
vi.mock('../../hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('../MapboxPropertyMap', () => ({ MapboxPropertyMap: ({ onBoundsChange }: any) =>
  <><button onClick={() => onBoundsChange({ north: 50, south: 40, east: 10, west: -10 })}>Initial zone</button>
    <button onClick={() => onBoundsChange({ north: 40, south: 30, east: 10, west: -10 })}>New zone</button></> }));

let intersect: IntersectionObserverCallback;
let root: Element | Document | null | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) { intersect = callback; root = options.root; }
    observe() {} disconnect() {} unobserve() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const filters = { search: '', type: 'all', status: 'all', priority: 'all' };
const pageCalls = () => vi.mocked(apiClient.get).mock.calls.filter(([url]) => url.endsWith('/page'));
function mount(kind: 'service-requests' | 'interventions') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={client}><TooltipProvider>
    <PagedMissionMap<{ id: number }> kind={kind} filters={filters}
      renderRow={row => <div key={row.id} data-testid="mission">{row.id}</div>} />
  </TooltipProvider></QueryClientProvider></MemoryRouter>);
}

describe.each(['service-requests', 'interventions'] as const)('Chargement progressif %s', kind => {
  it('charge 20 fiches, attend le bas de la liste, puis ajoute 20 et 5 sans doublons', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url, options) => {
      if (url.endsWith('/overview')) return { markers: [{ id: 1, name: 'Tours', lat: 47, lng: 1 }], total: 45, late: 3, today: 1, completed: 0 } as any;
      const page = Number(options?.params?.page);
      return { content: Array.from({ length: page === 2 ? 5 : 20 }, (_, index) => ({ id: page * 20 + index + 1 })),
        totalElements: 45, number: page, last: page === 2 } as any;
    });
    mount(kind);
    fireEvent.click(await screen.findByText('Initial zone'));
    await waitFor(() => expect(screen.getAllByTestId('mission')).toHaveLength(20));
    expect(pageCalls()).toHaveLength(1);
    expect(root).toBe(document.querySelector('[data-map-list-scroll]'));
    act(() => intersect([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
    await waitFor(() => expect(screen.getAllByTestId('mission')).toHaveLength(40));
    act(() => intersect([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
    await waitFor(() => expect(screen.getAllByTestId('mission')).toHaveLength(45));
    expect(pageCalls().map(([, options]) => options?.params?.page)).toEqual([0, 1, 2]);
    expect(screen.queryByText('Charger les 20 suivants')).toBeNull();
    fireEvent.click(screen.getByText('New zone'));
    await waitFor(() => expect(pageCalls()).toHaveLength(4));
    await waitFor(() => expect(screen.getAllByTestId('mission')).toHaveLength(20));
    expect(pageCalls()[3][1]?.params?.page).toBe(0);
  });

  it('préserve les lignes en cas d’erreur du lot suivant et permet de réessayer', async () => {
    let fail = true;
    vi.mocked(apiClient.get).mockImplementation(async (url, options) => {
      if (url.endsWith('/overview')) return { markers: [{ id: 1, name: 'Tours', lat: 47, lng: 1 }], total: 21, late: 0, today: 0, completed: 0 } as any;
      const page = Number(options?.params?.page);
      if (page === 1 && fail) { fail = false; throw new Error('Network'); }
      return { content: Array.from({ length: page === 0 ? 20 : 1 }, (_, index) => ({ id: page * 20 + index + 1 })), totalElements: 21, number: page, last: page === 1 } as any;
    });
    mount(kind);
    fireEvent.click(await screen.findByText('Initial zone'));
    await waitFor(() => expect(screen.getAllByTestId('mission')).toHaveLength(20));
    fireEvent.click(screen.getByText('Charger les 20 suivants'));
    await screen.findByRole('alert');
    expect(screen.getAllByTestId('mission')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/i }));
    await waitFor(() => expect(screen.getAllByTestId('mission')).toHaveLength(21));
    expect(pageCalls().map(([, options]) => options?.params?.page)).toEqual([0, 1, 1]);
  });
});
