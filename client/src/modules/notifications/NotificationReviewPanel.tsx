import React from 'react';
import { Badge, Skeleton } from '../../components/ui';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import RatingStars from '../../components/baitly/RatingStars';
import ChannelTag from '../../components/baitly/ChannelTag';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import { reviewsApi, type GuestReview } from '../../services/api/reviewsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { formatFactDate } from './notificationMeta';
import type { Notification } from '../../services/api';

/**
 * Avis voyageur designe par une notification, ou `null`.
 *
 * L'emetteur depose l'identifiant dans les faits ; c'est le seul lien fiable
 * vers l'avis. Le titre le porte aussi (« — avis #57 »), mais un intitule est
 * du texte destine a l'humain : le lire pour naviguer casserait a la premiere
 * traduction.
 */
export function reviewIdOf(notification: Notification): number | null {
  const raw = notification.metadata?.reviewId;
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

/**
 * Charge l'avis complet. La notification n'en transporte qu'un resume tronque
 * a 140 caracteres ; le lire suppose le texte entier, la note et le canal.
 *
 * Un echec ne fait rien echouer : `review` reste `null` et la fiche retombe sur
 * son message, qui dit deja l'essentiel.
 */
export function useNotificationReview(reviewId: number | null) {
  const [review, setReview] = React.useState<GuestReview | null>(null);
  const [loading, setLoading] = React.useState(reviewId !== null);

  React.useEffect(() => {
    if (reviewId === null) {
      setReview(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setReview(null);
    reviewsApi
      .getById(reviewId)
      .then((loaded) => { if (active) setReview(loaded); })
      .catch(() => { if (active) setReview(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reviewId]);

  return { review, loading };
}

/** Attente de l'avis : la forme du panneau, pas un tourniquet centre. */
export function NotificationReviewSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}

/**
 * L'avis lui-meme, dans la fiche d'une notification de reputation.
 *
 * <p>Le scanner resume l'avis en une phrase — « Avis 5/5 de Camille B. le
 * 3 sept. 2026 (DIRECT), sans reponse hote. "..." » — qu'il fallait desosser a
 * la lecture. Ici chaque fait a sa forme : le voyageur a un visage, la note des
 * etoiles, le canal son logo, et le commentaire une surface a lui, ou il se lit
 * comme une citation plutot que comme un fragment de phrase.</p>
 */
export default function NotificationReviewPanel({ review }: { review: GuestReview }) {
  const { t, currentLanguage } = useTranslation();
  const guestName = review.guestName?.trim() || t('notifications.detail.review.anonymous', 'Voyageur');

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-start gap-3">
        <GuestAvatar
          name={guestName}
          photoUrl={guestPhotoSrc(review.guestAvatarUrl)}
          size={40}
          className="mt-0.5"
        />

        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-medium text-foreground">{guestName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {typeof review.rating === 'number' && (
              <>
                <RatingStars value={review.rating} size={15} />
                <span className="font-medium tabular-nums text-foreground">{review.rating}/5</span>
              </>
            )}
            {review.reviewDate && (
              <>
                {typeof review.rating === 'number' && <span aria-hidden="true">·</span>}
                <time dateTime={review.reviewDate} className="tabular-nums">
                  {formatFactDate(review.reviewDate, currentLanguage)}
                </time>
              </>
            )}
          </div>
        </div>

        {review.channelName && <ChannelTag channel={review.channelName} />}
      </header>

      {review.reviewText && (
        <blockquote className="m-0 rounded-lg bg-muted px-4 py-3">
          <p className="m-0 text-[15px] leading-relaxed text-pretty whitespace-pre-line text-foreground">
            {review.reviewText}
          </p>
        </blockquote>
      )}

      {review.hostResponse ? (
        /* Filet d'1 px plutot qu'une seconde carte : la reponse prolonge l'avis,
           elle n'est pas un objet de plus a l'ecran. */
        <div className="flex flex-col gap-1.5 border-s border-border ps-3">
          <h4 className="m-0 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t('notifications.detail.review.hostReply', 'Votre réponse')}
          </h4>
          <p className="m-0 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {review.hostResponse}
          </p>
        </div>
      ) : (
        <div>
          <Badge variant="warning">
            {t('notifications.detail.review.awaitingReply', 'Sans réponse')}
          </Badge>
        </div>
      )}
    </section>
  );
}
