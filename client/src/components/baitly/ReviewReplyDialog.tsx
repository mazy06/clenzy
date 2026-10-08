import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BotIcon, CheckIcon, StarIcon, TriangleAlertIcon } from '../../icons/glyphs';
import {
  Badge,
  Button,
  Dialog,
  Skeleton,
  Spinner,
  Textarea,
} from '../ui';
import GuestAvatar from './GuestAvatar';
import { ActionModalContent, ActionModalHeader, ActionModalBody, ActionModalFooter, ActionModalFacts, ActionModalLoading, ActionModalSection } from '../../modules/supervision/components/ActionModal';
import { reviewsApi } from '../../services/api/reviewsApi';
import { refreshActionQueue } from '../../services/api/actionItemsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useAiKeyStatus } from '../../hooks/useAi';
import { consequencesOf } from '../../modules/supervision/components/actionRegistry';

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
  /**
   * Réponse PUBLIÉE avec succès (jamais sur simple fermeture) — la file HITL
   * de supervision s'en sert pour écarter la carte d'avis correspondante.
   */
  onPublished?: () => void;
}

export default function ReviewReplyDialog({
  reviewId,
  onClose,
  preview,
  invalidateKeys = [],
  onPublished,
}: ReviewReplyDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = React.useState('');
  const [proposal, setProposal] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  const { data: review, isLoading, isError: loadFailed, refetch } = useQuery({
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
      onPublished?.();
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
      <ActionModalContent className="sm:max-w-[640px]">
        <ActionModalHeader agentId="rep"
          title={t('supervision.reviewReply.title', 'Répondre à cet avis')}
          description={preview?.propertyName ?? t('dashboard.actionItems.reviewFallback', 'Avis voyageur')} />
        <ActionModalBody>
        <div className="flex items-center gap-3">
          {guestName && <GuestAvatar name={guestName} size={36} />}
          <span className="min-w-0 flex-1 font-medium">{guestName ?? t('dashboard.actionItems.reviewFallback', 'Avis voyageur')}</span>
          {rating != null && <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums">
            <StarIcon className="size-4 text-[var(--bui-warning-ink)]" />{rating}
          </span>}
        </div>
        {isLoading ? (
          <ActionModalLoading />
        ) : loadFailed ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-sm text-destructive-ink">{t('supervision.modal.reviewUnavailable', 'L’avis n’a pas pu être chargé. Réessayez pour le relire avant de répondre.')}</p>
            <Button variant="outline" onClick={() => refetch()}>{t('dashboard.actionItems.retryProposal', 'Réessayer')}</Button>
          </div>
        ) : (
          <>
            {/* The full review shares the body's scroll area with the reply. */}
            <blockquote className="baitly-action-message">
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
                className="baitly-review-proposal"
              >
                <h3 className="text-sm font-semibold">{t('dashboard.actionItems.proposalTitle', 'Réponse proposée')}</h3>

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
              /* One flat section; inserting a proposal never publishes it. */
              <div className="baitly-review-proposal">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-semibold">{t('dashboard.actionItems.proposalTitle', 'Réponse proposée')}</h3>
                  <Badge variant="warning" className="ms-auto">
                    {t('dashboard.actionItems.awaitingYou', 'En attente')}
                  </Badge>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    'dashboard.actionItems.proposalLead',
                    'Rédigée par l’agent, jamais publiée sans vous. Message proposé :',
                  )}
                </p>
                <p className="my-3 text-sm leading-relaxed whitespace-pre-wrap">« {proposal} »</p>


                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="xs" disabled={busy} onClick={() => setText(proposal!)}>
                    <CheckIcon className="size-3" />
                    {text.trim()
                      ? t('dashboard.actionItems.replaceWithProposal', 'Remplacer ma réponse')
                      : t('dashboard.actionItems.insertProposal', 'Insérer dans ma réponse')}
                  </Button>
                  <Button size="xs" variant="outline" disabled={busy} onClick={() => setDismissed(true)}>
                    {t('supervision.apply.dismiss', 'Ignorer')}
                  </Button>
                  <span className="ms-auto text-[11px] text-muted-foreground">
                    {t('dashboard.actionItems.orWriteYourOwn', 'ou écrivez la vôtre ci-dessous')}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="review-response" className="text-sm font-medium">{t('supervision.modal.yourReply', 'Votre réponse')}</label>
              <Textarea id="review-response" value={text} onChange={(event) => setText(event.target.value)}
                rows={5} disabled={busy}
                placeholder={t('channels.reviews.replyPlaceholder', 'Votre réponse, visible publiquement sur le canal…')} />
            </div>
            <ActionModalSection title={t('supervision.modal.consequences', 'Ce qui va se passer')}>
              <ActionModalFacts facts={consequencesOf('REVIEW_DRAFT_REPLY').map((line) => t(line.key, line.fallback))} />
            </ActionModalSection>

            {publish.isError && (
              <p className="m-0 text-xs text-destructive">
                {t('dashboard.actionItems.replyFailed', 'La publication a échoué. Réessayez.')}
              </p>
            )}
          </>
        )}

        </ActionModalBody>
        <ActionModalFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button disabled={!text.trim() || busy || isLoading || loadFailed} onClick={() => publish.mutate(text.trim())}>
            {busy && <Spinner />}
            {t('supervision.reviewReply.cta', 'Publier la réponse')}
          </Button>
        </ActionModalFooter>
      </ActionModalContent>
    </Dialog>
  );
}
