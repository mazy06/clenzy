import {
  BadgeCheck, CalendarCheck, CircleCheck, CircleHelp, CirclePause, CirclePlay,
  CircleX, ClipboardCheck, CreditCard, Hourglass, UserRoundCheck,
} from '../icons/glyphs';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui';
import type { ToneTokens } from './StatusChip';

const STATUS_ICONS: Record<string, typeof Hourglass> = {
  PENDING: Hourglass,
  AWAITING_VALIDATION: ClipboardCheck,
  AWAITING_PAYMENT: CreditCard,
  SCHEDULED: CalendarCheck,
  APPROVED: BadgeCheck,
  ASSIGNED: UserRoundCheck,
  DEVIS_ACCEPTED: BadgeCheck,
  IN_PROGRESS: CirclePlay,
  ON_HOLD: CirclePause,
  COMPLETED: CircleCheck,
  CANCELLED: CircleX,
  REJECTED: CircleX,
};

/** Indicateur de carte Baitly : le libellé reste accessible au clavier et au survol. */
export default function ServiceMapIndicator({ label, tokens, icon: Icon = CircleHelp }: {
  label: string;
  tokens: ToneTokens;
  icon?: typeof Hourglass;
}) {
  return <Tooltip>
    <TooltipTrigger asChild>
      <span tabIndex={0} role="img" aria-label={label}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        style={{ color: tokens.color, backgroundColor: tokens.bg }}>
        <Icon className="size-4" aria-hidden />
      </span>
    </TooltipTrigger>
    <TooltipContent side="top">{label}</TooltipContent>
  </Tooltip>;
}

export function ServiceMapStatus({ status, label, tokens }: { status: string; label: string; tokens: ToneTokens }) {
  return <ServiceMapIndicator icon={STATUS_ICONS[status.toUpperCase()]} label={label} tokens={tokens} />;
}
