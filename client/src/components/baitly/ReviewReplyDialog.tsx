import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BotIcon, CheckIcon, StarIcon, TriangleAlertIcon } from 'lucide-react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  Skeleton,
  Spinner,
  Textarea,
} from '../ui';
import GuestAvatar from './GuestAvatar';
import { cn } from '../../utils/cn';
import { reviewsApi } from '../../services/api/reviewsApi';
import { refreshActionQueue } from '../../services/api/actionItemsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useAiKeyStatus } from '../../hooks/useAi';

/**
 * Baitly — réponse rapide à un avis, sans quitter l'écran d'où l'on vient.
 *
 * La bibliothèque n'avait rien pour ça : `ConfirmationModal` est bâti sur
 * `AlertDialog`, une confirmation bloquante qui ne se ferme pas au clic dehors
 * et n'accueille pas de saisie. On construit donc sur `Dialog`.
 *
 * L'avis complet est chargé à l'ouverture : les listes qui mènent ici ne
 * transportent qu'un extrait tronqué, et on ne répond pas à un texte qu'on n'a
 * pas lu en entier.
 *
 * **La proposition vient de l'agent Réputation, jamais d'un geste de l'hôte.**
 * L'agent rédige un brouillon en amont (`host_response_draft`, action
 * `REVIEW_DRAFT_REPLY`) ; la modale ne fait que le présenter — pas de bouton
 * « générer » qui ferait tourner un modèle à la demande.
 *
 * Et le brouillon ne s'écrit jamais tout seul dans la zone de saisie : il
 * s'affiche à part, et c'est un clic sur « Insérer » qui le fait passer dans la
 * réponse. Sans quoi l'hôte publierait un texte qu'il n'a pas choisi en croyant
 * l'avoir relu.
 */

export interface ReviewReplyDialogProps {
  /** Avis à ouvrir. `null` ferme la modale. */
  reviewId: number | null;
  onClose: () => void;
  /** En-tête affiché pendant le chargement, depuis la ligne cliquée. */
  preview?: {
    guestName?: string | null;
    propertyName?: string | null;
    rating?: number | null;
  };
  /** Clés react-query à invalider après publication (listes à rafraîchir). */
  invalidateKeys?: readonly (readonly unknown[])[];
}

