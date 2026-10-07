import { lazy, Suspense, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import { documentsApi, InvalidDocumentPdfError } from '../../services/api/documentsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCommerceScope } from '../../hooks/useCommerceScope';

const BaitlyPdfPreview = lazy(() => import('../../components/BaitlyPdfPreview'));

export default function TemplatePdfPreview({ id, version }: { id: number; name: string; version: number }) {
  const { t } = useTranslation();
  const scope = useCommerceScope();
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let blobUrl: string | undefined;
    setUrl(null); setError(null); setLoading(true);
    if (scope) {
      void documentsApi.fetchTemplatePreviewBlobUrl(id, controller.signal).then(value => {
        if (controller.signal.aborted) { URL.revokeObjectURL(value); return; }
        blobUrl = value; setUrl(value);
      }).catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof InvalidDocumentPdfError
          ? t('documents.previewInvalidPdf') : t('documents.previewError'));
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    return () => { controller.abort(); if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [id, version, scope, attempt, t]);

  const actions = <>
        <Button variant="ghost" size="icon-sm" aria-label={t('documents.details.regeneratePreview')}
          title={t('documents.details.regeneratePreview')} disabled={loading} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} /></Button>
  </>;
  return <div className="documents-template-preview" aria-busy={loading}>
    {!url && <div className="documents-template-preview__toolbar"><span>{t('documents.details.preview')}</span>
      <div className="flex items-center gap-1">{actions}</div></div>}
    {error && <Alert variant="destructive" role="alert" className="m-4 w-auto"><AlertDescription>{error}</AlertDescription></Alert>}
    {loading && <div role="status" className="p-4"><span className="sr-only">{t('documents.details.generating')}</span><Skeleton className="h-96 w-full" /></div>}
    {url && <div className="min-h-0 flex-1"><Suspense fallback={<Skeleton className="m-3 h-96" />}>
      <BaitlyPdfPreview key={url} url={url} title={t('documents.details.previewFrameTitle')} actions={actions} />
    </Suspense></div>}
  </div>;
}
