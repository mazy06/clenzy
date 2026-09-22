import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PlatformSettings } from '../../../services/api/platformSettingsApi';
import LaunchScheduleSettings from './LaunchScheduleSettings';

const mutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
}));
vi.mock('../../../hooks/usePlatformSettings', () => ({
  useSetLaunchSettings: () => mutation,
}));
const settings = {
  registrationsPaused: true,
  launchAt: '2027-01-15T09:00:00Z',
  launchTimeZone: 'Europe/Paris',
} as PlatformSettings;

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

it('enregistre le décompte en UTC seulement au clic, avec la pause explicite', () => {
  render(<LaunchScheduleSettings settings={settings} />);
  fireEvent.change(screen.getByLabelText('Date du lancement'), {
    target: { value: '2027-02-10' },
  });
  fireEvent.change(screen.getByLabelText('Heure du lancement'), {
    target: { value: '15:30' },
  });
  fireEvent.click(screen.getByRole('switch'));
  expect(mutation.mutate).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer le pré-lancement' }),
  );
  expect(mutation.mutate).toHaveBeenCalledWith(
    {
      registrationsPaused: false,
      launchAt: new Date('2027-02-10T15:30').toISOString(),
      launchTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    expect.any(Object),
  );
});

it('permet de retirer la date sans rouvrir les inscriptions', () => {
  render(<LaunchScheduleSettings settings={settings} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retirer la date' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer le pré-lancement' }),
  );
  expect(mutation.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      registrationsPaused: true,
      launchAt: null,
    }),
    expect.any(Object),
  );
});

it('refuse une date sans heure au lieu d’inventer minuit', () => {
  render(<LaunchScheduleSettings settings={{ ...settings, launchAt: null }} />);
  fireEvent.change(screen.getByLabelText('Date du lancement'), {
    target: { value: '2027-02-10' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer le pré-lancement' }),
  );
  expect(mutation.mutate).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Renseignez une date et une heure valides',
  );
});

it('recharge les deux champs à partir de l’instant enregistré en base', () => {
  const saved = new Date(settings.launchAt!);
  const pad = (value: number) => String(value).padStart(2, '0');
  render(<LaunchScheduleSettings settings={settings} />);
  expect(screen.getByLabelText('Date du lancement')).toHaveValue(
    `${saved.getFullYear()}-${pad(saved.getMonth() + 1)}-${pad(saved.getDate())}`,
  );
  expect(screen.getByLabelText('Heure du lancement')).toHaveValue(
    `${pad(saved.getHours())}:${pad(saved.getMinutes())}`,
  );
});
