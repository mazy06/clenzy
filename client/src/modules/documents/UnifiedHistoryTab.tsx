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
  statusHex: string;
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

const MSG_STATUS: Record<string, { hex: string; label: string }> = {
  SENT: { hex: '#4A9B8E', label: 'Envoye' },
  DELIVERED: { hex: '#4A9B8E', label: 'Delivre' },
  PENDING: { hex: '#ED6C02', label: 'En attente' },
  FAILED: { hex: '#d32f2f', label: 'Echoue' },
  BOUNCED: { hex: '#d32f2f', label: 'Rebondi' },
};

const DOC_STATUS: Record<string, { hex: string; label: string }> = {
  PENDING: { hex: '#757575', label: 'En attente' },
  GENERATING: { hex: '#0288d1', label: 'En cours' },
  COMPLETED: { hex: '#4A9B8E', label: 'Termine' },
  FAILED: { hex: '#d32f2f', label: 'Echoue' },
  SENT: { hex: '#4A9B8E', label: 'Envoye' },
  LOCKED: { hex: '#ED6C02', label: 'Verrouille' },
  ARCHIVED: { hex: '#757575', label: 'Archive' },
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
        const statusConfig = MSG_STATUS[log.status] || { hex: '#757575', label: log.status };
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
          statusHex: statusConfig.hex,
          errorMessage: log.errorMessage || undefined,
        });
      }
    }

    if (filter !== 'messages') {
      for (const gen of generations) {
        const statusConfig = DOC_STATUS[gen.status] || { hex: '#757575', label: gen.status };
        rows.push({
          id: `doc-${gen.id}`,
          kind: 'document',
          date: new Date(gen.createdAt),
          dateStr: gen.createdAt,
          name: gen.templateName || gen.documentType || '—',
          recipient: gen.emailTo || '—',
          channel: 'Document',
          status: statusConfig.label,
          statusHex: statusConfig.hex,
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
                        {row.legalNumber && (() => { const c = row.locked ? '#ED6C02' : '#757575'; return (
                          <Chip
                            icon={row.locked ? <Lock sx={{ fontSize: 12, color: `${c} !important` }} /> : undefined}
                            label={row.legalNumber}
                            size="small"
                            sx={{ fontFamily: 'monospace', fontSize: '0.625rem', height: 20, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
                          />
                        ); })()}
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
                      <Chip label={row.channel} size="small" sx={{ backgroundColor: '#0288d118', color: '#0288d1', border: '1px solid #0288d140', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', height: 24, '& .MuiChip-label': { px: 1 } }} />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={row.errorMessage || ''}>
                        <Chip
                          label={row.status}
                          size="small"
                          sx={{ backgroundColor: `${row.statusHex}18`, color: row.statusHex, border: `1px solid ${row.statusHex}40`, borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', height: 24, '& .MuiChip-label': { px: 1 } }}
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
