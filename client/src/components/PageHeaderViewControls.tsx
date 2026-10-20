import type {ReactNode} from 'react';
import {Button,Tooltip,TooltipContent,TooltipTrigger} from './ui';
import {usePageHeaderActions,usePageHeaderFilterHost} from './PageHeaderActionsContext';
import './headerActionColors.css';

/** View controls stay visible in the header; standalone sections retain a local fallback. */
export default function PageHeaderViewControls<Value extends string>({label,value,onChange,options}:{
 label:string;value:Value;onChange:(value:Value)=>void;
 options:readonly {value:Value;label:string;icon:ReactNode;action?:string}[];
}){
 const hosted=usePageHeaderFilterHost();
 const controls=<div role="group" aria-label={label} className="flex shrink-0 items-center gap-1">
  {options.map((option,index)=><Tooltip key={option.value}><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon"
   className="baitly-header-action" data-header-action={option.action??(index?'pipeline':'table')}
   aria-label={option.label} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.icon}</Button></TooltipTrigger><TooltipContent>{option.label}</TooltipContent></Tooltip>)}
 </div>;
 const portal=usePageHeaderActions(controls);
 return hosted?portal:controls;
}
