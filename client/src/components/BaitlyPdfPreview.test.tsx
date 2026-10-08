import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BaitlyPdfPreview from './BaitlyPdfPreview';

const pdf = vi.hoisted(() => ({ load: vi.fn(), getPage: vi.fn(), destroy: vi.fn(), render: vi.fn(), cancel: vi.fn() }));
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: pdf.load }));
beforeEach(() => {
  pdf.destroy.mockReset().mockResolvedValue(undefined);
  pdf.cancel.mockReset(); pdf.render.mockReset().mockImplementation(() => ({ promise: Promise.resolve(), cancel: pdf.cancel }));
  pdf.getPage.mockReset().mockImplementation(async (page: number) => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 400 * scale, height: 600 * scale }),
    render: pdf.render, getTextContent: async () => ({ items: [{ str: `Contenu fictif page ${page}` }] }),
  }));
  pdf.load.mockReset().mockImplementation(() => ({ promise: Promise.resolve({ numPages: 2, getPage: pdf.getPage }), destroy: pdf.destroy }));
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(520);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('devicePixelRatio', 2);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('affiche les pages nettes sans lecteur natif ni téléchargement', async () => {
  render(<BaitlyPdfPreview url="blob:test" title="Aperçu" />);
  await screen.findByText('Contenu fictif page 1');
  const canvas = screen.getByRole('img', { name: 'Page 1 sur 2' });
  expect(canvas.tagName).toBe('CANVAS'); expect(canvas).toHaveAttribute('width', '992');
  expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
  await screen.findByText('Contenu fictif page 2');
  expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(document.querySelector('iframe,object,embed')).toBeNull();
});

it('détruit le lecteur et annule le rendu lors du démontage', async () => {
  pdf.render.mockReturnValue({ promise: new Promise(() => {}), cancel: pdf.cancel });
  const view = render(<BaitlyPdfPreview url="blob:test" title="Aperçu" />);
  await waitFor(() => expect(pdf.render).toHaveBeenCalled()); view.unmount();
  expect(pdf.destroy).toHaveBeenCalledTimes(1); expect(pdf.cancel).toHaveBeenCalledTimes(1);
});

it('signale un PDF illisible sans proposer de téléchargement de secours', async () => {
  pdf.load.mockReturnValue({ promise: Promise.reject(new Error('corrupt PDF')), destroy: pdf.destroy });
  render(<BaitlyPdfPreview url="blob:test" title="Aperçu" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossible d’afficher ce PDF.');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
