import {useId,useState} from 'react';
import {ChevronDown} from '../../icons';
import {Button} from '../../components/ui/button';
import {baitlyDirectoryServices} from '../../config/baitlyDirectoryServices';
import {professionalDirectoryMessages} from '../../i18n/baitlyProfessionalDirectoryMessages';
import type {DirectoryService} from '../../services/api/baitlyProfessionalDirectoryApi';

/** Inline expansion stays inside header filter panels, including when those panels are portalled. */
export default function BaitlyDirectoryServiceFilter({value,onChange,language}:{value:DirectoryService[];onChange:(value:DirectoryService[])=>void;language:string}){
 const m=professionalDirectoryMessages(language),id=useId(),[open,setOpen]=useState(false);
 const names=value.map(code=>m[code]).join(', '),label=value.length>1?`${value.length} ${m.selected}`:names||m.allServices;
 return <fieldset className="min-w-0 space-y-2"><legend className="text-sm">{m.service}</legend>
  <Button type="button" variant="outline" size="sm" className="w-full min-w-0 justify-between gap-2 font-normal" aria-label={m.service} title={names||m.allServices} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(previous=>!previous)}><span className="truncate tabular-nums">{label}</span><ChevronDown size={14} className="shrink-0" aria-hidden/></Button>
  {open&&<div id={id} className="max-h-64 space-y-1 overflow-y-auto overscroll-contain" role="group" aria-label={m.service}>
   <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-muted"><input type="checkbox" className="size-4 shrink-0 cursor-pointer" style={{accentColor:'var(--bui-primary)'}} checked={value.length===0} onChange={()=>onChange([])}/>{m.allServices}</label>
   {baitlyDirectoryServices.map(code=><label key={code} className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-muted"><input type="checkbox" className="size-4 shrink-0 cursor-pointer" style={{accentColor:'var(--bui-primary)'}} checked={value.includes(code)} onChange={event=>onChange(baitlyDirectoryServices.filter(item=>item===code?event.target.checked:value.includes(item)))}/>{m[code]}</label>)}
  </div>}
 </fieldset>;
}
