import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from '../icons/glyphs';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button, Skeleton } from './ui';
import { useTranslation } from '../hooks/useTranslation';

// Worker livré avec Baitly : aucun document n'est envoyé à un lecteur tiers.
GlobalWorkerOptions.workerSrc = workerUrl;

/** Aperçu du PDF produit par le serveur, indépendant des plugins du navigateur. */
export default function BaitlyPdfPreview({ url, title, actions }: { url: string; title: string; actions?: ReactNode }) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pageText, setPageText] = useState('');

  useEffect(() => {
    let disposed = false;
    setPdf(null); setFailed(false); setRendering(true); setPageNumber(1); setPageText('');
    const task = getDocument({ url, isEvalSupported: false, enableXfa: false });
    task.promise.then(document => { if (!disposed) setPdf(document); })
      .catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; void task.destroy().catch(() => {}); };
  }, [url]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(0, element.clientWidth - 24));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !width) return;
    let disposed = false;
    let task: RenderTask | undefined;
    setRendering(true); setPageText('');
    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (disposed || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        task = page.render({ canvas, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
        await task.promise;
        if (disposed) return;
        const text = await page.getTextContent();
        if (!disposed) setPageText(text.items.flatMap(item => 'str' in item ? [item.str] : []).join(' '));
      } catch {
        if (!disposed) setFailed(true);
      } finally {
        if (!disposed) setRendering(false);
      }
    })();
    return () => { disposed = true; task?.cancel(); };
  }, [pdf, pageNumber, width]);

  const pageLabel = t('documents.pdfPage', { page: pageNumber, total: pdf?.numPages || 1 });
  return <section aria-label={title} title={title} aria-busy={!failed && (!pdf || rendering)} className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
      <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">{pdf ? pageLabel : title}</span>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon-sm" aria-label={t('common.previous')} disabled={!pdf || rendering || pageNumber <= 1}
          onClick={() => setPageNumber(page => page - 1)}><ChevronLeft /></Button>
        <Button variant="ghost" size="icon-sm" aria-label={t('common.next')} disabled={!pdf || rendering || pageNumber >= pdf.numPages}
          onClick={() => setPageNumber(page => page + 1)}><ChevronRight /></Button>
        {actions}
      </div>
    </div>
    <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-auto p-3">
      {failed ? <div role="alert" className="flex flex-col gap-3 text-sm text-muted-foreground">
        <p>{t('documents.pdfReadError')}</p>
      </div> : <>
        {(!pdf || rendering) && <Skeleton aria-label={t('documents.details.generating')} className="absolute inset-3 h-96" />}
        <canvas ref={canvasRef} role="img" aria-label={pageLabel} className={rendering ? 'invisible' : 'block'} />
        <p className="sr-only">{pageText}</p>
      </>}
    </div>
  </section>;
}
