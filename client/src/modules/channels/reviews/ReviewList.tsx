import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Spinner,
  Textarea,
} from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import EmptyState from '../../../components/EmptyState';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import StatTile from '../../../components/baitly/StatTile';
import { cn } from '../../../utils/cn';
import {
  Star as StarIcon,
  Reply as ReplyIcon,
  AutoAwesome as SparklesIcon,
  Comment as CommentIcon,
} from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useNotification } from '../../../hooks/useNotification';
import { reviewsApi, type GuestReview } from '../../../services/api/reviewsApi';

const RATING_STARS = [0, 1, 2, 3, 4];

/**
 * Note en lecture seule, 5 étoiles au pas de 0,5. Deux calques superposés : le
 * calque plein est rogné à la largeur correspondant à la note — seule façon
 * d'obtenir une demi-étoile sans glyphe dédié.
 */
function ReadOnlyRating({ value, size = 14 }: { value: number; size?: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="relative inline-flex shrink-0" aria-label={`${rounded} / 5`}>
      <span className="inline-flex text-border">
        {RATING_STARS.map((i) => <StarIcon key={i} size={size} strokeWidth={1.75} />)}
      </span>
      <span
        className="absolute inset-0 inline-flex overflow-hidden text-warning-ink"
        style={{ width: `${(rounded / 5) * 100}%` }}
        aria-hidden
      >
        {RATING_STARS.map((i) => <StarIcon key={i} size={size} strokeWidth={1.75} />)}
      </span>
    </span>
  );
}

interface ReviewListProps {
  /** Filtre sur un logement. Absent = tous les logements de l'organisation. */
  propertyId?: number;
  /** Affiche la note moyenne et le total au-dessus de la liste. */
  showStats?: boolean;
}

/**
 * Liste d'avis voyageurs — surface UNIQUE, partagée par l'écran global
 * (/channels/reviews) et l'onglet « Avis » d'un logement.
 *
 * <p>Un seul composant pour les deux : le filtre par logement est un paramètre,
 * pas un écran différent. Dupliquer aurait garanti que les deux vues divergent
 * à la première évolution.</p>
 *
 * <p>Source : {@code /api/reviews} (ReviewController), le stock interne
 * multi-canal — celui qui porte les statistiques, le brouillon de réponse de
 * l'agent Réputation et la publication de la réponse d'hôte.</p>
 */
