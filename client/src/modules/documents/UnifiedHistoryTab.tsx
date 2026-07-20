import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  Forum as ForumIcon,
  ChatBubbleOutline as SmsIcon,
  History,
  Edit as EditIcon,
  Replay,
  Warning as AlertTriangleIcon,
  ArrowForward as ArrowRightIcon,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useHighlightParam, useHighlightTarget } from '../../hooks/useHighlight';
import { guestMessagingApi, type GuestMessageLog } from '../../services/api/guestMessagingApi';
import { guestsApi } from '../../services/api/guestsApi';
import { documentsApi, type DocumentGeneration } from '../../services/api/documentsApi';
import { useGenerations, useVerifyDocumentIntegrity } from './hooks/useDocuments';
import GenerateDialog from './GenerateDialog';
import FilterChipRow from '../../components/FilterChipRow';
import EmptyState from '../../components/EmptyState';
import { renderServerEmailPreview } from '../../utils/emailMarkdown';

// ─── Types ──────────────────────────────────────────────────────────────────

type HistoryFilter = 'all' | 'messages' | 'documents';

/** Ton sémantique (tokens Signature) pour les chips de statut -soft. */
interface Tone { c: string; bg: string }

const TONES: Record<'ok' | 'warn' | 'err' | 'info' | 'muted', Tone> = {
  ok:    { c: 'var(--ok)',    bg: 'var(--ok-soft)' },
  warn:  { c: 'var(--warn)',  bg: 'var(--warn-soft)' },
  err:   { c: 'var(--err)',   bg: 'var(--err-soft)' },
  info:  { c: 'var(--info)',  bg: 'var(--info-soft)' },
  muted: { c: 'var(--muted)', bg: 'var(--hover)' },
};

