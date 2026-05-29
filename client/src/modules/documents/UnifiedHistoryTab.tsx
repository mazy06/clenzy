import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  useTheme,
} from '@mui/material';
import {
  Download,
  Lock,
  Fingerprint,
  VerifiedUser,
  Email as EmailIcon,
  Description as DocIcon,
  History,
  Visibility,
  Edit as EditIcon,
  Replay,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { guestMessagingApi, type GuestMessageLog } from '../../services/api/guestMessagingApi';
import { guestsApi } from '../../services/api/guestsApi';
import { documentsApi, type DocumentGeneration } from '../../services/api/documentsApi';
import { useGenerations, useVerifyDocumentIntegrity } from './hooks/useDocuments';
import GenerateDialog from './GenerateDialog';
import { softChipSx } from '../../utils/statusUtils';

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
  // Message-specific
  messageLog?: GuestMessageLog;
  // Document-specific
  documentGeneration?: DocumentGeneration;
  legalNumber?: string;
  locked?: boolean;
  documentHash?: string;
  fileSize?: number;
  correctsId?: number;
}

// ─── Status Configs ─────────────────────────────────────────────────────────

// Palette Baitly : remplace les couleurs MUI (#d32f2f, #ED6C02, #0288d1)
// par les accents valides du produit.
const ACCENT_TEAL = '#4A9B8E';
const WARM = '#D4A574';
const SOFT_BLUE = '#7BA3C2';
const NEUTRAL = '#8A8378';
const DANGER_SOFT = '#C97A7A';
const PRIMARY = '#6B8A9A';

const MSG_STATUS: Record<string, { hex: string; label: string }> = {
  SENT: { hex: ACCENT_TEAL, label: 'Envoye' },
  DELIVERED: { hex: ACCENT_TEAL, label: 'Delivre' },
  PENDING: { hex: WARM, label: 'En attente' },
  FAILED: { hex: DANGER_SOFT, label: 'Echoue' },
  BOUNCED: { hex: DANGER_SOFT, label: 'Rebondi' },
};

