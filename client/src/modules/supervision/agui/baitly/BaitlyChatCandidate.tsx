import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '../../../../components/ui/button';
import { Textarea } from '../../../../components/ui/textarea';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { useTranslation } from '../../../../hooks/useTranslation';
import { ToolResultRenderer, TOOL_DISPLAY_HINTS, type RenderContext } from '../renderers';
import { PendingHint } from '../renderers/shared';
import type { BaitlyChatAdapter } from './BaitlyChatAdapter';

/** Native Baitly view; restoring never posts or replays an effect. */
export function BaitlyChatCandidate({ adapter, onNavigate }: { adapter: BaitlyChatAdapter; onNavigate?: RenderContext['onNavigate'] }) {
  const { t } = useTranslation();
  const snapshot = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);
  const [draft, setDraft] = useState(''); // Volatile composer, never persisted or replayed.
  const id = useId();
  const navigate:RenderContext['onNavigate']=path=>{
    if(/^\/(?!\/)[^\\\u0000-\u001f]*$/.test(path)) onNavigate?.(path);
  };
  useEffect(() => { void adapter.restore(); return () => adapter.stop(); }, [adapter]);
  const send = () => {
    const text = draft;
    setDraft('');
    // No retry handler, persisted queue or replay on reconnect.
    void adapter.send(text).catch(() => {});
  };
  return <section className="flex min-h-0 flex-col gap-4 text-foreground" aria-label={t('baitlyChatCandidate.title')}>
    {snapshot.phase === 'restoring' && <p role="status" className="text-sm text-muted-foreground">{t('baitlyChatCandidate.restoring')}</p>}
    {snapshot.phase === 'blocked' && <Alert><AlertDescription>{t('baitlyChatCandidate.blocked')}</AlertDescription></Alert>}
    <ol className="m-0 flex list-none flex-col gap-3 p-0" aria-label={t('baitlyChatCandidate.messages')}>
      {snapshot.model.items.map(item => <li key={item.id} className="min-w-0 break-words">
        {item.kind === 'tool' && item.historical && !item.result
          ? <p className="text-sm text-muted-foreground">{t('baitlyChatCandidate.recordedTool')}</p>
          : item.kind === 'tool' ? item.complete
          ? <ToolResultRenderer result={item.result} hintFallback={item.toolName ? TOOL_DISPLAY_HINTS[item.toolName] : null} ctx={{ onNavigate:navigate }} />
          : <PendingHint label={t('supervision.agui.pending.default')} />
          : <><span className="text-xs font-medium text-muted-foreground">{t(item.kind === 'user' ? 'baitlyChatCandidate.you' : 'baitlyChatCandidate.assistant')}</span>
            <div className="max-w-prose text-sm"><ReactMarkdown skipHtml components={{ img: ({ alt }) => <span>{alt}</span> }}>{item.text}</ReactMarkdown></div></>}
        {item.hasAttachments && <p className="text-xs text-muted-foreground">{t('baitlyChatCandidate.historicalAttachment')}</p>}
      </li>)}
    </ol>
    {snapshot.reconciliation.some(row => row.evidence !== 'AWAITING_DECISION') && <section aria-label={t('baitlyChatCandidate.reconciliation')} className="border-t border-border pt-3">
      <h3 className="mb-2 text-sm font-semibold">{t('baitlyChatCandidate.reconciliation')}</h3>
      <p className="mb-3 max-w-prose text-sm text-muted-foreground">{t('baitlyChatCandidate.evidenceNotice')}</p>
      <dl className="flex flex-col gap-2 text-sm">
        {snapshot.reconciliation.filter(row => row.evidence !== 'AWAITING_DECISION').map(row => <div key={row.toolCallId} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="break-words">{row.toolName}</dt>
          <dd className={row.evidence === 'UNCERTAIN' || row.evidence === 'CONFLICT' ? 'text-warning-ink' : 'text-muted-foreground'}>{t(`baitlyChatCandidate.evidence.${row.evidence}`)}</dd>
        </div>)}
      </dl>
    </section>}
    {snapshot.pending.length > 0 && <section aria-label={t('baitlyChatCandidate.pending')} className="border-y border-border py-3">
      <h3 className="mb-2 text-sm font-semibold">{t('baitlyChatCandidate.pending')}</h3>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {snapshot.pending.map(action => <li key={action.toolCallId}>
          <p className="text-sm">{action.description || action.toolName}</p>
          {!action.resumable && <p className="text-xs text-muted-foreground">{t('baitlyChatCandidate.unavailable')}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!action.resumable || snapshot.phase !== 'review'} onClick={() => void adapter.decide(action.toolCallId, true).catch(() => {})}>{t('baitlyChatCandidate.approve')}</Button>
            <Button type="button" size="sm" variant="outline" disabled={!action.resumable || snapshot.phase !== 'review'} onClick={() => void adapter.decide(action.toolCallId, false).catch(() => {})}>{t('baitlyChatCandidate.refuse')}</Button>
          </div>
        </li>)}
      </ul>
    </section>}
    <form className="flex flex-col gap-2 border-t border-border pt-3" onSubmit={event => { event.preventDefault(); send(); }}>
      <label htmlFor={id} className="text-sm font-medium">{t('baitlyChatCandidate.message')}</label>
      <Textarea id={id} value={draft} onChange={event => setDraft(event.target.value)} disabled={snapshot.phase !== 'ready'} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={snapshot.phase !== 'ready' || !draft.trim()}>{t('baitlyChatCandidate.send')}</Button>
        {snapshot.phase === 'running' && <Button type="button" variant="outline" onClick={() => adapter.stop()}>{t('baitlyChatCandidate.stop')}</Button>}
        <Button type="button" variant="ghost" disabled={snapshot.phase === 'running' || snapshot.phase === 'restoring'} onClick={() => void adapter.restore()}>{t('baitlyChatCandidate.check')}</Button>
      </div>
    </form>
  </section>;
}
