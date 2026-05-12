import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Payment,
  Receipt,
  AccountBalanceWallet,
  AccountBalance,
  Category,
  Assessment,
} from '../../icons';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import PaymentHistoryPage from '../payments/PaymentHistoryPage';
import InvoicesList from '../invoices/InvoicesList';
import WalletDashboard from '../finance/WalletDashboard';
import { PayoutsTab, ExpensesTab, ExportsTab } from '../accounting/AccountingPage';
import FiscalReportSection from '../reports/FiscalReportSection';

// ─── Tab indices (logical, stable) ──────────────────────────────────────────

const TAB_PAYMENTS = 0;
const TAB_INVOICES = 1;
const TAB_WALLETS = 2;
const TAB_PAYOUTS = 3;
const TAB_EXPENSES = 4;
const TAB_REPORTS = 5;

// ─── Merged Reports & Exports Tab ──────────────────────────────────────────

const ReportsExportsTab: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<'fiscal' | 'exports'>('fiscal');

  return (
    <Box>
      <Paper sx={{ p: 1.5, mb: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5 }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_e, v) => v && setView(v)}
          size="small"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontSize: '0.8125rem', px: 3 } }}
        >
          <ToggleButton value="fiscal">
            {t('billing.tabs.fiscalReport', 'Rapport fiscal')}
          </ToggleButton>
          <ToggleButton value="exports">
            {t('billing.tabs.exports', 'Exports comptables')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {view === 'fiscal' && <FiscalReportSection />}
      {view === 'exports' && <ExportsTab />}
    </Box>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

const BillingPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canViewInvoices = user?.permissions?.includes('reports:view') ?? false;
  const canViewWallets = user?.permissions?.includes('payments:manage') ?? false;
  const canViewAccounting = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);

  // Build visible tabs dynamically (order preserved)
  const visibleTabs: { index: number; key: string }[] = [
    { index: TAB_PAYMENTS, key: 'payments' },
  ];
  if (canViewInvoices) visibleTabs.push({ index: TAB_INVOICES, key: 'invoices' });
  if (canViewWallets) visibleTabs.push({ index: TAB_WALLETS, key: 'wallets' });
  if (canViewAccounting) {
    visibleTabs.push({ index: TAB_PAYOUTS, key: 'payouts' });
    visibleTabs.push({ index: TAB_EXPENSES, key: 'expenses' });
    visibleTabs.push({ index: TAB_REPORTS, key: 'reports' });
  }

  // Map URL ?tab=<logicalIndex> → visible position
  const getInitialPos = () => {
    const tabParam = searchParams.get('tab');
    if (!tabParam) return 0;
    const parsed = parseInt(tabParam, 10);
    if (isNaN(parsed)) return 0;
    const pos = visibleTabs.findIndex((vt) => vt.index === parsed);
    return pos >= 0 ? pos : 0;
  };

  const [activePos, setActivePos] = useState(getInitialPos);
  const activeLogicalIndex = visibleTabs[activePos]?.index ?? TAB_PAYMENTS;

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newPos: number) => {
      setActivePos(newPos);
      const logicalIndex = visibleTabs[newPos]?.index ?? 0;
      setSearchParams(logicalIndex === 0 ? {} : { tab: String(logicalIndex) }, { replace: true });
    },
    [setSearchParams, visibleTabs],
  );

  // Handle URL param changes (browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const parsed = parseInt(tabParam, 10);
      if (!isNaN(parsed)) {
        const pos = visibleTabs.findIndex((vt) => vt.index === parsed);
        if (pos >= 0 && pos !== activePos) {
          setActivePos(pos);
        }
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title={t('billing.title')}
        subtitle={t('billing.subtitle')}
        iconBadge={<AccountBalance />}
        backPath="/dashboard"
        showBackButton={false}
      />
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activePos}
            onChange={handleTabChange}
            sx={{
              flex: 1,
              '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontSize: '0.8125rem' },
            }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              icon={<Payment size={18} strokeWidth={1.75} />}
              iconPosition="start"
              label={t('billing.tabs.payments')}
            />
            {canViewInvoices && (
              <Tab
                icon={<Receipt size={18} strokeWidth={1.75} />}
                iconPosition="start"
                label={t('billing.tabs.invoices')}
              />
            )}
            {canViewWallets && (
              <Tab
                icon={<AccountBalanceWallet size={18} strokeWidth={1.75} />}
                iconPosition="start"
                label={t('navigation.wallets')}
              />
            )}
            {canViewAccounting && (
              <Tab
                icon={<AccountBalance size={18} strokeWidth={1.75} />}
                iconPosition="start"
                label={t('billing.tabs.payouts', 'Reversements')}
              />
            )}
            {canViewAccounting && (
              <Tab
                icon={<Category size={18} strokeWidth={1.75} />}
                iconPosition="start"
                label={t('billing.tabs.expenses', 'Depenses')}
              />
            )}
            {canViewAccounting && (
              <Tab
                icon={<Assessment size={18} strokeWidth={1.75} />}
                iconPosition="start"
                label={t('billing.tabs.reportsExports', 'Rapports & Exports')}
              />
            )}
          </Tabs>
        </Box>
      </Paper>

      {/* ── Tab content ── */}
      {activeLogicalIndex === TAB_PAYMENTS && <PaymentHistoryPage embedded />}
      {activeLogicalIndex === TAB_INVOICES && canViewInvoices && <InvoicesList embedded />}
      {activeLogicalIndex === TAB_WALLETS && canViewWallets && <WalletDashboard embedded />}
      {activeLogicalIndex === TAB_PAYOUTS && canViewAccounting && <PayoutsTab />}
      {activeLogicalIndex === TAB_EXPENSES && canViewAccounting && <ExpensesTab />}
      {activeLogicalIndex === TAB_REPORTS && canViewAccounting && <ReportsExportsTab />}
    </Box>
  );
};

export default BillingPage;
