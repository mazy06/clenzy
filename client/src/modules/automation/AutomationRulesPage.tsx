import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import AutomationRulesSection from './AutomationRulesSection';
import AutomationSystemSection from './AutomationSystemSection';
import ConstellationAutoRulesSection from './ConstellationAutoRulesSection';
import './automation.css';

export default function AutomationRulesPage() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const { slot, portalContainer } = usePageHeaderActionsSlot();
  const tabs = [
    { key: 'rules', label: t('tabHeaders.automation.rules', 'Règles') },
    { key: 'system', label: t('tabHeaders.automation.system', 'Système') },
    {
      key: 'agents',
      label: t('tabHeaders.automation.agents', 'Agents'),
      hidden: !hasAnyRole([
        'SUPER_ADMIN',
        'SUPER_MANAGER',
        'HOST',
        'SUPERVISOR',
      ]),
    },
  ];
  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  const [activeTab, setActiveTab] = useTabKeyParam(tabs);
  const activeKey = visibleTabs[activeTab]?.key;
  const tabMeta: Record<string, TabHeaderMeta> = {
    [tabs[0].label]: {
      subtitle: t(
        'tabHeaders.automation.rulesSub',
        'Vos déclencheurs et vos actions au quotidien.',
      ),
    },
    [tabs[1].label]: {
      subtitle: t(
        'tabHeaders.automation.systemSub',
        'Consultez les mécanismes gérés automatiquement par Baitly.',
      ),
    },
    [tabs[2].label]: {
      subtitle: t(
        'tabHeaders.automation.agentsSub',
        'Définissez les actions que vos agents peuvent appliquer.',
      ),
    },
  };
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.automation.title', 'Automatisation'),
    t(
      'tabHeaders.automation.default',
      'Pilotez les règles, le système et les actions des agents.',
    ),
    visibleTabs.map((tab) => tab.label),
    activeTab,
    tabMeta,
  );

  return (
    <PageHeaderActionsProvider slot={slot}>
      <div className="automation-page">
        <PageHeader
          title={title}
          subtitle={subtitle}
          showBackButton={false}
          actions={portalContainer}
        />
        <PageTabs
          options={tabs}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel={t(
            'tabHeaders.automation.navigation',
            'Sections d’automatisation',
          )}
          mb={0}
        />
        <div className="automation-workspace">
          {activeKey === 'rules' && <AutomationRulesSection />}
          {activeKey === 'system' && <AutomationSystemSection />}
          {activeKey === 'agents' && <ConstellationAutoRulesSection />}
        </div>
      </div>
    </PageHeaderActionsProvider>
  );
}
