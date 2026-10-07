import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, Eye, Fingerprint, Pencil, Send } from 'lucide-react';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Field, FieldLabel, NativeSelect, NativeSelectOption, Skeleton } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useTranslation } from '../../hooks/useTranslation';
import { useScreenSearch } from '../../components/ScreenChrome';
import { useHighlightParam } from '../../hooks/useHighlight';
import { guestMessagingApi, type GuestMessageLog } from '../../services/api/guestMessagingApi';
import { guestsApi } from '../../services/api/guestsApi';
import { documentsApi, type DocumentGeneration } from '../../services/api/documentsApi';
import { useGenerations, useVerifyDocumentIntegrity } from './hooks/useDocuments';
import GenerateDialog from './GenerateDialog';
import PagePagination from '../../components/PagePagination';
import { renderServerEmailPreview, emailPreviewFontStack } from '../../utils/emailMarkdown';
import DocumentsWorkspace, { DOCUMENT_ART, DocumentFacts, DocumentsLoading, type DocumentRecord } from './components/DocumentsWorkspace';

export interface UnifiedHistoryTabRef { refresh: () => void; openGenerate: () => void }
const hasRecipient = (log: GuestMessageLog) => !!log.recipient && !['N/A', '—'].includes(log.recipient.trim()) && (log.channel !== 'EMAIL' || log.recipient.includes('@'));
const downloadable = (row: DocumentGeneration) => ['COMPLETED', 'SENT', 'LOCKED'].includes(row.status);
const UnifiedHistoryTab = forwardRef<UnifiedHistoryTabRef>((_, ref) => {
  const { t, currentLanguage } = useTranslation(); const scope = useCommerceScope();
  const { user, isPlatformStaff, hasRole } = useAuth();
  const canReview = isPlatformStaff() || ['OWNER', 'ADMIN'].includes(user?.orgRole ?? '');
  const [channel, setChannel] = useState('documents'); const [page, setPage] = useState(0);
  const [messagePage, setMessagePage] = useState(0); const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [actionError, setActionError] = useState(''); const [verifyResult, setVerifyResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [editEmailLog, setEditEmailLog] = useState<GuestMessageLog | null>(null);
  const [editEmailValue, setEditEmailValue] = useState(''); const [editEmailLoading, setEditEmailLoading] = useState(false);
  const [pdfId, setPdfId] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null); const [pdfError, setPdfError] = useState(false);
  const documents = useGenerations(page, 20);
  const messages = useQuery({ queryKey: ['document-message-history', scope], enabled: !!scope && channel !== 'documents', queryFn: guestMessagingApi.getHistory, retry: false });
  const verify = useVerifyDocumentIntegrity();
  const highlight = useHighlightParam();
  const highlighted = useQuery({ queryKey: ['documents', 'highlight', scope, highlight], enabled: !!scope && !!highlight && /^\d+$/.test(highlight),
    queryFn: () => documentsApi.getGeneration(Number(highlight)), retry: false });
  useEffect(() => { if (highlighted.data && downloadable(highlighted.data)) setPdfId(highlighted.data.id); }, [highlighted.data?.id]);
  useScreenSearch(search, value => { setSearch(value); setMessagePage(0); }, t(channel === 'documents' ? 'documentsWorkspace.searchCurrentPage' : 'documentsWorkspace.searchMessage'));
  useImperativeHandle(ref, () => ({ refresh: () => { void documents.refetch(); if (channel !== 'documents') void messages.refetch(); }, openGenerate: () => setGenerateOpen(true) }));
  useEffect(() => {
    let cancelled = false; let url: string | undefined;
    setPdfUrl(null); setPdfError(false);
    if (pdfId) documentsApi.fetchGenerationBlobUrl(pdfId).then(value => { url = value; if (cancelled) URL.revokeObjectURL(value); else setPdfUrl(value); }).catch(() => { if (!cancelled) setPdfError(true); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [pdfId, scope]);
  const selectedLog = channel !== 'documents' ? messages.data?.find(row => `msg-${row.id}` === selected) : undefined;
  const preview = useQuery({ queryKey: ['document-message-preview', scope, selectedLog?.id], enabled: !!scope && selectedLog?.channel === 'EMAIL' && !!selectedLog?.templateId,
    queryFn: () => guestMessagingApi.previewMessage(selectedLog!.id), retry: false });
  const date = (value: string) => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString(currentLanguage, { dateStyle: 'medium', timeStyle: 'short' }); };
  const editEmail = (log: GuestMessageLog) => { setEditEmailLog(log); setEditEmailValue(log.recipient === 'N/A' ? '' : log.recipient); };
  const resend = async (log: GuestMessageLog) => {
    if (resendingId !== null) return;
    setResendingId(log.id); setActionError('');
    try { await guestMessagingApi.resendMessage(log.id); await messages.refetch(); }
    catch { setActionError(t('documents.resendError')); } finally { setResendingId(null); }
  };
  const download = async (row: DocumentGeneration) => { try { await documentsApi.downloadGeneration(row.id, row.fileName || 'document.pdf'); } catch { setActionError(t('documentsWorkspace.downloadError')); } };
  const documentRows = (documents.data?.content ?? []).filter(row => `${row.templateName} ${row.legalNumber} ${row.emailTo}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const messageRows = (messages.data ?? []).filter(row => (channel === 'messages' || row.channel === channel)
    && `${row.templateName} ${row.subject} ${row.recipient} ${row.guestName}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const currentMessagePage = Math.min(messagePage, Math.max(0, Math.ceil(messageRows.length / 20) - 1));
  const records: DocumentRecord[] = channel === 'documents' ? documentRows.map(row => ({
    id: `doc-${row.id}`, highlightId: String(row.id), title: row.legalNumber || row.templateName || row.documentType,
    subtitle: row.legalNumber ? row.templateName : row.emailTo, meta: new Date(row.createdAt).toLocaleDateString(currentLanguage), image: DOCUMENT_ART.document,
    status: { value: row.status, label: t(`documentsWorkspace.status.${row.status}`, row.status) },
    actions: <>{downloadable(row) && <><Button size="sm" onClick={() => setPdfId(row.id)}><Eye size={15} />{t('documents.history.preview')}</Button><Button variant="outline" size="sm" onClick={() => void download(row)}><Download size={15} />{t('documents.history.download')}</Button></>}
      {row.documentType === 'FACTURE' && canReview && <Button asChild size="sm" variant="outline"><Link to={`/documents?tab=compliance&generation=${row.id}`}>{t('documentVerification.openHub')}</Link></Button>}
      {row.locked && row.documentHash && hasRole('SUPER_ADMIN') && <Button size="sm" variant="outline" disabled={verify.isPending} onClick={async () => {
        try { const result = await verify.mutateAsync(row.id); setVerifyResult({ ok: result.verified, text: t(result.verified ? 'documentsWorkspace.integrityOk' : 'documentsWorkspace.integrityFailed') }); } catch { setActionError(t('documentsWorkspace.verifyError')); }
      }}><Fingerprint size={15} />{t('documentsWorkspace.verifyIntegrity')}</Button>}</>,
    detail: <>{row.errorMessage && <Alert variant="destructive"><AlertDescription>{row.errorMessage}</AlertDescription></Alert>}
      <DocumentFacts items={[
        { label: t('documentsWorkspace.date'), value: date(row.createdAt) },
        { label: t('documentsWorkspace.recipient'), value: row.emailTo },
        { label: t('documentsWorkspace.file'), value: row.fileName },
        { label: t('documentsWorkspace.reference'), value: `${row.referenceType || ''} ${row.referenceId || ''}` },
        { label: t('documentsWorkspace.size'), value: row.fileSize ? `${Math.ceil(row.fileSize / 1024)} Ko` : '—' },
      ]} />{row.correctsId && <p>{t('documentsWorkspace.correction', { id: row.correctsId })}</p>}
      {row.locked && <p className="text-muted-foreground">{t('documents.history.locked')}</p>}
    </>,
  })) : messageRows.slice(currentMessagePage * 20, (currentMessagePage + 1) * 20).map(log => ({
    id: `msg-${log.id}`, title: log.templateName || log.subject || t('documents.history.typeMessage'), subtitle: log.subject || log.guestName || log.recipient,
    image: DOCUMENT_ART.message, meta: log.channel, status: { value: log.status, label: t(`documentsWorkspace.status.${log.status}`, log.status) },
    actions: log.status === 'FAILED' ? <>
      {log.guestId && log.channel === 'EMAIL' && <Button size="sm" variant="outline" onClick={() => editEmail(log)}><Pencil size={15} />{t('documents.history.editGuestEmail')}</Button>}
      {log.templateId && <Button size="sm" disabled={!hasRecipient(log) || resendingId !== null} onClick={() => void resend(log)}><Send size={15} />{t('documentsWorkspace.resend')}</Button>}
    </> : undefined,
    detail: <>{log.errorMessage && <Alert variant="destructive"><AlertDescription>{log.errorMessage}</AlertDescription></Alert>}
      {log.status === 'FAILED' && !hasRecipient(log) && <p className="text-muted-foreground">{t('documents.noRecipientHint')}</p>}
      <DocumentFacts items={[
        { label: t('documentsWorkspace.recipient'), value: log.recipient },
        { label: t('documentsWorkspace.guest'), value: log.guestName },
        { label: t('documentsWorkspace.date'), value: date(log.sentAt || log.createdAt) },
        { label: t('documentsWorkspace.channel'), value: log.channel },
        { label: t('documentsWorkspace.reference'), value: `#${log.reservationId}` },
      ]} />
      {selectedLog?.id === log.id && log.channel === 'EMAIL' && !!log.templateId && <><h3>{t('documents.history.emailContent')}</h3>
        {preview.isPending ? <Skeleton className="h-48 w-full" /> : preview.data ? <iframe title={t('documents.history.emailContent')} sandbox="" className="h-80 w-full rounded-lg border border-border"
          srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>body{font-family:${emailPreviewFontStack(currentLanguage)};font-size:14px;line-height:1.65;margin:16px;color:#203344;overflow-wrap:anywhere}</style></head><body>${renderServerEmailPreview(preview.data.htmlBody)}</body></html>`} />
          : <p>{t('documentsWorkspace.previewUnavailable')}</p>}
      </>}
    </>,
  }));
  const query = channel === 'documents' ? documents : messages;
  return <>
    <div className="documents-toolbar"><p>{t('documentsWorkspace.historyHint')}</p><NativeSelect aria-label={t('documentsWorkspace.channel')} value={channel} onChange={event => { setChannel(event.target.value); setSelected(null); setSearch(''); setMessagePage(0); }}>
      <NativeSelectOption value="documents">{t('documents.history.filterDocuments')}</NativeSelectOption><NativeSelectOption value="messages">{t('documents.history.filterMessages')}</NativeSelectOption>
      {['EMAIL', 'WHATSAPP', 'SMS'].map(value => <NativeSelectOption value={value} key={value}>{value === 'EMAIL' ? 'Email' : value === 'WHATSAPP' ? 'WhatsApp' : value}</NativeSelectOption>)}
    </NativeSelect></div>
    {actionError && <Alert variant="destructive" role="alert" className="mb-3"><AlertDescription>{actionError}</AlertDescription></Alert>}
    {verifyResult && <Alert variant={verifyResult.ok ? 'success' : 'destructive'} className="mb-3"><AlertDescription>{verifyResult.text}</AlertDescription></Alert>}
    {(query.error || highlighted.error) && <Alert variant="destructive" role="alert"><AlertDescription>{t('documentsWorkspace.loadError')}</AlertDescription><Button variant="ghost" onClick={() => { void query.refetch(); if (highlight) void highlighted.refetch(); }}>{t('common.retry')}</Button></Alert>}
    {query.isPending ? <DocumentsLoading /> : !query.error && <DocumentsWorkspace label={t('documentsWorkspace.views.activity')} records={records} selectedId={selected} onSelect={setSelected}
      pagination={<PagePagination page={channel === 'documents' ? page : currentMessagePage} rowsPerPage={20} count={channel === 'documents' ? documents.data?.totalElements ?? 0 : messageRows.length}
        onPageChange={value => { channel === 'documents' ? setPage(value) : setMessagePage(value); setSelected(null); }} />} />}
    <Dialog open={!!editEmailLog} onOpenChange={open => { if (!open && !editEmailLoading) setEditEmailLog(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{t('documents.history.editGuestEmail')}</DialogTitle></DialogHeader>
      <form onSubmit={async event => { event.preventDefault(); if (!editEmailLog?.guestId || editEmailLoading) return; setEditEmailLoading(true); try {
        await guestsApi.updateEmail(editEmailLog.guestId, editEmailValue.trim()); await guestMessagingApi.resendMessage(editEmailLog.id); setEditEmailLog(null); void messages.refetch();
      } catch { setActionError(t('documents.resendError')); } finally { setEditEmailLoading(false); } }}>
        <p className="mb-4 text-sm text-muted-foreground">{t('documentsWorkspace.editAndResendHint')}</p>
        <Field><FieldLabel htmlFor="document-guest-email">Email</FieldLabel><Input id="document-guest-email" type="email" required value={editEmailValue} onChange={event => setEditEmailValue(event.target.value)} /></Field>
        <DialogFooter className="mt-4"><Button type="button" variant="outline" disabled={editEmailLoading} onClick={() => setEditEmailLog(null)}>{t('common.cancel')}</Button><Button type="submit" disabled={editEmailLoading || !editEmailValue.trim()}>{t('documents.saveAndResend')}</Button></DialogFooter>
      </form></DialogContent></Dialog>
    <Dialog open={pdfId !== null} onOpenChange={open => { if (!open) setPdfId(null); }}><DialogContent className="max-w-4xl h-[85dvh] grid-rows-[auto_minmax(0,1fr)]"><DialogHeader><DialogTitle>{t('documents.history.pdfPreview')}</DialogTitle></DialogHeader>
      {pdfError ? <p role="alert">{t('documents.history.pdfLoadError')}</p> : pdfUrl ? <object data={pdfUrl} type="application/pdf" className="h-full w-full"><a href={pdfUrl} download="document.pdf">{t('common.download')}</a></object> : <Skeleton className="h-full w-full" />}
    </DialogContent></Dialog>
    <GenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} onSuccess={() => { setGenerateOpen(false); void documents.refetch(); }} />
  </>;
});
UnifiedHistoryTab.displayName = 'UnifiedHistoryTab';
export default UnifiedHistoryTab;
