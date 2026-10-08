import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { PageHeaderActionsProvider, usePageHeaderFiltersSlot } from '../../../components/PageHeaderActionsContext';
import FinanceWorkspace from './FinanceWorkspace';
import FinanceHeaderFilters from './FinanceHeaderFilters';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function measuredViewport() {
  let height = 800;
  vi.spyOn(window, 'innerHeight', 'get').mockImplementation(() => height);
  vi.stubGlobal('visualViewport', undefined);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { top: this.classList.contains('finance-workspace') ? 150 : 0, bottom: 0, height: 0, width: 800, left: 0, right: 800, x: 0, y: 0, toJSON() {} };
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('finance-workspace__list') ? parseFloat(this.parentElement?.style.height || '0') : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.tagName === 'LI' ? 63 : 56;
  });
  return async (next: number) => {
    height = next;
    await act(async () => fireEvent(window, new Event('resize')));
    await act(async () => fireEvent(window, new Event('resize')));
  };
}

const records = Array.from({ length: 30 }, (_, i) => ({ id: i, title: `Facture ${i}`, amount: `${i + 1} €`, fields: [{ label: 'Client', value: `Client ${i}` }] }));

it('affiche la page de la facture ciblée par une notification', async () => {
  measuredViewport();
  render(<FinanceWorkspace items={records} highlightId="27" />);
  await waitFor(() => expect(screen.getByText('28-30 sur 30')).toBeVisible());
  expect(screen.getByRole('button', { name: 'Facture 27 28 €' })).toBeVisible();
});

it('adapte la pagination à la hauteur et conserve le dossier sélectionné sur sa nouvelle page', async () => {
  const resize = measuredViewport();
  const view = render(<FinanceWorkspace items={records} />);
  const rows = () => view.container.querySelectorAll('.finance-workspace__list > ul > li');
  await waitFor(() => expect(rows()).toHaveLength(9));
  fireEvent.click(screen.getByRole('link', { name: 'Go to next page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Facture 17 18 €' }));
  await resize(600);
  await waitFor(() => expect(rows()).toHaveLength(6));
  expect(screen.getByRole('button', { name: 'Facture 17 18 €' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('13-18 sur 30')).toBeVisible();
  expect(within(screen.getByRole('region', { name: 'Détails' })).getByText('Client 17')).toBeVisible();
  view.rerender(<FinanceWorkspace items={records.slice(0, 2)} />);
  expect(screen.getByText('1-2 sur 2')).toBeVisible();
  expect(screen.queryByText('Client 17')).not.toBeInTheDocument();
});

function HeaderHarness({ children }: { children: ReactNode }) {
  const { filtersSlot, filtersContainer } = usePageHeaderFiltersSlot();
  return <PageHeaderActionsProvider slot={null} filtersSlot={filtersSlot}>
    <header data-testid="header">{filtersContainer}</header><main>{children}</main>
  </PageHeaderActionsProvider>;
}

function FilteredList() {
  const [filter, setFilter] = useState('');
  return <><FinanceHeaderFilters><label>Statut<select value={filter} onChange={e => setFilter(e.target.value)}>
    <option value="">Tous</option><option value="overdue">En retard</option>
  </select></label></FinanceHeaderFilters><FinanceWorkspace items={filter ? records.slice(0, 2) : records} /></>;
}

it('ne remet pas les filtres dans le contenu quand le menu du header compact est fermé', () => {
  render(<PageHeaderActionsProvider slot={null} filtersSlot={null}>
    <FinanceHeaderFilters><label>Statut<select><option>Tous</option></select></label></FinanceHeaderFilters>
  </PageHeaderActionsProvider>);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

it('porte les filtres dans le header et garde une pagination valide après filtrage depuis une autre page', async () => {
  measuredViewport();
  const view = render(<HeaderHarness><FilteredList /></HeaderHarness>);
  const header = within(screen.getByTestId('header'));
  await waitFor(() => expect(view.container.querySelectorAll('.finance-workspace__list > ul > li')).toHaveLength(9));
  expect(within(screen.getByRole('main')).queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Go to next page' }));
  fireEvent.change(header.getByRole('combobox', { name: 'Statut' }), { target: { value: 'overdue' } });
  expect(screen.getByText('1-2 sur 2')).toBeVisible();
});

it('transmet la capacité mesurée aux listes paginées côté serveur', async () => {
  const resize = measuredViewport();
  const onPageSizeChange = vi.fn();
  render(<FinanceWorkspace items={records.slice(0, 1)} pagination={<span>Pagination serveur</span>} onPageSizeChange={onPageSizeChange} />);
  await waitFor(() => expect(onPageSizeChange).toHaveBeenLastCalledWith(9));
  await resize(600);
  await waitFor(() => expect(onPageSizeChange).toHaveBeenLastCalledWith(6));
  expect(screen.getByText('Pagination serveur')).toBeVisible();
});
