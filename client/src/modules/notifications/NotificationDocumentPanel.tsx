import React from 'react';
import { Badge, Button, Skeleton, Spinner } from '../../components/ui';
import { Description, Download, Email, Warning } from '../../icons';
import { sizedIcon } from '../../config/navigationIcons';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { documentsApi, type DocumentGeneration } from '../../services/api/documentsApi';
import { Caption, Figure } from './NotificationFieldParts';
import { readDocumentFailure, groupTags } from './documentFailure';
import { deepLinkId, factId, fullTimestamp } from './notificationMeta';
import type { Notification } from '../../services/api';

/**
 * Le DOCUMENT d'une notification de production documentaire.
 *
 * <p>Trois natures partagent la meme categorie et ne demandent pas la meme
 * chose : une piece PRODUITE se regarde, une piece ENVOYEE se verifie
 * (a qui, quand), un ECHEC se repare. La fiche les traitait pareil — un
 * paragraphe, puis « Ouvrir Documents ». Le nom du fichier, sa taille et son
 * temps de generation y tenaient lieu de tout.</p>
 *
 * <p>La piece elle-meme s'affiche desormais dans la fiche. Et un echec de
 * modele — « 27 tag(s) non resolus » suivi d'une enumeration a la file — se lit
 * enfin : les tags sont regroupes PAR DONNEE ABSENTE, parce que vingt-sept tags
 * manquants ne sont presque jamais vingt-sept problemes. Ici, un seul : le
 * groupe « intervention » n'a pas ete fourni.</p>
 */

/** Cles portant une generation de document. */
const DOCUMENT_KEYS = new Set([
  'DOCUMENT_GENERATED', 'DOCUMENT_SENT_BY_EMAIL', 'DOCUMENT_GENERATION_FAILED',
]);

/** Generation designee par une notification, ou `null`. */
export function documentGenerationIdOf(notification: Notification): number | null {
  if (!DOCUMENT_KEYS.has(notification.notificationKey ?? '')) return null;
  return factId(notification, 'documentGenerationId')
    ?? deepLinkId(notification, { param: 'highlight' });
}

/**
 * Charge la generation.
 *
 * <p>Un echec ne fait rien echouer : `generation` reste `null` et la fiche
 * retombe sur son message, qui porte deja le nom du fichier ou le motif.</p>
 */
