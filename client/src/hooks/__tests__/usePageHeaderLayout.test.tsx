import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePageHeaderLayout } from '../usePageHeaderLayout';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function Header({ anchored = true, contentKey = '' }: { anchored?: boolean; contentKey?: string }) {
  const { headerRef, canInlineControls, compactSearch, compactActions } = usePageHeaderLayout(anchored, contentKey);
  return <div data-testid="page" style={{ paddingInlineStart: 24, paddingInlineEnd: 24, paddingTop: 24 }}>
    <header ref={headerRef} data-testid="header">
      <div data-header-row data-inline={canInlineControls}>
        <div data-slot="page-title"><span>Titre et onglet</span></div>
        <div data-header-toolbar>{canInlineControls && <select aria-label="Catégorie"><option>Toutes</option></select>}</div>
        <output>{compactSearch ? 'Recherche compacte' : 'Recherche complète'}</output>
        <output>{compactActions ? 'Menu actions' : 'Actions directes'}</output>
      </div>
    </header>
  </div>;
}

function dimensions() {
  let width = 1200;
  let controls = 550;
  const callbacks = new Set<ResizeObserverCallback>();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { callbacks.add(callback); }
    observe() {}
    disconnect() {}
    unobserve() {}
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-header-row') ? width : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-header-toolbar') ? controls : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: this.tagName === 'SPAN' ? 420 : 0, height: 0, toJSON() {} };
  });
  return async (nextWidth: number, nextControls = controls) => {
    width = nextWidth; controls = nextControls;
    await act(async () => callbacks.forEach(callback => callback([], {} as ResizeObserver)));
  };
}

it('suit le conteneur sans resize de fenêtre et restaure les contrôles sur grand écran', async () => {
  const resize = dimensions();
  render(<Header />);
  await waitFor(() => expect(screen.getByRole('combobox')).toBeVisible());
  expect(screen.getByText('Recherche complète')).toBeVisible();
  await resize(760);
  await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
  expect(screen.getByText('Recherche compacte')).toBeVisible();
  expect(screen.getByText('Actions directes')).toBeVisible();
  await resize(600);
  await waitFor(() => expect(screen.getByText('Menu actions')).toBeVisible());
  await resize(1500);
  await waitFor(() => expect(screen.getByRole('combobox')).toBeVisible());
  expect(screen.getByText('Recherche complète')).toBeVisible();
});

it('replie un groupe trop large même au-dessus du seuil habituel', async () => {
  const resize = dimensions();
  render(<Header />);
  await waitFor(() => expect(screen.getByRole('combobox')).toBeVisible());
  await resize(1200, 900);
  await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
  await resize(1600);
  await waitFor(() => expect(screen.getByRole('combobox')).toBeVisible());
});

it('réévalue la place après un changement de vue vers des contrôles plus courts', async () => {
  const resize = dimensions();
  const view = render(<Header contentKey="long" />);
  await resize(1200, 900);
  await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
  await resize(1200, 400);
  view.rerender(<Header contentKey="short" />);
  await waitFor(() => expect(screen.getByRole('combobox')).toBeVisible());
});

it('reprend les marges du parent et laisse les headers non ancrés dans leur conteneur', () => {
  dimensions();
  const view = render(<Header />);
  expect(screen.getByTestId('header').style.getPropertyValue('--page-header-gutter-start')).toBe('24px');
  expect(screen.getByTestId('header').style.getPropertyValue('--page-header-gutter-top')).toBe('24px');
  view.unmount();
  render(<Header anchored={false} />);
  expect(screen.getByTestId('header').style.getPropertyValue('--page-header-gutter-start')).toBe('');
});

it('additionne les marges imbriquées de la page et du cadre principal', () => {
  dimensions();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const page = this.dataset.testid === 'page';
    const shell = this.dataset.testid === 'shell';
    return { x: page ? 12 : 0, y: page ? 12 : 0, left: page ? 12 : 0, top: page ? 12 : 0,
      right: page ? 1188 : shell ? 1200 : 0, bottom: 0, width: page ? 1176 : shell ? 1200 : 0, height: 0, toJSON() {} };
  });
  render(<div data-testid="shell" style={{ padding: 12, paddingInlineStart: 12, paddingInlineEnd: 12 }}><Header /></div>);
  expect(screen.getByTestId('header').style.getPropertyValue('--page-header-gutter-start')).toBe('36px');
  expect(screen.getByTestId('header').style.getPropertyValue('--page-header-gutter-top')).toBe('36px');
});
