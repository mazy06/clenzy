import { lazy, Suspense, useEffect, useState } from 'react';
import { Attachment, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle,
  AttachmentTrigger, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Skeleton, Spinner } from '../../components/ui';
import { Receipt } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { documentsApi } from '../../services/api/documentsApi';
import { quoteInboxMessages } from './baitlyQuoteInboxMessages';

const BaitlyPdfPreview = lazy(() => import('../../components/BaitlyPdfPreview'));

/** Même document immuable dans le fil et l'annuaire privé des devis, chargé à l'ouverture. */
export default function BaitlyQuoteDocument({ generationId, quoteId, inlinePreview = false }: { generationId: number; quoteId: number; inlinePreview?: boolean }) {
  return inlinePreview
    ? <InlineDocument key={generationId} generationId={generationId} quoteId={quoteId} />
    : <Document key={generationId} generationId={generationId} quoteId={quoteId} />;
}

/** Seul le devis sélectionné monte son lecteur, avec le même PDF et les mêmes droits. */
function InlineDocument({ generationId, quoteId }: { generationId: number; quoteId: number }) {
  const { t, currentLanguage } = useTranslation();
  const copy = quoteInboxMessages(currentLanguage);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const fileName = `devis-${quoteId}.pdf`;
  useEffect(() => {
    let disposed = false;
    let blobUrl: string | undefined;
    void documentsApi.fetchGenerationBlobUrl(generationId).then(value => {
      if (disposed) { URL.revokeObjectURL(value); return; }
      blobUrl = value; setUrl(value);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [generationId]);
  return <div className="baitly-quotes-inline-document">
    <Attachment className="baitly-quotes-inline-file w-full">
      <AttachmentMedia><Receipt /></AttachmentMedia>
      <AttachmentContent><AttachmentTitle>{fileName}</AttachmentTitle>
        {url && <AttachmentDescription><a href={url} target="_blank" rel="noopener noreferrer" className="baitly-quotes-pdf-link">
          {copy.openDocument}</a></AttachmentDescription>}
      </AttachmentContent>
    </Attachment>
    {failed ? <p role="alert">{t('interventions.quotes.previewFailed', 'Le document n’a pas pu être chargé.')}</p>
      : <div className="baitly-quotes-pdf-reader">
        {url ? <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <BaitlyPdfPreview url={url} title={fileName} />
        </Suspense> : <Skeleton className="h-full w-full" aria-label={t('common.loading', 'Chargement')} />}
      </div>}
  </div>;
}

function Document({ generationId, quoteId }: { generationId: number; quoteId: number }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileName = `devis-${quoteId}.pdf`;
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const load = async () => {
    if (url || loading) return;
    setLoading(true);
    try { setUrl(await documentsApi.fetchGenerationBlobUrl(generationId)); }
    catch { setUrl(null); }
    finally { setLoading(false); }
  };
  return <Dialog onOpenChange={open => { if (open) void load(); }}>
    <Attachment className="baitly-thread-quote-document w-full">
      <AttachmentMedia><Receipt /></AttachmentMedia>
      <AttachmentContent><AttachmentTitle>{fileName}</AttachmentTitle>
        <AttachmentDescription>{t('interventions.quotes.openPreview', 'Ouvrir l’aperçu')}</AttachmentDescription>
      </AttachmentContent>
      <DialogTrigger asChild><AttachmentTrigger aria-label={t('interventions.quotes.preview', 'Aperçu du devis')} /></DialogTrigger>
    </Attachment>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader><DialogTitle>{fileName}</DialogTitle></DialogHeader>
      {loading ? <div className="flex h-[60vh] items-center justify-center"><Spinner className="size-8" /></div>
        : url ? <><iframe src={url} title={fileName} className="h-[60vh] w-full rounded-md border border-border" />
          <div className="flex justify-end text-xs"><a href={url} target="_blank" rel="noopener noreferrer" className="text-info-ink underline">
            {t('interventions.quotes.openInTab', 'Ouvrir dans un nouvel onglet')}</a></div></>
        : <p className="py-8 text-center text-sm text-muted-foreground">{t('interventions.quotes.previewFailed', 'Le document n’a pas pu être chargé.')}</p>}
    </DialogContent>
  </Dialog>;
}
