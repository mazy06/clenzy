import { Archive, CircleCheck, CircleDashed, CircleHelp, Clock3, FileCheck2, LoaderCircle, LockKeyhole, Pause, Send, ShieldAlert, XCircle } from 'lucide-react';
import StatusIcon from '../../../components/StatusIcon';

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
  const [Icon, tone] = Object.prototype.hasOwnProperty.call(states, value)
    ? states[value as keyof typeof states] : [CircleHelp, 'muted'] as const;
  return <StatusIcon icon={Icon} tone={tone} label={label} className="documents-status" />;
}
