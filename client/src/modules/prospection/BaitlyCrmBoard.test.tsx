import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {prospectsApi,type ProspectDto} from '../../services/api/prospectsApi';
import BaitlyCrmBoard from './BaitlyCrmBoard';
vi.mock('../../hooks/useTranslation',()=>({useTranslation:()=>({currentLanguage:'fr'})}));
vi.mock('@dnd-kit/core',()=>({
  DndContext:({children,onDragEnd,onDragCancel}:any)=><div>{children}<button onClick={()=>onDragEnd({active:{id:1},over:{id:'IN_DISCUSSION'}})}>Drop next</button><button onClick={()=>onDragEnd({active:{id:1},over:{id:'TO_CONTACT'}})}>Drop same</button><button onClick={()=>onDragEnd({active:{id:1},over:null})}>Drop outside</button><button onClick={onDragCancel}>Cancel drag</button></div>,
  DragOverlay:({children}:any)=>children,MouseSensor:{},TouchSensor:{},KeyboardSensor:{},useSensor:()=>({}),useSensors:()=>[],useDraggable:()=>({attributes:{},listeners:{},setNodeRef:()=>{},setActivatorNodeRef:()=>{},isDragging:false}),useDroppable:()=>({setNodeRef:()=>{},isOver:false}),pointerWithin:()=>[],rectIntersection:()=>[],
}));
const contact:ProspectDto={id:1,name:'Samira',contactType:'OWNER',contactNature:'PRIVATE',category:'OWNERS',status:'TO_CONTACT',sourceType:'MANUAL',archived:false};
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(canManage=true){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><BaitlyCrmBoard contacts={[contact]} status="all" canManage={canManage} onOpen={vi.fn()}/></QueryClientProvider>);}
it('persists only the relationship stage when dropped into another column',async()=>{
  const update=vi.spyOn(prospectsApi,'update').mockResolvedValue({...contact,status:'IN_DISCUSSION'});setup();fireEvent.click(screen.getByRole('button',{name:'Drop next'}));
  await waitFor(()=>expect(update).toHaveBeenCalledWith(1,{status:'IN_DISCUSSION'}));expect(await screen.findByRole('status')).toHaveTextContent('Étape enregistrée.');
});
it('does not write for the current column, an outside drop or a cancelled drag',()=>{
  const update=vi.spyOn(prospectsApi,'update');setup();for(const name of ['Drop same','Drop outside','Cancel drag'])fireEvent.click(screen.getByRole('button',{name}));expect(update).not.toHaveBeenCalled();
});
it('restores the original column after a failed save',async()=>{
  let reject!:(error:Error)=>void;vi.spyOn(prospectsApi,'update').mockImplementation(()=>new Promise((_,fail)=>{reject=fail;}));setup();fireEvent.click(screen.getByRole('button',{name:'Drop next'}));
  expect(within(screen.getByRole('region',{name:'En échange'})).getByText('Samira')).toBeInTheDocument();await waitFor(()=>expect(reject).toBeDefined());reject(new Error('Forbidden'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Le déplacement n’a pas pu être enregistré.');expect(within(screen.getByRole('region',{name:'À qualifier'})).getByText('Samira')).toBeInTheDocument();
});
it('keeps read-only users from dragging or submitting a stage change',()=>{
  const update=vi.spyOn(prospectsApi,'update');setup(false);expect(screen.queryByRole('button',{name:'Déplacer : Samira'})).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Drop next'}));expect(update).not.toHaveBeenCalled();
});
