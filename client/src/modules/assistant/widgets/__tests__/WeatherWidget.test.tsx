import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeatherWidget } from '../WeatherWidget';

describe('WeatherWidget (smoke)', () => {
  it('renders fallback when items is empty', () => {
    render(<WeatherWidget data={{ items: [] }} />);
    expect(screen.getByText(/Aucune donnee meteo/i)).toBeInTheDocument();
  });

  it('renders title + tiles for each day with temp and rain', () => {
    render(<WeatherWidget data={{
      title: 'Meteo Paris',
      city: 'Paris',
      days: 2,
      items: [
        { date: '2026-05-26', tempMax: 22.3, tempMin: 12.1, rain_mm: 0, conditionCode: 0, conditionLabel: 'Ensoleille' },
        { date: '2026-05-27', tempMax: 19.5, tempMin: 11.0, rain_mm: 5.2, conditionCode: 61, conditionLabel: 'Pluie' },
      ],
    }} />);

    expect(screen.getByText('Meteo Paris')).toBeInTheDocument();
    // Temperatures arrondies a l'entier
    expect(screen.getByText('22°')).toBeInTheDocument();
    expect(screen.getByText('20°')).toBeInTheDocument(); // 19.5 → 20°
    // Precipitations affichees uniquement si > 0.1 mm
    expect(screen.getByText('5.2mm')).toBeInTheDocument();
    // Pas de pluie pour day 0 (0mm)
    expect(screen.queryByText('0.0mm')).not.toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    render(<WeatherWidget data={{
      items: [{ date: '2026-05-26' }],
    }} />);
    // Pas de crash, le composant rend (au moins le jour formatte)
    expect(screen.getByText(/26\/05/)).toBeInTheDocument();
  });
});
