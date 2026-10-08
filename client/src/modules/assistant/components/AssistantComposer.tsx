import React, { useId } from 'react';
import { Send, Close } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import type { AgentStatus } from '../../../hooks/useAgent';

interface AssistantComposerProps {
  status: AgentStatus;
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onAbort?: () => void;
  autoFocus?: boolean;
}

/** The draft belongs to the dock, so expanding or closing it never erases it. */
export function AssistantComposer({ status, value, onChange, onSend, onAbort, autoFocus }: AssistantComposerProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const isBusy = status === 'sending' || status === 'streaming';
  const isBlocked = isBusy || status === 'awaiting_confirmation';
  const submit = () => {
    if (!value.trim() || isBlocked) return;
    onSend(value.trim());
    onChange('');
  };

  return (
    <form className="baitly-assistant-composer" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // An IME confirmation is not a request to send the message.
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
            event.preventDefault();
            submit();
          }
        }}
        aria-label={t('assistant.composer.label')}
        aria-describedby={hintId}
        placeholder={t('assistant.composer.placeholder')}
        autoFocus={autoFocus}
        rows={2}
        dir={value.trim() ? 'auto' : undefined}
      />
      <div className="baitly-assistant-composer-tools">
        <span id={hintId}>{t(status === 'awaiting_confirmation' ? 'assistant.composer.confirmation' : 'assistant.composer.keyboardHint')}</span>
        {isBusy && onAbort ? (
          <button type="button" className="baitly-assistant-send" onClick={onAbort} aria-label={t('assistant.composer.stop')}>
            <Close size={18} />
          </button>
        ) : (
          <button type="submit" className="baitly-assistant-send" disabled={!value.trim() || isBlocked} aria-label={t('assistant.composer.send')}>
            <Send size={18} className="rtl:-scale-x-100" />
          </button>
        )}
      </div>
    </form>
  );
}
