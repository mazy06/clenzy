import * as React from 'react';
import { ListChecksIcon } from 'lucide-react';
import { Button } from '../../components/ui';
import { Money } from '../../components/baitly/Money';
import { useTranslation } from '../../hooks/useTranslation';
import type { DashboardActionKind, DashboardActionSeverity } from '../../services/api/dashboardOperationsApi';
import { DashboardQueueGroup, DashboardQueueToggle } from './DashboardQueue';
export { DashboardQueueRow as ActionRow } from './DashboardQueue';

const GROUP_PREVIEW = 3;

/** Reuse the KPI packshots; technical exceptions retain their precise symbol. */
const ARTWORK: Partial<Record<DashboardActionKind, string>> = {
  RESERVATION_PENDING: '/images/dashboard-kpis/bookings.webp',
  FEED_STALE: '/images/dashboard-kpis/bookings.webp',
  CHECKIN_NOT_STARTED: '/images/dashboard-kpis/adr.webp',
  WELCOME_GUIDE_MISSING: '/images/dashboard-kpis/adr.webp',
  REVIEW_UNANSWERED: '/images/dashboard-kpis/rating.webp',
  PAYMENT_INCIDENT: '/images/dashboard-kpis/revenue.webp',
  BALANCE_DUE: '/images/dashboard-kpis/revenue.webp',
  BALANCE_ABANDONED: '/images/dashboard-kpis/revenue.webp',
  DEPOSIT_STUCK: '/images/dashboard-kpis/revenue.webp',
  OWNER_PAYOUT_PENDING: '/images/dashboard-kpis/revenue.webp',
  PAYOUT_ONBOARDING_INCOMPLETE: '/images/dashboard-kpis/revenue.webp',
  SERVICE_UNPAID: '/images/dashboard-actions/service-payment.webp',
  SERVICE_UNASSIGNED: '/images/dashboard-actions/intervention-assignment.webp',
  INTERVENTION_OVERDUE: '/images/dashboard-actions/intervention-overdue.webp',
  INTERVENTION_UNASSIGNED: '/images/dashboard-actions/intervention-assignment.webp',
  INTERVENTION_UNPAID: '/images/dashboard-actions/service-payment.webp',
  CONVERSATION_UNANSWERED: '/images/dashboard-actions/messages.webp',
  GUEST_MESSAGE_FAILED: '/images/dashboard-actions/messages.webp',
  INVITATION_EXPIRED: '/images/dashboard-actions/messages.webp',
};

/** A single open category, with an inset detail surface joined by concave shoulders. */
export function ActionGroup({
  kind, icon, label, total, shown, severity, amount, open, onToggle,
  shownOfLabel, moreLabel, lessLabel, bulkLabel, onBulk, children,
}: {
  kind: DashboardActionKind;
  icon: React.ReactNode;
  label: string;
  total: number;
  shown: number;
  severity: DashboardActionSeverity;
  amount: number | null;
  open: boolean;
  onToggle: () => void;
  shownOfLabel: (shown: number, total: number) => string;
  moreLabel: (count: number) => string;
  lessLabel: string;
  bulkLabel?: string;
  onBulk: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = React.useState(false);
  React.useEffect(() => { if (!open) setShowAll(false); }, [open]);
  const rows = React.Children.toArray(children);
  const hiddenHere = Math.max(0, rows.length - GROUP_PREVIEW);
  const artwork = ARTWORK[kind];
  const severityLabel = severity === 'critical'
    ? t('dashboard.actionItems.priorityCritical', 'Prioritaire')
    : severity === 'warning'
      ? t('dashboard.actionItems.priorityWarning', 'À suivre')
      : t('dashboard.actionItems.priorityInfo', 'À examiner');
  if (total === 0) return null;

  return <DashboardQueueGroup label={label} count={total} open={open} onToggle={onToggle}
    artwork={artwork ? <img src={artwork} alt="" width={192} height={192} decoding="async" loading="lazy" /> : icon}
    meta={<span className="db-queue-group__priority" data-severity={severity}>{severityLabel}</span>}
    value={amount != null ? <Money value={amount} decimals={0} /> : undefined}>
      <div className="db-queue-group__rows">{showAll ? rows : rows.slice(0, GROUP_PREVIEW)}</div>
      {(hiddenHere > 0 || shown < total || bulkLabel) && <div className="db-queue-group__footer">
        <div className="db-queue-group__more">
          {hiddenHere > 0 && <DashboardQueueToggle expanded={showAll} onToggle={() => setShowAll((all) => !all)} moreLabel={moreLabel(hiddenHere)} lessLabel={lessLabel} />}
          {/* The server caps rows: always disclose the limit, even with only 1–3 returned. */}
          {shown < total && <span>{shownOfLabel(showAll ? shown : Math.min(shown, GROUP_PREVIEW), total)}</span>}
        </div>
        {bulkLabel && <Button size="sm" className="db-queue__bulk" onClick={onBulk}>
          <ListChecksIcon aria-hidden="true" />
          <span>{bulkLabel}</span>
        </Button>}
      </div>}
  </DashboardQueueGroup>;
}
