import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { MANAGER_ROLES } from '../../constants/roles';
import { usePropertiesList, propertiesListKeys } from '../../hooks/usePropertiesList';
import { useScreenTabs } from '../../hooks/useScreenTabs';
import { useTranslation } from '../../hooks/useTranslation';
import { useTabKeyParam } from '../tabKeyParam';
import PageHeader from '../PageHeader';
import PageTabs from '../PageTabs';
import { Alert, AlertDescription, Button, Skeleton } from '../ui';
import { FIRST_USE_MODULES, type FirstUseModule } from './catalog';

const ModuleFirstUseShowcase = lazy(() => import('./ModuleFirstUseShowcase'));

interface Props {
  module: FirstUseModule;
  children: ReactNode;
  /** Les listes métier doivent avoir confirmé l'absence de données, hors filtres. */
  ready?: boolean;
  hasContent?: boolean;
}

/** Ne détourne pas les équipes terrain vers la création d'un portefeuille. */
export default function ModuleFirstUsePage(props: Props) {
  const { hasAnyRole } = useAuth();
  const canSetUp = hasAnyRole([...MANAGER_ROLES]);
  if (!canSetUp || props.ready === false || props.hasContent) return <>{props.children}</>;
  return <PortfolioIntroduction {...props} />;
}

function IntroductionSkeleton() {
  const { t } = useTranslation();
  return <div className="grid gap-6 p-6 md:grid-cols-2" role="status" aria-label={t('common.loading')}>
    <div><Skeleton className="mb-4 h-20 w-4/5" /><Skeleton className="h-48 w-full" /></div>
    <Skeleton className="h-80 w-full rounded-xl" />
  </div>;
}

function PortfolioIntroduction({ module, children }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { properties, isLoading, isError } = usePropertiesList();
  // Choix de navigation temporaire, jamais une préférence persistante.
  const [openWorkspace, setOpenWorkspace] = useState(false);
  const definition = FIRST_USE_MODULES[module];
  const tabs = useScreenTabs(definition.path);
  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  const [activeTab, setActiveTab] = useTabKeyParam(tabs);
  const activeKey = visibleTabs[activeTab]?.key ?? definition.screens[0];
  const title = visibleTabs[activeTab]?.label ?? t(definition.title);

  if (properties.length > 0 || openWorkspace || (tabs.length > 0 && visibleTabs.length === 0)
    || !definition.screens.some((screen) => screen === activeKey)) return <>{children}</>;

  return <>
    <PageHeader title={title} showBackButton={false} />
    {tabs.length > 0 && <PageTabs options={tabs} value={activeTab} onChange={setActiveTab} />}
    <div className="min-h-0 flex-1 overflow-y-auto">
      {isLoading ? <IntroductionSkeleton /> : isError ? (
        <Alert variant="destructive" className="m-4 w-auto">
          <AlertDescription>
            {t('propertiesFirstUse.loadError')}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => { void queryClient.invalidateQueries({ queryKey: propertiesListKeys.all }); }}>{t('common.retry')}</Button>
              <Button variant="ghost" onClick={() => setOpenWorkspace(true)}>{t('moduleFirstUse.openWorkspace')}</Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Suspense fallback={<IntroductionSkeleton />}>
          <ModuleFirstUseShowcase key={`${module}-${activeKey}`} module={module} screen={activeKey} title={title} onOpenWorkspace={() => setOpenWorkspace(true)} />
        </Suspense>
      )}
    </div>
  </>;
}
