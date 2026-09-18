import { render, screen, fireEvent } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { describe, it, expect, vi } from 'vitest';
import FilterSearchBar from '../FilterSearchBar';

vi.mock('../../hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('../ScreenChrome', () => ({ useScreenSearch: vi.fn() }));

const onChange = vi.fn();
function Filters() {
  return <FilterSearchBar bare searchTerm="" onSearchChange={() => {}}
    counter={{ count: 161, label: 'réservation' }}
    filters={{ status: { value: '', label: 'Statut', onChange,
      options: [{ value: '', label: 'Tous' }, { value: 'CONFIRMED', label: 'Confirmée' }] } }} />;
}

describe('Filtres du PageHeader', () => {
  it('affiche directement les options dans le panneau du header', () => {
    render(<div data-header-filter-panel><Filters /></div>);
    expect(screen.queryByRole('button', { name: 'Affichage et filtres' })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Statut' }), { target: { value: 'CONFIRMED' } });
    expect(onChange).toHaveBeenCalledWith('CONFIRMED');
  });

  it('reconnaît également les filtres injectés via un portail', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-header-filter-panel', '');
    document.body.appendChild(panel);
    const view = render(createPortal(<Filters />, panel));
    expect(screen.getByRole('combobox', { name: 'Statut' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Affichage et filtres' })).toBeNull();
    view.unmount();
    panel.remove();
  });

  it('conserve le déclencheur pour une barre autonome', () => {
    render(<Filters />);
    expect(screen.getByRole('button', { name: 'Affichage et filtres' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Statut' })).toBeNull();
  });
});
