import React, { useRef } from 'react';
import { ChevronDown, Lock } from '../../../icons';
import { cn } from '../../../utils/cn';
import { useTranslation } from '../../../hooks/useTranslation';
import { AssistantThread } from './AssistantThread';
import { AssistantSuggestions } from './AssistantSuggestions';
import { AssistantComposer } from './AssistantComposer';
import { AssistantEmptyState } from './AssistantEmptyState';
import { AssistantContextChips } from './AssistantContextChips';
import { AssistantAvatar } from './AssistantAvatar';
import type { AgentStatus, DisplayMessage } from '../../../hooks/useAgent';
import '../../supervision/supervision-surfaces.css';
import './assistant-surface.css';

interface AssistantSurfaceProps {
  messages: DisplayMessage[];
  status: AgentStatus;
  error: string | null;
  onSend: (text: string, attachments?: DisplayMessage['attachments']) => void;
  onAbort?: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  headerActions?: React.ReactNode;
  compact?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/** Shared layout: portrait, context, conversation and a persistent composer. */
export function AssistantSurface({
  messages, status, error, onSend, onAbort, draft, onDraftChange,
  headerActions, compact, autoFocus, className,
}: AssistantSurfaceProps) {
  const { t } = useTranslation();
  const composerRef = useRef<HTMLDivElement>(null);
  const ideasRef = useRef<HTMLDetailsElement>(null);
  const isBusy = status === 'sending' || status === 'streaming' || status === 'awaiting_confirmation';
  const choosePrompt = (prompt: string) => {
    onDraftChange(prompt);
    if (ideasRef.current) ideasRef.current.open = false;
    composerRef.current?.querySelector('textarea')?.focus();
  };

  return (
    <div className={cn('baitly-supervision-surface baitly-assistant', className)} data-compact={compact || undefined}>
      <header className="baitly-assistant-header">
        <AssistantAvatar />
        <div className="baitly-assistant-heading">
          <h2>{t('assistant.dockLabel')}</h2>
          <p role="status">{t(isBusy ? 'assistant.thread.working' : 'assistant.headerSubtitle')}</p>
        </div>
        {headerActions && <div className="baitly-assistant-window-actions">{headerActions}</div>}
      </header>
      <AssistantContextChips />
      <AssistantThread messages={messages} emptyState={<AssistantEmptyState onPick={choosePrompt} disabled={isBusy} />} />
      {error && <div role="alert" className="baitly-assistant-error"><strong>{t('assistant.errorTitle')}</strong><p>{error}</p></div>}
      <footer className="baitly-assistant-footer" ref={composerRef}>
        {messages.length > 0 && (
          <details ref={ideasRef} className="baitly-assistant-ideas">
            <summary>{t('assistant.empty.startWith')}<ChevronDown size={16} /></summary>
            <AssistantSuggestions onPick={choosePrompt} disabled={isBusy} />
          </details>
        )}
        <AssistantComposer status={status} value={draft} onChange={onDraftChange} onSend={onSend} onAbort={onAbort} autoFocus={autoFocus} />
        <p className="baitly-assistant-reassurance"><Lock size={13} aria-hidden="true" />{t('assistant.composer.hint')}</p>
      </footer>
    </div>
  );
}
