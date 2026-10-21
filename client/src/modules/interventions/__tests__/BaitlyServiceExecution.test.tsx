import { useMemo, useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { interventionsApi } from '../../../services/api/interventionsApi';
import { useInterventionPhotos } from '../useInterventionPhotos';
import { useInterventionProgress } from '../useInterventionProgress';
import { serviceExecutionProfile, serviceValidatedChecks } from '../baitlyServiceExecution';
import type { InterventionDetailsData } from '../interventionUtils';
import type { InitialLoadData } from '../useInterventionState';

vi.mock('../../../services/api/interventionsApi', () => ({ interventionsApi: {
  updateValidatedRooms: vi.fn(), updateCompletedSteps: vi.fn(), updateProgress: vi.fn(),
} }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../useInterventionsList', () => ({ interventionsKeys: { detail: (id: string) => ['intervention', id], lists: () => ['interventions'] } }));
let saved: InterventionDetailsData;
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => {
    const [intervention, setIntervention] = useState<InterventionDetailsData | null>({ ...saved });
    const [error, setError] = useState<string | null>(null);
    const [, setCompleting] = useState(false);
    const initialLoadData = useMemo(() => ({
      intervention, beforePhotos: [], afterPhotos: ['evidence.png'], inspectionComplete: true,
      completedSteps: new Set(JSON.parse(intervention!.completedSteps!)), validatedRooms: new Set([0,1,2,3]),
    } as InitialLoadData), [intervention]);
    const photos = useInterventionPhotos({ id: '12', intervention, setIntervention, setError, initialLoadData });
    const progress = useInterventionProgress({ id: '12', intervention, setIntervention, setError, setCompleting,
      propertyDetails: null, initialLoadData, canUpdateProgressFn: true, ...photos });
    return { ...progress, error, setNotes: (notes: string) => setIntervention(previous => ({ ...previous!, notes })) };
  }, { wrapper });
}
beforeEach(() => {
  vi.clearAllMocks();
  saved = { id:12, type:'OTHER', serviceItemCode:'culinary-breakfast', status:'IN_PROGRESS', validatedRooms:'[0,1,2,3]',
    completedSteps:'["inspection","after_photos"]', notes:'{}' } as InterventionDetailsData;
  vi.mocked(interventionsApi.updateCompletedSteps).mockImplementation(async (_id, steps) => {
    saved={...saved,completedSteps:steps};return {...saved};
  });
  vi.mocked(interventionsApi.updateProgress).mockImplementation(async (_id, progress) => ({ ...saved,progressPercentage:progress }));
});
afterEach(cleanup);

describe('Réalisation métier Baitly', () => {
  it('ignore les anciennes pièces et retrouve les validations métier après rechargement', async () => {
    const first=mount();
    expect(first.result.current.validatedRooms.size).toBe(0);
    expect(first.result.current.areAllStepsCompleted()).toBe(false);
    for (let index=0;index<3;index++) await act(async()=>{await first.result.current.handleRoomValidation(index);});
    await waitFor(()=>expect(first.result.current.areAllStepsCompleted()).toBe(true));
    expect(interventionsApi.updateValidatedRooms).not.toHaveBeenCalled();
    expect(JSON.parse(saved.completedSteps!)).toEqual(expect.arrayContaining(['service:breakfast:order','service:breakfast:packaging','service:breakfast:delivery']));
    expect(interventionsApi.updateCompletedSteps).toHaveBeenCalledTimes(3);
    first.unmount();
    const second=mount();
    expect(second.result.current.validatedRooms.size).toBe(3);
    expect(second.result.current.areAllStepsCompleted()).toBe(true);
  });
  it('ne confirme pas un contrôle si sa sauvegarde échoue et permet de réessayer', async () => {
    vi.mocked(interventionsApi.updateCompletedSteps).mockRejectedValueOnce(new Error('HTTP 500'));
    const {result}=mount();
    await act(async()=>{await result.current.handleRoomValidation(0);});
    expect(result.current.validatedRooms.has(0)).toBe(false);
    expect(result.current.error).toBe('serviceExecution.saveError');
    await act(async()=>{await result.current.handleRoomValidation(0);});
    expect(result.current.validatedRooms.has(0)).toBe(true);
  });
  it.each(['driver-airport','driver-station'])('exige un compte rendu enregistré pour %s', async code => {
    saved={...saved,serviceItemCode:code};
    const {result}=mount();
    for(let index=0;index<3;index++) await act(async()=>{await result.current.handleRoomValidation(index);});
    expect(result.current.areAllStepsCompleted()).toBe(false);
    expect(result.current.calculateProgress()).toBe(80);
    act(()=>result.current.setNotes(JSON.stringify({after_photos:'Prise en charge et dépose confirmées, recette fictive.'})));
    await waitFor(()=>expect(result.current.areAllStepsCompleted()).toBe(true));
  });
  it('ne mélange pas les confirmations de services différents', () => {
    const transfer=serviceExecutionProfile({serviceItemCode:'driver-airport'})!;
    expect(serviceValidatedChecks(transfer,new Set(['service:breakfast:delivery','rooms'])).size).toBe(0);
    expect(serviceExecutionProfile({type:'CLEANING',serviceItemCode:'cleaning-mid-stay'})).toBeNull();
    expect(serviceExecutionProfile({type:'CLEANING',serviceItemCode:'culinary-breakfast'})?.kind).toBe('breakfast');
  });
});
