import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import apiClient from '../../services/apiClient';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useTranslation } from '../../hooks/useTranslation';

export interface EmailPreviewSource { subject: string; body: string; wrapperStyle?: string; language?: string }

/** Le serveur utilise l'enveloppe réelle d'envoi, avec un contexte exclusivement fictif. */
export default function EmailTemplatePreview({ subject, body, wrapperStyle = 'NOTIFICATION_GUEST', language = 'fr' }: EmailPreviewSource) {
  const { t } = useTranslation(); const scope = useCommerceScope();
  const [result, setResult] = useState<{ subject: string; html: string } | null>(null);
  const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setResult(null); setError(false);
    const timer = window.setTimeout(() => {
      if (!scope) return;
      void apiClient.post<{ subject: string; html: string }>('/document-previews/email',
        { subject, body, wrapperStyle, language: language.split('-')[0] }, { signal: controller.signal })
        .then(value => { if (!controller.signal.aborted) setResult(value); })
        .catch(() => { if (!controller.signal.aborted) setError(true); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [subject, body, wrapperStyle, language, scope, attempt]);
  return <section className="flex h-full min-h-0 flex-1 flex-col" aria-label={t('documents.emailPreview')} aria-busy={!result && !error}>
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
      <p className="min-w-0 text-sm font-medium break-words">{result?.subject || t('documents.emailPreview')}</p>
      <Button variant="ghost" size="icon-sm" aria-label={t('documents.details.regeneratePreview')} title={t('documents.details.regeneratePreview')}
        disabled={!result && !error} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} /></Button>
    </div>
    {error ? <Alert variant="destructive" role="alert" className="m-4 w-auto"><AlertDescription>{t('documents.previewError')}</AlertDescription></Alert>
      : result ? <iframe title={t('documents.emailPreview')} srcDoc={result.html} sandbox="" referrerPolicy="no-referrer" className="min-h-0 w-full flex-1 border-0" />
        : <div role="status" className="p-4"><span className="sr-only">{t('documents.details.generating')}</span><Skeleton className="h-96 w-full" /></div>}
  </section>;
}
