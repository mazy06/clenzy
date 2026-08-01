import React, { useState, useRef, useCallback } from 'react';
import { Badge, Button, InputGroup, InputGroupAddon, InputGroupInput } from '../../components/ui';
import {
  ViewList,
  ChatBubbleOutline,
  Description,
  History,
  LocalOffer,
  GppGood,
  Refresh,
  Add,
  Send,
  Search,
  Forum,
} from '../../icons';
import { useTabKeyParam } from '../../components/tabKeyParam';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
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

// ─── Tab indices ────────────────────────────────────────────────────────────

// IMPORTANT : ajouter une tab decale TOUS les indices suivants. Toute logique
// indexed-based (URL ?tab=N, switch case) doit etre relue. Les templates email
// systeme sont fusionnees dans TAB_MSG_TEMPLATES (cf. MessageTemplatesSection).
const TAB_CATALOG = 0;
const TAB_MSG_TEMPLATES = 1;
const TAB_WHATSAPP_TEMPLATES = 2;
const TAB_DOC_TEMPLATES = 3;
const TAB_HISTORY = 4;
const TAB_VARIABLES = 5;
const TAB_COMPLIANCE = 6;

// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. documentsTabMeta plus bas).

// ─── Component ──────────────────────────────────────────────────────────────

const DocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  // Pastille « échecs récents » sur l'onglet Historique — même hook (et même poll
  // react-query dédupliqué) que le badge du menu Documents : l'utilisateur suit le
  // chemin menu → onglet jusqu'aux lignes en échec.
  const failedCount = useDocumentsFailedCount(true);
  // Source de verite des tabs : `key` stable pour l'URL (?tab=<key>) + label pour le header.
  // Defini ICI car activeTab/setActiveTab sont consommes tot (callbacks, inlineActions).
  const tabs = [
    { value: TAB_CATALOG,            key: 'catalog',            label: t('documents.tabs.catalog'),            icon: <ViewList /> },
    { value: TAB_MSG_TEMPLATES,      key: 'message-templates',  label: t('documents.tabs.messageTemplates'),   icon: <ChatBubbleOutline /> },
    { value: TAB_WHATSAPP_TEMPLATES, key: 'whatsapp-templates', label: t('documents.tabs.whatsappTemplates'),  icon: <Forum /> },
    { value: TAB_DOC_TEMPLATES,      key: 'document-templates', label: t('documents.tabs.documentTemplates'),  icon: <Description /> },
    { value: TAB_HISTORY,            key: 'history',            label: t('documents.tabs.history'),            icon: <History />,
      ...(failedCount > 0 ? { badge: failedCount, badgeColor: 'error' as const } : {}) },
    { value: TAB_VARIABLES,          key: 'variables',          label: t('documents.tabs.variablesAndTags'),   icon: <LocalOffer /> },
    { value: TAB_COMPLIANCE,         key: 'compliance',         label: t('documents.tabs.compliance'),         icon: <GppGood /> },
  ];
  const [activeTab, setActiveTab] = useTabKeyParam(tabs);

  const [tagsSearch, setTagsSearch] = useState('');
  const [complianceSearch, setComplianceSearch] = useState('');

  const msgTemplatesRef = useRef<MessageTemplatesSectionRef>(null);
  const whatsappTemplatesRef = useRef<WhatsAppTemplatesSectionRef>(null);
  const docTemplatesRef = useRef<TemplatesListRef>(null);
  const historyRef = useRef<UnifiedHistoryTabRef>(null);
  const complianceRef = useRef<ComplianceDashboardRef>(null);

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

  // Templates for the catalog tab
  const { data: catalogTemplates = [] } = useTemplates();

  // useTabKeyParam ecrit la cle de l'onglet dans l'URL (?tab=<key>) et derive activeTab de l'URL
  // (source de verite) — plus besoin de useEffect de sync.
  const handleTabChange = setActiveTab;

  const switchToMessagingTab = useCallback(() => setActiveTab(TAB_MSG_TEMPLATES), [setActiveTab]);

  // tabs (source unique) defini plus haut (avant les callbacks/inlineActions qui le consomment).
  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const documentsTabMeta: Record<string, TabHeaderMeta> = {
    [t('documents.tabs.catalog')]: {
      subtitle: t('tabHeaders.documents.subtitle.catalog', 'Catalogue des templates par étape du parcours voyageur : messagerie, documents, communications.'),
    },
    [t('documents.tabs.messageTemplates')]: {
      subtitle: t('tabHeaders.documents.subtitle.messageTemplates', 'Templates de messagerie automatique (check-in, bienvenue, push tarification) déclenchés par évènement.'),
    },
    [t('documents.tabs.whatsappTemplates')]: {
      subtitle: t('tabHeaders.documents.subtitle.whatsappTemplates'),
    },
    [t('documents.tabs.documentTemplates')]: {
      subtitle: t('tabHeaders.documents.subtitle.documentTemplates', 'Bibliothèque des templates PDF (factures, attestations, état des lieux) versionnés et réutilisables.'),
    },
    [t('documents.tabs.history')]: {
      subtitle: t('tabHeaders.documents.subtitle.history', 'Historique unifié des messages envoyés et documents générés, filtrable par canal et statut.'),
    },
    [t('documents.tabs.variablesAndTags')]: {
      subtitle: t('tabHeaders.documents.subtitle.variablesAndTags', 'Référence des variables disponibles ({{guest.name}}, {{property.address}}…) pour personnaliser vos templates.'),
    },
    [t('documents.tabs.compliance')]: {
      subtitle: t('tabHeaders.documents.subtitle.compliance', 'Tableau de bord conformité : factures NF, attestations légales, recherche par numéro de document.'),
    },
  };
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.documents.title', 'Documents & Communications'),
    t('tabHeaders.documents.default', 'Templates, historique et conformite reglementaire'),
    tabs.map((tab) => tab.label),
    activeTab,
    documentsTabMeta,
  );

  // Inline actions per tab
  const inlineActions = (() => {
    if (activeTab === TAB_CATALOG) {
      return (
        <Button variant="ghost" size="sm" onClick={() => docTemplatesRef.current?.fetchTemplates()}>
          <Refresh size={14} strokeWidth={1.75} />
          {t('common.refresh')}
        </Button>
      );
    }
    if (activeTab === TAB_MSG_TEMPLATES) {
      return (
        <>
          <Button variant="ghost" size="sm" onClick={() => msgTemplatesRef.current?.fetchTemplates()}>
            <Refresh size={14} strokeWidth={1.75} />
            {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => msgTemplatesRef.current?.openEditor()}>
            <Add size={14} strokeWidth={1.75} />
            {t('messaging.templates.create')}
          </Button>
        </>
      );
    }
    if (activeTab === TAB_WHATSAPP_TEMPLATES) {
      return (
        <Button variant="ghost" size="sm" onClick={() => whatsappTemplatesRef.current?.refresh()}>
          <Refresh size={14} strokeWidth={1.75} />
          {t('common.refresh')}
        </Button>
      );
    }
    if (activeTab === TAB_DOC_TEMPLATES) {
      return (
        <>
          <Button variant="ghost" size="sm" onClick={() => docTemplatesRef.current?.fetchTemplates()}>
            <Refresh size={14} strokeWidth={1.75} />
            {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => docTemplatesRef.current?.openUpload()}>
            <Add size={14} strokeWidth={1.75} />
            {t('documents.tabs.newDocTemplate')}
          </Button>
        </>
      );
    }
    if (activeTab === TAB_HISTORY) {
      return (
        <>
          <Button variant="ghost" size="sm" onClick={() => historyRef.current?.refresh()}>
            <Refresh size={14} strokeWidth={1.75} />
            {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => historyRef.current?.openGenerate()}>
            <Send size={14} strokeWidth={1.75} />
            {t('documents.tabs.generateDoc')}
          </Button>
        </>
      );
    }
    if (activeTab === TAB_VARIABLES) {
      return (
        // Champ de recherche de la barre d'onglets : aucun libelle visible,
        // d'ou aria-label plutot qu'un FieldLabel.
        <InputGroup className="w-[220px]">
          <InputGroupAddon align="inline-start">
            <span className="inline-flex text-muted-foreground"><Search size={14} strokeWidth={1.75} /></span>
          </InputGroupAddon>
          <InputGroupInput
            id="documents-tags-search"
            aria-label={t('documents.tabs.searchTag')}
            placeholder={t('documents.tabs.searchTag')}
            value={tagsSearch}
            onChange={(e) => setTagsSearch(e.target.value)}
          />
        </InputGroup>
      );
    }
    if (activeTab === TAB_COMPLIANCE) {
      return (
        <>
          <Button variant="ghost" size="sm" onClick={() => complianceRef.current?.fetchData()}>
            <Refresh size={14} strokeWidth={1.75} />
            {t('common.refresh')}
          </Button>
          <InputGroup className="w-[220px]">
            <InputGroupAddon align="inline-start">
              <span className="inline-flex text-muted-foreground"><Search size={14} strokeWidth={1.75} /></span>
            </InputGroupAddon>
            <InputGroupInput
              id="documents-compliance-search"
              aria-label="Rechercher par numéro de document"
              placeholder="Ex: FAC-2025-00001"
              value={complianceSearch}
              onChange={(e) => setComplianceSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && complianceRef.current?.searchByNumber(complianceSearch)}
            />
          </InputGroup>
        </>
      );
    }
    return null;
  })();

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <div>
        <PageHeader
          title={title}
          subtitle={subtitle}
          iconBadge={<Description />}
          // Le badge d'echecs de la projection, sur le titre : meme compteur
          // que la pastille de l'onglet Historique, masque a zero.
          titleAdornment={
            failedCount > 0 ? (
              <Badge variant="destructive">
                {t('documents.failedBadge', { count: failedCount, defaultValue: '{{count}} échecs' })}
              </Badge>
            ) : undefined
          }
          backPath="/dashboard"
          showBackButton={false}
          actions={headerActionsPortal}
        />
        <PageTabs
          options={tabs}
          value={activeTab}
          onChange={handleTabChange}
          inlineActions={inlineActions}
        />

        {/* ── Tab content ── */}
        {activeTab === TAB_CATALOG && (
          <TemplateCatalogAccordions
            templates={catalogTemplates}
            onOpenUpload={() => {
              setActiveTab(TAB_DOC_TEMPLATES);
              setTimeout(() => docTemplatesRef.current?.openUpload(), 100);
            }}
            onSwitchToMessagingTab={switchToMessagingTab}
            onOpenSystemEmail={() => {
              // Les system templates sont desormais dans la tab "Templates messages".
              // On switch dessus — l'user voit la liste fusionnee user+system.
              setActiveTab(TAB_MSG_TEMPLATES);
            }}
          />
        )}
        {activeTab === TAB_MSG_TEMPLATES && <MessageTemplatesSection ref={msgTemplatesRef} />}
        {activeTab === TAB_WHATSAPP_TEMPLATES && <WhatsAppTemplatesSection ref={whatsappTemplatesRef} />}
        {activeTab === TAB_DOC_TEMPLATES && <TemplatesList ref={docTemplatesRef} />}
        {activeTab === TAB_HISTORY && <UnifiedHistoryTab ref={historyRef} />}
        {activeTab === TAB_VARIABLES && <AvailableTagsReference search={tagsSearch} />}
        {activeTab === TAB_COMPLIANCE && <ComplianceDashboard ref={complianceRef} />}
      </div>
    </PageHeaderActionsProvider>
  );
};

export default DocumentsPage;
