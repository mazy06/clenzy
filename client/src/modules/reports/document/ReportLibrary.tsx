import React, { useMemo, useState } from 'react';
import { useViewportFill } from '../../../hooks/useViewportFill';
import { Download, Eye, Trash2, FileText, Send } from '../../../icons/glyphs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/ui';
import StatusChip from '../../../components/StatusChip';
import { WidgetPanel } from '../../../components/baitly/WidgetPanel';
import { composerCopy } from './baitlyComposerCopy';
import SendReportDialog from './SendReportDialog';
import EmptyState from '../../../components/EmptyState';
import NavCountBadge from '../../../components/NavCountBadge';
import PeriodSegmented from '../../../components/baitly/PeriodSegmented';
import { Description as DescriptionIcon } from '../../../icons';
import { cn } from '../../../utils/cn';
import {
  reportDocumentsApi,
  type ReportDocumentStatus,
  type ReportDocumentSummary,
} from '../../../services/api/reportDocumentsApi';
import { activeIntlLocale } from '../../../utils/activeLocale';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * Les rapports deja produits.
 *
 * <p>Ce volet est en PERMANENCE a l'ecran, aux cotes du formulaire : retrouver
 * un releve envoye la semaine derniere est le geste le plus frequent de cet
 * ecran, et il n'a pas a traverser une composition pour y arriver.</p>
 *
 * <p>Le cycle reste explicite : brouillon puis envoye. L'envoi vaut relecture ;
 * le document transmis reste consultable et ne peut plus etre supprime.</p>
 */
const STATUS_TONE: Record<ReportDocumentStatus, 'neutral' | 'ok' | 'warn'> = {
  DRAFT: 'warn',
  REVIEWED: 'neutral',
  SENT: 'ok',
  ARCHIVED: 'neutral',
};

const STATUS_KEY: Record<ReportDocumentStatus, string> = {
  DRAFT: 'reports.library.status.draft',
  // Statut historique : l'etape de relecture separee n'existe plus, mais des
  // documents la portent encore en base et doivent rester lisibles.
  REVIEWED: 'reports.library.status.reviewed',
  SENT: 'reports.library.status.sent',
  ARCHIVED: 'reports.library.status.archived',
};

const FILTERS: Array<{ value: string; labelKey: string }> = [
  { value: 'ALL', labelKey: 'reports.library.filters.all' },
  { value: 'PENDING', labelKey: 'reports.library.filters.pending' },
  { value: 'SENT', labelKey: 'reports.library.filters.sent' },
];

interface ReportLibraryProps {
  /** Le document affiche dans la zone d'apercu, pour le marquer dans la liste. */
  openedId?: number | null;
  /** {@code null} referme l'apercu — appele quand le document affiche est supprime. */
  onOpen?: (document: ReportDocumentSummary | null) => void;
}

const ReportLibrary: React.FC<ReportLibraryProps> = ({ openedId = null, onOpen }) => {
  const { t, currentLanguage } = useTranslation();
  const copy = composerCopy(currentLanguage);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('ALL');

  const documentsQuery = useQuery({
    queryKey: ['report-documents'],
    queryFn: reportDocumentsApi.list,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['report-documents'] });
  const removeMutation = useMutation({
    mutationFn: reportDocumentsApi.remove,
    onSuccess: (_result, id) => {
      if (id === openedId) onOpen?.(null);
      invalidate();
    },
  });

  // Une confirmation EN PLACE plutot qu'une fenetre : le bouton demande a etre
  // reclique, ce qui suffit a empecher le geste accidentel sans interrompre.
  const [confirming, setConfirming] = useState<number | null>(null);

  const documents = documentsQuery.data ?? [];
  const shown = useMemo(() => {
    if (filter === 'ALL') return documents;
    if (filter === 'SENT') return documents.filter((item) => item.status === 'SENT');
    return documents.filter((item) => item.status !== 'SENT');
  }, [documents, filter]);

  /** Le rapport dont on choisit les destinataires. */
  const [sending, setSending] = useState<ReportDocumentSummary | null>(null);

  // La colonne descend jusqu'au bas de la fenetre et defile pour elle-meme :
  // sans hauteur explicite, `flex-1` et `overflow-y-auto` se resolvent a zero.
  const [fillRef, fillHeight] = useViewportFill<HTMLDivElement>({ minWidth: 1180 });

  return (
    <div
      ref={fillRef}
      style={fillHeight ? { height: fillHeight } : undefined}
      className="rc-library"
    >
      <WidgetPanel
        className="rc-library-panel"
        title={<span className="rc-library-title"><FileText size={18} aria-hidden />{copy.library}</span>}
        caption={copy.libraryHint}
        action={documents.length > 0 ? <NavCountBadge count={documents.length} /> : undefined}
      >
        <div className="rc-library-body">
          {documents.length > 0 && (
            <div className="rc-library-filters">
              <PeriodSegmented
              ariaLabel={t('reports.library.filterAria')}
                value={filter}
                onChange={setFilter}
                options={FILTERS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
              />
            </div>
          )}

          {documentsQuery.isLoading ? (
            <div role="status" aria-label={t('common.loading')}>
              {[0, 1, 2].map(item => <div key={item} className="rc-library-skeleton"><span /><span /><span /></div>)}
            </div>
          ) : documentsQuery.isError ? (
            <div className="rc-library-error" role="alert"><p>{copy.loadFailed}</p>
              <Button size="sm" variant="outline" onClick={() => documentsQuery.refetch()}>{copy.retry}</Button></div>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<DescriptionIcon />}
              title={t(documents.length === 0
                ? 'reports.library.emptyTitle'
                : 'reports.library.emptyFilteredTitle')}
              description={t(documents.length === 0
                ? 'reports.library.emptyBody'
                : 'reports.library.emptyFilteredBody')}
              variant="plain"
            />
          ) : (
            <ul className="rc-library-list">
              {shown.map((document) => (
                <Row
                  key={document.id}
                  document={document}
                  active={document.id === openedId}
                  confirming={confirming === document.id}
                  onOpen={onOpen ? () => onOpen(document) : undefined}
                  onSend={() => setSending(document)}
                  onDelete={() => {
                    if (confirming === document.id) {
                      setConfirming(null);
                      removeMutation.mutate(document.id);
                    } else {
                      setConfirming(document.id);
                    }
                  }}
                  busy={removeMutation.isPending}
                />
              ))}
            </ul>
          )}
        </div>
      </WidgetPanel>

      <SendReportDialog
        document={sending}
        onClose={() => setSending(null)}
        onSent={invalidate}
      />
    </div>
  );
};

