import { useEffect,useState } from 'react';
import {DndContext,DragOverlay,MouseSensor,TouchSensor,KeyboardSensor,useSensor,useSensors,useDraggable,useDroppable,pointerWithin,rectIntersection,type DragEndEvent,type KeyboardCoordinateGetter} from '@dnd-kit/core';
import {Alert,AlertDescription} from '../../components/ui';
import {GripVertical} from '../../icons/glyphs';
import {useUpdateProspect} from '../../hooks/useProspects';
import {crmDragMessages} from '../../i18n/baitlyCrmDragMessages';
import PagePagination from '../../components/PagePagination';
import { useTranslation } from '../../hooks/useTranslation';
import { prospectionMessages } from '../../i18n/baitlyProspectionMessages';
import type { ProspectDto } from '../../services/api/prospectsApi';
import { BAITLY_CRM_STATUSES } from './BaitlyCrmFields';
import BaitlyCrmContactCard from './BaitlyCrmContactCard';
export const BAITLY_CRM_STAGE_KEYS=['qualify','discuss','partner','rejected'] as const;
const columnCoordinates:KeyboardCoordinateGetter=(event,{currentCoordinates,context})=>{
  if(!['ArrowLeft','ArrowRight'].includes(event.code))return;
  event.preventDefault();const rect=context.collisionRect;if(!rect)return;
  const columns=context.droppableContainers.getEnabled().map(container=>context.droppableRects.get(container.id)).filter((value):value is NonNullable<typeof value>=>!!value);
  const x=rect.left+rect.width/2;const candidates=columns.filter(column=>event.code==='ArrowRight'?column.left+column.width/2>x+1:column.left+column.width/2<x-1).sort((a,b)=>Math.abs(a.left+a.width/2-x)-Math.abs(b.left+b.width/2-x));
  const target=candidates[0];if(target)return {x:currentCoordinates.x+target.left+target.width/2-x,y:currentCoordinates.y+target.top+Math.min(target.height/2,100)-(rect.top+rect.height/2)};
};
export default function BaitlyCrmBoard({contacts,status,selected,onOpen,canManage=false}:{contacts:ProspectDto[];status:string;selected?:number;onOpen:(id:number)=>void;canManage?:boolean}){
  const {currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);const d=crmDragMessages(currentLanguage);const update=useUpdateProspect();
  const [active,setActive]=useState<ProspectDto|null>(null);const [pending,setPending]=useState<{id:number;status:string}|null>(null);const [notice,setNotice]=useState('');
  const sensors=useSensors(useSensor(MouseSensor,{activationConstraint:{distance:5}}),useSensor(TouchSensor,{activationConstraint:{delay:200,tolerance:8}}),useSensor(KeyboardSensor,{coordinateGetter:columnCoordinates}));
  const blocked=!canManage||update.isPending;
  function finish(event:DragEndEvent){setActive(null);if(blocked||!event.over)return;const contact=contacts.find(item=>item.id===event.active.id);const target=String(event.over.id);if(!contact||contact.archived||!BAITLY_CRM_STATUSES.includes(target)||target===contact.status)return;
    const restoreFocus=()=>{if(event.activatorEvent?.type==='keydown')requestAnimationFrame(()=>document.getElementById(`baitly-crm-drag-${contact.id}`)?.focus());};
    setPending({id:contact.id,status:target});setNotice(d.moving);update.mutate({id:contact.id,data:{status:target}},{onSuccess:()=>{setPending(null);setNotice(d.saved);restoreFocus();},onError:()=>{setPending(null);setNotice('');restoreFocus();}});
  }
  const visible=contacts.map(contact=>pending?.id===contact.id?{...contact,status:pending.status}:contact);
  return <><p role="status" className="sr-only">{notice}</p>{update.isError&&<Alert variant="destructive"><AlertDescription>{d.error}</AlertDescription></Alert>}
    <DndContext sensors={sensors} collisionDetection={args=>{const hits=pointerWithin(args);return hits.length?hits:rectIntersection(args);}}
      accessibility={{screenReaderInstructions:{draggable:d.instructions},announcements:{onDragStart:({active})=>d.picked(contacts.find(contact=>contact.id===active.id)?.name??''),onDragOver:({over})=>over?d.over(m[BAITLY_CRM_STAGE_KEYS[BAITLY_CRM_STATUSES.indexOf(String(over.id))]]):undefined,onDragEnd:({active,over})=>over&&contacts.find(contact=>contact.id===active.id)?.status!==String(over.id)?d.moving:d.cancelled,onDragCancel:()=>d.cancelled}}}
      onDragStart={event=>{if(!blocked){setActive(contacts.find(contact=>contact.id===event.active.id)??null);setNotice('');}}} onDragEnd={finish} onDragCancel={()=>{setActive(null);setNotice(d.cancelled);}}>
      <div className="bcrm-board" data-single={status!=='all'} aria-label={m.crm} aria-busy={update.isPending}>
        {BAITLY_CRM_STATUSES.map((stage,index)=>status==='all'||status===stage?<Stage key={stage} stage={stage} title={m[BAITLY_CRM_STAGE_KEYS[index]]} help={m[`${BAITLY_CRM_STAGE_KEYS[index]}Help`]} index={index}
          contacts={visible.filter(contact=>contact.status===stage)} selected={selected} revealId={pending?.status===stage?pending.id:undefined} blocked={blocked} onOpen={onOpen}/>:null)}
      </div>
      <DragOverlay dropAnimation={null}>{active&&<div className="bcrm-drag-preview"><strong>{active.name}</strong><span>{m.stage}</span></div>}</DragOverlay>
    </DndContext>
  </>;
}
function Stage({stage,title,help,index,contacts,selected,onOpen,blocked,revealId}:{stage:string;title:string;help:string;index:number;contacts:ProspectDto[];selected?:number;onOpen:(id:number)=>void;blocked:boolean;revealId?:number}){
  const {currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);const [page,setPage]=useState(0);const {setNodeRef,isOver}=useDroppable({id:stage,disabled:blocked});
  const revealPage=revealId===undefined?-1:Math.floor(contacts.findIndex(contact=>contact.id===revealId)/10);
  useEffect(()=>{if(revealPage>=0)setPage(revealPage);},[revealId,revealPage]);
  const currentPage=Math.min(page,Math.max(0,Math.ceil(contacts.length/10)-1));
  return <section ref={setNodeRef} className="bcrm-stage" data-stage={stage} data-drop-over={isOver} aria-label={title}>
    <header><div><span className="bcrm-stage__number">{String(index+1).padStart(2,'0')}</span><h3>{title}</h3><span className="bcrm-stage__count tabular-nums">{contacts.length}</span></div><p>{help}</p></header>
    <div className="bcrm-stage__contacts">{contacts.length?contacts.slice(currentPage*10,currentPage*10+10).map(contact=><DraggableContact key={contact.id} contact={contact} selected={selected===contact.id} blocked={blocked||contact.archived} onOpen={()=>onOpen(contact.id)}/>):<p className="bcrm-stage__empty">{m.noStage}</p>}</div>
    {contacts.length>10&&<PagePagination page={currentPage} count={contacts.length} rowsPerPage={10} onPageChange={setPage}/>}
  </section>;
}
function DraggableContact({contact,selected,blocked,onOpen}:{contact:ProspectDto;selected:boolean;blocked:boolean;onOpen:()=>void}){
  const {currentLanguage}=useTranslation();const d=crmDragMessages(currentLanguage);const {attributes,listeners,setNodeRef,setActivatorNodeRef,isDragging}=useDraggable({id:contact.id,disabled:blocked});
  return <div ref={setNodeRef} className="bcrm-draggable-contact" data-dragging={isDragging}>
    {!blocked&&<button type="button" id={`baitly-crm-drag-${contact.id}`} ref={setActivatorNodeRef} {...attributes} {...listeners} className="bcrm-drag-handle" aria-label={`${d.move} : ${contact.name}`} title={d.move}><GripVertical size={16} aria-hidden/></button>}
    <BaitlyCrmContactCard contact={contact} selected={selected} onOpen={onOpen}/>
  </div>;
}