export default function ReviewList({ propertyId, showStats = false }: ReviewListProps) {
  const { t } = useTranslation();
  const { notify } = useNotification();

  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const page = await reviewsApi.list({ propertyId });
      setReviews(page.content ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { void fetchReviews(); }, [fetchReviews]);

  // Réponses déjà publiées vs en attente : c'est la seule lecture qui compte
  // pour un hôte, bien avant la note moyenne.
  const pending = reviews.filter((r) => !r.hostResponse).length;
  const rated = reviews.filter((r) => typeof r.rating === 'number');
  const average = rated.length > 0
    ? rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
    : null;

  /** Brouillon de l'agent Réputation — proposé, jamais publié sans l'hôte. */
  const handleDraft = async (review: GuestReview) => {
    setBusyId(review.id);
    try {
      const updated = await reviewsApi.draftReply(review.id);
      setReviews((prev) => prev.map((r) => (r.id === review.id ? updated : r)));
      setReplyingTo(review.id);
      setReplyText(updated.hostResponseDraft ?? '');
    } catch {
      notify.error(t('channels.reviews.draftError', 'Impossible de générer un brouillon.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleRespond = async (review: GuestReview) => {
    if (!replyText.trim()) return;
    setBusyId(review.id);
    try {
      const updated = await reviewsApi.respond(review.id, replyText.trim());
      setReviews((prev) => prev.map((r) => (r.id === review.id ? updated : r)));
      setReplyingTo(null);
      setReplyText('');
    } catch {
      notify.error(t('channels.reviews.respondError', "Impossible de publier la réponse."));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertDescription>
          {t('channels.reviews.errorLoading', 'Impossible de charger les avis.')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {showStats && reviews.length > 0 && (
        <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-3">
          <StatTile
            icon={<StarIcon />}
            label={t('channels.reviews.avgRating', 'Note moyenne')}
            value={average != null ? average.toFixed(1) : '—'}
            unit={average != null ? '/ 5' : undefined}
          />
          <StatTile
            icon={<CommentIcon />}
            label={t('channels.reviews.totalReviews', 'Avis reçus')}
            value={reviews.length}
          />
          <StatTile
            icon={<ReplyIcon />}
            label={t('channels.reviews.pending', 'Sans réponse')}
            value={pending}
            iconClassName={pending > 0 ? 'text-warning-ink' : undefined}
          />
        </div>
      )}

      {reviews.length === 0 ? (
        <EmptyState
          variant="transparent"
          icon={<StarIcon />}
          title={t('channels.reviews.emptyTitle', 'Aucun avis')}
          description={t(
            'channels.reviews.emptyHint',
            'Les avis remontent automatiquement depuis les canaux connectés.',
          )}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {reviews.map((review) => {
            const isReplying = replyingTo === review.id;
            const busy = busyId === review.id;
            return (
              <article key={review.id} className="rounded-xl border border-border bg-card p-3.5">
                <header className="flex items-start gap-2.5">
                  <GuestAvatar name={review.guestName || 'Voyageur'} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-foreground">
                        {review.guestName || t('channels.reviews.anonymous', 'Voyageur')}
                      </span>
                      {typeof review.rating === 'number' && <ReadOnlyRating value={review.rating} />}
                      {review.channelName && <Badge variant="secondary">{review.channelName}</Badge>}
                      {!review.hostResponse && (
                        <Badge variant="warning">
                          {t('channels.reviews.awaitingReply', 'Sans réponse')}
                        </Badge>
                      )}
                    </div>
                    {review.reviewDate && (
                      <p className="mt-0.5 text-xs tabular-nums text-faint">
                        {new Date(review.reviewDate).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </header>

                {review.reviewText && (
                  <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {review.reviewText}
                  </p>
                )}

                {/* Réponse publiée : encart distinct, l'hôte doit voir d'un coup
                    d'œil ce qui est déjà public. */}
                {review.hostResponse && (
                  <div className="mt-2.5 rounded-lg border border-border bg-muted p-2.5">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('channels.reviews.yourReply', 'Votre réponse')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {review.hostResponse}
                    </p>
                  </div>
                )}

                {!review.hostResponse && (
                  <div className="mt-2.5">
                    {isReplying ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          rows={3}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={t('channels.reviews.replyPlaceholder', 'Votre réponse publique…')}
                          aria-label={t('channels.reviews.reply', 'Répondre')}
                          className="min-h-[3lh] text-sm"
                        />
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            size="xs"
                            variant="ghost"
                            className="cursor-pointer"
                            onClick={() => { setReplyingTo(null); setReplyText(''); }}
                          >
                            {t('common.cancel', 'Annuler')}
                          </Button>
                          <Button
                            size="xs"
                            className="cursor-pointer"
                            disabled={busy || !replyText.trim()}
                            onClick={() => handleRespond(review)}
                          >
                            {busy ? <Spinner className="size-3" /> : <ReplyIcon size={13} strokeWidth={1.75} />}
                            {t('channels.reviews.sendReply', 'Publier')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="xs"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => { setReplyingTo(review.id); setReplyText(review.hostResponseDraft ?? ''); }}
                        >
                          <ReplyIcon size={13} strokeWidth={1.75} />
                          {t('channels.reviews.reply', 'Répondre')}
                        </Button>
                        {/* Le brouillon de l'agent Réputation n'est qu'une
                            proposition : il remplit le champ, l'hôte publie. */}
                        <Button
                          size="xs"
                          variant="ghost"
                          className="cursor-pointer"
                          disabled={busy}
                          onClick={() => handleDraft(review)}
                        >
                          {busy ? <Spinner className="size-3" /> : <SparklesIcon size={13} strokeWidth={1.75} />}
                          {review.hostResponseDraft
                            ? t('channels.reviews.useDraft', 'Reprendre le brouillon')
                            : t('channels.reviews.draft', 'Proposer une réponse')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
