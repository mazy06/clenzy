import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import fr from '../../../public/locales/fr.json';
import en from '../../../public/locales/en.json';
import ar from '../../../public/locales/ar.json';
import {
  pmsImportApi,
  type ImportView,
  type ImportSchema,
} from '../../services/api/pmsImportApi';
import PmsImportWorkspace from './PmsImportWorkspace';

const invalidateQueries = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock('../../services/api/pmsImportApi', () => ({
  pmsImportApi: {
    schema: vi.fn(),
    recent: vi.fn(),
    get: vi.fn(),
    upload: vi.fn(),
    validate: vi.fn(),
    commit: vi.fn(),
    export: vi.fn(),
    deleteDraft: vi.fn(),
  },
}));
vi.mock('../../services/api/propertiesApi', () => ({
  propertiesApi: { getAll: vi.fn().mockResolvedValue([]) },
}));
const locale = createInstance();
await locale.init({
  lng: 'fr',
  fallbackLng: 'fr',
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    ar: { translation: ar },
  },
});
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: locale.t.bind(locale),
    currentLanguage: locale.language,
  }),
}));

const schema: ImportSchema = {
  GUEST: [
    { key: 'sourceId', required: true, aliases: [] },
    { key: 'firstName', required: true, aliases: [] },
    { key: 'lastName', required: true, aliases: [] },
  ],
  PROPERTY: [],
  RESERVATION: [],
  ARCHIVE: [],
};
const view: ImportView = {
  id: 'batch-1',
  source: 'Smoobu',
  sourceAccount: 'Agence',
  status: 'DRAFT',
  createdAt: '2026-10-03T10:00:00Z',
  documents: [
    {
      id: 'doc-1',
      name: 'guests.csv',
      columns: ['id', 'first', 'last', 'custom'],
      rowCount: 1,
      sample: [{ id: '001', first: 'Salma', last: 'Alaoui', custom: 'VIP' }],
      attachment: false,
      propertyRefs: [],
      unmappedColumns: ['custom'],
    },
  ],
  plans: [
    {
      documentId: 'doc-1',
      kind: 'GUEST',
      fields: { sourceId: 'id', firstName: 'first', lastName: 'last' },
      defaults: {},
      propertyLinks: {},
      dateFormat: 'ISO',
      decimalSeparator: '.',
    },
  ],
  report: {
    ready: 1,
    archived: 0,
    duplicates: 0,
    issueCount: 0,
    issues: [],
    totals: {},
    token: 'approved',
  },
};

afterEach(cleanup);
beforeEach(async () => {
  vi.clearAllMocks();
  await locale.changeLanguage('fr');
  vi.mocked(pmsImportApi.schema).mockResolvedValue(schema);
  vi.mocked(pmsImportApi.recent).mockResolvedValue([view]);
  vi.mocked(pmsImportApi.get).mockResolvedValue(structuredClone(view));
});
async function open() {
  render(<PmsImportWorkspace />);
  await screen.findByRole('button', { name: /Smoobu.*Agence/ });
  fireEvent.click(screen.getByRole('button', { name: /Smoobu.*Agence/ }));
  await screen.findByRole('button', { name: /Vérifier les correspondances/ });
}

describe('PMS import workflow', () => {
  it('invalidates approval after a mapping change and revalidates before commit', async () => {
    await open();
    expect(screen.queryByRole('button', {
      name: /Intégrer les données vérifiées/,
    })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Prénom/), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/Prénom · Valeur commune/), {
      target: { value: 'Salma' },
    });
    vi.mocked(pmsImportApi.validate).mockImplementation(async (_, plans) => ({
      ...view,
      plans,
      report: { ...view.report!, token: 'new-approval' },
    }));
    fireEvent.click(
      screen.getByRole('button', { name: /Vérifier les correspondances/ }),
    );
    const commit = await screen.findByRole('button', { name: /Intégrer les données vérifiées/ });
    expect(commit).toBeEnabled();
    expect(screen.queryByLabelText(/Prénom/)).not.toBeInTheDocument();
    vi.mocked(pmsImportApi.commit).mockResolvedValue({
      ...view,
      status: 'COMPLETED',
    });
    fireEvent.click(commit);
    await screen.findByText('Import terminé');
    expect(pmsImportApi.commit).toHaveBeenCalledWith('batch-1', 'new-approval');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['onboarding', 'me'] });
  });
  it('blocks integration when validation reports an error', async () => {
    vi.mocked(pmsImportApi.get).mockResolvedValue({
      ...view,
      report: {
        ...view.report!,
        issueCount: 1,
        issues: [{ documentId: 'doc-1', row: 2, code: 'SOURCE_CHANGED' }],
      },
    });
    await open();
    expect(
      screen.getByRole('button', { name: /Intégrer les données vérifiées/ }),
    ).toBeDisabled();
    expect(screen.getByText(/Cet identifiant existe déjà/)).toBeVisible();
    expect(pmsImportApi.commit).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
  it('accepts a PMS outside the suggested list and uploads the original file', async () => {
    vi.mocked(pmsImportApi.recent).mockResolvedValue([]);
    vi.mocked(pmsImportApi.upload).mockResolvedValue({ ...view, report: null });
    render(<PmsImportWorkspace />);
    const source = await screen.findByLabelText('PMS d’origine');
    fireEvent.change(source, { target: { value: 'PMS local' } });
    fireEvent.change(screen.getByLabelText(/Compte dans ce PMS/), {
      target: { value: 'Mon compte' },
    });
    const file = new File(['id,first,last\n1,Salma,Alaoui'], 'export.csv', {
      type: 'text/csv',
    });
    fireEvent.change(screen.getByLabelText(/Exports à reprendre/), {
      target: { files: [file] },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Analyser les fichiers/ }),
    );
    await waitFor(() =>
      expect(pmsImportApi.upload).toHaveBeenCalledWith(
        [file],
        'PMS local',
        'Mon compte',
        'UTF-8',
      ),
    );
    expect(
      screen.queryByRole('button', { name: /Intégrer les données vérifiées/ }),
    ).not.toBeInTheDocument();
  });
  it('shows an actionable upload error without losing the selected source', async () => {
    vi.mocked(pmsImportApi.upload).mockRejectedValue({
      message: 'DUPLICATE_OR_EMPTY_HEADERS',
    });
    render(<PmsImportWorkspace />);
    fireEvent.change(await screen.findByLabelText('PMS d’origine'), {
      target: { value: 'PMS local' },
    });
    fireEvent.change(screen.getByLabelText(/Compte dans ce PMS/), {
      target: { value: 'Compte' },
    });
    fireEvent.change(screen.getByLabelText(/Exports à reprendre/), {
      target: { files: [new File(['id,id'], 'bad.csv')] },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Analyser les fichiers/ }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('uniques');
    expect(screen.getByLabelText('PMS d’origine')).toHaveValue('PMS local');
  });
  it.each(['fr', 'en', 'ar'])(
    'has matching translation keys in %s',
    async (language) => {
      await locale.changeLanguage(language);
      render(<PmsImportWorkspace />);
      await screen.findByRole('button', { name: /Smoobu.*Agence/ });
      expect(document.body.textContent).not.toContain('pmsImport.');
      fireEvent.click(screen.getByRole('button', { name: /Smoobu.*Agence/ }));
      await waitFor(() => expect(pmsImportApi.get).toHaveBeenCalled());
      await screen.findByText('guests.csv');
      expect(document.body.textContent).not.toContain('pmsImport.');
    },
  );
});
