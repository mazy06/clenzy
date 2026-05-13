import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Receipt as ReceiptIcon,
  ShoppingCart as ShoppingCartIcon,
} from '../../icons';
import { pennylaneApi } from '../../services/api/pennylaneApi';
import type { PennylaneStatus, PennylaneSyncStatus } from '../../services/api/pennylaneApi';
import { useTranslation } from '../../hooks/useTranslation';

export default function IntegrationsSection() {
  const { t } = useTranslation();

  const [status, setStatus] = useState<PennylaneStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<PennylaneSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const [s, ss] = await Promise.all([
        pennylaneApi.getStatus(),
        pennylaneApi.getSyncStatus().catch(() => null),
      ]);
      setStatus(s);
      if (ss) setSyncStatus(ss);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConnect = async () => {
    try {
      const result = await pennylaneApi.connect();
      if (result.authorization_url) {
        // Redirect dans le meme onglet pour que le callback revienne sur Settings
        window.location.href = result.authorization_url;
      }
    } catch {
      setSyncMessage({ type: 'error', text: t('settings.integrations.pennylane.connectionError') });
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await pennylaneApi.disconnect();
      setStatus({ connected: false });
      setSyncStatus(null);
      setDisconnectDialogOpen(false);
      setSyncMessage({ type: 'success', text: t('settings.integrations.pennylane.disconnected') });
    } catch {
      setSyncMessage({ type: 'error', text: t('settings.integrations.pennylane.disconnectError') });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async (type: 'invoices' | 'expenses' | 'all') => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      if (type === 'invoices') {
        const result = await pennylaneApi.syncInvoices();
        setSyncMessage({
          type: result.failed > 0 ? 'error' : 'success',
          text: `${result.synced} ${t('settings.integrations.pennylane.invoicesSynced')}${result.failed > 0 ? ` (${result.failed} ${t('settings.integrations.pennylane.failed')})` : ''}`,
        });
      } else if (type === 'expenses') {
        const result = await pennylaneApi.syncExpenses();
        setSyncMessage({
          type: result.failed > 0 ? 'error' : 'success',
          text: `${result.synced} ${t('settings.integrations.pennylane.expensesSynced')}${result.failed > 0 ? ` (${result.failed} ${t('settings.integrations.pennylane.failed')})` : ''}`,
        });
      } else {
        const result = await pennylaneApi.syncAll();
        const totalSynced = result.invoices.synced + result.expenses.synced;
        const totalFailed = result.invoices.failed + result.expenses.failed;
        setSyncMessage({
          type: totalFailed > 0 ? 'error' : 'success',
          text: `${totalSynced} ${t('settings.integrations.pennylane.elementsSynced')}${totalFailed > 0 ? ` (${totalFailed} ${t('settings.integrations.pennylane.failed')})` : ''}`,
        });
      }
      // Refresh sync status
      const ss = await pennylaneApi.getSyncStatus().catch(() => null);
      if (ss) setSyncStatus(ss);
    } catch {
      setSyncMessage({ type: 'error', text: t('settings.integrations.pennylane.syncError') });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Pennylane Card */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                bgcolor: '#1B2A4A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              PL
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {t('settings.integrations.pennylane.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('settings.integrations.pennylane.description')}
              </Typography>
            </Box>
          </Box>

          <Chip
            icon={status?.connected ? <CheckCircleIcon /> : <ErrorIcon />}
            label={status?.connected ? t('settings.integrations.pennylane.connected') : t('settings.integrations.pennylane.notConnected')}
            color={status?.connected ? 'success' : 'default'}
            size="small"
            variant="outlined"
          />
        </Box>

        {/* Connection info or connect button */}
        {status?.connected ? (
          <>
            {/* Connection details */}
            <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
              {status.connectedAt && (
                <Typography variant="caption" color="text.secondary">
                  {t('settings.integrations.pennylane.connectedAt')}: {new Date(status.connectedAt).toLocaleDateString()}
                </Typography>
              )}
              {status.lastSyncAt && (
                <Typography variant="caption" color="text.secondary">
                  {t('settings.integrations.pennylane.lastSync')}: {new Date(status.lastSyncAt).toLocaleString()}
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Sync status */}
            {syncStatus && (
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Chip
                  icon={<ReceiptIcon />}
                  label={`${syncStatus.pendingInvoices} ${t('settings.integrations.pennylane.pendingInvoices')}`}
                  size="small"
                  variant="outlined"
                  color={syncStatus.pendingInvoices > 0 ? 'warning' : 'default'}
                />
                <Chip
                  icon={<ShoppingCartIcon />}
                  label={`${syncStatus.pendingExpenses} ${t('settings.integrations.pennylane.pendingExpenses')}`}
                  size="small"
                  variant="outlined"
                  color={syncStatus.pendingExpenses > 0 ? 'warning' : 'default'}
                />
              </Box>
            )}

            {/* Sync actions */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon />}
                onClick={() => handleSync('invoices')}
                disabled={syncing}
              >
                {t('settings.integrations.pennylane.syncInvoices')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon />}
                onClick={() => handleSync('expenses')}
                disabled={syncing}
              >
                {t('settings.integrations.pennylane.syncExpenses')}
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                onClick={() => handleSync('all')}
                disabled={syncing}
              >
                {syncing ? t('settings.integrations.pennylane.syncing') : t('settings.integrations.pennylane.syncAll')}
              </Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<LinkOffIcon />}
                onClick={() => setDisconnectDialogOpen(true)}
              >
                {t('settings.integrations.pennylane.disconnect')}
              </Button>
            </Box>
          </>
        ) : (
          <Button
            variant="contained"
            startIcon={<LinkIcon />}
            onClick={handleConnect}
            sx={{ mt: 1 }}
          >
            {t('settings.integrations.pennylane.connect')}
          </Button>
        )}

        {/* Sync feedback */}
        {syncMessage && (
          <Alert severity={syncMessage.type} sx={{ mt: 2 }} onClose={() => setSyncMessage(null)}>
            {syncMessage.text}
          </Alert>
        )}
      </Paper>

      {/* Other integrations — Coming soon */}
      <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontSize: '0.85rem' }}>
          {t('settings.integrations.comingSoon')}
        </Typography>
      </Paper>

      {/* Disconnect confirmation */}
      <Dialog open={disconnectDialogOpen} onClose={() => setDisconnectDialogOpen(false)}>
        <DialogTitle>{t('settings.integrations.pennylane.disconnectTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('settings.integrations.pennylane.disconnectConfirm')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisconnectDialogOpen(false)} disabled={disconnecting}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDisconnect}
            color="error"
            variant="contained"
            disabled={disconnecting}
            startIcon={disconnecting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {t('settings.integrations.pennylane.disconnect')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
