import type {ComponentProps,ReactNode} from 'react';
import {Button,Tooltip,TooltipContent,TooltipTrigger} from '../../components/ui';
import '../../components/headerActionColors.css';

/** Compact actions shared by the Baitly CRM header and its portals. */
export default function BaitlyCrmIconAction({label,icon,action,className,...props}:Omit<ComponentProps<typeof Button>,'children'|'size'> & {label:string;icon:ReactNode;action:'create'|'search'|'import'|'locate'|'enrich'|'review'|'refresh'|'save'|'next'|'send'|'cancel'|'table'|'pipeline'}){
 return <Tooltip><TooltipTrigger asChild><span className="inline-flex"><Button variant="ghost" {...props} className={`baitly-header-action ${className??''}`} data-header-action={action} size="icon" aria-label={label}>{icon}</Button></span></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}
