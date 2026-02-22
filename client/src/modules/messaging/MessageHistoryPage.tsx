import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Refresh, History } from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import PageHeader from '../../components/PageHeader';
import {
  guestMessagingApi,
  type GuestMessageLog,
} from '../../services/api/guestMessagingApi';

const STATUS_CONFIG: Record<string, { color: 'success' | 'warning' | 'error' | 'info' | 'default'; label: string }> = {
  SENT: { color: 'success', label: 'Envoye' },
  DELIVERED: { color: 'success', label: 'Delivre' },
  PENDING: { color: 'warning', label: 'En attente' },
  FAILED: { color: 'error', label: 'Echoue' },
  BOUNCED: { color: 'error', label: 'Rebondi' },
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
};

export default function MessageHistoryPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<GuestMessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await guestMessagingApi.getHistory();
      setLogs(data);
    } catch (err) {
      setError(t('messaging.history.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      <PageHeader
        title={t('messaging.history.title')}
        subtitle={t('messaging.history.subtitle')}
        backPath="/settings"
        actions={
          <Tooltip title={t('common.refresh')}>
            <IconButton onClick={loadHistory} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : logs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <History sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('messaging.history.empty')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('messaging.history.emptyDesc')}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('messaging.history.date')}</TableCell>
                <TableCell>{t('messaging.history.guest')}</TableCell>
                <TableCell>{t('messaging.history.template')}</TableCell>
                <TableCell>{t('messaging.history.channel')}</TableCell>
                <TableCell>{t('messaging.history.recipient')}</TableCell>
                <TableCell>{t('messaging.history.subject')}</TableCell>
                <TableCell align="center">{t('messaging.history.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => {
                const statusConfig = STATUS_CONFIG[log.status] || { color: 'default' as const, label: log.status };
                return (
                  <TableRow key={log.id} hover>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {formatDate(log.sentAt || log.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {log.guestName || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                        {log.templateName || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={CHANNEL_LABELS[log.channel] || log.channel}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                        {log.recipient}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {log.subject || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={log.errorMessage || ''}>
                        <Chip
                          label={statusConfig.label}
                          color={statusConfig.color}
                          size="small"
                        />
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