export default function ReviewReplyDialog({
  reviewId,
  onClose,
  preview,
  invalidateKeys = [],
}: ReviewReplyDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = React.useState('');
  const [proposal, setProposal] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  const { data: review, isLoading } = useQuery({
    queryKey: ['review', reviewId],
    queryFn: () => reviewsApi.getById(reviewId!),
    enabled: reviewId != null,
  });

  // Réinitialise à chaque avis ouvert, sinon la réponse précédente traîne.
  React.useEffect(() => {
    setText('');
    setProposal(null);
    setDismissed(false);
  }, [reviewId]);

  // Un brouillon déjà rédigé par l'agent est une proposition comme une autre :
  // il s'affiche, il ne s'installe pas.
  const storedDraft = review?.hostResponseDraft?.trim() || null;
  React.useEffect(() => {
    if (storedDraft && !dismissed) setProposal((current) => current ?? storedDraft);
  }, [storedDraft, dismissed]);

  /**
   * La proposition à la demande.
   *
   * L'agent Réputation rédige en amont pour les avis qu'il traite ; quand il
   * n'est pas passé, l'hôte n'avait aucun moyen de lui en demander une. Le geste
   * reste **explicite** : aucun modèle ne tourne à la simple ouverture de la
   * modale, et ce qui revient est une proposition, pas une réponse publiée.
   */
  const askAgent = useMutation({
    mutationFn: () => reviewsApi.draftReply(reviewId!),
    onSuccess: (updated) => {
      setDismissed(false);
      setProposal(updated.hostResponseDraft?.trim() || null);
    },
  });

  React.useEffect(() => askAgent.reset(), [reviewId]); // eslint-disable-line react-hooks/exhaustive-deps

  const publish = useMutation({
    mutationFn: (response: string) => reviewsApi.respond(reviewId!, response),
    onSuccess: async () => {
      // La ligne traitée doit disparaître tout de suite : on demande le
      // recalcul de la file avant d'invalider les vues qui la lisent.
      await refreshActionQueue(
        (key) => queryClient.invalidateQueries({ queryKey: key }), invalidateKeys);
      onClose();
    },
  });

  // Aucune clé branchée, ni côté organisation ni côté plateforme. En cas d'échec
  // de la requête on ne conclut PAS à l'absence : mieux vaut se taire qu'accuser
  // à tort une configuration correcte.
  const { data: aiKeys } = useAiKeyStatus();
  const aiUnconfigured = Array.isArray(aiKeys) && aiKeys.every((key) => !key.configured);

  const guestName = review?.guestName ?? preview?.guestName ?? null;
  const rating = review?.rating ?? preview?.rating ?? null;
  const busy = publish.isPending;
  const showProposal = proposal != null && !dismissed;

  return (
    <Dialog open={reviewId != null} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          {/* `pe-8` réserve la place du bouton de fermeture, positionné en
              absolu dans le coin : sans lui, la note vient buter dessus. */}
          <DialogTitle className="flex items-center gap-2.5 pe-8">
            {guestName && <GuestAvatar name={guestName} size={32} />}
            <span className="truncate">
              {guestName ?? t('dashboard.actionItems.reviewFallback', 'Avis voyageur')}
            </span>
            {rating != null && (
              <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold tabular-nums">
                {rating}
                <StarIcon className="size-3.5 fill-warning text-warning" />
              </span>
            )}
          </DialogTitle>
          {preview?.propertyName && <DialogDescription>{preview.propertyName}</DialogDescription>}
        </DialogHeader>

        {isLoading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Spinner /> {t('common.loading', 'Chargement…')}
          </p>
        ) : (
          <>
            {/* L'avis, en entier. Un texte long défile ici plutôt que d'étirer
                la modale au-delà de l'écran. */}
            <blockquote className="max-h-40 overflow-y-auto rounded-lg bg-muted p-3 text-sm leading-relaxed text-foreground">
              {review?.reviewText || t('dashboard.actionItems.noReviewText', 'Avis sans texte.')}
            </blockquote>

            {/* Pas de proposition ET aucun modèle branché : l'absence n'est pas
                un état normal, c'est une configuration manquante. Le dire, sinon
                l'hôte croit que l'agent l'ignore. On ne l'affiche PAS quand une
                clé existe : là, l'agent n'est simplement pas encore passé. */}
            {/* Pas encore de brouillon : c'est la MÊME carte que la proposition,
                dans son état vide. Un bouton isolé posé dans le flux n'aurait
                aucun lien visuel avec la carte qui vient le remplacer, alors
                qu'il s'agit du même objet à deux moments de sa vie. */}
            {!showProposal && !aiUnconfigured && (
              <div
                className={cn(
                  'rounded-xl border p-4 transition-colors duration-200 motion-reduce:transition-none',
                  askAgent.isError ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/40',
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">
                    {t('supervision.agents.rep.name', 'Agent Réputation')}
                  </Badge>
                  <Badge variant="outline">
                    {t('dashboard.actionItems.proposalTag', 'Réponse d’avis')}
                  </Badge>
                </div>

                {askAgent.isPending ? (
                  /* La forme de ce qui arrive, pas un sablier : on montre trois
                     lignes de texte à venir là où la réponse s'écrira. */
                  <div className="mt-3 flex flex-col gap-1.5" aria-live="polite">
                    <span className="sr-only">
                      {t('dashboard.actionItems.proposalPending', 'L’agent rédige une proposition…')}
                    </span>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-11/12" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ) : (
                  <>
                    <p className="mt-2.5 mb-0 text-xs text-muted-foreground">
                      {askAgent.isError
                        ? t(
                            'dashboard.actionItems.proposalFailed',
                            'L’agent n’a pas pu rédiger de proposition. Vous pouvez réessayer ou écrire votre réponse.',
                          )
                        : t(
                            'dashboard.actionItems.askProposalHint',
                            'L’agent Réputation peut rédiger un brouillon à partir de cet avis. Rien n’est publié sans vous.',
                          )}
                    </p>
                    <Button
                      size="sm"
                      variant={askAgent.isError ? 'outline' : 'secondary'}
                      className="mt-3"
                      onClick={() => askAgent.mutate()}
                    >
                      <BotIcon />
                      {askAgent.isError
                        ? t('dashboard.actionItems.retryProposal', 'Réessayer')
                        : t('dashboard.actionItems.askProposal', 'Proposer une réponse')}
                    </Button>
                  </>
                )}
              </div>
            )}

            {!showProposal && aiUnconfigured && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft/40 p-2.5">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <p className="m-0 text-xs text-muted-foreground">
                  {t(
                    'dashboard.actionItems.aiUnconfigured',
                    'Aucun modèle d’IA n’est configuré : l’agent ne peut pas proposer de réponse.',
                  )}{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/settings?tab=ai')}
                    className="cursor-pointer font-medium text-foreground underline underline-offset-2"
                  >
                    {t('dashboard.actionItems.configureAi', 'Configurer')}
                  </button>
                </p>
              </div>
            )}

            {showProposal && (
              /* Carte de proposition — grammaire reprise de `CardChrome` du site
                 vitrine (client/site/components/AnimatedHitlMockup) : bandeau de
                 badges agent + objet + statut, titre, message proposé en bloc
                 cité, filet, puis accepter / écarter.
                 Le liseré latéral de 2 px du site n'est pas repris : c'est un
                 ban design (CLAUDE.md, side-stripe > 1 px). */
              <div className="shadow-brand rounded-xl border border-warning/50 bg-card p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">
                    {t('supervision.agents.rep.name', 'Agent Réputation')}
                  </Badge>
                  <Badge variant="outline">
                    {t('dashboard.actionItems.proposalTag', 'Réponse d’avis')}
                  </Badge>
                  <Badge variant="warning" className="ms-auto">
                    {t('dashboard.actionItems.awaitingYou', 'En attente')}
                  </Badge>
                </div>

                <h3 className="mt-2.5 text-sm font-semibold">
                  {t('dashboard.actionItems.proposalTitle', 'Réponse proposée')}
                  {guestName && ` — ${guestName}`}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    'dashboard.actionItems.proposalLead',
                    'Rédigée par l’agent, jamais publiée sans vous. Message proposé :',
                  )}
                </p>
                <p className="mt-2.5 rounded-lg bg-muted p-2.5 text-xs italic">« {proposal} »</p>

                <Separator className="my-3" />

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="xs" onClick={() => setText(proposal!)}>
                    <CheckIcon className="size-3" />
                    {text.trim()
                      ? t('dashboard.actionItems.replaceWithProposal', 'Remplacer ma réponse')
                      : t('dashboard.actionItems.insertProposal', 'Insérer dans ma réponse')}
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => setDismissed(true)}>
                    {t('supervision.apply.dismiss', 'Ignorer')}
                  </Button>
                  <span className="ms-auto text-[11px] text-muted-foreground">
                    {t('dashboard.actionItems.orWriteYourOwn', 'ou écrivez la vôtre ci-dessous')}
                  </span>
                </div>
              </div>
            )}

            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={5}
              autoFocus
              placeholder={t(
                'channels.reviews.replyPlaceholder',
                'Votre réponse, visible publiquement sur le canal…',
              )}
            />

            {publish.isError && (
              <p className="m-0 text-xs text-destructive">
                {t('dashboard.actionItems.replyFailed', 'La publication a échoué. Réessayez.')}
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button disabled={!text.trim() || busy} onClick={() => publish.mutate(text.trim())}>
            {busy && <Spinner />}
            {t('channels.reviews.sendReply', 'Publier la réponse')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