const DOC_STATUS: Record<string, { hex: string; label: string }> = {
  PENDING: { hex: NEUTRAL, label: 'En attente' },
  GENERATING: { hex: SOFT_BLUE, label: 'En cours' },
  COMPLETED: { hex: ACCENT_TEAL, label: 'Termine' },
  FAILED: { hex: DANGER_SOFT, label: 'Echoue' },
  SENT: { hex: ACCENT_TEAL, label: 'Envoye' },
  LOCKED: { hex: WARM, label: 'Verrouille' },
  ARCHIVED: { hex: NEUTRAL, label: 'Archive' },
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Message logs (non-paginated)
  const [messageLogs, setMessageLogs] = useState<GuestMessageLog[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Message detail / edit email dialog
  const [detailLog, setDetailLog] = useState<GuestMessageLog | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editEmailLog, setEditEmailLog] = useState<GuestMessageLog | null>(null);
  const [editEmailValue, setEditEmailValue] = useState('');
  const [editEmailLoading, setEditEmailLoading] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);

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
          messageLog: log,
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

  const handleResend = async (log: GuestMessageLog) => {
    try {
      setResendingId(log.id);
      await guestMessagingApi.resendMessage(log.id);
      setActionError(null);
      loadMessages();
    } catch (err) {
      // Le backend renvoie 400 + code MESSAGING_RECIPIENT_MISSING + message clair quand
      // la reservation n'a pas d'email guest (typique iCal anonymise).
      const e = err as { response?: { data?: { message?: string; code?: string } } };
      const backendMessage = e?.response?.data?.message;
      setActionError(backendMessage || 'Erreur lors du renvoi du message');
    } finally {
      setResendingId(null);
    }
  };

  /** Determine si le log a un destinataire utilisable pour un renvoi. */
  const hasRecipient = (log: GuestMessageLog): boolean => {
    const r = (log.recipient || '').trim();
    if (!r || r === 'N/A' || r === '—') return false;
    if (log.channel === 'EMAIL') return r.includes('@');
    return true;
  };

  const handleUpdateEmailAndResend = async () => {
    if (!editEmailLog || !editEmailValue.trim() || !editEmailLog.guestId) return;
    try {
      setEditEmailLoading(true);
      await guestsApi.updateEmail(editEmailLog.guestId, editEmailValue.trim());
      await guestMessagingApi.resendMessage(editEmailLog.id);
      setEditEmailLog(null);
      setEditEmailValue('');
      loadMessages();
    } catch {
      setActionError("Erreur lors de la mise a jour de l'email");
    } finally {
      setEditEmailLoading(false);
    }
  };

  // Charger l'apercu du contenu email quand le dialog de detail s'ouvre
  useEffect(() => {
    if (!detailLog || detailLog.channel !== 'EMAIL' || !detailLog.templateId) {
      setPreviewHtml(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewHtml(null);
    guestMessagingApi.previewMessage(detailLog.id)
      .then((res) => { if (!cancelled) setPreviewHtml(res.htmlBody); })
      .catch(() => { if (!cancelled) setPreviewHtml(null); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [detailLog]);

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

      {/* Filter chips — Baitly soft palette, active = PRIMARY tinted, inactif = NEUTRAL */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 2 }}>
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.key;
          return (
            <Chip
              key={opt.key}
              label={opt.label}
              onClick={() => setFilter(opt.key)}
              sx={{
                ...softChipSx(active ? PRIMARY : NEUTRAL),
                cursor: 'pointer',
                opacity: active ? 1 : 0.7,
                transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': { opacity: 1, backgroundColor: active ? `${PRIMARY}24` : `${NEUTRAL}24` },
              }}
            />
          );
        })}
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : unifiedRows.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 2 }}><History size={48} strokeWidth={1.75} /></Box>
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
                    {/* Type icon (Baitly palette : message = SOFT_BLUE, document = VIOLET) */}
                    <TableCell sx={{ pr: 0 }}>
                      <Tooltip title={row.kind === 'message' ? t('documents.history.typeMessage') : t('documents.history.typeDocument')} arrow>
                        {row.kind === 'message'
                          ? <Box component="span" sx={{ display: 'inline-flex', color: SOFT_BLUE }}><EmailIcon size={18} strokeWidth={1.75} /></Box>
                          : <Box component="span" sx={{ display: 'inline-flex', color: '#8b5cf6' }}><DocIcon size={18} strokeWidth={1.75} /></Box>
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
                        {row.legalNumber && (() => {
                          const hex = row.locked ? WARM : NEUTRAL;
                          return (
                            <Chip
                              icon={row.locked ? <Lock size={12} strokeWidth={1.75} color={hex} /> : undefined}
                              label={row.legalNumber}
                              size="small"
                              sx={{
                                ...softChipSx(hex),
                                fontFamily: '"SF Mono", Menlo, Consolas, monospace',
                              }}
                            />
                          );
                        })()}
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
                      <Chip label={row.channel} size="small" sx={softChipSx(SOFT_BLUE)} />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={row.errorMessage || ''} arrow>
                        <Chip label={row.status} size="small" sx={softChipSx(row.statusHex)} />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        {/* ── Message actions ── */}
                        {row.kind === 'message' && row.messageLog && (
                          <>
                            <Tooltip title="Voir les details" arrow>
                              <IconButton
                                size="small"
                                onClick={() => setDetailLog(row.messageLog!)}
                                aria-label="Voir les details"
                                sx={{ cursor: 'pointer', color: 'text.secondary', '&:hover': { color: SOFT_BLUE, backgroundColor: `${SOFT_BLUE}14` } }}
                              >
                                <Visibility size={16} strokeWidth={1.75} />
                              </IconButton>
                            </Tooltip>
                            {row.messageLog.status === 'FAILED' && row.messageLog.guestId && (
                              <Tooltip title="Modifier l'email et renvoyer" arrow>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditEmailLog(row.messageLog!);
                                    setEditEmailValue(row.messageLog!.recipient === 'N/A' ? '' : row.messageLog!.recipient);
                                  }}
                                  aria-label="Modifier l'email"
                                  sx={{ cursor: 'pointer', color: 'text.secondary', '&:hover': { color: WARM, backgroundColor: `${WARM}14` } }}
                                >
                                  <EditIcon size={16} strokeWidth={1.75} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {row.messageLog.status === 'FAILED' && !row.messageLog.guestId && (
                              <Tooltip title="Réservation anonymisée (iCal Airbnb/Booking) — l'email du voyageur n'est pas exposé par le canal. Crée un guest manuel pour pouvoir envoyer le message.">
                                <span>
                                  <IconButton size="small" disabled>
                                    <EditIcon size={16} strokeWidth={1.75} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                            {row.messageLog.status === 'FAILED' && row.messageLog.templateId && (() => {
                              const canResend = hasRecipient(row.messageLog!);
                              const tip = canResend
                                ? "Renvoyer le message"
                                : "Pas de destinataire — ajoute un email guest avant de renvoyer";
                              return (
                                <Tooltip title={tip} arrow>
                                  <span>
                                    <IconButton
                                      size="small"
                                      disabled={!canResend || resendingId === row.messageLog!.id}
                                      onClick={() => canResend && handleResend(row.messageLog!)}
                                      aria-label="Renvoyer"
                                      sx={{
                                        cursor: canResend ? 'pointer' : 'not-allowed',
                                        color: canResend ? ACCENT_TEAL : 'text.disabled',
                                        '&:hover': canResend ? { backgroundColor: `${ACCENT_TEAL}14` } : {},
                                      }}
                                    >
                                      {resendingId === row.messageLog!.id
                                        ? <CircularProgress size={16} />
                                        : <Replay size={16} strokeWidth={1.75} />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              );
                            })()}
                          </>
                        )}
                        {/* ── Document actions ── */}
                        {row.kind === 'document' && row.documentGeneration && (
                          <>
                            {['COMPLETED', 'SENT', 'LOCKED'].includes(row.documentGeneration.status) && (
                              <Tooltip title="Telecharger" arrow>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDownload(row.documentGeneration!)}
                                  aria-label="Telecharger"
                                  sx={{ cursor: 'pointer', color: 'text.secondary', '&:hover': { color: PRIMARY, backgroundColor: `${PRIMARY}14` } }}
                                >
                                  <Download size={16} strokeWidth={1.75} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {row.locked && row.documentHash && (
                              <Tooltip title="Verifier l'integrite" arrow>
                                <IconButton
                                  size="small"
                                  onClick={() => handleVerify(row.documentGeneration!)}
                                  aria-label="Verifier l'integrite"
                                  sx={{ cursor: 'pointer', color: 'text.secondary', '&:hover': { color: SOFT_BLUE, backgroundColor: `${SOFT_BLUE}14` } }}
                                >
                                  <Fingerprint size={16} strokeWidth={1.75} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {row.correctsId && (
                              <Tooltip title={`Correction du document #${row.correctsId}`}>
                                <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', mt: 0.5 }}><VerifiedUser size={16} strokeWidth={1.75} /></Box>
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

      {/* ── Detail dialog ── */}
      <Dialog open={!!detailLog} onClose={() => setDetailLog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Details du message</DialogTitle>
        <DialogContent>
          {detailLog && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
              <Typography variant="body2"><strong>Template :</strong> {detailLog.templateName || '—'}</Typography>
              <Typography variant="body2"><strong>Sujet :</strong> {detailLog.subject || '—'}</Typography>
              <Typography variant="body2"><strong>Destinataire :</strong> {detailLog.recipient}</Typography>
              <Typography variant="body2"><strong>Voyageur :</strong> {detailLog.guestName || '—'}</Typography>
              <Typography variant="body2"><strong>Canal :</strong> {detailLog.channel}</Typography>
              <Typography variant="body2"><strong>Statut :</strong> {detailLog.status}</Typography>
              {detailLog.errorMessage && (
                <Alert severity="error" sx={{ mt: 1 }}>{detailLog.errorMessage}</Alert>
              )}
              <Typography variant="body2"><strong>Reservation :</strong> #{detailLog.reservationId}</Typography>
              <Typography variant="body2" color="text.secondary">
                Cree le {formatDate(detailLog.createdAt)}
                {detailLog.sentAt && ` — Envoye le ${formatDate(detailLog.sentAt)}`}
              </Typography>

              {/* Apercu du contenu email */}
              {detailLog.channel === 'EMAIL' && detailLog.templateId && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 1 }}>Contenu de l&apos;email</Typography>
                  {previewLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : previewHtml ? (
                    <Box
                      sx={{
                        mt: 0.5,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        overflow: 'hidden',
                      }}
                    >
                      <iframe
                        sandbox=""
                        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:${isDark ? '#e0e0e0' : '#333'};background:${isDark ? '#1e1e1e' : '#fff'};padding:16px;margin:0;white-space:pre-line;word-wrap:break-word;}a{color:${isDark ? '#90caf9' : '#1976d2'};}</style></head><body>${previewHtml}</body></html>`}
                        title="Apercu email"
                        style={{
                          width: '100%',
                          height: 300,
                          border: 'none',
                        }}
                      />
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                      Apercu indisponible
                    </Typography>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {detailLog?.status === 'FAILED' && detailLog.guestId && (
            <Button
              color="warning"
              onClick={() => {
                setEditEmailLog(detailLog);
                setEditEmailValue(detailLog.recipient === 'N/A' ? '' : detailLog.recipient);
                setDetailLog(null);
              }}
            >
              Modifier l&apos;email
            </Button>
          )}
          {detailLog?.status === 'FAILED' && detailLog.templateId && (() => {
            const canResend = hasRecipient(detailLog);
            return (
              <Tooltip
                title={canResend ? '' : "Pas de destinataire — ajoute un email guest avant de renvoyer"}
                disableHoverListener={canResend}
              >
                <span>
                  <Button
                    color="success"
                    disabled={!canResend || resendingId === detailLog.id}
                    onClick={() => {
                      if (!canResend) return;
                      handleResend(detailLog);
                      setDetailLog(null);
                    }}
                  >
                    Renvoyer
                  </Button>
                </span>
              </Tooltip>
            );
          })()}
          <Button onClick={() => setDetailLog(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit email dialog ── */}
      <Dialog open={!!editEmailLog} onClose={() => setEditEmailLog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Modifier l&apos;email du voyageur</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Saisissez l&apos;email du voyageur pour {editEmailLog?.guestName || 'ce voyageur'}.
            Le message sera automatiquement renvoye apres la mise a jour.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            type="email"
            label="Email"
            value={editEmailValue}
            onChange={(e) => setEditEmailValue(e.target.value)}
            placeholder="voyageur@example.com"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditEmailLog(null)} disabled={editEmailLoading}>
            Annuler
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!editEmailValue.trim() || editEmailLoading}
            onClick={handleUpdateEmailAndResend}
          >
            {editEmailLoading ? <CircularProgress size={20} /> : 'Enregistrer et renvoyer'}
          </Button>
        </DialogActions>
      </Dialog>

      <GenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} onSuccess={() => setGenerateOpen(false)} />
    </Box>
  );
});

UnifiedHistoryTab.displayName = 'UnifiedHistoryTab';

export default UnifiedHistoryTab;
