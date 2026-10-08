import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionGroup, ActionRow } from '../DashboardActionList';

vi.mock('../../../components/baitly/Money', () => ({ Money: ({ value }: { value: number }) => <span>{value} €</span> }));
afterEach(cleanup);

const props = {
  kind: 'RESERVATION_PENDING' as const, icon: <svg />, label: 'Réservations à confirmer',
  total: 102, shown: 5, severity: 'critical' as const, amount: null, open: true,
  onToggle: vi.fn(), onBulk: vi.fn(), shownOfLabel: (shown: number, total: number) => `${shown} affichées sur ${total}`,
  moreLabel: (n: number) => `Voir les ${n} autres`, lessLabel: 'Réduire',
};
const rows = Array.from({ length: 5 }, (_, n) => <ActionRow key={n} primary={`Voyageur ${n + 1}`}
  secondary="Appartement Promenade" actionLabel="Confirmer" onClick={() => {}} />);

describe('Baitly action queue', () => {
  it('keeps the server total and the received-row limit distinct, before and after expanding', () => {
    render(<ActionGroup {...props}>{rows}</ActionGroup>);
    expect(screen.getByRole('button', { name: /Réservations à confirmer Prioritaire 102/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('3 affichées sur 102')).toBeVisible();
    expect(screen.queryByText('Voyageur 4')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voir les 2 autres' }));
    expect(screen.getByText('Voyageur 5')).toBeVisible();
    expect(screen.getByText('5 affichées sur 102')).toBeVisible();
  });

  it('also discloses a server cap when fewer than four rows are returned', () => {
    render(<ActionGroup {...props} shown={2}>{rows.slice(0, 2)}</ActionGroup>);
    expect(screen.getByText('2 affichées sur 102')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Voir les/ })).not.toBeInTheDocument();
  });

  it('resets the preview when closing a category and removes collapsed actions from keyboard navigation', () => {
    const { rerender } = render(<ActionGroup {...props}>{rows}</ActionGroup>);
    fireEvent.click(screen.getByRole('button', { name: 'Voir les 2 autres' }));
    rerender(<ActionGroup {...props} open={false}>{rows}</ActionGroup>);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Voyageur/ })).not.toBeInTheDocument();
    rerender(<ActionGroup {...props}>{rows}</ActionGroup>);
    expect(screen.queryByText('Voyageur 4')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: /Réservations à confirmer/ });
    expect(screen.getByRole('region')).toHaveAttribute('aria-labelledby', trigger.id);
    expect(trigger).toHaveAttribute('aria-controls', screen.getByRole('region').id);
  });

  it('preserves separate single-item and bulk actions without executing either when toggling the category', () => {
    const onToggle = vi.fn(); const onBulk = vi.fn(); const onAction = vi.fn();
    const { container } = render(<ActionGroup {...props} onToggle={onToggle} onBulk={onBulk} bulkLabel="Confirmer les 102">
      <ActionRow primary="Sofia Fontaine" secondary="RES-533" age="6 j" ageTitle="En attente depuis 6 jours" actionLabel="Confirmer" onClick={onAction} />
    </ActionGroup>);
    fireEvent.click(screen.getByRole('button', { name: /Réservations à confirmer/ }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onAction).not.toHaveBeenCalled();
    expect(onBulk).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sofia Fontaine/ }));
    expect(onAction).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer les 102' }));
    expect(onBulk).toHaveBeenCalledOnce();
    expect(container.querySelector('button button')).toBeNull();
  });

  it('keeps exact monetary totals and describes urgency without relying on the image or colour', () => {
    render(<ActionGroup {...props} kind="BALANCE_ABANDONED" label="Soldes jamais encaissés" amount={1025} total={2} shown={2}>
      {rows.slice(0, 2)}
    </ActionGroup>);
    expect(screen.getByRole('button', { name: /Soldes jamais encaissés Prioritaire 2 1025 €/ })).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
