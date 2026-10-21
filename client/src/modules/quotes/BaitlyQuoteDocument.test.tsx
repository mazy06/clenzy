import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BaitlyQuoteDocument from './BaitlyQuoteDocument';
const fetchPdf = vi.hoisted(() => vi.fn());
vi.mock('../../services/api/documentsApi', () => ({ documentsApi: { fetchGenerationBlobUrl: fetchPdf } }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('../../components/BaitlyPdfPreview', () => ({ default: ({ url, title }: { url: string; title: string }) => <div role="region" aria-label={title} data-url={url}>PDF affiché</div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });
it('loads the existing PDF generation only when opened', async () => {
  fetchPdf.mockRejectedValue(new Error('Unavailable'));
  render(<BaitlyQuoteDocument generationId={12815} quoteId={22} />);
  expect(screen.getByText('devis-22.pdf')).toBeInTheDocument();
  expect(fetchPdf).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Aperçu du devis' }));
  await waitFor(() => expect(fetchPdf).toHaveBeenCalledExactlyOnceWith(12815));
  expect(await screen.findByText('Le document n’a pas pu être chargé.')).toBeInTheDocument();
});

it('loads the selected PDF automatically inline and releases it when switching quotes', async () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  fetchPdf.mockResolvedValueOnce('blob:quote22').mockResolvedValueOnce('blob:quote26');
  const view = render(<BaitlyQuoteDocument generationId={12815} quoteId={22} inlinePreview />);
  await waitFor(() => expect(screen.getByRole('region', { name: 'devis-22.pdf' })).toHaveAttribute('data-url', 'blob:quote22'));
  expect(fetchPdf).toHaveBeenCalledExactlyOnceWith(12815);
  expect(screen.queryByRole('dialog')).toBeNull();
  view.rerender(<BaitlyQuoteDocument generationId={12827} quoteId={26} inlinePreview />);
  await waitFor(() => expect(screen.getByRole('region', { name: 'devis-26.pdf' })).toHaveAttribute('data-url', 'blob:quote26'));
  expect(revoke).toHaveBeenCalledWith('blob:quote22');
  expect(screen.queryByRole('region', { name: 'devis-22.pdf' })).toBeNull();
  view.unmount();
  expect(revoke).toHaveBeenCalledWith('blob:quote26');
});

it('releases an inline PDF that finishes loading after leaving the dossier', async () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  let complete!: (url: string) => void;
  fetchPdf.mockReturnValueOnce(new Promise<string>(resolve => { complete = resolve; }));
  const view = render(<BaitlyQuoteDocument generationId={12815} quoteId={22} inlinePreview />);
  view.unmount();
  complete('blob:late');
  await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:late'));
});
