import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortfolioOverviewWidget } from '../PortfolioOverviewWidget';

describe('PortfolioOverviewWidget (smoke)', () => {
  it('renders the empty-portfolio fallback when totalProperties = 0', () => {
    render(<PortfolioOverviewWidget data={{ totalProperties: 0 }} />);
    expect(screen.getByText(/Aucune propriete/i)).toBeInTheDocument();
  });

  it('renders KPI stats + top performer + under-performer + pattern', () => {
    const data = {
      title: 'Vue portfolio',
      daysBack: 30,
      totalProperties: 3,
      activeProperties: 2,
      totalRevenue: 2000,
      avgOccupancy: 0.65,
      avgADR: 100,
      topPerformers: [
        { id: 1, name: 'Loft Paris', city: 'Paris', revenue: 1200, occupancy: 0.8, reservations: 4 },
      ],
      underPerformers: [
        {
          id: 2, name: 'Studio Lyon', city: 'Lyon',
          occupancy: 0.2, reservations: 1,
          reason: 'Tres faible occupation', recommendation: 'Baisser le tarif',
        },
      ],
      patterns: [
        {
          type: 'HIGH_CANCELLATION_RATE', severity: 'HIGH',
          title: 'Taux d\'annulation eleve',
          description: '1 propriete avec >20% d\'annulations',
          items: ['Villa Nice (33%)'],
        },
      ],
    };

    render(<PortfolioOverviewWidget data={data} />);

    // KPI tiles : on regarde quelques labels et valeurs cles
    expect(screen.getByText('Vue portfolio')).toBeInTheDocument();
    expect(screen.getByText('Proprietes')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument(); // avgOccupancy
    expect(screen.getByText('2/3 actives')).toBeInTheDocument();

    // Section top performers
    expect(screen.getByText('Top performers')).toBeInTheDocument();
    expect(screen.getByText('Loft Paris')).toBeInTheDocument();
    expect(screen.getByText('Occupation 80%')).toBeInTheDocument();

    // Section sous-performants
    expect(screen.getByText(/Sous-performants/)).toBeInTheDocument();
    expect(screen.getByText('Studio Lyon')).toBeInTheDocument();
    expect(screen.getByText(/Tres faible occupation/)).toBeInTheDocument();
    expect(screen.getByText(/Baisser le tarif/)).toBeInTheDocument();

    // Section patterns
    expect(screen.getByText('Patterns detectes')).toBeInTheDocument();
    expect(screen.getByText(/Taux d'annulation eleve/)).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText(/Villa Nice/)).toBeInTheDocument();
  });

  it('hides optional sections when arrays are empty', () => {
    render(<PortfolioOverviewWidget data={{
      totalProperties: 1,
      activeProperties: 1,
      totalRevenue: 0,
      avgOccupancy: 0,
      avgADR: 0,
      topPerformers: [],
      underPerformers: [],
      patterns: [],
    }} />);

    // KPI section toujours rendue
    expect(screen.getByText('Proprietes')).toBeInTheDocument();
    // Sections vides : pas de header
    expect(screen.queryByText('Top performers')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sous-performants/)).not.toBeInTheDocument();
    expect(screen.queryByText('Patterns detectes')).not.toBeInTheDocument();
  });
});
