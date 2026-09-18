// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MyAvailabilityCard from './MyAvailabilityCard';
import { myAvailabilityApi } from '../../services/api/myAvailabilityApi';

vi.mock('../../services/api/myAvailabilityApi', () => ({ myAvailabilityApi: {
  getMine: vi.fn(), removeAbsence: vi.fn(), addAbsence: vi.fn(), replaceWeekly: vi.fn(),
} }));
vi.mock('../../hooks/useTranslation', () => {
  const t = (_key: string, fallback: string) => fallback;
  return { useTranslation: () => ({ t }) };
});
vi.mock('../../hooks/useNotification', () => ({ useNotification: () => ({ notify: { success: vi.fn() } }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Declared absences', () => {
  it('does not turn contradictory migrated calendars into unrestricted availability', async () => {
    vi.mocked(myAvailabilityApi.getMine).mockResolvedValue({ weekly: [], weeklyRestricted: true, absences: [] });
    render(<MyAvailabilityCard />);
    expect(await screen.findByText(/Vos anciens horaires ne comportent aucun créneau commun/)).toBeTruthy();
    expect(screen.queryByText('Toujours disponible')).toBeNull();
    const save = screen.getByRole('button', { name: 'Enregistrer mes horaires' });
    expect(save.hasAttribute('disabled')).toBe(true);
    fireEvent.click(save);
    expect(myAvailabilityApi.replaceWeekly).not.toHaveBeenCalled();
  });

  it('preserves separate slots on a day when another working day is selected', async () => {
    const weekly = [
      { id: 1, dayOfWeek: 1, startTime: '09:00:00', endTime: '12:00:00' },
      { id: 2, dayOfWeek: 1, startTime: '14:00:00', endTime: '17:00:00' },
    ];
    vi.mocked(myAvailabilityApi.getMine).mockResolvedValue({ weekly, weeklyRestricted: true, absences: [] });
    vi.mocked(myAvailabilityApi.replaceWeekly).mockResolvedValue(weekly);
    render(<MyAvailabilityCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mardi', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes horaires' }));
    await waitFor(() => expect(myAvailabilityApi.replaceWeekly).toHaveBeenCalledWith([
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '12:00' },
    ]));
  });

  it('does not silently drop an invalid weekly slot', async () => {
    vi.mocked(myAvailabilityApi.getMine).mockResolvedValue({ weekly: [
      { id: 7, dayOfWeek: 1, startTime: '17:00:00', endTime: '09:00:00' },
    ], absences: [] });
    render(<MyAvailabilityCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer mes horaires' }));
    expect(await screen.findByText('Chaque heure de fin doit suivre son heure de début.')).toBeTruthy();
    expect(myAvailabilityApi.replaceWeekly).not.toHaveBeenCalled();
  });

  it('shows a conflict returned by the server without deleting or reassigning anything', async () => {
    vi.mocked(myAvailabilityApi.getMine).mockResolvedValue({ weekly: [], absences: [
      { id: 1, startDate: '2026-09-15', endDate: '2026-09-15', reason: null, assignmentConflict: true },
    ] });
    render(<MyAvailabilityCard />);
    expect(await screen.findByText(/Cette absence recouvre une mission attribuée/)).toBeTruthy();
    expect(myAvailabilityApi.removeAbsence).not.toHaveBeenCalled();
  });

  it('keeps the absence visible when removal fails', async () => {
    vi.mocked(myAvailabilityApi.getMine).mockResolvedValue({ weekly: [], absences: [
      { id: 1, startDate: '2026-09-15', endDate: '2026-09-15', reason: null },
    ] });
    vi.mocked(myAvailabilityApi.removeAbsence).mockRejectedValue(new Error('offline'));
    render(<MyAvailabilityCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retirer cette absence' }));
    await waitFor(() => expect(screen.getByText(/Elle reste enregistrée/)).toBeTruthy());
    expect(screen.getByText('2026-09-15')).toBeTruthy();
  });
});
