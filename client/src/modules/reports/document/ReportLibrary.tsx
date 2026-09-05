import React, { useMemo, useState } from 'react';
import { useViewportFill } from '../../../hooks/useViewportFill';
import { Download, Eye, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Spinner } from '../../../components/ui';
import StatusChip from '../../../components/StatusChip';
import { ChartTile } from '../../../components/stats';
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

/**
 * Les rapports deja produits.
 *
 * <p>Ce volet est en PERMANENCE a l'ecran, aux cotes du formulaire : retrouver
 * un releve envoye la semaine derniere est le geste le plus frequent de cet
 * ecran, et il n'a pas a traverser une composition pour y arriver.</p>
 *
 * <p>Le cycle reste explicite — brouillon, relu, envoye — parce qu'un
 * commentaire redige automatiquement ne doit pas atteindre un proprietaire sans
 * qu'un humain l'ait lu. Le bouton d'envoi n'apparait qu'apres la relecture.</p>
 */
const STATUS_TONE: Record<ReportDocumentStatus, 'neutral' | 'ok' | 'warn'> = {
  DRAFT: 'warn',
  REVIEWED: 'neutral',
  SENT: 'ok',
  ARCHIVED: 'neutral',
};

const STATUS_LABEL: Record<ReportDocumentStatus, string> = {
  DRAFT: 'Brouillon',
  // Statut historique : l'etape de relecture separee n'existe plus, mais des
  // documents la portent encore en base et doivent rester lisibles.
  REVIEWED: 'Relu',
  SENT: 'Envoyé',
  ARCHIVED: 'Archivé',
};

const FILTERS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'Tous' },
  { value: 'PENDING', label: 'À envoyer' },
  { value: 'SENT', label: 'Envoyés' },
];

interface ReportLibraryProps {
  /** Le document affiche dans la zone d'apercu, pour le marquer dans la liste. */
  openedId?: number | null;
  /** {@code null} referme l'apercu — appele quand le document affiche est supprime. */
  onOpen?: (document: ReportDocumentSummary | null) => void;
}

const ReportLibrary: React.FC<ReportLibraryProps> = ({ openedId = null, onOpen }) => {
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
  const [fillRef, fillHeight] = useViewportFill<HTMLDivElement>();

  return (
    <div
      ref={fillRef}
      style={fillHeight ? { height: fillHeight } : undefined}
      className="flex min-h-0 flex-col min-[1180px]:sticky min-[1180px]:top-2"
    >
      <ChartTile
        fluid
        className="min-h-0 flex-1"
        title="Documents produits"
        hint="Un brouillon tant qu’il n’est pas transmis"
        action={documents.length > 0 ? <NavCountBadge count={documents.length} /> : undefined}
      >
        <div className="flex h-full min-h-0 flex-col gap-2 pt-1">
          {documents.length > 0 && (
            <div className="shrink-0">
              <PeriodSegmented
              ariaLabel="Filtrer les documents"
                value={filter}
                onChange={setFilter}
                options={FILTERS}
              />
            </div>
          )}

          {documentsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-7" />
            </div>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<DescriptionIcon />}
              title={documents.length === 0 ? 'Aucun rapport produit' : 'Aucun document à ce stade'}
              description={
                documents.length === 0
                  ? 'Les documents générés apparaîtront ici, avec leur cycle de relecture.'
                  : 'Changez de filtre pour voir les autres documents.'
              }
              variant="plain"
            />
          ) : (
            <ul className="no-scrollbar m-0 min-h-0 flex-1 list-none space-y-0 overflow-y-auto p-0">
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
      </ChartTile>

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
}> = ({ document, active, confirming, onOpen, onSend, onDelete, busy }) => (
  <li
    className={cn(
      'flex flex-col gap-1.5 border-b border-border px-2 py-2 last:border-b-0 transition-colors duration-200',
      active ? 'bg-primary/5' : 'hover:bg-muted/40',
    )}
  >
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className="cursor-pointer text-start disabled:cursor-default"
    >
      <span className="block truncate text-xs font-semibold text-foreground">
        {document.title}
        {document.recipientName ? (
          <span className="font-normal text-muted-foreground"> · {document.recipientName}</span>
        ) : null}
      </span>
      <span className="block text-2xs tabular-nums text-muted-foreground">
        {document.documentNumber} v{document.version} ·{' '}
        {new Date(document.periodStart).toLocaleDateString('fr-FR')} —{' '}
        {new Date(document.periodEnd).toLocaleDateString('fr-FR')}
        {document.hasNarrative ? ' · commenté' : ''}
      </span>
    </button>

    <div className="flex flex-wrap items-center gap-1.5">
      <StatusChip
        tone={STATUS_TONE[document.status]}
        dot
        label={STATUS_LABEL[document.status]}
        className="h-[20px] text-[0.6rem]"
      />

      {/* Trois gestes, trois icones : la colonne est etroite, trois libelles
          l'auraient fait passer sur trois lignes. */}
      <IconAction label="Aperçu" onClick={onOpen} disabled={!onOpen}>
        <Eye className="size-3.5" />
      </IconAction>
      <IconAction
        label="Télécharger le PDF"
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
          label={confirming ? 'Confirmer la suppression' : 'Supprimer'}
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
        <Button size="sm" disabled={busy} onClick={onSend}>
          Envoyer
        </Button>
      )}
    </div>
  </li>
);

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
