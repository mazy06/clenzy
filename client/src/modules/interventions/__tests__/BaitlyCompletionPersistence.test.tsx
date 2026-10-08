import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useInterventionDetails } from '../useInterventionDetails';

const mocked = vi.hoisted(() => ({
  complete: vi.fn(), persist: vi.fn(), setCompleting: vi.fn(), ready: vi.fn(),
}));
vi.mock('../useInterventionState', () => ({ useInterventionState: () => ({
  handleCompleteIntervention: mocked.complete, setCompleting: mocked.setCompleting,
}) }));
vi.mock('../useInterventionPhotos', () => ({ useInterventionPhotos: () => ({
  completedSteps: new Set(['inspection', 'after_photos']), persistCompletedSteps: mocked.persist,
}) }));
vi.mock('../useInterventionProgress', () => ({ useInterventionProgress: () => ({ areAllStepsCompleted: mocked.ready }) }));
vi.mock('../useInterventionNotes', () => ({ useInterventionNotes: () => ({}) }));

beforeEach(() => {
  vi.resetAllMocks();
  mocked.ready.mockReturnValue(true);
  mocked.persist.mockResolvedValue(undefined);
  mocked.complete.mockResolvedValue(undefined);
});
afterEach(cleanup);

it('attend la persistance des étapes avant de terminer et ignore un double clic', async () => {
  let saved!: () => void;
  mocked.persist.mockReturnValue(new Promise<void>(resolve => { saved = resolve; }));
  const { result } = renderHook(() => useInterventionDetails('12'));
  let completing!: Promise<void>;
  act(() => { completing = result.current.handleCompleteIntervention(); });
  expect(mocked.persist).toHaveBeenCalledWith(new Set(['inspection', 'after_photos', 'rooms']));
  expect(mocked.complete).not.toHaveBeenCalled();
  await act(async () => { await result.current.handleCompleteIntervention(); });
  expect(mocked.persist).toHaveBeenCalledTimes(1);
  await act(async () => { saved(); await completing; });
  expect(mocked.complete).toHaveBeenCalledTimes(1);
});

it('laisse la mission ouverte si la sauvegarde finale échoue, puis permet de réessayer', async () => {
  mocked.persist.mockRejectedValueOnce(new Error('HTTP 500'));
  const { result } = renderHook(() => useInterventionDetails('12'));
  await act(async () => { await result.current.handleCompleteIntervention(); });
  expect(mocked.complete).not.toHaveBeenCalled();
  expect(mocked.setCompleting).toHaveBeenLastCalledWith(false);
  await act(async () => { await result.current.handleCompleteIntervention(); });
  expect(mocked.complete).toHaveBeenCalledTimes(1);
});

it('refuse de terminer tant que les pièces ne sont pas toutes confirmées', async () => {
  mocked.ready.mockReturnValue(false);
  const { result } = renderHook(() => useInterventionDetails('12'));
  await act(async () => { await result.current.handleCompleteIntervention(); });
  expect(mocked.persist).not.toHaveBeenCalled();
  expect(mocked.complete).not.toHaveBeenCalled();
});
