import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Plus, RefreshCw, Send } from '../../icons/glyphs';
import { Button } from '../../components/ui';
import { useScreenTabs } from '../../hooks/useScreenTabs';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import HeaderSearchField from '../../components/HeaderSearchField';
import { PageHeaderActionsProvider, usePageHeaderActionsSlot, usePageHeaderFiltersSlot } from '../../components/PageHeaderActionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useTemplates } from './hooks/useDocuments';
import TemplateCatalogAccordions from './TemplateCatalogAccordions';
import MessageTemplatesSection, { type MessageTemplatesSectionRef } from './MessageTemplatesSection';
import WhatsAppTemplatesSection, { type WhatsAppTemplatesSectionRef } from './WhatsAppTemplatesSection';
import TemplatesList, { type TemplatesListRef } from './TemplatesList';
import UnifiedHistoryTab, { type UnifiedHistoryTabRef } from './UnifiedHistoryTab';
import { useDocumentsFailedCount } from './useDocumentsFailedCount';
import AvailableTagsReference from './AvailableTagsReference';
import ComplianceDashboard, { type ComplianceDashboardRef } from './ComplianceDashboard';
import AmendmentArchives from './AmendmentArchives';
import BaitlyTemplateQuality from './BaitlyTemplateQuality';
import { useAuth } from '../../hooks/useAuth';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import { DOCUMENT_ART } from './components/DocumentsWorkspace';
import { DOCUMENT_VIEWS, resolveDocumentsLocation, type DocumentsTab } from './documentsNavigation';
import './documentsWorkspace.css';

