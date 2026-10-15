import { useMemo, useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { interventionsApi, getBaitlyRoomInspection } from '../../../services/api/interventionsApi';
import { useInterventionPhotos } from '../useInterventionPhotos';
import { parsePhotos, type InterventionDetailsData } from '../interventionUtils';
import type { InitialLoadData } from '../useInterventionState';

vi.mock('../../../services/api/interventionsApi', () => ({ getBaitlyRoomInspection: vi.fn(), interventionsApi: {
  uploadPhotos: vi.fn(), updateCompletedSteps: vi.fn(),
} }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }) }));
vi.mock('../useInterventionsList', () => ({ interventionsKeys: { detail: (id: string) => ['intervention', id], lists: () => ['interventions'] } }));

let saved: InterventionDetailsData;
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => {
    const [intervention, setIntervention] = useState<InterventionDetailsData | null>({ ...saved });
    const [error, setError] = useState<string | null>(null);
    const initialLoadData = useMemo(() => ({
      beforePhotos: parsePhotos(intervention?.beforePhotosUrls),
      afterPhotos: parsePhotos(intervention?.afterPhotosUrls),
      completedSteps: new Set(JSON.parse(intervention!.completedSteps!)),
      inspectionComplete: parsePhotos(intervention?.beforePhotosUrls).length > 0,
    } as InitialLoadData), [intervention]);
    const photos = useInterventionPhotos({ id: '12', intervention, setIntervention, setError, initialLoadData });
    return { ...photos, error };
  }, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  saved = { id: 12, status: 'IN_PROGRESS', completedSteps: '["inspection","rooms"]', beforePhotosUrls: '["before.png"]' } as InterventionDetailsData;
  vi.mocked(interventionsApi.uploadPhotos).mockImplementation(async (_id, _files, type) => {
    saved = { ...saved, [type === 'before' ? 'beforePhotosUrls' : 'afterPhotosUrls']: '["stored.png"]' };
    return { ...saved };
  });
  vi.mocked(interventionsApi.updateCompletedSteps).mockImplementation(async (_id, steps) => {
    saved = { ...saved, completedSteps: steps }; return { ...saved };
  });
});
afterEach(cleanup);

describe('Photos et étapes persistées Baitly', () => {
  it('requires one tagged photo for every cleaning room before completing inspection', async () => {
    saved = { ...saved, type: 'CLEANING', completedSteps: '[]', beforePhotosUrls: undefined };
    const rooms = [{ id: 'bedroom_1', type: 'bedroom', number: 1 }, { id: 'bathroom_1', type: 'bathroom', number: 1 }];
    vi.mocked(getBaitlyRoomInspection).mockResolvedValue({ rooms, stepPhotoCounts: { inspection_bedroom_1: 1 } });
    const { result } = mount();
    await waitFor(() => expect(result.current.inspectionRooms).toHaveLength(2));
    act(() => { result.current.setInspectionRoom('bedroom_1'); result.current.setSelectedPhotos([new File(['photo'], 'room.png', { type: 'image/png' })]); });
    await act(async () => { await result.current.handlePhotoUpload(); });
    await waitFor(() => expect(result.current.uploadingPhotos).toBe(false));
    expect(result.current.inspectionComplete).toBe(false);
    expect(JSON.parse(saved.completedSteps!)).not.toContain('inspection');
    expect(vi.mocked(interventionsApi.uploadPhotos).mock.calls[0][1][0].name).toMatch(/^baitly-12-step-inspection_bedroom_1-/);
    vi.mocked(getBaitlyRoomInspection).mockResolvedValue({ rooms, stepPhotoCounts: { inspection_bedroom_1: 1, inspection_bathroom_1: 1 } });
    act(() => { result.current.setInspectionRoom('bathroom_1'); result.current.setSelectedPhotos([new File(['photo'], 'bath.png', { type: 'image/png' })]); });
    await act(async () => { await result.current.handlePhotoUpload(); });
    await waitFor(() => expect(result.current.uploadingPhotos).toBe(false));
    expect(result.current.inspectionComplete).toBe(true);
    expect(JSON.parse(saved.completedSteps!)).toContain('inspection');
  });
  it.each(['before', 'after'] as const)('persiste l’étape %s dès le dépôt et la retrouve après rechargement', async type => {
    if (type === 'before') saved = { ...saved, completedSteps: '[]', beforePhotosUrls: undefined };
    const first = mount();
    act(() => {
      first.result.current.setPhotoType(type);
      first.result.current.setSelectedPhotos([new File(['sandbox'], 'test.png', { type: 'image/png' })]);
    });
    await act(async () => { await first.result.current.handlePhotoUpload(); });
    await waitFor(() => expect(interventionsApi.updateCompletedSteps).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(first.result.current.uploadingPhotos).toBe(false));
    const step = type === 'before' ? 'inspection' : 'after_photos';
    expect(JSON.parse(saved.completedSteps!)).toContain(step);
    expect(first.result.current.completedSteps.has(step)).toBe(true);
    if (type === 'after') expect(JSON.parse(saved.completedSteps!)).toContain('rooms');
    first.unmount();
    const second = mount();
    expect(second.result.current.completedSteps.has(step)).toBe(true);
    expect(type === 'before' ? second.result.current.beforePhotos : second.result.current.afterPhotos).toEqual(['stored.png']);
  });

  it('garde la photo si seule la sauvegarde de l’étape échoue et permet sa reprise sans second dépôt', async () => {
    vi.mocked(interventionsApi.updateCompletedSteps).mockRejectedValueOnce(new Error('HTTP 500'));
    const { result } = mount();
    act(() => {
      result.current.setPhotoType('after');
      result.current.setSelectedPhotos([new File(['sandbox'], 'test.png')]);
    });
    await act(async () => { await result.current.handlePhotoUpload(); });
    await waitFor(() => expect(result.current.uploadingPhotos).toBe(false));
    await waitFor(() => expect(result.current.error).toContain('étapes n’ont pas été enregistrées'));
    expect(result.current.afterPhotos).toEqual(['stored.png']);
    expect(result.current.completedSteps.has('after_photos')).toBe(true);
    expect(JSON.parse(saved.completedSteps!)).not.toContain('after_photos');
    await act(async () => { await result.current.persistCompletedSteps(result.current.completedSteps); });
    expect(JSON.parse(saved.completedSteps!)).toContain('after_photos');
    expect(interventionsApi.uploadPhotos).toHaveBeenCalledTimes(1);
  });
});
