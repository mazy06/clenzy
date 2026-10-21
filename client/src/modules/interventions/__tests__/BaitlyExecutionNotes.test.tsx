import { useMemo, useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useInterventionNotes } from '../useInterventionNotes';
import { interventionsApi } from '../../../services/api/interventionsApi';
import type { InterventionDetailsData } from '../interventionUtils';
import type { InitialLoadData } from '../useInterventionState';
vi.mock('../../../services/api/interventionsApi',()=>({interventionsApi:{updateNotes:vi.fn(),getById:vi.fn()}}));
vi.mock('../../../hooks/useTranslation',()=>({useTranslation:()=>({t:(key:string)=>key})}));
vi.mock('../useInterventionsList',()=>({interventionsKeys:{detail:(id:string)=>['intervention',id]}}));
afterEach(()=>{cleanup();vi.clearAllMocks();vi.useRealTimers();});
function mount(savedNotes = '{}'){
  const client=new QueryClient({defaultOptions:{mutations:{retry:false}}});
  const wrapper=({children}:PropsWithChildren)=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(()=>{
    const [intervention,setIntervention]=useState<InterventionDetailsData|null>({id:12,status:'IN_PROGRESS',notes:savedNotes} as InterventionDetailsData);
    const [error,setError]=useState<string|null>(null);
    const initialLoadData=useMemo(()=>({intervention,stepNotes:JSON.parse(intervention!.notes),lastSavedNotes:intervention!.notes} as InitialLoadData),[intervention]);
    const notes=useInterventionNotes({id:'12',intervention,setIntervention,setError,initialLoadData});
    return {...notes,error,refresh:setIntervention};
  },{wrapper});
}
it('attend la réponse du backend et ne soumet pas deux fois le compte rendu',async()=>{
  let resolve!:(value:InterventionDetailsData)=>void;
  vi.mocked(interventionsApi.updateNotes).mockReturnValue(new Promise(done=>{resolve=done;}));
  const {result}=mount();
  act(()=>result.current.handleOpenNotesDialog('after_photos'));
  act(()=>result.current.setNotesValue('RECETTE : voyageurs fictifs déposés au point convenu.'));
  let pending!:Promise<void>;
  act(()=>{pending=result.current.handleUpdateNotes();});
  await act(async()=>{await result.current.handleUpdateNotes();});
  expect(interventionsApi.updateNotes).toHaveBeenCalledTimes(1);
  expect(result.current.notesDialogOpen).toBe(true);
  expect(result.current.updatingNotes).toBe(true);
  await act(async()=>{resolve({id:12,status:'IN_PROGRESS',notes:JSON.stringify({after_photos:'RECETTE : voyageurs fictifs déposés au point convenu.'})} as InterventionDetailsData);await pending;});
  expect(result.current.notesDialogOpen).toBe(false);
  expect(result.current.getStepNote('after_photos')).toContain('RECETTE');
});
it('conserve le texte et le dialogue si la sauvegarde échoue',async()=>{
  vi.mocked(interventionsApi.updateNotes).mockRejectedValueOnce(new Error('HTTP 500'));
  vi.mocked(interventionsApi.getById).mockResolvedValueOnce({id:12,notes:'{}'} as InterventionDetailsData);
  const {result}=mount();
  act(()=>result.current.handleOpenNotesDialog('after_photos'));
  act(()=>result.current.setNotesValue('Compte rendu à conserver'));
  await act(async()=>{await result.current.handleUpdateNotes();});
  expect(result.current.notesDialogOpen).toBe(true);
  expect(result.current.notesValue).toBe('Compte rendu à conserver');
  expect(result.current.error).toBe('interventions.detailErrors.updatingNotes');
});
it('confirme une écriture dont la réponse a été perdue sans la rejouer',async()=>{
  const notes=JSON.stringify({after_photos:'Compte rendu confirmé côté serveur'});
  vi.mocked(interventionsApi.updateNotes).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  vi.mocked(interventionsApi.getById).mockResolvedValueOnce({id:12,status:'IN_PROGRESS',notes} as InterventionDetailsData);
  const {result}=mount();
  act(()=>result.current.handleOpenNotesDialog('after_photos'));
  act(()=>result.current.setNotesValue('Compte rendu confirmé côté serveur'));
  await act(async()=>{await result.current.handleUpdateNotes();});
  expect(interventionsApi.updateNotes).toHaveBeenCalledTimes(1);
  expect(interventionsApi.getById).toHaveBeenCalledWith(12);
  expect(result.current.notesDialogOpen).toBe(false);
  expect(result.current.error).toBeNull();
  expect(result.current.getStepNote('after_photos')).toBe('Compte rendu confirmé côté serveur');
});
it('conserve le brouillon si la relecture est aussi indisponible',async()=>{
  vi.mocked(interventionsApi.updateNotes).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  vi.mocked(interventionsApi.getById).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const {result}=mount();
  act(()=>result.current.handleOpenNotesDialog('after_photos'));
  act(()=>result.current.setNotesValue('Brouillon hors ligne'));
  await act(async()=>{await result.current.handleUpdateNotes();});
  expect(interventionsApi.updateNotes).toHaveBeenCalledTimes(1);
  expect(result.current.notesDialogOpen).toBe(true);
  expect(result.current.notesValue).toBe('Brouillon hors ligne');
  expect(result.current.error).toBe('interventions.detailErrors.updatingNotes');
});
it('ne renvoie pas les anciennes notes après un enregistrement confirmé',async()=>{
  vi.useFakeTimers();
  vi.mocked(interventionsApi.updateNotes).mockImplementation(async(id,notes)=>({id,status:'IN_PROGRESS',notes} as InterventionDetailsData));
  const {result,unmount}=mount(JSON.stringify({inspection:'Ancienne note'}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
  act(()=>result.current.handleOpenNotesDialog('after_photos'));
  act(()=>result.current.setNotesValue('Compte rendu confirmé'));
  await act(async()=>{await result.current.handleUpdateNotes();});
  await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});
  act(()=>unmount());
  expect(interventionsApi.updateNotes).toHaveBeenCalledTimes(1);
  expect(JSON.parse(vi.mocked(interventionsApi.updateNotes).mock.calls[0][1])).toEqual({inspection:'Ancienne note',after_photos:'Compte rendu confirmé'});
});
it('préserve le brouillon ouvert pendant une actualisation de la fiche',()=>{
  const {result}=mount(JSON.stringify({inspection:'Note enregistrée'}));
  act(()=>result.current.handleOpenNotesDialog('after_photos'));
  act(()=>result.current.setNotesValue('Brouillon en cours de rédaction'));
  act(()=>result.current.refresh({id:12,status:'IN_PROGRESS',notes:JSON.stringify({inspection:'Note enregistrée',rooms:{general:'Autre étape actualisée'}})} as InterventionDetailsData));
  expect(result.current.notesDialogOpen).toBe(true);
  expect(result.current.notesValue).toBe('Brouillon en cours de rédaction');
  expect(interventionsApi.updateNotes).not.toHaveBeenCalled();
});
