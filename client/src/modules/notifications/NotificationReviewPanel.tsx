import React from 'react';
import { Badge, Skeleton } from '../../components/ui';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import RatingStars from '../../components/baitly/RatingStars';
import ChannelTag from '../../components/baitly/ChannelTag';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import { reviewsApi, type GuestReview, type ReviewStats } from '../../services/api/reviewsApi';
import { reservationsApi, type Reservation } from '../../services/api';
import { Money } from '../../components/baitly/Money';
import { PropertyIdentity, useNotificationProperty } from './NotificationPropertyPanel';
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
export interface ReviewDossier {
  review: GuestReview;
  /** Moyenne et volume d'avis du LOGEMENT — ce qui situe celui-ci. */
  stats: ReviewStats | null;
  /** Sejour a l'origine de l'avis, quand le canal l'a rattache. */
  reservation: Reservation | null;
}

/**
 * Charge l'avis, puis ce qui lui donne sa mesure.
 *
 * <p>La notification n'en transporte qu'un resume tronque a 140 caracteres ; le
 * lire suppose le texte entier, la note et le canal. Mais un 3/5 isole ne dit
 * pas s'il faut s'alarmer : c'est la MOYENNE du logement qui le dit, et le
 * SEJOUR qui rappelle de quoi le voyageur parle — combien de nuits, a quel
 * prix, sur quel canal.</p>
 *
 * <p>Deux vagues : l'avis d'abord, qui porte le logement et le sejour, puis ce
 * qu'on en deduit. Chaque piece manquante se rend en silence.</p>
 */
