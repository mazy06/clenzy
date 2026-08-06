import React from 'react';
import { SmartToy as BotIcon } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';

interface AssistantEmptyStateProps {
  /** {@code compact} = panneau docké : invitation courte. */
  compact?: boolean;
}

/**
 * Fil vide : le badge d'agent et l'invitation, rien de plus.
 *
 * <p>Les amorces ne sont PAS ici : elles vivent dans la rangée permanente
 * ({@link AssistantSuggestions}) juste sous le fil, comme dans la projection.
 * Les dupliquer ferait deux fois la même offre à l'écran.</p>
 */
export const AssistantEmptyState: React.FC<AssistantEmptyStateProps> = ({ compact = false }) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 px-4 py-8 text-center">
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
        <BotIcon className="size-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-balance">{t('assistant.empty.title')}</p>
        <p className="mx-auto mt-1 max-w-[420px] text-xs text-muted-foreground">
          {compact ? t('assistant.empty.body') : t('assistant.empty.bodyLong')}
        </p>
      </div>
    </div>
  );
};
