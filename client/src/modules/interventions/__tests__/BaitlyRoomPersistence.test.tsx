import { useMemo, useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { interventionsApi } from '../../../services/api/interventionsApi';
import { useInterventionPhotos } from '../useInterventionPhotos';
import { useInterventionProgress } from '../useInterventionProgress';
import type { InterventionDetailsData, PropertyDetails } from '../interventionUtils';
import type { InitialLoadData } from '../useInterventionState';

vi.mock('../../../services/api/interventionsApi', () => ({ interventionsApi: {
  updateValidatedRooms: vi.fn(), updateCompletedSteps: vi.fn(), updateProgress: vi.fn(),
} }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }) }));
vi.mock('../useInterventionsList', () => ({ interventionsKeys: { detail: (id: string) => ['intervention', id], lists: () => ['interventions'] } }));

let saved: InterventionDetailsData;
const property = { bedroomCount: 1, bathroomCount: 1, livingRooms: 0, kitchens: 0 } as PropertyDetails;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function mount(initialProperty: PropertyDetails | null = property) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => {
    const [intervention, setIntervention] = useState<InterventionDetailsData | null>({ ...saved });
    const [error, setError] = useState<string | null>(null);
    const [propertyDetails, setPropertyDetails] = useState(initialProperty);
    const [, setCompleting] = useState(false);
    const initialLoadData = useMemo(() => ({
      intervention, propertyDetails: property, beforePhotos: ['before.png'], afterPhotos: ['after.png'],
      inspectionComplete: true, completedSteps: new Set(JSON.parse(intervention!.completedSteps!)),
      validatedRooms: new Set(JSON.parse(intervention!.validatedRooms!)),
      allRoomsValidated: JSON.parse(intervention!.validatedRooms!).length === 2,
      stepNotes: {}, lastSavedNotes: '',
    } as InitialLoadData), [intervention]);
    const photos = useInterventionPhotos({ id: '12', intervention, setIntervention, setError, initialLoadData });
    const progress = useInterventionProgress({ id: '12', intervention, setIntervention, setError, setCompleting,
      propertyDetails, initialLoadData, canUpdateProgressFn: true, ...photos });
    return { ...progress, photos, error, setPropertyDetails };
  }, { wrapper });
  return { ...hook, client };
}

beforeEach(() => {
  vi.clearAllMocks();
  saved = { id: 12, status: 'IN_PROGRESS', validatedRooms: '[0]',
    completedSteps: '["inspection","after_photos"]', progressPercentage: 75 } as InterventionDetailsData;
  vi.mocked(interventionsApi.updateValidatedRooms).mockImplementation(async (_id, rooms) => {
    saved = { ...saved, validatedRooms: rooms }; return { ...saved };
  });
  vi.mocked(interventionsApi.updateCompletedSteps).mockImplementation(async (_id, steps) => {
    saved = { ...saved, completedSteps: steps }; return { ...saved };
  });
  vi.mocked(interventionsApi.updateProgress).mockImplementation(async (_id, progress) => {
    saved = { ...saved, progressPercentage: progress }; return { ...saved };
  });
});
afterEach(cleanup);

