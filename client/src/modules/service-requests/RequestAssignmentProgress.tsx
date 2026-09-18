import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { invalidateMissionWorkflow } from '../../hooks/invalidateMissionWorkflow';

export interface AssignmentProgress {
  assignmentPhase?: string | null;
  assignmentExpiresAt?: string | null;
  autoAssignStatus?: string | null;
}

/** Échéance partagée avec le serveur, visible aussi par le gestionnaire. */
export default function RequestAssignmentProgress({ assignmentPhase, assignmentExpiresAt, autoAssignStatus }: AssignmentProgress) {
  const { t, currentLanguage } = useTranslation();
  const cache = useQueryClient();
  const [now, setNow] = useState(Date.now);
  const deadline = assignmentExpiresAt ? Date.parse(assignmentExpiresAt) : NaN;
  useEffect(() => {
    if (!Number.isFinite(deadline)) return;
    let refreshed = false;
    const update = () => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline && !refreshed) {
        refreshed = true;
        void invalidateMissionWorkflow(cache);
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [deadline, cache]);
  if (Number.isFinite(deadline)) {
    const minutes = Math.max(0, Math.ceil((deadline-now)/60_000));
    return <p className="flex items-center gap-1 text-xs tabular-nums text-[var(--bui-warning-ink)]"
      title={new Date(deadline).toLocaleString(currentLanguage)}>
      <Clock3 className="size-3.5" aria-hidden />
      {minutes ? t('requestCommercial.expires', {count:minutes}) : t('assignmentProgress.reassigning')}
    </p>;
  }
  const state = assignmentPhase === 'PUBLIC' ? 'public' : assignmentPhase === 'QUOTED' ? 'quoted'
    : assignmentPhase === 'MANUAL' ? (autoAssignStatus === 'public_details' ? 'public_details_required'
      : ['automation_disabled','needs_qualification','too_late'].includes(autoAssignStatus ?? '') ? autoAssignStatus : 'manual')
    : autoAssignStatus === 'waiting_contact' ? 'contact' : 'searching';
  return <p className="text-xs text-muted-foreground" role="status">{t('assignmentProgress.'+state)}</p>;
}
