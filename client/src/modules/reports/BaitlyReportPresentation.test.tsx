import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BaitlyReportKpis from './BaitlyReportKpis';
import { reportMetric, type BaitlyReportKind } from './baitlyReportMetrics';
import { ReportView, SignalList, type ReportContent } from './reportShell';
import { HighlightList, HistogramChart } from '../../components/stats';

afterEach(cleanup);

it.each<[BaitlyReportKind, string, string]>([
  ['overview', 'revenue', 'Revenus'], ['revenue', 'total', 'Revenus'], ['occupancy', 'rate', 'Occupation'],
  ['pricing', 'f90', 'Revenus prévus à 90 j'], ['pace', 'pickup7', 'Pickup à 7 jours'],
  ['properties', 'cost', 'Coûts d’exploitation'], ['interventions', 'rate', 'Taux de réalisation'], ['teams', 'avg', 'Tâches par équipe'],
])('adapts the dashboard KPI to %s without changing its figure', (report, key, label) => {
  render(<BaitlyReportKpis report={report} figures={[{ key, value: '123,45', label: 'Ancienne légende' }]} />);
  const tile = screen.getByRole('button', { name: new RegExp(label) });
  expect(tile).toHaveTextContent('123,45');
  expect(tile).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(tile);
  expect(screen.getByRole('dialog', { name: label })).toBeVisible();
  expect(screen.queryByText('Excellent')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Fermer les détails' }));
  expect(tile).toHaveAttribute('aria-expanded', 'false');
});

it('keeps one disclosure open and preserves an inverted delta without inventing a baseline', () => {
  render(<BaitlyReportKpis report="properties" figures={[
    { key: 'cost', value: '250 €', label: 'Coûts', delta: -12, deltaInverted: true },
    { key: 'revpan', value: '70 €', label: 'RevPAN', delta: null },
  ]} />);
  fireEvent.click(screen.getByRole('button', { name: /^Coûts/ }));
  expect(screen.getByText('-12 %')).toHaveAttribute('data-favorable', 'true');
  fireEvent.click(screen.getByRole('button', { name: /^RevPAN/ }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.queryByText('-12 %')).toBeNull();
  expect(screen.queryByText('Évolution face à la période précédente de même durée')).toBeNull();
});

it('uses the dashboard widget content without truncating long lists or negative values', () => {
  const content: ReportContent = { loading: false, figures: [], items: [
    { key: 'ranking', title: 'Classement', fluid: true, render: () => <HistogramChart label="Marge" buckets={[
      { label: 'Appartement au nom très long du quartier historique', count: -25 },
    ]} formatValue={value => `${value} €`} /> },
    { key: 'highlights', title: 'Repères', fluid: true, render: () => <HighlightList items={Array.from({ length: 12 }, (_, index) => ({ label: `Bien ${index}`, value: index }))} /> },
    { key: 'alerts', title: 'Décisions', fluid: true, render: () => <SignalList items={[]} emptyLabel="Rien à traiter" /> },
  ] };
  const { container } = render(<ReportView report="overview" content={content} />);
  expect(screen.getByText('Appartement au nom très long du quartier historique')).toBeVisible();
  expect(screen.getByText('-25 €')).toBeVisible();
  expect(screen.getByText('Bien 11')).toBeVisible();
  expect(screen.getByText('Rien à traiter')).toBeVisible();
  expect(container.querySelectorAll('.bui-widget-panel')).toHaveLength(3);
  expect(container.querySelector('.db-data-ranking')).not.toBeNull();
});

it('hides stale financial figures while loading or on error and keeps retry available', () => {
  const retry = vi.fn();
  const content: ReportContent = { loading: true, figures: [{ key: 'revenue', label: 'Revenus', value: '999 €' }], items: [], retry };
  const view = render(<ReportView report="overview" content={content} />);
  expect(screen.getByRole('status')).toBeVisible();
  expect(screen.queryByText('999 €')).toBeNull();
  view.rerender(<ReportView report="overview" content={{ ...content, loading: false, error: true }} />);
  expect(screen.queryByText('999 €')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
  expect(retry).toHaveBeenCalledOnce();
});

it('localizes metric labels and preserves unknown metric labels', () => {
  expect(reportMetric('overview', 'occupancy', 'en-US', '').label).toBe('Occupancy');
  expect(reportMetric('overview', 'occupancy', 'ar', '').label).toBe('الإشغال');
  expect(reportMetric('teams', 'unknown', 'fr', 'Nouvel indicateur').label).toBe('Nouvel indicateur');
});