export default function DocumentsPage() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const scope = useCommerceScope();
  const failedCount = useDocumentsFailedCount(true);
  const [params, setParams] = useSearchParams();
  const { tab, view } = resolveDocumentsLocation(params);
  // Canonical URLs also keep the shared sidebar and header on the correct merged tab.
  useEffect(() => {
    if (params.get('tab') && params.get('tab') !== tab) {
      setParams(previous => {
        const next = new URLSearchParams(previous);
        next.set('tab', tab); next.set('view', view);
        return next;
      }, { replace: true });
    }
  }, [params, setParams, tab, view]);
  const tabs = useScreenTabs('/documents').map(item => item.key === 'history' && failedCount > 0
    ? { ...item, badge: failedCount, badgeColor: 'error' as const } : item);
  const { slot, portalContainer } = usePageHeaderActionsSlot();
  const { filtersSlot, filtersContainer } = usePageHeaderFiltersSlot();
  const [search, setSearch] = useState('');
  const [uploadRequested, setUploadRequested] = useState(false);
  const msgRef = useRef<MessageTemplatesSectionRef>(null);
  const whatsappRef = useRef<WhatsAppTemplatesSectionRef>(null);
  const templatesRef = useRef<TemplatesListRef>(null);
  const historyRef = useRef<UnifiedHistoryTabRef>(null);
  const complianceRef = useRef<ComplianceDashboardRef>(null);
  const templates = useTemplates();
  const navigate = (nextTab: DocumentsTab, nextView?: string, template?: string) => {
    setSearch('');
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('tab', nextTab);
      next.set('view', nextView || DOCUMENT_VIEWS[nextTab][0]);
      ['invoice', 'generation', 'highlight', 'template'].forEach(key => next.delete(key));
      if (template) next.set('template', template);
      return next;
    });
  };
  const refresh = () => {
    if (tab === 'catalog') void templates.refetch();
    else if (tab === 'message-templates') view === 'whatsapp' ? whatsappRef.current?.refresh() : msgRef.current?.fetchTemplates();
    else if (tab === 'history') historyRef.current?.refresh();
    else complianceRef.current?.fetchData();
  };
  const views: readonly string[] = DOCUMENT_VIEWS[tab].filter(item => item !== 'templates' || hasAnyRole(['SUPER_ADMIN']));
  const currentView = views.includes(view) ? view : views[0];
  const illustration = currentView === 'variables' ? DOCUMENT_ART.variables : tab === 'message-templates'
    ? DOCUMENT_ART.message : tab === 'compliance' ? DOCUMENT_ART.compliance : tab === 'history' ? DOCUMENT_ART.history : DOCUMENT_ART.document;
  return <PageHeaderActionsProvider slot={slot} filtersSlot={filtersSlot}>
    <div className="documents-page">
      <PageHeader title={t('tabHeaders.documents.title')}
        inlineControls={tab === 'catalog' ? filtersContainer : undefined}
        subtitle={t(`documentsWorkspace.hints.${currentView}`)} iconBadge={<FileText />} showBackButton={false}
        actions={<>
          {!['variables', 'amendments', 'templates'].includes(currentView) && <Button variant="ghost" size="icon-sm" aria-label={t('common.refresh')} title={t('common.refresh')} onClick={refresh}><RefreshCw size={17} /></Button>}
          {tab === 'catalog' && currentView !== 'variables' && <Button size="sm" onClick={() => { navigate('catalog'); setUploadRequested(true); }}><Plus size={16} />{t('documentsWorkspace.import')}</Button>}
          {tab === 'message-templates' && currentView === 'email' && <Button size="sm" onClick={() => msgRef.current?.openEditor()}><Plus size={16} />{t('messaging.templates.create')}</Button>}
          {tab === 'history' && currentView === 'activity' && <Button size="sm" onClick={() => historyRef.current?.openGenerate()}><Send size={16} />{t('documents.tabs.generateDoc')}</Button>}
          {portalContainer}
        </>} />
      <PageTabs options={tabs} value={tabs.findIndex(item => item.key === tab)} onChange={index => navigate(tabs[index].key as DocumentsTab)} />
      <div className="documents-page__content" key={scope}>
        {tab !== 'catalog' && <div className="documents-context"><img src={illustration} alt="" width={52} height={52} /><div>
          <h2>{t(`documentsWorkspace.views.${currentView}`)}</h2><p>{t(`documentsWorkspace.hints.${currentView}`)}</p>
        </div></div>}
        <div className="documents-views" role="group" aria-label={t('documentsWorkspace.viewsLabel')}>
          {views.map(item => <button type="button" key={item} aria-pressed={currentView === item} onClick={() => navigate(tab, item)}>{t(`documentsWorkspace.views.${item}`)}</button>)}
        </div>
        {currentView === 'library' && <TemplatesList ref={templatesRef} uploadRequested={uploadRequested} onUploadHandled={() => setUploadRequested(false)} />}
        {currentView === 'guide' && <TemplateCatalogAccordions templates={templates.data ?? []}
          onOpenUpload={() => { navigate('catalog'); setUploadRequested(true); }}
          onSwitchToMessagingTab={() => navigate('message-templates')}
          onOpenSystemEmail={key => navigate('message-templates', 'email', key)} />}
        {currentView === 'variables' && <><HeaderSearchField value={search} onChange={setSearch} placeholder={t('documents.tabs.searchTag')} /><AvailableTagsReference search={search} /></>}
        {currentView === 'email' && <MessageTemplatesSection ref={msgRef} />}
        {currentView === 'whatsapp' && <WhatsAppTemplatesSection ref={whatsappRef} />}
        {currentView === 'activity' && <UnifiedHistoryTab ref={historyRef} />}
        {currentView === 'amendments' && <AmendmentArchives />}
        {currentView === 'checks' && <><HeaderSearchField value={search} onChange={value => { setSearch(value); complianceRef.current?.searchByNumber(value); }} placeholder={t('documentsWorkspace.searchDocument')} /><ComplianceDashboard ref={complianceRef} /></>}
        {currentView === 'templates' && <BaitlyTemplateQuality />}
      </div>
    </div>
  </PageHeaderActionsProvider>;
}
