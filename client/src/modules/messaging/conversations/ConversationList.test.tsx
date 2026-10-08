// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ConversationList, { type InboxFilter } from './ConversationList';
import type { UnifiedConversation } from './unified';

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

// Le vrai champ vit dans l'en-tête de l'application ; le gabarit remplace ce
// pont par un champ local pour piloter la recherche.
vi.mock('../../../components/HeaderSearchField', () => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input type="search" aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

afterEach(cleanup);

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);

const item = (key: string, over: Partial<UnifiedConversation> = {}): UnifiedConversation => ({
  key,
  kind: 'channel',
  name: `Voyageur ${key}`,
  context: 'Villa Soleil',
  channel: 'WHATSAPP',
  preview: `Aperçu ${key}`,
  lastAt: hoursAgo(0.1),
  unreadCount: 0,
  ...over,
});

const ITEMS: UnifiedConversation[] = [
  item('ch-1', { name: 'Sofia Marti', unreadCount: 2, preview: 'Quelle est l’heure d’arrivée ?' }),
  item('ch-2', { name: 'Karim Benali', lastAt: daysAgo(40), context: 'Riad Atlas', preview: 'Merci pour le séjour' }),
  item('in-3', { kind: 'internal', channel: 'INTERNAL', name: 'Équipe ménage', context: 'Chat interne', lastAt: daysAgo(40) }),
  item('form-4', { kind: 'form', channel: 'FORM', name: 'Lucie Moreau', context: 'Devis', unreadCount: 1, lastAt: daysAgo(40) }),
];

function renderList(over: Partial<React.ComponentProps<typeof ConversationList>> = {}) {
  const props = {
    items: ITEMS,
    isLoading: false,
    error: null,
    filter: 'all' as InboxFilter,
    onFilterChange: vi.fn(),
    showFormsFilter: true,
    selectedKey: null,
    onSelect: vi.fn(),
    onArchive: vi.fn(),
    onRestore: vi.fn(),
    ...over,
  };
  render(<ConversationList {...props} />);
  return props;
}

describe('ConversationList', () => {
  it('affiche les filtres, les effectifs utiles et signale le filtre actif', () => {
    renderList();
    const tabs = within(screen.getByRole('tablist'));
    expect(tabs.getByRole('tab', { name: 'Tous' }).getAttribute('aria-selected')).toBe('true');
    // Effectifs seulement là où ils appellent un geste : non lus, formulaires.
    expect(tabs.getByRole('tab', { name: /^Non lus\s*2$/ })).toBeTruthy();
    expect(tabs.getByRole('tab', { name: /^Formulaires\s*1$/ })).toBeTruthy();
    expect(tabs.getByRole('tab', { name: 'Voyageurs' })).toBeTruthy();
    // L'archive est un picto seul, nommé pour les lecteurs d'écran.
    expect(tabs.getByRole('tab', { name: 'Archivés' }).textContent).toBe('');
  });

  it('masque le filtre Formulaires pour un rôle sans accès', () => {
    renderList({ showFormsFilter: false });
    expect(screen.queryByRole('tab', { name: /Formulaires/ })).toBeNull();
  });

  it('remonte le changement de filtre', () => {
    const { onFilterChange } = renderList();
    fireEvent.click(screen.getByRole('tab', { name: /^Non lus/ }));
    expect(onFilterChange).toHaveBeenCalledWith('unread');
  });

  it('regroupe par ancienneté, du plus récent au plus ancien', () => {
    renderList();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Aujourd’hui', 'Plus ancien']);
  });

  it('filtre « Non lus » ne garde que les conversations non lues', () => {
    renderList({ filter: 'unread' });
    expect(screen.getByText('Sofia Marti')).toBeTruthy();
    expect(screen.getByText('Lucie Moreau')).toBeTruthy();
    expect(screen.queryByText('Karim Benali')).toBeNull();
  });

  it('cherche dans le nom, le contexte et l’aperçu', () => {
    renderList();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'atlas' } });
    expect(screen.getByText('Karim Benali')).toBeTruthy();
    expect(screen.queryByText('Sofia Marti')).toBeNull();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'introuvable' } });
    expect(screen.getByText('Aucun résultat')).toBeTruthy();
  });

  it('sélectionne une conversation au clic sans déclencher l’archivage', () => {
    const { onSelect, onArchive } = renderList({ selectedKey: 'ch-1' });
    fireEvent.click(screen.getByRole('button', { name: /Sofia Marti/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'ch-1' }));
    expect(onArchive).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Sofia Marti/ }).getAttribute('aria-current')).toBe('true');
  });

  it('archive depuis le bouton dédié, sans ouvrir la conversation', () => {
    const { onSelect, onArchive } = renderList();
    const [archive] = screen.getAllByRole('button', { name: 'Archiver la conversation' });
    fireEvent.click(archive);
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('vue Archivés : les conversations se rouvrent, seuls les formulaires s’ouvrent', () => {
    const { onSelect, onRestore } = renderList({ filter: 'archived' });
    expect(screen.queryByRole('button', { name: /Sofia Marti/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Lucie Moreau/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: 'form-4' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Rouvrir la conversation' })[0]);
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Restaurer le formulaire' })).toBeTruthy();
  });

  it('dit pourquoi la liste est vide, selon le filtre', () => {
    renderList({ items: [], filter: 'unread' });
    expect(screen.getByText('Vous êtes à jour')).toBeTruthy();
    cleanup();
    renderList({ items: [], filter: 'archived' });
    expect(screen.getByText('Aucun élément archivé')).toBeTruthy();
  });

  it('montre le chargement puis l’erreur sans liste', () => {
    renderList({ isLoading: true });
    expect(screen.getByRole('status', { name: 'Chargement…' })).toBeTruthy();
    cleanup();
    renderList({ error: new Error('boom') });
    expect(screen.getByText('Impossible de charger les conversations.')).toBeTruthy();
  });
});
