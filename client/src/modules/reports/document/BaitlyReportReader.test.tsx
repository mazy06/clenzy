import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import SnapshotView from './SnapshotView';
import type { ReportSnapshot } from '../../../services/api/reportDocumentsApi';

afterEach(cleanup);

const snapshot: ReportSnapshot = {
  meta: {
    documentNumber: 'R-2026-0042', version: 2, profile: 'OWNER', title: 'Relevé de septembre',
    issuerName: 'Gestion & Accueil', issuerLogoUrl: null, recipientName: 'Nadia', currency: 'EUR',
    periodStart: '2026-09-01', periodEnd: '2026-09-30', comparePeriodStart: '2026-08-01', comparePeriodEnd: '2026-08-30',
    lastYearPeriodStart: '2025-09-01', lastYearPeriodEnd: '2025-09-30', dataAsOf: '2026-10-01T12:00:00Z',
    scopeLabels: ['Villa <Océan>', 'Appartement du port'], scopeNote: 'Deux logements gérés',
  },
  kpis: [
    { key: 'revenue', label: 'Revenus', value: '12 345,67 €', rawValue: 0, deltaPreviousPct: 8.2, deltaLastYearPct: -3.4, higherIsBetter: true, hint: null },
    { key: 'cost', label: 'Charges', value: '987,65 €', rawValue: 99999, deltaPreviousPct: -2.1, deltaLastYearPct: null, higherIsBetter: false, hint: null },
  ],
  sections: [
    { id: 'pnl', title: 'Compte de résultat', subtitle: 'Revenus et charges', kind: 'PNL', chart: null,
      table: { columns: ['Poste', 'Montant'], aligns: ['START', 'END'], rows: [['Charges', '987,65 €']], totals: ['Net', '11 358,02 €'] },
      notes: [{ tone: 'warning', label: 'Facture attendue', detail: 'Montant estimé', impact: '97,23 €' }],
      body: null, narrative: 'Commentaire déjà validé du rapport.',
    },
    { id: 'glossary', title: 'Définitions', subtitle: null, kind: 'GLOSSARY', chart: null, table: null, notes: [], body: 'Définition du revenu.', narrative: null },
  ],
};

it('keeps server-formatted amounts, references, both comparisons and section content in the reader', () => {
  render(<SnapshotView snapshot={snapshot} />);
  expect(screen.getByRole('heading', { name: snapshot.meta.title })).toBeVisible();
  expect(screen.getByText('R-2026-0042 · version 2')).toBeVisible();
  expect(screen.getByText('Villa <Océan> · Appartement du port')).toBeVisible();
  expect(screen.getByText('Deux logements gérés')).toBeVisible();
  expect(screen.getByText('12 345,67 €')).toBeVisible();
  expect(screen.queryByText('99 999')).toBeNull();
  expect(screen.getByText('+8,2 %')).toHaveAttribute('data-direction', 'positive');
  expect(screen.getByText('-3,4 %')).toHaveAttribute('data-direction', 'negative');
  expect(screen.getByText('-2,1 %')).toHaveAttribute('data-direction', 'positive');
  expect(within(screen.getByRole('table')).getByText('11 358,02 €')).toBeVisible();
  expect(screen.getByText('97,23 €')).toBeVisible();
  expect(screen.getByText('Commentaire déjà validé du rapport.')).toBeVisible();
  expect(screen.getByText('Chapitre 01')).toBeVisible();
  expect(screen.queryByText('Chapitre 02')).toBeNull();
  expect(screen.getByText('Définition du revenu.')).toBeVisible();
});

it('handles missing comparisons, an empty perimeter and literal markup without inventing content', () => {
  const { container } = render(<SnapshotView snapshot={{ ...snapshot,
    meta: { ...snapshot.meta, title: '<script>titre</script>', documentNumber: null, scopeLabels: [], recipientName: null },
    kpis: [{ ...snapshot.kpis[0], deltaPreviousPct: null, deltaLastYearPct: null }], sections: [],
  }} />);
  expect(screen.getByRole('heading', { name: '<script>titre</script>' })).toBeVisible();
  expect(container.querySelector('script')).toBeNull();
  expect(screen.queryByText(/période préc/)).toBeNull();
  expect(screen.queryByText(/an dernier/)).toBeNull();
});
