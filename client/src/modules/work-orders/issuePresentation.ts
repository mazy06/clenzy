import type { StatusTone } from '../../components/StatusChip';
import type { IssueSeverity, IssueStatus } from '../../services/api/issuesApi';

// Tons et listes des anomalies, partagés par l'écran Anomalies et la vue Anomalies de la carte.
export const ISSUE_STATUS_TONES: Record<IssueStatus, StatusTone> = {
  OPEN: 'warn',
  QUALIFIED: 'info',
  CONVERTED: 'ok',
  DISMISSED: 'neutral',
};

export const ISSUE_SEVERITY_TONES: Record<IssueSeverity, StatusTone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warn',
  CRITICAL: 'err',
};

export const ISSUE_SEVERITIES: IssueSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
// Miroir des catégories du mobile (AnomalyReportScreen) — mêmes valeurs backend.
export const ISSUE_CATEGORIES = ['DAMAGE', 'MISSING_ITEM', 'HYGIENE', 'EQUIPMENT', 'SAFETY', 'OTHER'] as const;
export const ISSUE_STATUSES: IssueStatus[] = ['OPEN', 'QUALIFIED', 'CONVERTED', 'DISMISSED'];
