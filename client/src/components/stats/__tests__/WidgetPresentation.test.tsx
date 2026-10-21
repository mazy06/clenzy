import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetPresentationContext } from '../widgetPresentation';
import { ChartThumbnailContext } from '../chartThumbnail';
import { HistogramChart } from '../charts';
import { HighlightList } from '../HighlightList';
import { SignalList } from '../../../modules/reports/reportShell';
import { VatSummaryCards } from '../../../modules/reports/FiscalReportSection';

vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
afterEach(cleanup);

describe('contenu des widgets du dashboard', () => {
  it('garde les libellés complets et les montants négatifs sur une échelle commune', () => {
    const { container } = render(<WidgetPresentationContext.Provider value>
      <HistogramChart label="Écart" buckets={[{ label: 'Appartement du quartier historique de Bordeaux', count: -25 }, { label: 'Villa des Palmiers', count: 75 }]}
        formatValue={(value) => `${value} €`} />
    </WidgetPresentationContext.Provider>);
    expect(screen.getByText('Appartement du quartier historique de Bordeaux')).toBeVisible();
    expect(screen.getByText('-25 €')).toBeVisible();
    expect(screen.getByText('75 €')).toBeVisible();
    const bars = container.querySelectorAll<HTMLElement>('.db-data-ranking__bar');
    expect(bars[0].style.inlineSize).toBe('25%');
    expect(bars[1].style.insetInlineStart).toBe('25%');
  });

  it('ne masque aucun repère lorsque le panneau contient une longue liste', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({ label: `Logement ${index}`, value: index * 137, hint: 'Bordeaux · secteur historique' }));
    const { container } = render(<WidgetPresentationContext.Provider value><HighlightList items={items} /></WidgetPresentationContext.Provider>);
    expect(container.querySelectorAll('dt')).toHaveLength(12);
    expect(screen.getByText('Logement 11')).toBeVisible();
    expect(screen.getByText('1507')).toBeVisible();
  });

  it('conserve le graphique dans les rapports et dans les miniatures', () => {
    const props = { label: 'Nuits', buckets: [{ label: 'Paris', count: 10 }] };
    const { container, rerender } = render(<HistogramChart {...props} />);
    expect(container.querySelector('.db-data-ranking')).toBeNull();
    rerender(<WidgetPresentationContext.Provider value><ChartThumbnailContext.Provider value><HistogramChart {...props} /></ChartThumbnailContext.Provider></WidgetPresentationContext.Provider>);
    expect(container.querySelector('.db-data-ranking')).toBeNull();
  });

  it('décrit les priorités sans se reposer uniquement sur la couleur', () => {
    render(<WidgetPresentationContext.Provider value><SignalList emptyLabel="Aucun signal" items={[
      { id: '1', tone: 'critical', title: 'Versement à valider', description: 'Période de septembre', meta: '1 250 €' },
      { id: '2', tone: 'warning', title: 'Déclaration à déposer', description: 'Échéance dans 3 jours' },
    ]} /></WidgetPresentationContext.Provider>);
    expect(screen.getByText('Prioritaire')).toBeInTheDocument();
    expect(screen.getByText('À suivre')).toBeInTheDocument();
    expect(screen.getByText('1 250 €')).toBeVisible();
  });

  it('sépare les émetteurs et leurs devises dans le récapitulatif fiscal', () => {
    const summary = { countryCode: 'FR', currency: 'EUR', period: '2026-09', totalHt: 100, totalTax: 20, totalTtc: 120, invoiceCount: 2, breakdown: [] };
    const { container } = render(<WidgetPresentationContext.Provider value><VatSummaryCards summary={{ ...summary, issuers: [
      { issuerKey: 'fr', sellerName: 'Agence Bordeaux', summary },
      { issuerKey: 'ma', sellerName: 'Agence Marrakech', summary: { ...summary, countryCode: 'MA', currency: 'MAD', totalTtc: 1200 } },
    ] }} /></WidgetPresentationContext.Provider>);
    expect(screen.getByText(/Agence Bordeaux · FR · EUR/)).toBeVisible();
    expect(screen.getByText(/Agence Marrakech · MA · MAD/)).toBeVisible();
    expect(container.querySelectorAll('.db-imported-figures')).toHaveLength(2);
    expect(container.querySelectorAll('.db-imported-figures > span')).toHaveLength(10);
  });
});
