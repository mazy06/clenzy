import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Item, ItemActions, ItemContent, ItemDescription, ItemGroup,
  ItemMedia, ItemSeparator, ItemTitle,
} from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Field, FieldLabel, Input } from '../../components/ui';
import { useThemeMode } from '../../hooks/useThemeMode';
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
  Visibility as EyeIcon,
  Description as FileTextIcon,
  Send as SendIcon,
  ArrowForward as ArrowRightIcon,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useHighlightParam, useHighlightTarget } from '../../hooks/useHighlight';
import { guestMessagingApi, type GuestMessageLog } from '../../services/api/guestMessagingApi';
import { guestsApi } from '../../services/api/guestsApi';
import { documentsApi, type DocumentGeneration } from '../../services/api/documentsApi';
import { useGenerations, useVerifyDocumentIntegrity } from './hooks/useDocuments';
import GenerateDialog from './GenerateDialog';
import FilterChipRow from '../../components/baitly/FilterChipRow';
import EmptyState from '../../components/EmptyState';
import { renderServerEmailPreview } from '../../utils/emailMarkdown';
import PagePagination from '../../components/PagePagination';
import { cn } from '../../utils/cn';

// Lien-bouton de fin de ligne (« Apercu », « Telecharger »). L'ancien `all: unset`
// est rendu par des remises a zero explicites : l'ordre des utilities Tailwind
// n'etant pas celui du fichier, un `all:unset` pourrait ecraser les declarations
// suivantes au lieu de les preceder.
const INLINE_LINK_BTN_CLS =
  'inline-flex cursor-pointer appearance-none items-center gap-1 border-0 bg-transparent p-0 '
  + '[font-family:inherit] text-[12.5px] font-semibold whitespace-nowrap text-primary '
  + 'hover:text-primary-deep '
  + 'focus-visible:rounded-[6px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

// ─── Types ──────────────────────────────────────────────────────────────────

type HistoryFilter = 'all' | 'messages' | 'documents';

/**
 * Ton sémantique (tokens Baitly UI) pour les chips de statut -soft.
 *
 * <p>L'encre est le jeton `-ink` : ces tons habillent du TEXTE, et la teinte
 * vive plafonne à ~2,2:1 sur `bg-card`. La couleur étant résolue à l'exécution
 * (table de statuts), elle reste une valeur CSS — Tailwind n'émet ses classes
 * qu'à la compilation.</p>
 */
interface Tone { c: string; bg: string }

