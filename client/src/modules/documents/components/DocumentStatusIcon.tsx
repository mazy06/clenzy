import { useState } from 'react';
import { Archive, CircleCheck, CircleDashed, CircleHelp, Clock3, FileCheck2, LoaderCircle, LockKeyhole, Pause, Send, ShieldAlert, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip';
import './documentStatusIcon.css';

const states = {
  ACTIVE: [CircleCheck, 'success'], APPROVED: [CircleCheck, 'success'], READY: [FileCheck2, 'success'],
  COMPLETED: [CircleCheck, 'success'], CHECKED: [FileCheck2, 'success'], DELIVERED: [CircleCheck, 'success'],
  SENT: [Send, 'success'], INACTIVE: [Pause, 'muted'], PAUSED: [Pause, 'warning'],
  PENDING: [Clock3, 'warning'], TO_CHECK: [CircleDashed, 'warning'], PREPARING: [Clock3, 'warning'],
  GENERATING: [LoaderCircle, 'info'], FAILED: [XCircle, 'destructive'], BOUNCED: [XCircle, 'destructive'],
  REJECTED: [XCircle, 'destructive'], BLOCKED: [ShieldAlert, 'destructive'],
  LOCKED: [LockKeyhole, 'info'], ARCHIVED: [Archive, 'muted'], COPY: [Archive, 'muted'],
} as const;

/** A real focusable control: status explanations also work on touch screens. */
export default function DocumentStatusIcon({ value, label }: { value: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [Icon, tone] = Object.prototype.hasOwnProperty.call(states, value)
    ? states[value as keyof typeof states] : [CircleHelp, 'muted'];
  return <Tooltip open={open} onOpenChange={setOpen} delayDuration={150}>
    <TooltipTrigger asChild>
      <button type="button" className="documents-status" data-tone={tone} aria-label={label}
        onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}>
        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="max-w-72 text-xs">{label}</TooltipContent>
  </Tooltip>;
}
