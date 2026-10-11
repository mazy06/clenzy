import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DirectionsMenu } from '../DirectionsMenu';

describe('DirectionsMenu', () => {
  it('whenOpened_thenOffersEveryGpsAppForTheAddress', async () => {
    render(
      <DirectionsMenu target={{ address: '8 rue des Rosiers, Paris', label: 'Studio Marais' }}>
        <button type="button">Itinéraire</button>
      </DirectionsMenu>,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Itinéraire' }), { key: 'Enter' });

    const waze = await screen.findByRole('menuitem', { name: /Waze/ });
    expect(waze).toHaveAttribute('href', 'https://waze.com/ul?q=8%20rue%20des%20Rosiers%2C%20Paris&navigate=yes');
    expect(screen.getByRole('menuitem', { name: /Google Maps/ })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('menuitem', { name: /Plans/ })).toBeInTheDocument();
    // Sans coordonnées, pas de carte Baitly à montrer.
    expect(screen.queryByRole('menuitem', { name: /carte Baitly/ })).toBeNull();
  });

  it('whenNothingToTarget_thenNoMenu', () => {
    render(
      <DirectionsMenu target={{ address: '', label: 'x' }}>
        <button type="button">Itinéraire</button>
      </DirectionsMenu>,
    );

    expect(screen.queryByRole('button', { name: 'Itinéraire' })).toBeNull();
  });
});