interface UnifiedRow {
  id: string;
  kind: 'message' | 'document';
  date: Date;
  dateStr: string;
  name: string;
  recipient: string;
  channel: string;
  status: string;
  statusTone: Tone;
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

// ─── Status Configs (tokens Signature) ──────────────────────────────────────

const MSG_STATUS: Record<string, { tone: Tone; label: string }> = {
  SENT: { tone: TONES.ok, label: 'Envoye' },
  DELIVERED: { tone: TONES.ok, label: 'Delivre' },
  PENDING: { tone: TONES.warn, label: 'En attente' },
  FAILED: { tone: TONES.err, label: 'Echoue' },
  BOUNCED: { tone: TONES.err, label: 'Rebondi' },
};

const DOC_STATUS: Record<string, { tone: Tone; label: string }> = {
  PENDING: { tone: TONES.muted, label: 'En attente' },
  GENERATING: { tone: TONES.info, label: 'En cours' },
  COMPLETED: { tone: TONES.ok, label: 'Termine' },
  FAILED: { tone: TONES.err, label: 'Echoue' },
  SENT: { tone: TONES.ok, label: 'Envoye' },
  LOCKED: { tone: TONES.warn, label: 'Verrouille' },
  ARCHIVED: { tone: TONES.muted, label: 'Archive' },
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
};

/** Couleur de pastille par canal — constantes messagerie validées + token info. */
const CHANNEL_PASTILLE: Record<string, { bg: string; icon: React.ReactNode }> = {
  EMAIL: { bg: 'var(--info)', icon: <EmailIcon size={15} strokeWidth={1.75} /> },
  WHATSAPP: { bg: '#25A36F', icon: <ForumIcon size={15} strokeWidth={1.75} /> },
  SMS: { bg: '#C28A52', icon: <SmsIcon size={15} strokeWidth={1.75} /> },
};

// ─── Ref Interface ──────────────────────────────────────────────────────────

export interface UnifiedHistoryTabRef {
  refresh: () => void;
  openGenerate: () => void;
}

/** Determine si le log a un destinataire utilisable pour un renvoi. */
const hasRecipient = (log: GuestMessageLog): boolean => {
  const r = (log.recipient || '').trim();
  if (!r || r === 'N/A' || r === '—') return false;
  if (log.channel === 'EMAIL') return r.includes('@');
  return true;
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

// ─── Component ──────────────────────────────────────────────────────────────

const UnifiedHistoryTab = forwardRef<UnifiedHistoryTabRef>((_, ref) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Apercu PDF in-app (deep-link notification + clic « Apercu » document).
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

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

  const generations = useMemo(() => docData?.content ?? [], [docData?.content]);
  const docTotalElements = docData?.totalElements ?? 0;

  // Deep-link notification : surligne la ligne ciblee (?highlight=<generationId>)
  // ET ouvre l'apercu PDF du document genere correspondant (demande principale).
  const highlightId = useHighlightParam();

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
        const statusConfig = MSG_STATUS[log.status] || { tone: TONES.muted, label: log.status };
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
          statusTone: statusConfig.tone,
          errorMessage: log.errorMessage || undefined,
          messageLog: log,
        });
      }
    }

    if (filter !== 'messages') {
      for (const gen of generations) {
        const statusConfig = DOC_STATUS[gen.status] || { tone: TONES.muted, label: gen.status };
        rows.push({
          id: `doc-${gen.id}`,
          kind: 'document',
          date: new Date(gen.createdAt),
          dateStr: gen.createdAt,
          name: gen.templateName || gen.documentType || '—',
          recipient: gen.emailTo || '—',
          channel: 'Document',
          status: statusConfig.label,
          statusTone: statusConfig.tone,
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

  const openPdfPreview = useCallback(async (generationId: number) => {
    setPdfLoading(true);
    setPdfDialogOpen(true);
    setPdfUrl(null);
    try {
      const blobUrl = await documentsApi.fetchGenerationBlobUrl(generationId);
      setPdfUrl(blobUrl);
    } catch {
      setActionError(t('documents.history.pdfLoadError', 'Erreur lors du chargement du document'));
    } finally {
      setPdfLoading(false);
    }
  }, [t]);

  const handleClosePdf = useCallback(() => {
    setPdfDialogOpen(false);
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  }, [pdfUrl]);

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

  const isLoading = messagesLoading || docsLoading;

  // Scroll + flash de la ligne ciblee (cf. data-highlight-id sur les rangees doc/message).
  useHighlightTarget(highlightId, !isLoading && unifiedRows.length > 0);

  // Ouvre l'apercu PDF de la generation ciblee des qu'elle est chargee — une seule fois.
  const openedHighlightRef = useRef<string | null>(null);
  useEffect(() => {
    if (!highlightId || docsLoading) return;
    if (openedHighlightRef.current === highlightId) return;
    const gen = generations.find((g) => String(g.id) === highlightId);
    if (!gen) return;
    if (['COMPLETED', 'SENT', 'LOCKED'].includes(gen.status)) {
      openedHighlightRef.current = highlightId;
      openPdfPreview(gen.id);
    }
  }, [highlightId, docsLoading, generations, openPdfPreview]);

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

      {/* Filtres — primitive partagée FilterChipRow ('' = Tous) */}
      <Box sx={{ mb: 2 }}>
        <FilterChipRow
          options={[
            { value: 'messages', label: t('documents.history.filterMessages'), color: 'var(--info)', count: messageLogs.length },
            { value: 'documents', label: t('documents.history.filterDocuments'), color: 'var(--accent)', count: docTotalElements },
          ]}
          value={filter === 'all' ? '' : filter}
          onChange={(v) => setFilter((v === '' ? 'all' : v) as HistoryFilter)}
          allLabel={t('documents.history.filterAll')}
          allCount={messageLogs.length + docTotalElements}
          size="compact"
        />
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : unifiedRows.length === 0 ? (
        <EmptyState
          icon={<History />}
          title={t('documents.history.empty')}
          description={t('documents.history.emptyDesc')}
        />
      ) : (
        <>
          {/* ── Lignes .fr-doc : pastille type + nom fw600 + méta muted + statut -soft + actions ── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {unifiedRows.map((row) => {
              const isFailed = row.statusTone === TONES.err && (row.status === 'Echoue' || row.status === 'Rebondi');
              const pastille = row.kind === 'document'
                ? { bg: 'var(--err)', icon: null }
                : CHANNEL_PASTILLE[(row.messageLog?.channel ?? 'EMAIL')] ?? CHANNEL_PASTILLE.EMAIL;
              const meta = [
                formatDate(row.dateStr),
                row.recipient !== '—' ? row.recipient : '',
                row.channel,
                row.fileSize ? formatFileSize(row.fileSize) : '',
              ].filter(Boolean).join(' · ');

              // ID brut de l'entite (= celui pose par le backend dans ?highlight=).
              const rawId = row.kind === 'document'
                ? String(row.documentGeneration?.id ?? '')
                : String(row.messageLog?.id ?? '');

              return (
                <Box
                  key={row.id}
                  data-highlight-id={rawId || undefined}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: '12px', p: '13px 15px',
                    border: '1px solid', borderColor: isFailed ? 'var(--err)' : 'var(--line)',
                    borderRadius: '12px', bgcolor: isFailed ? 'var(--err-soft)' : 'var(--card)',
                    transition: 'border-color .14s, box-shadow .14s',
                    ...(isFailed ? {} : {
                      '&:hover': { borderColor: 'var(--accent)', boxShadow: '0 8px 22px -16px var(--accent)' },
                    }),
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  }}
                >
                  {/* Pastille type 34 r9 — PDF = --err, canaux mappés sémantiquement */}
                  <Tooltip title={row.kind === 'message' ? t('documents.history.typeMessage') : t('documents.history.typeDocument')} arrow>
                    <Box sx={{
                      width: 34, height: 34, borderRadius: '9px',
                      bgcolor: isFailed ? 'var(--err)' : pastille.bg, color: 'var(--on-accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      fontSize: '9px', fontWeight: 800,
                    }}>
                      {isFailed
                        ? <AlertTriangleIcon size={15} strokeWidth={1.75} />
                        : row.kind === 'document' ? 'PDF' : pastille.icon}
                    </Box>
                  </Tooltip>

                  {/* Nom + méta */}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '13px', fontWeight: 600, color: isFailed ? 'var(--err)' : 'var(--ink)' }}>
                        {row.name}
                      </Typography>
                      {row.legalNumber && (
                        <Chip
                          icon={row.locked ? <Lock size={12} strokeWidth={1.75} /> : undefined}
                          label={row.legalNumber}
                          size="small"
                          sx={{
                            color: row.locked ? 'var(--warn)' : 'var(--muted)',
                            bgcolor: row.locked ? 'var(--warn-soft)' : 'var(--hover)',
                            fontFamily: '"SF Mono", Menlo, Consolas, monospace',
                            '& .MuiChip-icon': { color: row.locked ? 'var(--warn)' : 'var(--muted)' },
                          }}
                        />
                      )}
                    </Box>
                    <Typography noWrap sx={{ fontSize: '11.5px', color: 'var(--muted)', mt: '1px' }}>
                      {isFailed && row.errorMessage ? `${row.errorMessage} · ${meta}` : meta}
                    </Typography>
                  </Box>

                  {/* Statut -soft + actions */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                    <Tooltip title={row.errorMessage || ''} arrow>
                      <Chip label={row.status} size="small" sx={{ color: row.statusTone.c, bgcolor: row.statusTone.bg }} />
                    </Tooltip>

                    {/* ── Message : « Aperçu → » accent + actions d'échec ── */}
                    {row.kind === 'message' && row.messageLog && (
                      <>
                        {row.messageLog.status === 'FAILED' && row.messageLog.guestId && (
                          <Tooltip title="Modifier l'email et renvoyer" arrow>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditEmailLog(row.messageLog!);
                                setEditEmailValue(row.messageLog!.recipient === 'N/A' ? '' : row.messageLog!.recipient);
                              }}
                              aria-label="Modifier l'email"
                              sx={{ cursor: 'pointer', color: 'var(--muted)', '&:hover': { color: 'var(--warn)', backgroundColor: 'var(--warn-soft)' } }}
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
                                    color: canResend ? 'var(--ok)' : 'var(--faint)',
                                    '&:hover': canResend ? { color: 'var(--ok)', backgroundColor: 'var(--ok-soft)' } : {},
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
                        <Box
                          component="button"
                          type="button"
                          onClick={() => setDetailLog(row.messageLog!)}
                          aria-label="Voir les details"
                          sx={{
                            all: 'unset', display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '12.5px', fontWeight: 600, color: 'var(--accent)',
                            whiteSpace: 'nowrap', cursor: 'pointer',
                            '&:hover': { color: 'var(--accent-deep)' },
                            '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2, borderRadius: '6px' },
                          }}
                        >
                          Aperçu
                          <ArrowRightIcon size={14} strokeWidth={1.75} />
                        </Box>
                      </>
                    )}

                    {/* ── Document : actions intégrité + « Télécharger → » accent ── */}
                    {row.kind === 'document' && row.documentGeneration && (
                      <>
                        {row.locked && row.documentHash && (
                          <Tooltip title="Verifier l'integrite" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleVerify(row.documentGeneration!)}
                              aria-label="Verifier l'integrite"
                              sx={{ cursor: 'pointer', color: 'var(--muted)', '&:hover': { color: 'var(--info)', backgroundColor: 'var(--info-soft)' } }}
                            >
                              <Fingerprint size={16} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {row.correctsId && (
                          <Tooltip title={`Correction du document #${row.correctsId}`}>
                            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><VerifiedUser size={16} strokeWidth={1.75} /></Box>
                          </Tooltip>
                        )}
                        {['COMPLETED', 'SENT', 'LOCKED'].includes(row.documentGeneration.status) && (
                          <Box
                            component="button"
                            type="button"
                            onClick={() => handleDownload(row.documentGeneration!)}
                            aria-label="Telecharger"
                            sx={{
                              all: 'unset', display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontSize: '12.5px', fontWeight: 600, color: 'var(--accent)',
                              whiteSpace: 'nowrap', cursor: 'pointer',
                              '&:hover': { color: 'var(--accent-deep)' },
                              '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2, borderRadius: '6px' },
                            }}
                          >
                            <Download size={14} strokeWidth={1.75} />
                            Télécharger
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>

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
                        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:${isDark ? '#e0e0e0' : '#333'};background:${isDark ? '#1e1e1e' : '#fff'};padding:16px;margin:0;word-wrap:break-word;}a{color:${isDark ? '#90caf9' : '#1976d2'};}</style></head><body>${renderServerEmailPreview(previewHtml)}</body></html>`}
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

      {/* ── Apercu PDF (deep-link notification document) ── */}
      <Dialog
        open={pdfDialogOpen}
        onClose={handleClosePdf}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { height: '85vh' } }}
      >
        <DialogTitle>{t('documents.history.pdfPreview', 'Apercu du document')}</DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {pdfLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress thickness={3.5} sx={{ color: 'var(--accent)' }} />
            </Box>
          ) : pdfUrl ? (
            <object data={pdfUrl} type="application/pdf" width="100%" style={{ flex: 1, border: 'none', minHeight: 0 }}>
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'var(--muted)', mb: 2 }}>
                  {t('documents.history.pdfNotSupported', 'Votre navigateur ne supporte pas la visualisation PDF.')}
                </Typography>
                <Button variant="contained" href={pdfUrl} download="document.pdf" startIcon={<Download size={16} strokeWidth={1.75} />}>
                  {t('common.download', 'Telecharger')}
                </Button>
              </Box>
            </object>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
                {t('documents.history.pdfLoadError', 'Erreur lors du chargement du document')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePdf}>{t('common.close', 'Fermer')}</Button>
        </DialogActions>
      </Dialog>

      <GenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} onSuccess={() => setGenerateOpen(false)} />
    </Box>
  );
});

UnifiedHistoryTab.displayName = 'UnifiedHistoryTab';

export default UnifiedHistoryTab;
