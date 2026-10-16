import StatusChip from '../../../components/StatusChip';
import { ChevronRight, ShieldAlert } from '../../../icons/glyphs';
import { useMapRowFocus } from './MapRowInteractions';
import { useTranslation } from '../../../hooks/useTranslation';
import type { Issue } from '../../../services/api/issuesApi';
import { activeIntlLocale } from '../../../utils/activeLocale';
import { cn } from '../../../utils/cn';
import { ISSUE_SEVERITY_TONES, ISSUE_STATUS_TONES } from '../../work-orders/issuePresentation';

/** Une anomalie : gravité, constat, logement (sauf dans sa fiche), signalement. Ouvre son détail. */
export default function IssueMapRow({ issue, onOpen, showProperty = true, compact = false }: {
  issue: Issue; onOpen: (issue: Issue) => void; showProperty?: boolean; compact?: boolean;
}) {
  const { t } = useTranslation();
  const locate = useMapRowFocus();
  const urgent = issue.severity === 'CRITICAL' || issue.severity === 'HIGH';
  const reported = new Intl.DateTimeFormat(activeIntlLocale(), { day: 'numeric', month: 'short' }).format(new Date(issue.createdAt));
  return (
    <div className="flex items-stretch"><button type="button" onClick={locate ?? (() => onOpen(issue))}
      className={cn('flex w-full cursor-pointer items-center gap-3 text-start transition-colors duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        compact ? 'rounded-md px-1.5 py-1.5' : 'px-4 py-3')}>
      <span className={cn('grid shrink-0 place-items-center rounded-md', compact ? 'size-7' : 'size-9',
        urgent ? 'bg-[var(--bui-destructive-soft)] text-[var(--bui-destructive-ink)]' : 'bg-[var(--bui-navy-soft)] text-[var(--bui-navy)]')}>
        <ShieldAlert size={compact ? 15 : 18} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('truncate font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>{issue.title}</span>
        {showProperty && issue.propertyName && <span className="truncate text-xs text-muted-foreground">{issue.propertyName}</span>}
        <span className={cn('truncate tabular-nums text-muted-foreground', compact ? 'text-2xs' : 'text-xs')}>
          {reported}{issue.reportedByName ? ` · ${issue.reportedByName}` : ''}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 [&>*]:scale-90">
        <StatusChip tone={ISSUE_SEVERITY_TONES[issue.severity]} label={t(`issues.severity.${issue.severity.toLowerCase()}`, issue.severity)} dot />
        {!compact && <StatusChip tone={ISSUE_STATUS_TONES[issue.status]} label={t(`issues.status.${issue.status.toLowerCase()}`, issue.status)} />}
      </span>
    </button>
    {locate && <button type="button" onClick={() => onOpen(issue)} aria-label={`${t('common.details', 'Détails')} · ${issue.title}`}
      className="flex w-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
      <ChevronRight className="size-4" aria-hidden />
    </button>}</div>
  );
}
