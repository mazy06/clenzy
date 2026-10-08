import { useImperativeHandle, useState, forwardRef } from 'react';
import { Pencil } from '../../icons/glyphs';
import { Alert, AlertDescription, Button, NativeSelect, NativeSelectOption } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useWhatsAppTemplatesList } from '../../hooks/useWhatsAppTemplates';
import { useScreenSearch } from '../../components/ScreenChrome';
import PagePagination from '../../components/PagePagination';
import WhatsAppTemplateEditorDialog from './WhatsAppTemplateEditorDialog';
import DocumentsWorkspace, { DOCUMENT_ART, DocumentFacts, DocumentsLoading } from './components/DocumentsWorkspace';
export interface WhatsAppTemplatesSectionRef { refresh: () => void }
const WhatsAppTemplatesSection = forwardRef<WhatsAppTemplatesSectionRef>((_, ref) => {
  const { t, currentLanguage } = useTranslation();
  const query = useWhatsAppTemplatesList();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [search, setSearch] = useState(''); const [page, setPage] = useState(0); const [language, setLanguage] = useState('');
  useScreenSearch(search, value => { setSearch(value); setPage(0); }, t('documentsWorkspace.searchMessage'));
  useImperativeHandle(ref, () => ({ refresh: () => { void query.refetch(); } }), [query.refetch]);
  const rows = [...(query.data ?? [])].sort((a, b) => Number(b.isCustomized) - Number(a.isCustomized) || a.templateKey.localeCompare(b.templateKey))
    .filter(row => t(`whatsappTemplates.keys.${row.templateKey}`, row.templateKey).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(rows.length / 12) - 1));
  return <>
    <div className="documents-toolbar"><p>{t('documentsWorkspace.count', { count: rows.length })}</p>
      <NativeSelect aria-label={t('messaging.templates.language')} value={language} onChange={e => setLanguage(e.target.value)}>
        <NativeSelectOption value="">{t('documentsWorkspace.interfaceLanguage')}</NativeSelectOption>
        <NativeSelectOption value="fr_FR">Français</NativeSelectOption><NativeSelectOption value="en_US">English</NativeSelectOption><NativeSelectOption value="ar_AR">العربية</NativeSelectOption>
      </NativeSelect></div>
    {query.error && <Alert variant="destructive" role="alert"><AlertDescription>{t('whatsappTemplates.loadError')}</AlertDescription><Button variant="ghost" onClick={() => void query.refetch()}>{t('common.retry')}</Button></Alert>}
    {query.isPending ? <DocumentsLoading /> : !query.error && <DocumentsWorkspace label="WhatsApp" records={rows.slice(pageIndex * 12, (pageIndex + 1) * 12).map(group => {
      const preferred = language || ({ fr: 'fr_FR', en: 'en_US', ar: 'ar_AR' }[currentLanguage] ?? 'fr_FR');
      const locale = group.languages[preferred] ? preferred : group.languages.fr_FR ? 'fr_FR' : Object.keys(group.languages)[0];
      const content = group.languages[locale];
      const status = content?.metaApprovalStatus || 'UNKNOWN';
      return { id: group.templateKey, title: t(`whatsappTemplates.keys.${group.templateKey}`, group.templateKey), image: DOCUMENT_ART.message,
        meta: locale?.split('_')[0].toUpperCase(), subtitle: t(`documentsWorkspace.whatsappStatus.${status}`, status),
        status: { value: status, label: t(`documentsWorkspace.whatsappStatus.${status}`, status) },
        actions: <Button size="sm" onClick={() => setEditingKey(group.templateKey)}><Pencil size={15} />{t('common.edit')}</Button>,
        detail: <><DocumentFacts items={[
          { label: t('messaging.templates.origin'), value: t(group.isCustomized ? 'messaging.templates.originCustomized' : 'messaging.templates.originSystem') },
          { label: t('documentsWorkspace.type'), value: t(`documentsWorkspace.categories.${group.category}`, group.category) },
          { label: t('messaging.templates.language'), value: locale?.split('_')[0].toUpperCase() },
        ]} /><h3>{t('documentsWorkspace.content')}</h3><div className="documents-preview" dir="auto">{content?.bodyNamed}</div>
          {!!content?.variables.length && <><h3>{t('documentsWorkspace.variables')}</h3><div className="documents-variables">{content.variables.map(value => <code key={value}>{'{'+value+'}'}</code>)}</div></>}
        </>,
      };
    })} pagination={<PagePagination page={pageIndex} rowsPerPage={12} count={rows.length} onPageChange={setPage} />} />}
    {editingKey && <WhatsAppTemplateEditorDialog templateKey={editingKey} open onClose={() => setEditingKey(null)} />}
  </>;
});
WhatsAppTemplatesSection.displayName = 'WhatsAppTemplatesSection';
export default WhatsAppTemplatesSection;
