import { useState, forwardRef, useImperativeHandle } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Trash2 } from '../../icons/glyphs';
import { Alert, AlertDescription, Button, NativeSelect, NativeSelectOption } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useScreenSearch } from '../../components/ScreenChrome';
import PagePagination from '../../components/PagePagination';
import ConfirmationModal from '../../components/ConfirmationModal';
import { guestMessagingApi, type MessageTemplate } from '../../services/api/guestMessagingApi';
import { systemEmailTemplatesApi } from '../../services/api/systemEmailTemplatesApi';
import MessageTemplateEditor from '../messaging/MessageTemplateEditor';
import SystemTemplateEditDialog from './SystemTemplateEditDialog';
import EmailTemplatePreview from './EmailTemplatePreview';
import DocumentsWorkspace, { DOCUMENT_ART, DocumentFacts, DocumentsLoading, type DocumentRecord } from './components/DocumentsWorkspace';

export interface MessageTemplatesSectionRef { fetchTemplates: () => void; openEditor: () => void }
const templateTypeLabels: Record<string, string> = {
  CHECK_IN: 'checkIn', CHECK_OUT: 'checkOut', WELCOME: 'welcome', PAYMENT_LINK: 'paymentLink', CUSTOM: 'custom',
};
const MessageTemplatesSection = forwardRef<MessageTemplatesSectionRef>((_, ref) => {
  const { t, currentLanguage } = useTranslation(); const scope = useCommerceScope();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(''); const [origin, setOrigin] = useState('all'); const [page, setPage] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [systemKey, setSystemKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);
  const [deleting, setDeleting] = useState(false); const [actionError, setActionError] = useState('');
  const users = useQuery({ queryKey: ['document-message-templates', scope], enabled: !!scope, queryFn: guestMessagingApi.getTemplates, retry: false });
  const systems = useQuery({ queryKey: ['document-system-templates', scope], enabled: !!scope, queryFn: systemEmailTemplatesApi.list, retry: false });
  const refresh = () => { void users.refetch(); void systems.refetch(); };
  useImperativeHandle(ref, () => ({ fetchTemplates: refresh, openEditor: () => { setEditingTemplate(null); setEditorOpen(true); } }));
  useScreenSearch(search, value => { setSearch(value); setPage(0); }, t('documentsWorkspace.searchMessage'));
  const records: (DocumentRecord & { origin: string })[] = [
    ...(users.isError ? [] : users.data ?? []).map(row => ({
      id: `user-${row.id}`, title: row.name, origin: 'user', image: DOCUMENT_ART.message, subtitle: row.subject,
      meta: row.language?.toUpperCase(), status: { value: row.isActive ? 'ACTIVE' : 'INACTIVE', label: t(row.isActive ? 'messaging.templates.active' : 'messaging.templates.inactive') },
      actions: <><Button size="sm" onClick={() => { setEditingTemplate(row); setEditorOpen(true); }}><Pencil size={15} />{t('common.edit')}</Button>
        <Button variant="ghost" size="icon-sm" aria-label={t('common.delete')} title={t('common.delete')} onClick={() => setDeleteTarget(row)}><Trash2 size={16} /></Button></>,
      detail: <><DocumentFacts items={[
        { label: t('messaging.templates.origin'), value: t('messaging.templates.originUser') },
        { label: t('documentsWorkspace.type'), value: t(`messaging.templateTypes.${templateTypeLabels[row.type] || 'custom'}`) },
        { label: t('messaging.templates.language'), value: row.language?.toUpperCase() },
      ]} /><h3>{t('documentsWorkspace.content')}</h3><div className="h-[600px] overflow-hidden rounded-xl border border-border"><EmailTemplatePreview subject={row.subject} body={row.body} language={row.language} /></div></>,
    })),
    ...(systems.isError ? [] : systems.data ?? []).map(group => {
      const locale = group.languages[currentLanguage] ? currentLanguage : group.languages.fr ? 'fr' : Object.keys(group.languages)[0];
      const content = group.languages[locale];
      return { id: `system-${group.templateKey}`, title: t(`systemEmailTemplates.keys.${group.templateKey}`, group.templateKey), origin: 'system',
        image: DOCUMENT_ART.message, subtitle: content?.subject, meta: Object.keys(group.languages).join(' · ').toUpperCase(),
        status: { value: 'ACTIVE', label: t('messaging.templates.active') },
        actions: <Button size="sm" onClick={() => setSystemKey(group.templateKey)}><Pencil size={15} />{t('common.edit')}</Button>,
        detail: <><DocumentFacts items={[
          { label: t('messaging.templates.origin'), value: t(group.isCustomized ? 'messaging.templates.originCustomized' : 'messaging.templates.originSystem') },
          { label: t('documentsWorkspace.recipient'), value: t(`systemEmailTemplates.recipientShort.${group.recipientType}`, group.recipientType) },
          { label: t('messaging.templates.language'), value: locale?.toUpperCase() },
        ]} /><h3>{t('documentsWorkspace.content')}</h3><div className="h-[600px] overflow-hidden rounded-xl border border-border"><EmailTemplatePreview subject={content?.subject || ''} body={content?.body || ''} language={locale} wrapperStyle={content?.wrapperStyle} /></div>
          {!!content?.variables.length && <><h3>{t('documentsWorkspace.variables')}</h3><div className="documents-variables">{content.variables.map(value => <code key={value}>{'{'+value+'}'}</code>)}</div></>}
        </>,
      };
    }),
  ];
  const rows = records.filter(row => (origin === 'all' || row.origin === origin) && `${row.title} ${row.subtitle}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(rows.length / 12) - 1));
  const linkedId = params.get('template');
  const selected = linkedId ? records.find(row => row.id === linkedId || row.id === `system-${linkedId}`)?.id : undefined;
  // A catalogue deep link may point beyond the current page. Keep the selected entry visible.
  const selectedIndex = selected ? rows.findIndex(row => row.id === selected) : -1;
  const visiblePage = selectedIndex >= 0 ? Math.floor(selectedIndex / 12) : pageIndex;
  return <>
    {(actionError || users.error || systems.error) && <Alert variant="destructive" role="alert" className="mb-3"><AlertDescription>{actionError || t('messaging.templates.loadError')}</AlertDescription><Button variant="ghost" onClick={refresh}>{t('common.retry')}</Button></Alert>}
    <div className="documents-toolbar"><p>{t('documentsWorkspace.count', { count: rows.length })}</p><NativeSelect value={origin} aria-label={t('messaging.templates.origin')} onChange={e => { setOrigin(e.target.value); setPage(0); }}>
      <NativeSelectOption value="all">{t('documentsWorkspace.allOrigins')}</NativeSelectOption><NativeSelectOption value="user">{t('messaging.templates.originUser')}</NativeSelectOption><NativeSelectOption value="system">{t('messaging.templates.originSystem')}</NativeSelectOption>
    </NativeSelect></div>
    {users.isPending || systems.isPending ? <DocumentsLoading /> : <DocumentsWorkspace label={t('documentsWorkspace.views.email')}
      records={rows.slice(visiblePage * 12, (visiblePage + 1) * 12)} selectedId={selected}
      onSelect={id => setParams(previous => { const next = new URLSearchParams(previous); if (id) next.set('template', id); else next.delete('template'); return next; }, { replace: true })}
      pagination={<PagePagination page={visiblePage} count={rows.length} rowsPerPage={12} onPageChange={value => {
        setPage(value); setParams(previous => { const next = new URLSearchParams(previous); next.delete('template'); return next; }, { replace: true });
      }} />} />}
    {editorOpen && <MessageTemplateEditor open template={editingTemplate} onClose={() => setEditorOpen(false)} onSave={() => { setEditorOpen(false); refresh(); }} />}
    {systemKey && <SystemTemplateEditDialog templateKey={systemKey} open onClose={() => { setSystemKey(null); refresh(); }} />}
    <ConfirmationModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('documentsWorkspace.deleteMessageTitle')}
      message={t('documentsWorkspace.deleteMessageHint', { name: deleteTarget?.name })} confirmText={t('common.delete')} cancelText={t('common.cancel')} severity="error" loading={deleting}
      onConfirm={async () => { if (!deleteTarget || deleting) return; setDeleting(true); setActionError(''); try { await guestMessagingApi.deleteTemplate(deleteTarget.id); setDeleteTarget(null); refresh(); } catch { setActionError(t('messaging.templates.deleteError')); } finally { setDeleting(false); } }} />
  </>;
});
MessageTemplatesSection.displayName = 'MessageTemplatesSection';
export default MessageTemplatesSection;
