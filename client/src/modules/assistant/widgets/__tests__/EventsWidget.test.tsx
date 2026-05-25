import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventsWidget } from '../EventsWidget';

describe('EventsWidget (smoke)', () => {
  it('renders empty state when no items', () => {
    render(<EventsWidget data={{ items: [], city: 'Paris' }} />);
    expect(screen.getByText(/Aucun evenement/i)).toBeInTheDocument();
  });

  it('renders title + events with type chip + date + description', () => {
    render(<EventsWidget data={{
      title: 'Evenements Paris',
      city: 'Paris',
      items: [
        {
          id: 'rg', title: 'Roland-Garros', type: 'SPORT',
          date: '2026-05-24', city: 'Paris', description: 'Tournoi de tennis',
        },
        {
          id: 'fete', title: 'Fete musique', type: 'FESTIVAL',
          date: '2026-06-21', city: 'Paris', description: 'Concerts gratuits',
        },
      ],
    }} />);

    expect(screen.getByText('Evenements Paris')).toBeInTheDocument();
    expect(screen.getByText('Roland-Garros')).toBeInTheDocument();
    expect(screen.getByText('Tournoi de tennis')).toBeInTheDocument();
    expect(screen.getByText('Sport')).toBeInTheDocument();
    expect(screen.getByText('Festival')).toBeInTheDocument();
    expect(screen.getByText('Fete musique')).toBeInTheDocument();
  });

  it('shows truncated hint when truncated=true', () => {
    render(<EventsWidget data={{
      city: 'Paris',
      items: [
        { id: 'a', title: 'A', type: 'FESTIVAL', date: '2026-06-01' },
      ],
      count: 1,
      totalElements: 60,
      truncated: true,
    }} />);
    expect(screen.getByText(/1\/60 affiches/i)).toBeInTheDocument();
  });

  it('hides wildcard city marker', () => {
    render(<EventsWidget data={{
      items: [
        { id: 'h', title: 'Fete Nationale', type: 'PUBLIC_HOLIDAY',
          date: '2026-07-14', city: '*' },
      ],
    }} />);
    // Le titre apparait
    expect(screen.getByText('Fete Nationale')).toBeInTheDocument();
    // Le marqueur "*" ne doit pas apparaitre en texte (au cote du titre)
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });
});