const Row: React.FC<{
  document: ReportDocumentSummary;
  active: boolean;
  confirming: boolean;
  onOpen?: () => void;
  onSend: () => void;
  onDelete: () => void;
  busy: boolean;
}> = ({ document, active, confirming, onOpen, onSend, onDelete, busy }) => {
  const { t, currentLanguage } = useTranslation();
  const copy = composerCopy(currentLanguage);
  return (
  <li className="rc-document-row" data-active={active} data-profile={document.profile}>
    <button type="button" onClick={onOpen} disabled={!onOpen} className="rc-document-open">
      <span className="rc-document-stamp"><FileText size={21} aria-hidden /></span>
      <span className="rc-document-main"><strong>{document.title}</strong>{' '}
        <small>{document.recipientName || copy.consolidated}</small></span>
    </button>
    <div className="rc-document-meta">
      <span>{document.documentNumber} · v{document.version}</span>
      <span>{new Date(document.periodStart).toLocaleDateString(activeIntlLocale())} → {new Date(document.periodEnd).toLocaleDateString(activeIntlLocale())}</span>
      {document.hasNarrative && <span>{t('reports.library.commented')}</span>}
    </div>

    <div className="rc-document-actions">
      <StatusChip
        tone={STATUS_TONE[document.status]}
        dot
        label={t(STATUS_KEY[document.status])}
        className="h-[20px] text-[0.6rem]"
      />

      {/* Trois gestes, trois icones : la colonne est etroite, trois libelles
          l'auraient fait passer sur trois lignes. */}
      <IconAction label={t('reports.library.preview')} onClick={onOpen} disabled={!onOpen}>
        <Eye className="size-3.5" />
      </IconAction>
      <IconAction
        label={t('reports.library.downloadPdf')}
        onClick={() =>
          reportDocumentsApi.downloadPdf(document.id, `${document.documentNumber}.pdf`)
        }
      >
        <Download className="size-3.5" />
      </IconAction>
      {/* Un rapport transmis fait foi de l'envoi : le serveur en refuse la
          suppression, l'ecran ne la propose donc pas. */}
      {document.status !== 'SENT' && (
        <IconAction
          label={confirming ? copy.confirmRemove : copy.remove}
          onClick={onDelete}
          disabled={busy}
          danger={confirming}
        >
          <Trash2 className="size-3.5" />
        </IconAction>
      )}

      {/* Un seul geste : envoyer. L'etape « marquer relu » demandait deux clics
          pour un seul acte — personne n'envoie un relevé sans l'avoir regardé. */}
      {document.status !== 'SENT' && (
        <Button size="sm" variant="outline" className="rc-library-send" disabled={busy} onClick={onSend}>
          <Send size={13} aria-hidden />{copy.send}
        </Button>
      )}
    </div>
  </li>
  );
};

/** Un geste sans libelle : l'intitule passe par le titre et le nom accessible. */
const IconAction: React.FC<{
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, disabled, danger, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex size-7 cursor-pointer items-center justify-center rounded-md border transition-colors duration-200',
      'disabled:cursor-not-allowed disabled:opacity-40',
      danger
        ? 'border-destructive bg-destructive/10 text-destructive'
        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
    )}
  >
    {children}
  </button>
);

export default ReportLibrary;