describe('Validation persistée des pièces Baitly', () => {
  it('reconnaît les pièces sauvegardées même si le logement arrive après la mission', () => {
    saved = { ...saved, validatedRooms: '[0,1]' };
    const { result } = mount(null);
    expect(result.current.allRoomsValidated).toBe(false);
    act(() => result.current.setPropertyDetails(property));
    expect(result.current.allRoomsValidated).toBe(true);
    expect(result.current.areAllStepsCompleted()).toBe(true);
    expect(interventionsApi.updateValidatedRooms).not.toHaveBeenCalled();
  });

  it('attend la sauvegarde avant de cocher la dernière pièce et interdit la fin pendant cette attente', async () => {
    const request = deferred<InterventionDetailsData>();
    vi.mocked(interventionsApi.updateValidatedRooms).mockReturnValueOnce(request.promise);
    const { result } = mount();
    act(() => { void result.current.handleRoomValidation(1); });
    await waitFor(() => expect(interventionsApi.updateValidatedRooms).toHaveBeenCalled());
    expect(result.current.validatedRooms.has(1)).toBe(false);
    expect(result.current.savingRoom).toBe(1);
    expect(result.current.areAllStepsCompleted()).toBe(false);
    await act(async () => { saved = { ...saved, validatedRooms: '[0,1]' }; request.resolve(saved); });
    await waitFor(() => expect(result.current.areAllStepsCompleted()).toBe(true));
    expect(result.current.validatedRooms.has(1)).toBe(true);
  });

  it('affiche une erreur et conserve le dernier état confirmé si le serveur refuse la sauvegarde', async () => {
    vi.mocked(interventionsApi.updateValidatedRooms).mockRejectedValueOnce(new Error('HTTP 500'));
    const { result } = mount();
    await act(async () => { await result.current.handleRoomValidation(1); });
    expect(result.current.error).toContain('n’a pas été enregistrée');
    expect(result.current.validatedRooms.size).toBe(1);
    expect(result.current.allRoomsValidated).toBe(false);
    expect(result.current.areAllStepsCompleted()).toBe(false);
    expect(interventionsApi.updateCompletedSteps).not.toHaveBeenCalled();
    await act(async () => { await result.current.handleRoomValidation(1); });
    await waitFor(() => expect(result.current.areAllStepsCompleted()).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it('conserve les pièces cochées après démontage et relecture du serveur', async () => {
    const first = mount();
    await act(async () => { await first.result.current.handleRoomValidation(1); });
    await waitFor(() => expect(first.result.current.areAllStepsCompleted()).toBe(true));
    first.unmount();
    const second = mount();
    expect([...second.result.current.validatedRooms]).toEqual([0, 1]);
    expect(second.result.current.allRoomsValidated).toBe(true);
  });

  it('enregistre aussi la désélection de la dernière pièce, y compris une liste vide', async () => {
    const { result } = mount();
    await act(async () => { await result.current.handleRoomValidation(0); });
    await waitFor(() => expect(result.current.savingRoom).toBeNull());
    expect(saved.validatedRooms).toBe('[]');
    expect(result.current.validatedRooms.size).toBe(0);
    expect(result.current.areAllStepsCompleted()).toBe(false);
  });

  it('sérialise les écritures des pièces, des étapes et du pourcentage sur la même mission', async () => {
    const request = deferred<InterventionDetailsData>();
    vi.mocked(interventionsApi.updateValidatedRooms).mockReturnValueOnce(request.promise);
    const { result } = mount();
    act(() => { void result.current.handleRoomValidation(1); });
    await waitFor(() => expect(interventionsApi.updateValidatedRooms).toHaveBeenCalledTimes(1));
    act(() => {
      result.current.photos.saveCompletedSteps(new Set(['inspection', 'after_photos']));
      void result.current.handleUpdateProgressValue(75);
      void result.current.handleRoomValidation(1);
    });
    expect(interventionsApi.updateCompletedSteps).not.toHaveBeenCalled();
    expect(interventionsApi.updateProgress).not.toHaveBeenCalled();
    expect(interventionsApi.updateValidatedRooms).toHaveBeenCalledTimes(1);
    await act(async () => { saved = { ...saved, validatedRooms: '[0,1]' }; request.resolve(saved); });
    await waitFor(() => expect(result.current.areAllStepsCompleted()).toBe(true));
    expect(interventionsApi.updateCompletedSteps).toHaveBeenCalled();
    expect(interventionsApi.updateProgress).toHaveBeenCalled();
    expect(saved.validatedRooms).toBe('[0,1]');
  });

  it('ne tente aucune nouvelle écriture des pièces sur une mission terminée', async () => {
    saved = { ...saved, status: 'COMPLETED' };
    const { result } = mount();
    await act(async () => { await result.current.handleRoomValidation(1); });
    expect(interventionsApi.updateValidatedRooms).not.toHaveBeenCalled();
  });
});
