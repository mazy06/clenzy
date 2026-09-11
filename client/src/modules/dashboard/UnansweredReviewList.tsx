import React from 'react';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import RatingStars from '../../components/baitly/RatingStars';
import { channelLogo } from '../../components/channelLogos';
import { guestPhotoSrc } from '../../services/api/guestsApi';
import { useFitRows } from '../../hooks/useFitRows';
import { useTranslation } from '../../hooks/useTranslation';
import type { GuestReview } from '../../services/api/reviewsApi';

/**
 * Avis restes sans reponse, sur le tableau de bord.
 *
 * <p>Ces lignes passaient par la liste de signaux generique : une pastille de
 * gravite, « 4★ · Camille N. » en une seule chaine, et quatre-vingt-dix
 * caracteres de commentaire coupes au milieu d'un mot. Un avis n'est pas un
 * signal parmi d'autres — c'est quelqu'un qui a ecrit quelque chose, et ce
 * qu'on doit reconnaitre d'un coup d'oeil, c'est QUI parle, ce qu'il a MIS
 * comme note, et sur QUEL canal la reponse est attendue.</p>
 *
 * <p>Chacun de ces trois est rendu par la primitive qui le porte deja ailleurs
 * dans le produit — {@link GuestAvatar}, {@link RatingStars}, le registre de
 * logos de canaux — plutot que reinvente ici : c'est exactement la meme lecture
 * que sur l'ecran des avis, ou l'on ira repondre.</p>
 *
 * <p>La pastille de gravite est tombee avec la refonte : elle disait « note
 * basse » par une couleur, quand cinq etoiles dont deux remplies le disent
 * mieux, et sans code a apprendre.</p>
 */
export default function UnansweredReviewList({
  reviews,
  emptyLabel,
}: {
  reviews: GuestReview[];
  emptyLabel: string;
}) {
  const { t } = useTranslation();
  // Meme regime que les autres tuiles : ce qui ne tient pas se compte, il ne
  // defile pas.
  const { ref, hidden } = useFitRows<HTMLUListElement>();

  if (reviews.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ul ref={ref} className="m-0 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-hidden p-0">
        {reviews.map((review) => {
          const channel = (review.channelName ?? '').toLowerCase();
          const logo = channelLogo(channel);
          const channelName = channel
            ? t(
                `reservations.source.${channel}`,
                channel.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase()),
              )
            : '';
          const guest = review.guestName?.trim() || t('pulse.reviews.anonymous', 'Voyageur');

          return (
            <li
              key={review.id}
              className="flex gap-2.5 border-b border-border pb-2 last:border-b-0 last:pb-0"
            >
              {/* En liste, la route des avis ne sert pas la photo — l'avatar
                  retombe sur les initiales, ce qui suffit a distinguer deux
                  voyageurs d'un coup d'oeil. */}
              <GuestAvatar
                name={guest}
                photoUrl={guestPhotoSrc(review.guestAvatarUrl)}
                size={28}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {guest}
                  </span>
                  {typeof review.rating === 'number' && <RatingStars value={review.rating} size={12} />}
                  {/* Le logo porte lui-meme sa marque : une pastille teintee
                      sous un logo de marque brouillerait les deux. `alt` plutot
                      qu'un texte masque — c'est le nom accessible du canal. */}
                  {logo ? (
                    <img
                      src={logo}
                      alt={channelName}
                      title={channelName}
                      className="size-4.5 shrink-0 rounded-full object-cover"
                    />
                  ) : channelName ? (
                    <span className="shrink-0 text-2xs font-semibold text-muted-foreground">
                      {channelName}
                    </span>
                  ) : null}
                </div>
                {/* Deux lignes pleines, coupees par le navigateur : la troncature
                    a quatre-vingt-dix caracteres cassait les mots en deux et ne
                    posait meme pas de points de suspension. Le texte entier
                    reste accessible a la souris, et se lit en entier sur
                    l'ecran des avis. */}
                {review.reviewText ? (
                  <p
                    className="m-0 mt-0.5 line-clamp-2 text-2xs leading-snug text-muted-foreground"
                    title={review.reviewText}
                  >
                    {review.reviewText}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <p className="m-0 shrink-0 pt-1.5 text-2xs font-semibold text-muted-foreground tabular-nums">
          +{hidden}
        </p>
      )}
    </div>
  );
}
