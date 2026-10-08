import React from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useCanSuperviseAgents } from '../../supervision/useCanSuperviseAgents';
import { useSupervisionPendingCounts } from '../../supervision/useSupervisionPendingCounts';

/** Real pending counts, using the same query cache as the supervision panel. */
export const AssistantContextChips: React.FC = () => {
  const { t, currentLanguage } = useTranslation();
  const { canView } = useCanSuperviseAgents();
  const { total } = useSupervisionPendingCounts(canView);
  const formattedCount = new Intl.NumberFormat(currentLanguage, {
    numberingSystem: currentLanguage.startsWith('ar') ? 'arab' : undefined,
  }).format(total);

  if (total <= 0) return null;

  return (
    <div className="baitly-assistant-context">
      <span className="baitly-assistant-context-dot" aria-hidden="true" />
      <span>{t('assistant.context.pending', { count: total, formattedCount })}</span>
      <span className="baitly-assistant-context-caption">{t('assistant.context.caption')}</span>
    </div>
  );
};