export function useNotificationDocument(generationId: number | null) {
  const [generation, setGeneration] = React.useState<DocumentGeneration | null>(null);
  const [loading, setLoading] = React.useState(generationId !== null);

  React.useEffect(() => {
    if (generationId === null) {
      setGeneration(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    documentsApi
      .getGeneration(generationId)
      .then((loaded) => { if (active) setGeneration(loaded); })
      .catch(() => { if (active) setGeneration(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [generationId]);

  return { generation, loading };
}

/** Attente : la forme du panneau, pas un tourniquet centre. */
export function NotificationDocumentSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-muted px-4 py-4">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
  );
}

/** Taille de fichier lisible — les octets ne disent rien a personne. */
function fileSize(bytes: number): string {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * La piece elle-meme, dans la fiche.
 *
 * <p>Le binaire exige un en-tete d'autorisation qu'un {@code <iframe src>}
 * n'envoie pas : on charge les octets et on affiche l'adresse blob qui en sort,
 * revoquee au demontage. Le chargement est A LA DEMANDE — une page de
 * notifications ne doit pas tirer un PDF par ligne.</p>
 */
function DocumentViewer({ generation }: { generation: DocumentGeneration }) {
  const { t } = useTranslation();
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [state, setState] = React.useState<'idle' | 'loading' | 'failed'>('idle');

  React.useEffect(() => () => { if (blobUrl) window.URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const open = () => {
    setState('loading');
    documentsApi
      .openGenerationBlob(generation.id)
      .then((url) => { setBlobUrl(url); setState('idle'); })
      .catch(() => setState('failed'));
  };

  if (blobUrl) {
    return (
      <iframe
        src={blobUrl}
        title={generation.fileName ?? t('notifications.detail.document.preview', 'Aperçu du document')}
        className="h-[420px] w-full rounded-lg border border-border bg-card"
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-8">
      <span className="inline-flex text-muted-foreground">{sizedIcon(<Description />, 28, 1.5)}</span>
      <Button variant="outline" onClick={open} disabled={state === 'loading'}>
        {state === 'loading'
          ? <Spinner className="size-4" />
          : <Description size={15} strokeWidth={1.75} />}
        {t('notifications.detail.document.show', 'Afficher le document')}
      </Button>
      {state === 'failed' && (
        <p className="m-0 text-xs text-destructive-ink">
          {t('notifications.detail.document.previewFailed', 'La pièce n’a pas pu être chargée.')}
        </p>
      )}
    </div>
  );
}

/**
 * Un echec de generation, lisible.
 *
 * <p>Les tags sont regroupes PAR DONNEE ABSENTE : vingt-sept tags manquants ne
 * sont presque jamais vingt-sept problemes, et la liste a la file le cachait.</p>
 */
function FailureReport({ message }: { message: string }) {
  const { t } = useTranslation();
  const failure = readDocumentFailure(message);
  if (!failure) return null;

  const groups = groupTags(failure.tags);

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-destructive-soft px-3.5 py-3">
      <div className="flex items-start gap-2.5 text-destructive-ink">
        <span className="mt-0.5 inline-flex shrink-0">{sizedIcon(<Warning />, 16, 2)}</span>
        <p className="m-0 text-sm font-medium text-pretty">{failure.summary}</p>
      </div>

      {failure.template && (
        <div>
          <Caption>{t('notifications.detail.document.template', 'Modèle')}</Caption>
          <p className="m-0 mt-1 text-sm font-medium text-foreground">{failure.template}</p>
        </div>
      )}

      {groups.length > 0 && (
        <div className="flex flex-col gap-3">
          <Caption>
            {t('notifications.detail.document.missing', '{{count}} tag non résolu', {
              count: failure.tags.length,
            })}
          </Caption>
          {groups.map(({ group, tags }) => (
            <div key={group ?? '_'} className="rounded-lg bg-card px-3 py-2.5">
              <p className="m-0 text-xs text-muted-foreground">
                {group
                  ? t('notifications.detail.document.groupAbsent',
                      'Données « {{group}} » absentes du contexte', { group })
                  : t('notifications.detail.document.groupUnknown', 'Origine non précisée')}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <code
                    key={tag}
                    className="rounded-md bg-field px-1.5 py-0.5 font-mono text-xs text-foreground"
                  >
                    {tag}
                  </code>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Teinte d'un statut de generation. */
const STATUS_BADGE: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary'> = {
  COMPLETED: 'success',
  SENT: 'success',
  GENERATING: 'warning',
  FAILED: 'destructive',
};

export default function NotificationDocumentPanel({
  generation,
  message,
  failedEvent = false,
}: {
  /**
   * La generation, quand elle a pu etre lue.
   *
   * <p>`null` est un cas NORMAL, pas une panne : un echec de generation porte
   * deja tout son motif dans le message de la notification. Faire dependre sa
   * mise en forme d'un aller-retour serveur, c'est la perdre des que celui-ci
   * ne repond pas — or c'est precisement quand la production documentaire va
   * mal qu'on lit ces fiches.</p>
   */
  generation: DocumentGeneration | null;
  /** Message de la notification — sa nature change ce qu'il faut en faire. */
  message?: string;
  /** L'evenement est un ECHEC, d'apres sa cle. Fait foi quand la piece manque. */
  failedEvent?: boolean;
}) {
  const { t, currentLanguage } = useTranslation();
  // Le statut de la piece fait foi quand on l'a ; sinon la nature de l'evenement.
  const failed = generation ? generation.status === 'FAILED' : failedEvent;
  // Le motif : celui de la piece s'il est complet, sinon celui du message — qui
  // est le meme texte, tronque a 500 caracteres.
  const failureText = generation?.errorMessage?.trim() || message;

  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-xl px-4 py-4',
        failed ? 'bg-destructive-soft/40' : 'bg-muted',
      )}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Caption>
            {generation?.documentType || t('notifications.detail.document.type', 'Document')}
          </Caption>
          {/* Le MESSAGE en tete : c'est lui qui dit de quelle nature est
              l'evenement — produit, envoye, ou echoue. Sur un echec, la mise en
              forme du motif prend le relais juste en dessous. */}
          <p className="m-0 mt-1 text-[15px] leading-snug font-medium text-pretty text-foreground">
            {failed
              ? t('notifications.detail.document.failedTitle', 'La pièce n’a pas pu être produite')
              : message?.trim() || generation?.fileName}
          </p>
        </div>
        {generation && (
          <Badge variant={STATUS_BADGE[generation.status] ?? 'secondary'}>
            {t(`documents.status.${generation.status}`, generation.status)}
          </Badge>
        )}
      </header>

      {failed && failureText && <FailureReport message={failureText} />}

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        {generation?.templateName && (
          <Figure label={t('notifications.detail.document.template', 'Modèle')}>
            {generation.templateName}
          </Figure>
        )}
        {!failed && generation && generation.fileSize > 0 && (
          <Figure label={t('notifications.detail.document.size', 'Taille')}>
            {fileSize(generation.fileSize)}
          </Figure>
        )}
        {generation?.emailTo && (
          <div className="min-w-0">
            <Caption>{t('notifications.detail.document.sentTo', 'Envoyé à')}</Caption>
            <p className="m-0 mt-1 inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm font-medium text-foreground">
              <span className="inline-flex shrink-0 text-muted-foreground">
                {sizedIcon(<Email />, 13, 1.75)}
              </span>
              <span className="truncate">{generation.emailTo}</span>
            </p>
          </div>
        )}
        {generation?.legalNumber && (
          <Figure label={t('notifications.detail.document.legalNumber', 'Numéro légal')}>
            {generation.legalNumber}
          </Figure>
        )}
        {generation && (
          <div className="ms-auto min-w-0 text-end">
            <Caption>{t('notifications.detail.document.producedAt', 'Produit le')}</Caption>
            <p className="m-0 mt-1 text-xs tabular-nums text-muted-foreground">
              {fullTimestamp(generation.createdAt, currentLanguage)}
            </p>
          </div>
        )}
      </div>

      {!failed && generation && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <Caption>{t('notifications.detail.document.piece', 'La pièce')}</Caption>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => void documentsApi.downloadGeneration(generation.id, generation.fileName)}
            >
              <Download size={14} strokeWidth={1.75} />
              {t('notifications.detail.document.download', 'Télécharger')}
            </Button>
          </div>
          <DocumentViewer generation={generation} />
        </div>
      )}
    </section>
  );
}
