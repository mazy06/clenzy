import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ModuleFirstUsePage from '../../components/first-use/ModuleFirstUsePage';
import { useScreenTabs, useScreenTabAccess } from '../../hooks/useScreenTabs';
import { canViewFinanceLedger, canViewFinanceReports } from '../../config/screenTabs';
import { useTranslation } from '../../hooks/useTranslation';
import { AccountBalance } from '../../icons';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { PageHeaderActionsProvider, usePageHeaderActionsSlot, usePageHeaderFiltersSlot } from '../../components/PageHeaderActionsContext';
import PaymentHistoryPage from '../payments/PaymentHistoryPage';
import InvoicesList from '../invoices/InvoicesList';
import WalletDashboard from '../finance/WalletDashboard';
import { PayoutsTab, ExpensesTab, ExportsTab } from '../accounting/AccountingPage';
import HousekeeperPayoutsTab from '../accounting/components/HousekeeperPayoutsTab';
import PayoutTrackingTab from '../accounting/components/PayoutTrackingTab';
import FiscalReportSection from '../reports/FiscalReportSection';
import { canonicalFinanceParams } from './financeNavigation';
import BaitlySupplierPurchases from '../accounting/components/BaitlySupplierPurchases';
import { useAuth } from '../../hooks/useAuth';
import './components/financeWorkspace.css';

function BillingPage() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const access = useScreenTabAccess();
  const { slot, portalContainer } = usePageHeaderActionsSlot();
  const { filtersSlot, filtersContainer } = usePageHeaderFiltersSlot();
  const tabs = useScreenTabs('/billing');
  const visible = tabs.filter(tab => !tab.hidden);
  const [params, setParams] = useSearchParams();
  const canonical = canonicalFinanceParams(params);
  const activePos = Math.max(0, visible.findIndex(tab => tab.key === canonical.get('tab')));
  const active = visible[activePos];
  const requestedView = canonical.get('view');
  useEffect(() => {
    const next = canonicalFinanceParams(params);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [params, setParams]);
  const views = active?.key === 'payouts' ? ['owners', 'providers', 'tracking']
    : active?.key === 'expenses' ? ['providers', ...(hasRole('SUPER_ADMIN') || hasRole('SUPER_MANAGER') ? ['suppliers'] : [])]
    : active?.key === 'reports' ? [
      ...(canViewFinanceReports(access) ? ['fiscal', 'exports'] : []),
      ...(canViewFinanceLedger(access) ? ['ledger'] : []),
    ] : [];
  const view = requestedView && views.includes(requestedView) ? requestedView : views[0];
  const changeView = (value: string) => setParams(prev => {
    const next = canonicalFinanceParams(prev); next.set('view', value); next.delete('highlight'); return next;
  });
  return <PageHeaderActionsProvider slot={slot} filtersSlot={filtersSlot}>
    <PageHeader title={active?.label ?? t('tabHeaders.billing.title')} iconBadge={<AccountBalance />}
      backPath="/dashboard" showBackButton={false} actions={portalContainer}
      inlineControls={<div className="finance-header-controls">
      {views.length > 1 && <nav className="finance-subviews" aria-label={t('financeWorkspace.views')}>
        {views.map(key => <button type="button" key={key} aria-pressed={view === key} onClick={() => changeView(key)}>{key === 'suppliers' ? t('supplierPurchase.title') : t(`financeWorkspace.viewsLabels.${key}`)}</button>)}
      </nav>}
        {filtersContainer}
      </div>} />
    <PageTabs options={tabs} value={activePos} onChange={index => setParams(prev => {
      const next = new URLSearchParams(prev); next.set('tab', visible[index].key); next.delete('view'); next.delete('highlight'); return next;
    })} />
    <div className="finance-page">

      {active?.key === 'payments' && <PaymentHistoryPage embedded />}
      {active?.key === 'invoices' && <InvoicesList embedded />}
      {active?.key === 'expenses' && view === 'providers' && <ExpensesTab />}
      {active?.key === 'expenses' && view === 'suppliers' && <BaitlySupplierPurchases />}
      {active?.key === 'payouts' && view === 'owners' && <PayoutsTab />}
      {active?.key === 'payouts' && view === 'providers' && <HousekeeperPayoutsTab />}
      {active?.key === 'payouts' && view === 'tracking' && <PayoutTrackingTab />}
      {active?.key === 'reports' && view === 'fiscal' && <FiscalReportSection />}
      {active?.key === 'reports' && view === 'exports' && <ExportsTab />}
      {active?.key === 'reports' && view === 'ledger' && <WalletDashboard embedded />}
    </div>
  </PageHeaderActionsProvider>;
}

export default function BillingEntry() {
  return <ModuleFirstUsePage module="billing"><BillingPage /></ModuleFirstUsePage>;
}
