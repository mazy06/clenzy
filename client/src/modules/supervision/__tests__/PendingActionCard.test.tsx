// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PendingActionCard } from '../components/PendingActionCard';
import type { PendingAction } from '../types';

const future = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

const base = (over: Partial<PendingAction> = {}): PendingAction => ({
  id: 'pa-1',
  agentId: 'rev',
  title: 'Baisser le tarif de −12 %',
  motif: 'Faible demande',
  reasoning: 'Raison métier claire.',
  createdAt: new Date().toISOString(),
  expiresAt: future(4),
  ...over,
});

describe('<PendingActionCard>', () => {
  it('affiche titre, motif et agent', () => {
    render(<PendingActionCard action={base()} onValidate={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('Baisser le tarif de −12 %')).toBeTruthy();
    expect(screen.getByText('Faible demande')).toBeTruthy();
    expect(screen.getByText(/Revenue/)).toBeTruthy();
  });

  it('« Pourquoi ? » déplie le raisonnement', () => {
    render(<PendingActionCard action={base()} onValidate={() => {}} onEdit={() => {}} />);
    expect(screen.queryByText('Raison métier claire.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pourquoi ?' }));
    expect(screen.getByText('Raison métier claire.')).toBeTruthy();
  });

  it('Valider appelle onValidate et désactive le bouton', () => {
    const onValidate = vi.fn();
    render(<PendingActionCard action={base()} onValidate={onValidate} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));
    expect(onValidate).toHaveBeenCalledWith('pa-1');
    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled();
  });

  it('action expirée : pas de bouton Valider', () => {
    render(<PendingActionCard action={base({ expiresAt: past() })} onValidate={() => {}} onEdit={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Valider' })).toBeNull();
    expect(screen.getAllByText('Expirée').length).toBeGreaterThan(0);
  });

  it('le raisonnement est rendu en texte brut (jamais de HTML)', () => {
    const { container } = render(
      <PendingActionCard action={base({ reasoning: '<b>injection</b>' })} onValidate={() => {}} onEdit={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pourquoi ?' }));
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<b>injection</b>');
  });
});
