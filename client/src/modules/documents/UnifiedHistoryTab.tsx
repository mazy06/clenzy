import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Download,
  Lock,
  Fingerprint,
  VerifiedUser,
  Email as EmailIcon,
  Description as DocIcon,
  History,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { guestMessagingApi, type GuestMessageLog } from '../../services/api/guestMessagingApi';
import { documentsApi, type DocumentGeneration } from '../../services/api/documentsApi';
import { useGenerations, useVerifyDocumentIntegrity } from './hooks/useDocuments';
import GenerateDialog from './GenerateDialog';

// ─── Types ──────────────────────────────────────────────────────────────────

type HistoryFilter = 'all' | 'messages' | 'documents';

interface UnifiedRow {
  id: string;
  kind: 'message' | 'document';
  date: Date;
  dateStr: string;
  name: string;
  recipient: string;
  channel: string;
  status: string;
  statusColor: 'success' | 'warning' | 'error' | 'info' | 'default';
  errorMessage?: string;
  // Document-specific
  documentGeneration?: DocumentGeneration;
  legalNumber?: string;
  locked?: boolean;
  documentHash?: string;
  fileSize?: number;
  correctsId?: number;
}

// ─── Status Configs ─────────────────────────────────────────────────────────

const MSG_STATUS: Record<string, { color: 'success' | 'warning' | 'error' | 'info' | 'default'; label: string }> = {
  SENT: { color: 'success', label: 'Envoye' },
  DELIVERED: { color: 'success', label: 'Delivre' },
  PENDING: { color: 'warning', label: 'En attente' },
  FAILED: { color: 'error', label: 'Echoue' },
  BOUNCED: { color: 'error', label: 'Rebondi' },
};

const DOC_STATUS: Record<string, { color: 'success' | 'warning' | 'error' | 'info' | 'default'; label: string }> = {
  PENDING: { color: 'default', label: 'En attente' },
  GENERATING: { color: 'info', label: 'En cours' },
  COMPLETED: { color: 'success', label: 'Termine' },
  FAILED: { color: 'error', label: 'Echoue' },
  SENT: { color: 'success', label: 'Envoye' },
  LOCKED: { color: 'warning', label: 'Verrouille' },
  ARCHIVED: { color: 'default', label: 'Archive' },
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
};

// ─── Ref Interface ──────────────────────────────────────────────────────────