const TONES: Record<'ok' | 'warn' | 'err' | 'info' | 'muted', Tone> = {
  ok:    { c: 'var(--bui-success-ink)',      bg: 'var(--bui-success-soft)' },
  warn:  { c: 'var(--bui-warning-ink)',      bg: 'var(--bui-warning-soft)' },
  err:   { c: 'var(--bui-destructive-ink)',  bg: 'var(--bui-destructive-soft)' },
  info:  { c: 'var(--bui-info-ink)',         bg: 'var(--bui-info-soft)' },
  muted: { c: 'var(--bui-muted-foreground)', bg: 'var(--bui-muted)' },
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

// ─── Status Configs (tokens Baitly UI) ──────────────────────────────────────

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

/**
 * Couleur de pastille par canal — aplats pleins, donc TEINTE VIVE (et non `-ink`,
 * réservé au texte). Les deux hex sont des couleurs de marque de canal.
 */
const CHANNEL_PASTILLE: Record<string, { bg: string; icon: React.ReactNode }> = {
  EMAIL: { bg: 'var(--bui-info)', icon: <EmailIcon size={15} strokeWidth={1.75} /> },
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

/**
 * Date d'historique, ecrite comme on la dirait.
 *
 * <p>Trois registres selon l'anciennete : « il y a 3 h » tant qu'on est dans la
 * journee, « hier a 14h30 », puis « Lundi 23 janvier a 15h28 ». Un horodatage
 * `14/08/2026 13:22` demandait un calcul mental pour repondre a la seule
 * question qu'on se pose devant un historique : c'etait quand ?</p>
 */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';

  const now = new Date();
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const time = `${String(date.getHours()).padStart(2, '0')}h${String(date.getMinutes()).padStart(2, '0')}`;

  if (dayDiff === 0) {
    const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
    // Une date a venir (horloge desynchronisee) ne doit pas donner « il y a -2 h ».
    if (minutes < 1) return "a l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    return `il y a ${Math.floor(minutes / 60)} h`;
  }
  if (dayDiff === 1) return `hier à ${time}`;

  const weekday = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  const dayMonth = date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    // L'annee n'apparait que si elle differe : la repeter alourdit sans informer.
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayMonth} à ${time}`;
};

/**
 * Raison d'echec, en trois mots.
 *
 * <p>La pastille disait « Echoue » et rien d'autre : il fallait survoler chaque
 * ligne pour savoir si le probleme venait du destinataire, du modele ou du
 * serveur. Le message brut, lui, est technique — « freemarker.core.
 * InvalidReferenceException » ne se lit pas dans une liste.</p>
 *
 * <p>Les motifs viennent des erreurs REELLEMENT presentes en base ; tout ce qui
 * n'est pas reconnu garde « Echec » seul, plutot qu'une categorie inventee qui
 * induirait en erreur. Le detail complet reste dans l'infobulle.</p>
 */
const FAILURE_REASONS: Array<{ match: RegExp; label: string }> = [
  { match: /pas de destinataire|no recipient/i, label: 'destinataire manquant' },
  { match: /adresse rejet|rejected|invalid.*(address|email)|mailbox/i, label: 'adresse rejetée' },
  { match: /bo[iî]te pleine|quota|mailbox full/i, label: 'boîte pleine' },
  { match: /num[eé]ro invalide|invalid number|not a valid phone/i, label: 'numéro invalide' },
  { match: /tags? non resolus|tags manquants/i, label: 'tags non résolus' },
  { match: /InvalidReferenceException|evaluated to null or missing/i, label: 'variable absente du modèle' },
  { match: /aucun template actif|template.*introuvable|no template/i, label: 'modèle introuvable' },
  { match: /transaction/i, label: 'erreur technique' },
  { match: /timeout|timed out/i, label: 'délai dépassé' },
];

const failureReason = (errorMessage?: string): string | null => {
  if (!errorMessage) return null;
  return FAILURE_REASONS.find((reason) => reason.match.test(errorMessage))?.label ?? null;
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
  const { isDark } = useThemeMode();
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
    <div>
      {actionError && <BuiAlert variant="destructive" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{actionError}</AlertDescription>
        <AlertAction>
          <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setActionError(null)}>
            <X />
          </BuiButton>
        </AlertAction>
      </BuiAlert>}
      {verifyResult && (
        <BuiAlert variant={verifyResult.includes('verifiee') ? 'success' : 'destructive'} className="mb-3">
          {verifyResult.includes('verifiee') ? <CircleCheck /> : <TriangleAlert />}
          <AlertDescription>{verifyResult}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setVerifyResult(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {/* Filtres — primitive partagée FilterChipRow ('' = Tous) */}
      <div className="mb-3">
        <FilterChipRow
          options={[
            { value: 'messages', label: t('documents.history.filterMessages'), color: 'var(--bui-info)', count: messageLogs.length },
            { value: 'documents', label: t('documents.history.filterDocuments'), color: 'var(--bui-primary)', count: docTotalElements },
          ]}
          value={filter === 'all' ? '' : filter}
          onChange={(v) => setFilter((v === '' ? 'all' : v) as HistoryFilter)}
          allLabel={t('documents.history.filterAll')}
          allCount={messageLogs.length + docTotalElements}
          size="compact"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner className="size-10" />
        </div>
      ) : unifiedRows.length === 0 ? (
        <EmptyState
          icon={<History />}
          title={t('documents.history.empty')}
          description={t('documents.history.emptyDesc')}
        />
      ) : (
        <>
          {/* Liste dense, pas une pile de cartes : chaque entree encadree, arrondie
              et espacee donnait six boites pour six lignes, et l'oeil butait sur
              les contours au lieu de balayer la colonne. `ItemGroup` du kit tient
              la liste, un filet separe les lignes. */}
          {/* Patron repris de la projection « Documents & Communications » de la
              galerie : ItemGroup + ItemMedia/ItemTitle/ItemDescription, filet
              entre les lignes. La liste empilait des cartes encadrees et
              arrondies — six boites pour six lignes. */}
          <ItemGroup className="gap-0 rounded-xl border border-solid border-border bg-card">
            {unifiedRows.map((row, rowIndex) => {
              const isFailed = row.statusTone === TONES.err && (row.status === 'Echoue' || row.status === 'Rebondi');
              const pastille = row.kind === 'document'
                ? { bg: 'var(--bui-destructive)', icon: null }
                : CHANNEL_PASTILLE[(row.messageLog?.channel ?? 'EMAIL')] ?? CHANNEL_PASTILLE.EMAIL;
              // Ce qu'on cherche dans un historique, dans cet ordre : QUOI, pour
              // QUI, puis par quel canal, sous quelle reference, et quand.
              const title = row.recipient && row.recipient !== '—'
                ? `${row.name} → ${row.recipient}`
                : row.name;
              const reason = isFailed ? failureReason(row.errorMessage) : null;
              const statusLabel = reason ? `${row.status} · ${reason}` : row.status;
              const meta = [
                row.channel,
                row.legalNumber,
                formatDate(row.dateStr),
                row.fileSize ? formatFileSize(row.fileSize) : '',
              ].filter(Boolean).join(' · ');

              // ID brut de l'entite (= celui pose par le backend dans ?highlight=).
              const rawId = row.kind === 'document'
                ? String(row.documentGeneration?.id ?? '')
                : String(row.messageLog?.id ?? '');

              return (
                <React.Fragment key={row.id}>
                {rowIndex > 0 && <ItemSeparator className="my-0" />}
                <Item
                  data-highlight-id={rawId || undefined}
                  size="sm"
                  className={cn(
                    // `cn-item` enveloppe : avec cinq actions, elles passaient a
                    // la ligne.
                    'flex-nowrap',
                    // Survol : une teinte legere, pas un aplat plein — sur une
                    // liste dense, le contraste deplacait le regard sans rien
                    // designer d'utile.
                    'transition-colors duration-150 hover:bg-muted/60',
                  )}
                >
                  {/* Pastille type 34 r9 — PDF = --err, canaux mappés sémantiquement */}
                  {/* Icone de type, pas une pastille pleine : le carre colore
                      de 34 px pesait autant que le titre qu'il annonce. */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ItemMedia
                        variant="icon"
                        className={cn('shrink-0', isFailed && 'text-destructive-ink')}
                      >
                        {isFailed
                          ? <AlertTriangleIcon />
                          : row.kind === 'document' ? <FileTextIcon /> : <SendIcon />}
                      </ItemMedia>
                    </TooltipTrigger>
                    <TooltipContent>
                      {row.kind === 'message' ? t('documents.history.typeMessage') : t('documents.history.typeDocument')}
                    </TooltipContent>
                  </Tooltip>

                  {/* Nom + méta */}
                  <ItemContent className="min-w-0 flex-1 gap-0">
                    {/* Le numero legal passait sous le nom : deux lignes la ou
                        une suffit. */}
                    <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                      <ItemTitle className={cn('truncate', isFailed && 'text-destructive-ink')}>
                        {title}
                      </ItemTitle>
                      {/* Le scellement NF reste une information, mais il tient
                          dans une icone : le numero, lui, a rejoint la meta. */}
                      {row.locked && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex shrink-0 text-warning-ink">
                              <Lock size={12} strokeWidth={1.75} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('documents.history.locked', 'Document scellé')}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <ItemDescription className="truncate">
                      {/* L'erreur brute encombrait la ligne : elle est resumee
                          dans la pastille, entiere dans l'infobulle. */}
                      {meta}
                    </ItemDescription>
                  </ItemContent>

                  {/* Statut -soft + actions */}
                  <ItemActions className="shrink-0 gap-1">
                    {/* Sans message d'erreur, aucune infobulle : le Tooltip du kit
                        afficherait une bulle vide la ou MUI n'en montrait aucune. */}
                    {row.errorMessage ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {/* Le span porte la ref que TooltipTrigger pose sur son enfant :
                              StatusChip est une fonction et n'en transmet pas. */}
                          <span className="inline-flex">
                            <StatusChip tokens={{ color: row.statusTone.c, bg: row.statusTone.bg }} label={statusLabel} className="font-normal" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{row.errorMessage}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <StatusChip tokens={{ color: row.statusTone.c, bg: row.statusTone.bg }} label={statusLabel} className="font-normal" />
                    )}

                    {/* ── Message : « Aperçu → » accent + actions d'échec ── */}
                    {row.kind === 'message' && row.messageLog && (
                      <>
                        {row.messageLog.status === 'FAILED' && row.messageLog.guestId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* Le span porte la ref : Button du kit ne la transmet pas. */}
                              <span className="inline-flex">
                                <BuiButton
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => {
                                    setEditEmailLog(row.messageLog!);
                                    setEditEmailValue(row.messageLog!.recipient === 'N/A' ? '' : row.messageLog!.recipient);
                                  }}
                                  aria-label="Modifier l'email"
                                  className="text-muted-foreground hover:bg-warning-soft hover:text-warning-ink"
                                >
                                  <EditIcon size={14} strokeWidth={1.75} />
                                </BuiButton>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Modifier l&apos;email et renvoyer</TooltipContent>
                          </Tooltip>
                        )}
                        {row.messageLog.status === 'FAILED' && !row.messageLog.guestId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <BuiButton variant="ghost" size="icon-xs" disabled aria-label="Modifier l'email">
                                  <EditIcon size={14} strokeWidth={1.75} />
                                </BuiButton>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Réservation anonymisée (iCal Airbnb/Booking) — l&apos;email du voyageur n&apos;est pas exposé par le canal.
                              Crée un guest manuel pour pouvoir envoyer le message.
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {row.messageLog.status === 'FAILED' && row.messageLog.templateId && (() => {
                          const canResend = hasRecipient(row.messageLog!);
                          const tip = canResend
                            ? "Renvoyer le message"
                            : "Pas de destinataire — ajoute un email guest avant de renvoyer";
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <BuiButton
                                    variant="ghost"
                                    size="icon-xs"
                                    disabled={!canResend || resendingId === row.messageLog!.id}
                                    onClick={() => canResend && handleResend(row.messageLog!)}
                                    aria-label="Renvoyer"
                                    className={cn(
                                      canResend
                                        ? 'text-success-ink hover:bg-success-soft hover:text-success-ink'
                                        : 'text-faint',
                                    )}
                                  >
                                    {resendingId === row.messageLog!.id
                                      ? <Spinner className="size-4" />
                                      : <Replay size={14} strokeWidth={1.75} />}
                                  </BuiButton>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{tip}</TooltipContent>
                            </Tooltip>
                          );
                        })()}
                        {/* Un oeil, comme dans la projection : « Aperçu → » en
                            toutes lettres pesait autant que le statut, sur
                            chaque ligne de la liste. */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <BuiButton
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setDetailLog(row.messageLog!)}
                                aria-label={t('documents.history.preview', 'Aperçu')}
                                className="text-muted-foreground"
                              >
                                <EyeIcon size={14} strokeWidth={1.75} />
                              </BuiButton>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('documents.history.preview', 'Aperçu')}</TooltipContent>
                        </Tooltip>
                      </>
                    )}

                    {/* ── Document : actions intégrité + « Télécharger → » accent ── */}
                    {row.kind === 'document' && row.documentGeneration && (
                      <>
                        {row.locked && row.documentHash && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <BuiButton
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => handleVerify(row.documentGeneration!)}
                                  aria-label="Verifier l'integrite"
                                  className="text-muted-foreground hover:bg-info-soft hover:text-info-ink"
                                >
                                  <Fingerprint size={14} strokeWidth={1.75} />
                                </BuiButton>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Verifier l&apos;integrite</TooltipContent>
                          </Tooltip>
                        )}
                        {row.correctsId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex text-muted-foreground"><VerifiedUser size={14} strokeWidth={1.75} /></span>
                            </TooltipTrigger>
                            <TooltipContent>{`Correction du document #${row.correctsId}`}</TooltipContent>
                          </Tooltip>
                        )}
                        {['COMPLETED', 'SENT', 'LOCKED'].includes(row.documentGeneration.status) && (
                          <button
                            type="button"
                            onClick={() => handleDownload(row.documentGeneration!)}
                            aria-label="Telecharger"
                            className={INLINE_LINK_BTN_CLS}
                          >
                            <Download size={14} strokeWidth={1.75} />
                            Télécharger
                          </button>
                        )}
                      </>
                    )}
                  </ItemActions>
                </Item>
                </React.Fragment>
              );
            })}
          </ItemGroup>

          {/* Pagination only for documents view */}
          {filter !== 'messages' && docTotalElements > docSize && (
            <PagePagination
              count={docTotalElements}
              page={docPage}
              onPageChange={(p) => setDocPage(p)}
              rowsPerPage={docSize}
              rowsPerPageOptions={[10, 20, 50]}
              onRowsPerPageChange={(rows) => { setDocSize(rows); setDocPage(0); }}
            />
          )}
        </>
      )}

      {/* ── Detail dialog ── */}
      <Dialog open={!!detailLog} onOpenChange={(next) => { if (!next) setDetailLog(null); }}>
        <DialogContent className="max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Details du message</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="flex flex-col gap-2 pt-1.5">
              <p className="text-xs"><strong>Template :</strong> {detailLog.templateName || '—'}</p>
              <p className="text-xs"><strong>Sujet :</strong> {detailLog.subject || '—'}</p>
              <p className="text-xs"><strong>Destinataire :</strong> {detailLog.recipient}</p>
              <p className="text-xs"><strong>Voyageur :</strong> {detailLog.guestName || '—'}</p>
              <p className="text-xs"><strong>Canal :</strong> {detailLog.channel}</p>
              <p className="text-xs"><strong>Statut :</strong> {detailLog.status}</p>
              {detailLog.errorMessage && (
                <BuiAlert variant="destructive" className="mt-1.5">
                  <TriangleAlert />
                  <AlertDescription>{detailLog.errorMessage}</AlertDescription>
                </BuiAlert>
              )}
              <p className="text-xs"><strong>Reservation :</strong> #{detailLog.reservationId}</p>
              <p className="text-xs text-muted-foreground">
                Cree le {formatDate(detailLog.createdAt)}
                {detailLog.sentAt && ` — Envoye le ${formatDate(detailLog.sentAt)}`}
              </p>

              {/* Apercu du contenu email */}
              {detailLog.channel === 'EMAIL' && detailLog.templateId && (
                <>
                  <h6 className="text-xs font-medium mt-1.5">Contenu de l&apos;email</h6>
                  {previewLoading ? (
                    <div className="flex justify-center py-3">
                      <Spinner className="size-6" />
                    </div>
                  ) : previewHtml ? (
                    <div className="mt-0.5 rounded-md border border-border overflow-hidden">
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
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground opacity-60 italic">
                      Apercu indisponible
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        <DialogFooter>
          {detailLog?.status === 'FAILED' && detailLog.guestId && (
            <BuiButton
              variant="outline"
              className="text-warning-ink border-warning hover:bg-warning-soft"
              onClick={() => {
                setEditEmailLog(detailLog);
                setEditEmailValue(detailLog.recipient === 'N/A' ? '' : detailLog.recipient);
                setDetailLog(null);
              }}
            >
              Modifier l&apos;email
            </BuiButton>
          )}
          {detailLog?.status === 'FAILED' && detailLog.templateId && (() => {
            const canResend = hasRecipient(detailLog);
            const resendButton = (
              <BuiButton
                variant="outline"
                className="text-success-ink border-success hover:bg-success-soft"
                disabled={!canResend || resendingId === detailLog.id}
                onClick={() => {
                  if (!canResend) return;
                  handleResend(detailLog);
                  setDetailLog(null);
                }}
              >
                Renvoyer
              </BuiButton>
            );
            // L'infobulle n'existait que dans le cas bloque (`disableHoverListener`
            // quand l'envoi est possible) : on ne monte le Tooltip que la.
            return canResend ? resendButton : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">{resendButton}</span>
                </TooltipTrigger>
                <TooltipContent>Pas de destinataire — ajoute un email guest avant de renvoyer</TooltipContent>
              </Tooltip>
            );
          })()}
          <BuiButton variant="ghost" onClick={() => setDetailLog(null)}>Fermer</BuiButton>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit email dialog ── */}
      <Dialog open={!!editEmailLog} onOpenChange={(next) => { if (!next) setEditEmailLog(null); }}>
        <DialogContent className="max-w-[444px]">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;email du voyageur</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">
            Saisissez l&apos;email du voyageur pour {editEmailLog?.guestName || 'ce voyageur'}.
            Le message sera automatiquement renvoye apres la mise a jour.
          </p>
          <Field>
            <FieldLabel htmlFor="resend-guest-email">Email</FieldLabel>
            <Input
              id="resend-guest-email"
              autoFocus
              type="email"
              value={editEmailValue}
              onChange={(e) => setEditEmailValue(e.target.value)}
              placeholder="voyageur@example.com"
            />
          </Field>
          <DialogFooter>
            <BuiButton variant="outline" onClick={() => setEditEmailLog(null)} disabled={editEmailLoading}>
              Annuler
            </BuiButton>
            <BuiButton
              disabled={!editEmailValue.trim() || editEmailLoading}
              onClick={handleUpdateEmailAndResend}
            >
              {editEmailLoading ? <Spinner className="size-5" /> : 'Enregistrer et renvoyer'}
            </BuiButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Apercu PDF (deep-link notification document) ── */}
      <Dialog open={pdfDialogOpen} onOpenChange={(next) => { if (!next) handleClosePdf(); }}>
        <DialogContent className="max-w-[900px] h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('documents.history.pdfPreview', 'Apercu du document')}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-col overflow-hidden">
          {pdfLoading ? (
            <div className="flex justify-center items-center flex-1">
              <Spinner className="size-10 text-primary" />
            </div>
          ) : pdfUrl ? (
            <object data={pdfUrl} type="application/pdf" width="100%" style={{ flex: 1, border: 'none', minHeight: 0 }}>
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-3">
                  {t('documents.history.pdfNotSupported', 'Votre navigateur ne supporte pas la visualisation PDF.')}
                </p>
                <BuiButton asChild>
                  <a href={pdfUrl} download="document.pdf">
                    <Download size={14} strokeWidth={1.75} />
                    {t('common.download', 'Telecharger')}
                  </a>
                </BuiButton>
              </div>
            </object>
          ) : (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {t('documents.history.pdfLoadError', 'Erreur lors du chargement du document')}
              </p>
            </div>
          )}
          </div>
          <DialogFooter>
            <BuiButton variant="ghost" onClick={handleClosePdf}>{t('common.close', 'Fermer')}</BuiButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} onSuccess={() => setGenerateOpen(false)} />
    </div>
  );
});

UnifiedHistoryTab.displayName = 'UnifiedHistoryTab';

export default UnifiedHistoryTab;
