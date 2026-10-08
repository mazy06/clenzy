import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Spinner,
  Textarea,
} from '../../../components/ui';
import { TriangleAlert, CheckCircle2, MessageCircle, RefreshCw } from 'lucide-react';
import StatusIcon from '../../../components/StatusIcon';
import PagePagination from '../../../components/PagePagination';
import StatTileRow from '../../../components/baitly/StatTileRow';
import { PROPERTY_ART } from '../../properties/propertyArtwork';
import { PropertyTabHeading, PropertyTabEmpty, PropertyTabLoading } from '../../properties/PropertyTabPrimitives';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import { guestPhotoSrc } from '../../../services/api/guestsApi';
import RatingStars from '../../../components/baitly/RatingStars';
import StatTile from '../../../components/baitly/StatTile';
import {
  Star as StarIcon,
  Reply as ReplyIcon,
  AutoAwesome as SparklesIcon,
  Comment as CommentIcon,
} from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useNotification } from '../../../hooks/useNotification';
import { reviewsApi, type GuestReview } from '../../../services/api/reviewsApi';
import { activeIntlLocale } from '../../../utils/activeLocale';

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

  const [pageIndex, setPageIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [average, setAverage] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number,string>>({});
  const requestId = React.useRef(0);
  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchReviews = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const [page, stats] = await Promise.all([
        reviewsApi.list({ propertyId, page: pageIndex, size: 8 }),
        propertyId != null && showStats ? reviewsApi.getStats(propertyId).catch(() => null) : Promise.resolve(null),
      ]);
      if (request !== requestId.current) return;
      setReviews(page.content ?? []);
      setTotal(page.totalElements ?? page.content?.length ?? 0);
      setAverage(stats?.totalReviews ? stats.averageRating : null);
    } catch {
      if (request === requestId.current) setError(true);
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [propertyId, pageIndex, showStats]);

  useEffect(() => { void fetchReviews(); return () => { requestId.current++; }; }, [fetchReviews]);

  const selected = reviews.find(review => review.id === selectedId) ?? reviews[0];
  const selectReview = (review: GuestReview) => {
    if (replyingTo != null) setDrafts(previous => ({ ...previous, [replyingTo]: replyText }));
    setSelectedId(review.id);
    setReplyingTo(null);
    setReplyText(drafts[review.id] ?? review.hostResponseDraft ?? '');
  };

  /** Brouillon de l'agent Réputation — proposé, jamais publié sans l'hôte. */
  const handleDraft = async (review: GuestReview) => {
    if (review.hostResponseDraft || drafts[review.id] != null) {
      setReplyingTo(review.id); setReplyText(drafts[review.id] ?? review.hostResponseDraft); return;
    }
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
      setDrafts(previous => { const next = { ...previous }; delete next[review.id]; return next; });
      setReplyText('');
    } catch {
      notify.error(t('channels.reviews.respondError', "Impossible de publier la réponse."));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PropertyTabLoading />;

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertDescription>
          {t('channels.reviews.errorLoading', 'Impossible de charger les avis.')}
        </AlertDescription><Button variant="outline" onClick={() => void fetchReviews()}><RefreshCw size={16} />{t('common.retry', 'Réessayer')}</Button>
      </Alert>
    );
  }

  return (
    <div className="pdt-page">
      {showStats && total > 0 && <StatTileRow presentation="overview">
        <StatTile icon={<StarIcon />} artwork={PROPERTY_ART.reviews} label={t('channels.reviews.avgRating', 'Note moyenne')} value={average != null ? average.toFixed(1) : '—'} unit={average != null ? '/ 5' : undefined} />
        <StatTile icon={<CommentIcon />} artwork={PROPERTY_ART.messages} label={t('channels.reviews.totalReviews', 'Avis reçus')} value={total} />
      </StatTileRow>}
      <section className="pdt-surface">
        <PropertyTabHeading art={PROPERTY_ART.reviews} title={t('properties.tabs.reviews', 'Avis')}
          description={t('propertyTabs.reviewsHint', 'Consultez les retours voyageurs et préparez vos réponses.')} />
        {reviews.length === 0 ? <PropertyTabEmpty art={PROPERTY_ART.reviews} title={t('channels.reviews.emptyTitle', 'Aucun avis')} description={t('channels.reviews.emptyHint')} />
          : <div className="pdt-split">
            <div className="pdt-list">
              {reviews.map(review => <div key={review.id} className="pdt-row" data-selected={selected?.id === review.id}>
                <button type="button" className="pdt-row__button" aria-pressed={selected?.id === review.id} disabled={busyId != null} onClick={() => selectReview(review)}>
                  <GuestAvatar name={review.guestName || t('channels.reviews.anonymous', 'Voyageur')} photoUrl={guestPhotoSrc(review.guestAvatarUrl)} size={36} />
                  <span className="pdt-row__copy"><strong>{review.guestName || t('channels.reviews.anonymous', 'Voyageur')}</strong>
                    <small>{review.channelName}{review.reviewDate ? ' · ' + new Date(review.reviewDate).toLocaleDateString(activeIntlLocale()) : ''}</small>
                    {review.reviewText && <span className="pdt-review-excerpt">{review.reviewText}</span>}
                  </span>
                  {review.rating != null && <span className="text-sm font-medium tabular-nums">{review.rating}/5</span>}
                </button>
                <StatusIcon icon={review.hostResponse ? CheckCircle2 : MessageCircle} tone={review.hostResponse ? 'success' : 'warning'}
                  label={review.hostResponse ? t('propertyTabs.replied', 'Réponse publiée') : t('channels.reviews.awaitingReply', 'Sans réponse')} />
              </div>)}
              <PagePagination count={total} rowsPerPage={8} page={pageIndex} onPageChange={value => {
                if (busyId != null) return;
                if (replyingTo != null) setDrafts(previous => ({ ...previous, [replyingTo]: replyText }));
                setPageIndex(value); setSelectedId(null); setReplyingTo(null);
              }} />
            </div>
            <div className="pdt-detail">
          {(selected ? [selected] : []).map((review) => {
            const isReplying = replyingTo === review.id;
            const busy = busyId === review.id;
            return (
              <article key={review.id} className="pdt-review-detail">
                <header className="flex items-start gap-2.5">
                  {/* La route de liste sert desormais la photo : l'ecran des
                      avis n'a plus de raison de s'en tenir aux initiales. */}
                  <GuestAvatar
                    name={review.guestName || 'Voyageur'}
                    photoUrl={guestPhotoSrc(review.guestAvatarUrl)}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-foreground">
                        {review.guestName || t('channels.reviews.anonymous', 'Voyageur')}
                      </span>
                      {typeof review.rating === 'number' && <RatingStars value={review.rating} />}
                      {review.channelName && <span className="text-xs text-muted-foreground">{review.channelName}</span>}
                      <StatusIcon icon={review.hostResponse ? CheckCircle2 : MessageCircle} tone={review.hostResponse ? 'success' : 'warning'}
                        label={review.hostResponse ? t('propertyTabs.replied', 'Réponse publiée') : t('channels.reviews.awaitingReply', 'Sans réponse')} />
                    </div>
                    {review.reviewDate && (
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {new Date(review.reviewDate).toLocaleDateString(activeIntlLocale())}
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
                  <div className="pdt-reply">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                            disabled={busy}
                            className="cursor-pointer"
                            onClick={() => { setDrafts(previous => ({ ...previous, [review.id]: replyText })); setReplyingTo(null); }}
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
                          disabled={busy}
                          className="cursor-pointer"
                          onClick={() => { setReplyingTo(review.id); setReplyText(drafts[review.id] ?? review.hostResponseDraft ?? ''); }}
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
          </div>}
      </section>
    </div>
  );
}
