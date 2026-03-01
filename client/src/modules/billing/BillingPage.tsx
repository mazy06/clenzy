import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Payment,
  Receipt,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import PaymentHistoryPage from '../payments/PaymentHistoryPage';
import InvoicesList from '../invoices/InvoicesList';

// ─── Tab indices ────────────────────────────────────────────────────────────

const TAB_PAYMENTS = 0;
const TAB_INVOICES = 1;

// ─── Component ──────────────────────────────────────────────────────────────

const BillingPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canViewInvoices = user?.permissions?.includes('reports:view') ?? false;

  const initialTab = parseInt(searchParams.get('tab') || '0', 10);
  const maxTab = canViewInvoices ? TAB_INVOICES : TAB_PAYMENTS;
  const [activeTab, setActiveTab] = useState(
    isNaN(initialTab) ? 0 : Math.min(initialTab, maxTab)
  );

  // Sync tab to URL param
  const handleTabChange = useCallback((_: React.SyntheticEvent, v: number) => {
    setActiveTab(v);
    setSearchParams(v === 0 ? {} : { tab: String(v) }, { replace: true });
  }, [setSearchParams]);

  // Handle URL param changes (browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const parsed = parseInt(tabParam, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= maxTab && parsed !== activeTab) {
        setActiveTab(parsed);
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title={t('billing.title')}
        subtitle={t('billing.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
      />
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              flex: 1,
              '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontSize: '0.8125rem' },
            }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              icon={<Payment sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={t('billing.tabs.payments')}
            />
            {canViewInvoices && (
              <Tab
                icon={<Receipt sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={t('billing.tabs.invoices')}
              />
            )}
          </Tabs>
        </Box>
      </Paper>

      {/* ── Tab content ── */}
      {activeTab === TAB_PAYMENTS && <PaymentHistoryPage embedded />}
      {activeTab === TAB_INVOICES && canViewInvoices && <InvoicesList embedded />}
    </Box>
  );
};

export default BillingPage;
