import { useTranslation } from '../../../hooks/useTranslation';
import { AssistantAvatar } from './AssistantAvatar';
import { AssistantSuggestions } from './AssistantSuggestions';

export function AssistantEmptyState({ onPick, disabled }: { onPick: (prompt: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <section className="baitly-assistant-welcome">
      <div className="baitly-assistant-introduction">
        <AssistantAvatar />
        <p className="baitly-assistant-eyebrow">{t('assistant.empty.eyebrow')}</p>
        <h2>{t('assistant.empty.title')}</h2>
        <p>{t('assistant.empty.body')}</p>
      </div>
      <p className="baitly-assistant-section-label">{t('assistant.empty.startWith')}</p>
      <AssistantSuggestions onPick={onPick} disabled={disabled} />
    </section>
  );
}
