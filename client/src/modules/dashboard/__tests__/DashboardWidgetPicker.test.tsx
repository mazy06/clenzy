import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardWidgetPicker from '../DashboardWidgetPicker';
import type { ReportContent } from '../../reports/reportShell';

const state = vi.hoisted(() => ({ mounted: [] as string[], error: false, retry: vi.fn() }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('../importedWidgets', () => ({
  TILE_SOURCES: [
    { id: 'reports.overview', labelKey: 'overview', fallback: 'Synthèse', originKey: 'reports', originFallback: 'Rapports' },
    { id: 'reports.teams', labelKey: 'teams', fallback: 'Équipes', originKey: 'reports', originFallback: 'Rapports' },
  ],
  importedWidgetId: (source: string, key: string) => `import:${source}:${key}`,
  TileThumbnail: () => <span aria-hidden="true">Aperçu</span>,
  SourceTileOptions: ({ source, children }: { source: { id: string }; children: (tiles: ReportContent['items'], loading: boolean, failure?: { retry: () => void }) => React.ReactNode }) => {
    state.mounted.push(source.id);
    return children([{ key: 'chart', title: `${source.id} graphique`, hint: 'Sur la période sélectionnée', render: () => null }], false, state.error ? { retry: state.retry } : undefined);
  },
}));
afterEach(() => { cleanup(); state.mounted = []; state.error = false; vi.clearAllMocks(); });

describe('catalogue des widgets', () => {
  const defaults = { open: true, onOpenChange: vi.fn(), period: 'month' as const, removedNative: [], placedIds: [], onAdd: vi.fn() };

  it('monte une seule source et conserve le catalogue ouvert après un ajout', () => {
    render(<DashboardWidgetPicker {...defaults} />);
    expect(new Set(state.mounted)).toEqual(new Set(['reports.overview']));
    fireEvent.click(screen.getByRole('button', { name: /Équipes/ }));
    expect(screen.queryByRole('button', { name: 'Ajouter : reports.overview graphique' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter : reports.teams graphique' }));
    expect(defaults.onAdd).toHaveBeenCalledWith('import:reports.teams:chart');
    expect(defaults.onOpenChange).not.toHaveBeenCalled();
  });

  it('empêche les doublons et permet de remettre un widget natif', () => {
    render(<DashboardWidgetPicker {...defaults} placedIds={['import:reports.overview:chart']} removedNative={[{ id: 'today-operations', label: 'Opérations du jour' }]} />);
    expect(screen.getByRole('button', { name: 'Déjà posé : reports.overview graphique' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Retirés du tableau de bord/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remettre' }));
    expect(defaults.onAdd).toHaveBeenCalledWith('today-operations');
  });

  it('propose de réessayer en cas d’échec au lieu d’afficher un catalogue vide', () => {
    state.error = true;
    render(<DashboardWidgetPicker {...defaults} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger ces composants.');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(state.retry).toHaveBeenCalledOnce();
  });
});
