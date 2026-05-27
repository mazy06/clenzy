import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Stub BarChartWidget : recharts a besoin de mesurer le container, complique
// dans jsdom. On garde le nom et le titre, c'est suffisant pour les smoke tests.
vi.mock('../charts/BarChartWidget', () => ({
  BarChartWidget: (props: { data: { title?: string } }) => (
    <div data-testid="bar-chart-stub">{props.data?.title}</div>
  ),
}));

import { SimulationWidget } from '../SimulationWidget';

describe('SimulationWidget (smoke)', () => {
  it('renders pricing_change : verdict + before/after + recommendation', () => {
    render(<SimulationWidget data={{
      kind: 'pricing_change',
      title: 'Simulation pricing Loft (-10%)',
      propertyName: 'Loft',
      pctChange: -0.10,
      elasticity: 0.5,
      from: '2026-07-01',
      to: '2026-07-30',
      simulationDays: 30,
      baseline: { label: 'Baseline', adr: 100, occupancyRate: 0.5, bookedNights: 15, revenue: 1500 },
      scenario: { label: 'Scenario', adr: 90, occupancyRate: 0.525, bookedNights: 16, revenue: 1440 },
      deltaRevenue: -60,
      deltaOccupancy: 0.025,
      pctRevenueChange: -0.04,
      recommendation: 'Baisse de prix non rentable.',
    }} />);

    expect(screen.getByText('Simulation pricing Loft (-10%)')).toBeInTheDocument();
    // Verdict pct revenue (signe en U+2212 sur les pourcentages negatifs)
    expect(screen.getByText('−4%')).toBeInTheDocument();
    // Cards avant/apres
    expect(screen.getByText('Avant')).toBeInTheDocument();
    expect(screen.getByText('Apres −10%')).toBeInTheDocument();
    // Recommandation
    expect(screen.getByText('Recommandation')).toBeInTheDocument();
    expect(screen.getByText('Baisse de prix non rentable.')).toBeInTheDocument();
    // Stub bar chart rendu
    expect(screen.getByTestId('bar-chart-stub')).toBeInTheDocument();
  });

  it('renders calendar_block : perte estimee + KPI + alternatives', () => {
    render(<SimulationWidget data={{
      kind: 'calendar_block',
      title: 'Simulation blocage Loft (10 jours)',
      propertyName: 'Loft',
      from: '2026-07-01',
      to: '2026-07-10',
      daysBlocked: 10,
      estimatedOccupancy: 0.8,
      adr: 120,
      expectedBookedNights: 8,
      estimatedLostRevenue: 960,
      reference: 'meme periode annee precedente',
      alternativeSuggestions: [
        'Decaler la maintenance sur une semaine plus creuse',
        'Bloquer uniquement les jours strictement necessaires',
      ],
    }} />);

    expect(screen.getByText('Simulation blocage Loft (10 jours)')).toBeInTheDocument();
    expect(screen.getByText('Perte estimee de revenue')).toBeInTheDocument();
    // KPI tiles
    expect(screen.getByText('Occupation attendue')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Nuits perdues')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    // Alternatives
    expect(screen.getByText('Alternatives suggerees')).toBeInTheDocument();
    expect(screen.getByText(/Decaler la maintenance/)).toBeInTheDocument();
    expect(screen.getByText(/strictement necessaires/)).toBeInTheDocument();
  });

  it('renders fallback for unknown payload kind', () => {
    render(<SimulationWidget data={{ kind: 'unknown_kind' } as unknown as { kind: 'pricing_change' }} />);
    expect(screen.getByText(/non interpretable/i)).toBeInTheDocument();
  });

  it('renders fallback for empty payload', () => {
    render(<SimulationWidget data={{}} />);
    expect(screen.getByText(/non interpretable/i)).toBeInTheDocument();
  });
});