export function useNotificationReview(reviewId: number | null) {
  const [dossier, setDossier] = React.useState<ReviewDossier | null>(null);
  const [loading, setLoading] = React.useState(reviewId !== null);

  React.useEffect(() => {
    if (reviewId === null) {
      setDossier(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setDossier(null);

    void (async () => {
      const review = await reviewsApi.getById(reviewId).catch(() => null);
      if (!active) return;
      if (!review) {
        setDossier(null);
        setLoading(false);
        return;
      }

      const [stats, reservation] = await Promise.all([
        reviewsApi.getStats(review.propertyId).catch(() => null),
        review.reservationId
          ? reservationsApi.getById(review.reservationId).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (!active) return;

      setDossier({ review, stats, reservation });
      setLoading(false);
    })();

    return () => { active = false; };
  }, [reviewId]);

  return { dossier, loading };
}

/** Attente de l'avis : la forme du panneau, pas un tourniquet centre. */
export function NotificationReviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="flex gap-4">
        <Skeleton className="h-[72px] min-w-0 flex-1" />
        <Skeleton className="h-[72px] min-w-0 flex-1" />
      </div>
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
/** Intitule de champ a l'interieur du panneau. */
function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/** Themes detectes dans l'avis — le libelle, pas la constante en base. */
const TAG_LABEL: Record<string, string> = {
  CLEANLINESS: 'Propreté',
  LOCATION: 'Emplacement',
  VALUE: 'Rapport qualité-prix',
  COMMUNICATION: 'Communication',
  CHECK_IN: 'Arrivée',
  COMFORT: 'Confort',
  ACCURACY: 'Conformité',
  AMENITIES: 'Équipements',
};

/** Nombre de nuits entre deux dates ISO, ou `null` si l'une est illisible. */
function nightsBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Le dossier d'un avis voyageur.
 *
 * <p>Le scanner resume l'avis en une phrase — « Avis 5/5 de Camille B. le
 * 3 sept. 2026 (DIRECT), sans reponse hote. "..." » — qu'il fallait desosser a
 * la lecture. Ici chaque fait a sa forme : le voyageur a un visage, la note des
 * etoiles, le canal son logo, et le commentaire une surface a lui, ou il se lit
 * comme une citation plutot que comme un fragment de phrase.</p>
 *
 * <p><b>Et l'avis a desormais sa mesure.</b> Un 3/5 isole ne dit pas s'il faut
 * s'alarmer : sous la vignette du logement, sa moyenne et son volume d'avis le
 * situent. Le sejour, lui, rappelle de quoi le voyageur parle — combien de
 * nuits, a quel prix, sur quel canal. Les deux repondent a la question qu'on se
 * pose avant d'ecrire une reponse.</p>
 */
export default function NotificationReviewPanel({ dossier }: { dossier: ReviewDossier }) {
  const { t, currentLanguage } = useTranslation();
  const { review, stats, reservation } = dossier;
  const { property } = useNotificationProperty(review.propertyId);

  const guestName = review.guestName?.trim() || t('notifications.detail.review.anonymous', 'Voyageur');
  const tags = (review.tags ?? []).filter(Boolean);
  const nights = reservation ? nightsBetween(reservation.checkIn, reservation.checkOut) : null;

  // La note du logement, ARRONDIE au dixieme : « 4,6 sur 23 avis » se compare,
  // « 4,5652173913 » ne se lit pas.
  const average = typeof stats?.averageRating === 'number'
    ? stats.averageRating.toFixed(1).replace('.', ',')
    : null;

  return (
    <section className="@container flex flex-col gap-4">
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

      {/* L'etat de la reponse et les themes se lisent ensemble : ce sont les
          deux choses qui decident de ce qu'on va ECRIRE. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {review.hostResponse ? null : (
          <Badge variant="warning">
            {t('notifications.detail.review.awaitingReply', 'Sans réponse')}
          </Badge>
        )}
        {tags.map((tag) => (
          <Badge key={tag} variant="outline">{TAG_LABEL[tag] ?? tag}</Badge>
        ))}
      </div>

      {review.hostResponse && (
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
      )}

      {/* Le logement a gauche avec sa moyenne, le sejour a droite : de quoi ce
          voyageur parle, et comment son avis se place parmi les autres. */}
      <div className="grid gap-4 border-t border-border pt-3.5 @[36rem]:grid-cols-2 @[36rem]:items-start">
        <div>
          <Caption>{t('notifications.detail.review.property', 'Le logement')}</Caption>
          <div className="mt-2 flex flex-col gap-2">
            <PropertyIdentity property={property} name={property?.name ?? ''} />
            {average && (
              <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <RatingStars value={Math.round(stats!.averageRating)} size={13} />
                <span className="font-medium tabular-nums text-foreground">{average}/5</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  {t('notifications.detail.review.totalReviews', '{{count}} avis', {
                    count: stats!.totalReviews,
                  })}
                </span>
              </p>
            )}
          </div>
        </div>

        <div>
          <Caption>{t('notifications.detail.review.stay', 'Le séjour')}</Caption>
          <div className="mt-2">
            {reservation ? (
              <div className="flex flex-col gap-1.5">
                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
                  <span className="font-medium tabular-nums">
                    {formatFactDate(reservation.checkIn, currentLanguage)}
                    {' → '}
                    {formatFactDate(reservation.checkOut, currentLanguage)}
                  </span>
                  {nights !== null && (
                    <span className="tabular-nums text-muted-foreground">
                      {t('notifications.detail.review.nights', '{{count}} nuit', { count: nights })}
                    </span>
                  )}
                </p>
                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {typeof reservation.guestCount === 'number' && reservation.guestCount > 0 && (
                    <span className="tabular-nums">
                      {t('notifications.detail.review.guests', '{{count}} voyageur', {
                        count: reservation.guestCount,
                      })}
                    </span>
                  )}
                  {typeof reservation.totalPrice === 'number' && reservation.totalPrice > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-medium text-foreground">
                        <Money value={reservation.totalPrice} />
                      </span>
                    </>
                  )}
                </p>
              </div>
            ) : (
              /* Un avis sans sejour rattache n'est pas une anomalie : certains
                 canaux ne renvoient pas la reservation d'origine. */
              <p className="m-0 text-sm text-muted-foreground">
                {t('notifications.detail.review.noStay',
                  "Le canal n'a pas rattaché cet avis à une réservation.")}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
