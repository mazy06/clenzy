import { ArrowDown, ArrowUpRight, Ban, Banknote, CircleCheck, CircleDashed, CircleHelp, Clock3, FileCheck2, FileSearch, FileText, Link2, LoaderCircle, RotateCcw, Send, ShieldAlert, TriangleAlert, Undo2, XCircle, type IconComponent } from '../../../icons/glyphs';
import StatusIcon, { type StatusIconTone } from '../../../components/StatusIcon';

const states: Record<string, readonly [IconComponent, StatusIconTone]> = {
  DRAFT: [CircleDashed, 'muted'], PENDING: [Clock3, 'warning'], ISSUED: [FileSearch, 'warning'],
  SENT: [Send, 'info'], APPROVED: [FileCheck2, 'info'], PAID: [CircleCheck, 'success'],
  PROCESSING: [LoaderCircle, 'info'], SUBMITTING: [LoaderCircle, 'info'],
  OVERDUE: [TriangleAlert, 'destructive'], FAILED: [XCircle, 'destructive'], BLOCKED: [ShieldAlert, 'warning'],
  CANCELLED: [Ban, 'muted'], REFUNDED: [RotateCcw, 'info'], PARTIALLY_REFUNDED: [Undo2, 'info'],
  CREDIT_NOTE: [FileText, 'info'], UNKNOWN: [CircleHelp, 'warning'], PARTIALLY_PAID: [Clock3, 'warning'],
  NOT_REQUIRED: [Ban, 'muted'], CHANNEL: [Banknote, 'info'], RECONCILIATION_REQUIRED: [Link2, 'warning'],
  TRANSFERRED: [CircleCheck, 'success'], CREDIT: [ArrowDown, 'success'], DEBIT: [ArrowUpRight, 'info'],
  INCLUDED: [FileCheck2, 'info'], AWAITING_VALIDATION: [FileSearch, 'warning'], AWAITING_PAYMENT: [Clock3, 'warning'],
  SCHEDULED: [Clock3, 'info'], IN_PROGRESS: [LoaderCircle, 'info'], ON_HOLD: [Clock3, 'warning'], COMPLETED: [CircleCheck, 'success'],
  WAITING_REFUND: [Clock3, 'warning'], RECOVERING: [LoaderCircle, 'info'], RECOVERED: [RotateCcw, 'success'],
  NO_RECOVERY_REQUIRED: [Ban, 'muted'], REVIEW_REQUIRED: [ShieldAlert, 'warning'],
  externalDocumented: [FileCheck2, 'info'], expensePrepared: [FileSearch, 'warning'], accepted: [CircleCheck, 'success'],
  invited: [Send, 'info'], externalPending: [Clock3, 'warning'], toChoose: [CircleHelp, 'warning'],
};

export default function FinanceStatusIcon({ value, label }: { value: string; label: string }) {
  const [icon, tone] = Object.prototype.hasOwnProperty.call(states, value) ? states[value] : [CircleHelp, 'muted'] as const;
  return <StatusIcon icon={icon} tone={tone} label={label} />;
}
