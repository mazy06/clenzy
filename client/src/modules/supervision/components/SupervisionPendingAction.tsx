import { useId, useState } from 'react';
import { Gavel, Check, Close } from '../../../icons';
import { Button } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { DescriptionNarrative } from './ActionDescription';
import { ActionIllustratedHeading } from './ActionIllustration';
import type { PendingAgentAction } from '../types';
import '../supervision-surfaces.css';

export interface SupervisionPendingActionProps {
  action: PendingAgentAction;
  /** Decision resumes the paused run. Description formatting never executes it. */
  onResolve: (confirmed: boolean) => void;
}

/** Live approvals share the same readable surface as persistent HITL cards. */
export function SupervisionPendingAction({ action, onResolve }: SupervisionPendingActionProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const resolve = (confirmed: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    onResolve(confirmed);
  };
  return (
    <div className="baitly-supervision-surface w-[340px] max-w-full">
      <section role="alertdialog" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={submitting} className="baitly-hitl-card">
        <div className="baitly-hitl-content">
          <p className="m-0 mb-2 flex items-center gap-2 text-xs font-medium text-warning-ink"><Gavel size={15} aria-hidden />{t('supervision.approval.title', 'Validation requise')}</p>
          <ActionIllustratedHeading>
            <h3 id={titleId} dir="auto" className="m-0 text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{action.toolName}</h3>
          </ActionIllustratedHeading>
          <div id={descriptionId} className="baitly-action-description"><DescriptionNarrative text={action.message} /></div>
        </div>
        <div className="baitly-hitl-actions flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="baitly-hitl-secondary" disabled={submitting} onClick={() => resolve(false)}><Close size={15} />{t('supervision.approval.reject', 'Refuser')}</Button>
          <Button size="sm" className="baitly-hitl-primary" disabled={submitting} onClick={() => resolve(true)}><Check size={15} />{submitting ? t('supervision.approval.submitting', 'Transmission…') : t('supervision.approval.validate', 'Valider')}</Button>
        </div>
      </section>
    </div>
  );
}
