import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LaunchCountdown, { remainingLaunchTime } from './LaunchCountdown';
import { PRELAUNCH_MESSAGES } from '../lib/messages/prelaunch';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('calcule un instant indépendamment du fuseau et évite les valeurs négatives', () => {
  const now = Date.parse('2027-01-01T00:00:00Z');
  expect(remainingLaunchTime('2027-01-02T05:03:04+03:00', now)).toEqual([
    1, 2, 3, 4,
  ]);
  expect(remainingLaunchTime('2026-01-01T00:00:00Z', now)).toEqual([
    0, 0, 0, 0,
  ]);
  expect(remainingLaunchTime('invalid', now)).toBeNull();
});

it('actualise les secondes puis affiche la préparation sans annoncer une ouverture automatique', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
  render(
    <LaunchCountdown
      launchAt="2027-01-01T00:00:02Z"
      language="ar"
      messages={PRELAUNCH_MESSAGES.ar}
    />,
  );
  expect(screen.getByRole('timer')).toHaveTextContent('٠٢');
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('timer')).toHaveTextContent('٠١');
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  expect(screen.getByText(PRELAUNCH_MESSAGES.ar.imminent)).toBeInTheDocument();
});
