import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ReportComposer from './ReportComposer';
import ReportLibrary from './ReportLibrary';
import { reportDocumentsApi, type ReportDocumentSummary } from '../../../services/api/reportDocumentsApi';
import { propertiesApi } from '../../../services/api/propertiesApi';

vi.mock('../../../services/api/reportDocumentsApi', () => ({ reportDocumentsApi: {
  list: vi.fn(), preview: vi.fn(), generate: vi.fn(), snapshot: vi.fn(), remove: vi.fn(), downloadPdf: vi.fn(),
} }));
vi.mock('../../../services/api/propertiesApi', () => ({ propertiesApi: { getAll: vi.fn(async () => [
  { id: 4, name: 'Villa Bleue', ownerId: 7, ownerName: 'Nadia' },
]) } }));
vi.mock('../../../components/PageHeaderActionsContext', () => ({ usePageHeaderActions: (node: ReactNode) => node }));
vi.mock('../../../hooks/useViewportFill', () => ({ useViewportFill: () => [null, undefined] }));
vi.mock('./SendReportDialog', () => ({ default: () => null }));
vi.mock('./SnapshotView', () => ({ default: () => <div>Aperçu calculé</div> }));

function show(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reportDocumentsApi.list).mockResolvedValue([]);
  vi.mocked(propertiesApi.getAll).mockResolvedValue([
    { id: 4, name: 'Villa Bleue', ownerId: 7, ownerName: 'Nadia' },
  ] as Awaited<ReturnType<typeof propertiesApi.getAll>>);
});
afterEach(cleanup);

it('keeps mandatory sections when clearing a family and sends the chosen scope to preview', async () => {
  show(<ReportComposer />);
  fireEvent.click(await screen.findByRole('button', { name: 'Villa Bleue' }, { timeout: 5000 }));
  const activity = screen.getByRole('button', { name: /^Activité/ }).closest('section')!;
  fireEvent.click(within(activity).getByRole('button', { name: 'tout inclure' }));
  fireEvent.click(within(activity).getByRole('button', { name: 'tout retirer' }));
  expect(screen.getByRole('button', { name: /Performance commerciale Rubrique obligatoire/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }));
  await waitFor(() => expect(reportDocumentsApi.preview).toHaveBeenCalledOnce());
  const body = vi.mocked(reportDocumentsApi.preview).mock.calls[0][0];
  expect(body.propertyIds).toEqual([4]);
  expect(body.sections).toContain('performance');
  expect(body.sections).toContain('notice');
  expect(body.sections).not.toContain('occupancy');
  expect(reportDocumentsApi.generate).not.toHaveBeenCalled();
});

it('updates audience defaults and prevents generation for an inverted date range', () => {
  show(<ReportComposer />);
  fireEvent.click(screen.getByRole('button', { name: /^Prospect/ }));
  fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2026-12-10' } });
  fireEvent.change(screen.getByLabelText('Au'), { target: { value: '2026-12-01' } });
  expect(screen.getByRole('button', { name: 'Aperçu' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /^Générer/ })).toBeDisabled();
  expect(screen.getByRole('alert')).toBeVisible();
});

const document = (id: number, status: 'SENT' | 'DRAFT'): ReportDocumentSummary => ({
  id, status, profile: 'OWNER', title: `Rapport ${id}`, documentNumber: `R-${id}`, version: 1,
  recipientName: 'Nadia', recipientEmail: null, periodStart: '2026-09-01', periodEnd: '2026-09-30',
  dataAsOf: '2026-10-01', hasNarrative: true, reviewedAt: null, sentAt: null, createdAt: '2026-10-01',
});

it('filters sent reports and preserves their preview and PDF actions without offering deletion', async () => {
  vi.mocked(reportDocumentsApi.list).mockResolvedValue([document(1, 'SENT'), document(2, 'DRAFT')]);
  const open = vi.fn();
  show(<ReportLibrary onOpen={open} />);
  await screen.findByRole('button', { name: 'Rapport 1 Nadia' });
  fireEvent.click(screen.getByRole('radio', { name: 'Envoyés' }));
  expect(screen.queryByRole('button', { name: 'Rapport 2 Nadia' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Envoyer' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }));
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  fireEvent.click(screen.getByRole('button', { name: 'Télécharger le PDF' }));
  expect(reportDocumentsApi.downloadPdf).toHaveBeenCalledWith(1, 'R-1.pdf');
});

it('shows a retry on library failure instead of claiming the library is empty', async () => {
  vi.mocked(reportDocumentsApi.list).mockRejectedValueOnce(new Error('Unavailable'));
  show(<ReportLibrary />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Les documents n’ont pas pu être chargés.');
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
  await waitFor(() => expect(reportDocumentsApi.list).toHaveBeenCalledTimes(2));
});
