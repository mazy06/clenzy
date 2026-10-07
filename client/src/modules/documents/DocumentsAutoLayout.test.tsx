import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PageHeaderActionsProvider, usePageHeaderFiltersSlot } from '../../components/PageHeaderActionsContext';
import DocumentsWorkspace from './components/DocumentsWorkspace';
import AvailableTagsReference from './AvailableTagsReference';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function HeaderHarness({ children }: { children: React.ReactNode }) {
  const { filtersSlot, filtersContainer } = usePageHeaderFiltersSlot();
  return <PageHeaderActionsProvider slot={null} filtersSlot={filtersSlot}><header data-testid="header">{filtersContainer}</header>{children}</PageHeaderActionsProvider>;
}

function measuredViewport() {
  let viewportHeight = 800;
  vi.spyOn(window, 'innerHeight', 'get').mockImplementation(() => viewportHeight);
  vi.stubGlobal('visualViewport', undefined);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { top: this.classList.contains('documents-workspace') ? 100 : 0, bottom: 0, height: 0, width: 800, left: 0, right: 800, x: 0, y: 0, toJSON() {} };
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('documents-workspace__list') ? parseFloat(this.parentElement?.style.height || '0') : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.tagName === 'LI') return 59;
    if (this.classList.contains('documents-workspace__list-title')) return 47;
    return 54;
  });
  return async (height: number) => {
    viewportHeight = height;
    // Le navigateur émet aussi ResizeObserver après la nouvelle hauteur ;
    // ce deuxième événement reproduit cette mesure dans le DOM sans layout.
    await act(async () => fireEvent(window, new Event('resize')));
    await act(async () => fireEvent(window, new Event('resize')));
  };
}

it('mesure la place, adapte le nombre de lignes et garde la sélection accessible après resize', async () => {
  const resize = measuredViewport();
  const records = Array.from({ length: 25 }, (_, i) => ({ id: String(i), title: `Modèle ${i}`, detail: <p>Détail {i}</p> }));
  const view = render(<DocumentsWorkspace autoPaginate records={records} label="Modèles" />);
  const rowCount = () => view.container.querySelectorAll('.documents-workspace__list > ul > li').length;
  await waitFor(() => expect(rowCount()).toBe(9));
  fireEvent.click(screen.getByRole('link', { name: 'Go to next page' }));
  expect(screen.getByRole('button', { name: 'Modèle 17' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Modèle 17' }));
  await resize(600);
  await waitFor(() => expect(rowCount()).toBe(6));
  expect(screen.getByRole('button', { name: 'Modèle 17' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Détail 17')).toBeVisible();
  expect(screen.getByText('13-18 sur 25')).toBeVisible();
  view.rerender(<DocumentsWorkspace autoPaginate records={records.slice(0, 2)} label="Modèles" />);
  expect(screen.getByText('1-2 sur 2')).toBeVisible();
  expect(screen.queryByText('Détail 17')).not.toBeInTheDocument();
});

it('porte filtre et compteur Variables dans le header et revient au début après filtrage', async () => {
  measuredViewport();
  const view = render(<HeaderHarness><AvailableTagsReference search="" /></HeaderHarness>);
  const header = within(screen.getByTestId('header'));
  expect(header.getByRole('combobox', { name: 'Catégorie' })).toBeVisible();
  expect(header.getByText('114 éléments')).toBeVisible();
  await waitFor(() => expect(view.container.querySelectorAll('.documents-record')).toHaveLength(9));
  fireEvent.click(screen.getByRole('link', { name: 'Go to next page' }));
  fireEvent.change(header.getByRole('combobox', { name: 'Catégorie' }), { target: { value: 'paiement' } });
  expect(header.getByText('4 éléments')).toBeVisible();
  expect(screen.getByText('1-4 sur 4')).toBeVisible();
  expect(view.container.querySelector('.documents-workspace')).toHaveAttribute('data-fit', 'true');
  expect(view.container.querySelector('.documents-toolbar')).toBeNull();
});
