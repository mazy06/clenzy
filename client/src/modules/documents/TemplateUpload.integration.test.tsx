import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TemplateUpload from './TemplateUpload';
import { documentsApi } from '../../services/api/documentsApi';

vi.mock('../../services/api/documentsApi', () => ({ documentsApi: {
  getDocumentTypes: vi.fn(async () => [{ value: 'BON_COMMANDE', label: 'Bon de commande' }]),
  uploadTemplate: vi.fn(async () => ({ id: 12 })),
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
async function open() {
  const onSuccess = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <TemplateUpload open onClose={() => {}} onSuccess={onSuccess} />
  </QueryClientProvider>);
  await screen.findByRole('option', { name: 'Bon de commande' });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'BON_COMMANDE' } });
  return { onSuccess, input: document.querySelector('input[type="file"]') as HTMLInputElement };
}
it('transmet le modèle HTML et son type au pipeline commun', async () => {
  const { onSuccess, input } = await open();
  const file = new File(['<html><body>${depense.description}</body></html>'], 'commande.HTML', { type: 'text/html' });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Uploader & scanner' }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  const payload = vi.mocked(documentsApi.uploadTemplate).mock.calls[0][0];
  expect(payload.get('file')).toBe(file);
  expect(payload.get('documentType')).toBe('BON_COMMANDE');
  expect(payload.get('name')).toBe('commande');
});
it('un ancien ODT sélectionné après un HTML ne réutilise pas le précédent fichier', async () => {
  const { input } = await open();
  fireEvent.change(input, { target: { files: [new File(['<html><body>test</body></html>'], 'test.html', { type: 'text/html' })] } });
  expect(screen.getByRole('button', { name: 'Uploader & scanner' })).toBeEnabled();
  fireEvent.change(input, { target: { files: [new File(['old'], 'old.odt')] } });
  expect(screen.getByRole('button', { name: 'Uploader & scanner' })).toBeDisabled();
  expect(documentsApi.uploadTemplate).not.toHaveBeenCalled();
});
it('refuse un fichier HTML vide', async () => {
  const { input } = await open();
  fireEvent.change(input, { target: { files: [new File([], 'empty.html', { type: 'text/html' })] } });
  expect(screen.getByText('Le modèle HTML doit contenir entre 1 octet et 5 Mo.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Uploader & scanner' })).toBeDisabled();
});