export interface UnifiedHistoryTabRef {
  refresh: () => void;
  openGenerate: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const UnifiedHistoryTab = forwardRef<UnifiedHistoryTabRef>((_, ref) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Message logs (non-paginated)
  const [messageLogs, setMessageLogs] = useState<GuestMessageLog[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Document generations (paginated)
  const [docPage, setDocPage] = useState(0);
  const [docSize, setDocSize] = useState(20);
  const { data: docData, isLoading: docsLoading, refetch: refetchDocs } = useGenerations(docPage, docSize);
  const verifyMutation = useVerifyDocumentIntegrity();

  const generations = docData?.content ?? [];
  const docTotalElements = docData?.totalElements ?? 0;

  const loadMessages = useCallback(async () => {
    try {
      setMessagesLoading(true);
      const data = await guestMessagingApi.getHistory();
      setMessageLogs(data);
    } catch {
      setActionError(t('messaging.history.loadError'));
    } finally {
      setMessagesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (filter === 'all' || filter === 'messages') {
      loadMessages();
    }
  }, [filter, loadMessages]);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      loadMessages();
      refetchDocs();
    },
    openGenerate: () => setGenerateOpen(true),
  }));

  // Merge & sort both lists for "all" view
  const unifiedRows: UnifiedRow[] = (() => {
    const rows: UnifiedRow[] = [];

    if (filter !== 'documents') {
      for (const log of messageLogs) {
        const statusConfig = MSG_STATUS[log.status] || { color: 'default' as const, label: log.status };
        const dateStr = log.sentAt || log.createdAt;
        rows.push({
          id: `msg-${log.id}`,
          kind: 'message',
          date: new Date(dateStr),
          dateStr,
          name: log.templateName || log.subject || '—',
          recipient: log.guestName || log.recipient || '—',
          channel: CHANNEL_LABELS[log.channel] || log.channel,
          status: statusConfig.label,
          statusColor: statusConfig.color,
          errorMessage: log.errorMessage || undefined,
        });
      }
    }

    if (filter !== 'messages') {
      for (const gen of generations) {
        const statusConfig = DOC_STATUS[gen.status] || { color: 'default' as const, label: gen.status };
        rows.push({
          id: `doc-${gen.id}`,
          kind: 'document',
          date: new Date(gen.createdAt),
          dateStr: gen.createdAt,
          name: gen.templateName || gen.documentType || '—',
          recipient: gen.emailTo || '—',
          channel: 'Document',
          status: statusConfig.label,
          statusColor: statusConfig.color,
          errorMessage: gen.errorMessage || undefined,
          documentGeneration: gen,
          legalNumber: gen.legalNumber ?? undefined,
          locked: gen.locked,
          documentHash: gen.documentHash ?? undefined,
          fileSize: gen.fileSize,
          correctsId: gen.correctsId ?? undefined,
        });
      }
    }

    return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  })();

  const handleDownload = async (gen: DocumentGeneration) => {
    try {
      await documentsApi.downloadGeneration(gen.id, gen.fileName || 'document.pdf');
    } catch {
      setActionError('Erreur lors du telechargement');
    }
  };

  const handleVerify = async (gen: DocumentGeneration) => {
    try {
      const result = await verifyMutation.mutateAsync(gen.id);
      if (result.verified) {
        setVerifyResult(`Document ${gen.legalNumber || '#' + gen.id} : Integrite verifiee`);
      } else {
        setVerifyResult(`Document ${gen.legalNumber || '#' + gen.id} : INTEGRITE COMPROMISE`);
      }
    } catch {
      setActionError('Erreur lors de la verification');
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isLoading = messagesLoading || docsLoading;

  const FILTER_OPTIONS: { key: HistoryFilter; label: string }[] = [
    { key: 'all', label: t('documents.history.filterAll') },
    { key: 'messages', label: t('documents.history.filterMessages') },
    { key: 'documents', label: t('documents.history.filterDocuments') },
  ];

  return (
    <Box>
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>}
      {verifyResult && (
        <Alert
          severity={verifyResult.includes('verifiee') ? 'success' : 'error'}
          sx={{ mb: 2 }}
          onClose={() => setVerifyResult(null)}
        >
          {verifyResult}
        </Alert>
      )}

      {/* Filter chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {FILTER_OPTIONS.map((opt) => (
          <Chip
            key={opt.key}
            label={opt.label}
            variant={filter === opt.key ? 'filled' : 'outlined'}
            color={filter === opt.key ? 'primary' : 'default'}
            onClick={() => setFilter(opt.key)}
            sx={{ fontWeight: filter === opt.key ? 600 : 400, cursor: 'pointer' }}
          />
        ))}
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : unifiedRows.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <History sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('documents.history.empty')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('documents.history.emptyDesc')}
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 40 }}></TableCell>
                  <TableCell>{t('documents.history.colDate')}</TableCell>
                  <TableCell>{t('documents.history.colName')}</TableCell>
                  <TableCell>{t('documents.history.colRecipient')}</TableCell>
                  <TableCell>{t('documents.history.colChannel')}</TableCell>
                  <TableCell align="center">{t('documents.history.colStatus')}</TableCell>
                  <TableCell align="right">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unifiedRows.map((row) => (
                  <TableRow key={row.id} hover>
                    {/* Type icon */}
                    <TableCell sx={{ pr: 0 }}>
                      <Tooltip title={row.kind === 'message' ? t('documents.history.typeMessage') : t('documents.history.typeDocument')}>
                        {row.kind === 'message'
                          ? <EmailIcon sx={{ fontSize: 18, color: 'info.main' }} />
                          : <DocIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
                        }
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>{formatDate(row.dateStr)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 200 }}>
                          {row.name}
                        </Typography>
                        {row.legalNumber && (
                          <Chip
                            icon={row.locked ? <Lock sx={{ fontSize: 12 }} /> : undefined}
                            label={row.legalNumber}
                            size="small"
                            variant="outlined"
                            color={row.locked ? 'warning' : 'default'}
                            sx={{ fontFamily: 'monospace', fontSize: '0.625rem', height: 20, borderWidth: 1.5 }}
                          />
                        )}
                      </Box>
                      {row.fileSize ? (
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(row.fileSize)}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                        {row.recipient}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={row.channel} size="small" variant="outlined" sx={{ borderWidth: 1.5 }} />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={row.errorMessage || ''}>
                        <Chip
                          label={row.status}
                          color={row.statusColor}
                          size="small"
                          variant="outlined"
                          sx={{ borderWidth: 1.5 }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        {row.kind === 'document' && row.documentGeneration && (
                          <>
                            {['COMPLETED', 'SENT', 'LOCKED'].includes(row.documentGeneration.status) && (
                              <Tooltip title="Telecharger">
                                <IconButton size="small" color="primary" onClick={() => handleDownload(row.documentGeneration!)}>
                                  <Download fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {row.locked && row.documentHash && (
                              <Tooltip title="Verifier l'integrite">
                                <IconButton size="small" color="info" onClick={() => handleVerify(row.documentGeneration!)}>
                                  <Fingerprint fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {row.correctsId && (
                              <Tooltip title={`Correction du document #${row.correctsId}`}>
                                <VerifiedUser sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }} />
                              </Tooltip>
                            )}
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination only for documents view */}
          {filter !== 'messages' && docTotalElements > docSize && (
            <TablePagination
              component="div"
              count={docTotalElements}
              page={docPage}
              onPageChange={(_, p) => setDocPage(p)}
              rowsPerPage={docSize}
              onRowsPerPageChange={(e) => { setDocSize(parseInt(e.target.value, 10)); setDocPage(0); }}
              rowsPerPageOptions={[10, 20, 50]}
              labelRowsPerPage="Par page"
            />
          )}
        </>
      )}

      <GenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} onSuccess={() => setGenerateOpen(false)} />
    </Box>
  );
});

UnifiedHistoryTab.displayName = 'UnifiedHistoryTab';

export default UnifiedHistoryTab;
