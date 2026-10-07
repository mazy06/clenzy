import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DocumentsWorkspace, { type DocumentRecord } from './components/DocumentsWorkspace';
import { resolveDocumentsLocation } from './documentsNavigation';
import { documentVariableSyntax } from './AvailableTagsReference';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const rows: DocumentRecord[] = [{ id: '1', title: 'Facture Baitly', status: { value: 'CHECKED', label: 'Document vérifié' }, detail: <p>Informations du dossier</p> }];

it.each([
  ['document-templates', 'catalog', 'library'], ['whatsapp-templates', 'message-templates', 'whatsapp'],
  ['variables', 'catalog', 'variables'], ['amendments', 'history', 'amendments'],
])('conserve le lien historique %s', (old, tab, view) => {
  expect(resolveDocumentsLocation(new URLSearchParams(`tab=${old}&invoice=12`))).toEqual({ tab, view });
});
it('ignore les vues incompatibles et les clés inconnues', () => {
  expect(resolveDocumentsLocation(new URLSearchParams('tab=history&view=whatsapp'))).toEqual({ tab: 'history', view: 'activity' });
  expect(resolveDocumentsLocation(new URLSearchParams('tab=__proto__'))).toEqual({ tab: 'catalog', view: 'library' });
});
it('copie la syntaxe propre à chaque moteur, sans doubler les accolades', () => {
  expect(documentVariableSyntax('{guestName}')).toBe('{guestName}');
  expect(documentVariableSyntax('client.nom')).toBe('${client.nom}');
  expect(documentVariableSyntax('${client.nom}')).toBe('${client.nom}');
});
it('ouvre le détail sans action métier et retire un dossier disparu', () => {
  const view = render(<DocumentsWorkspace records={rows} label="Documents" />);
  fireEvent.click(screen.getByRole('button', { name: 'Facture Baitly' }));
  expect(screen.getByText('Informations du dossier')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Facture Baitly' })).toHaveAttribute('aria-pressed', 'true');
  view.rerender(<DocumentsWorkspace records={[]} label="Documents" />);
  expect(screen.queryByText('Informations du dossier')).not.toBeInTheDocument();
});
it('explique le statut au toucher sans ouvrir la ligne et se ferme avec Échap', async () => {
  render(<DocumentsWorkspace records={rows} label="Documents" />);
  fireEvent.click(screen.getByRole('button', { name: 'Document vérifié' }));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Document vérifié');
  expect(screen.queryByText('Informations du dossier')).not.toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  expect(document.querySelector('button button')).toBeNull();
});
it('déplace le focus dans le détail mobile et le rend à la ligne au retour', async () => {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true }));
  render(<DocumentsWorkspace records={rows} label="Documents" />);
  const row = screen.getByRole('button', { name: 'Facture Baitly' });
  fireEvent.click(row);
  expect(screen.getByRole('heading', { name: 'Facture Baitly' })).toHaveFocus();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retour à la liste' })));
  await waitFor(() => expect(row).toHaveFocus());
});
