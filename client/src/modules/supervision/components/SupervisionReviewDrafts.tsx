/* ============================================================
   <SupervisionReviewDrafts> — brouillons de réponse d'avis (REP)

   Affiché dans le drawer de l'agent Réputation : liste les avis d'un
   logement pour lesquels l'IA a préparé un brouillon de réponse
   (host_response_draft) non encore publié. L'opérateur relit, édite et
   publie (PUT /reviews/{id}/respond → host_response). Jamais de publication
   automatique — l'humain valide toujours.
   ============================================================ */

import { useCallback, useEffect, useState } from 'react';
import { Button, Spinner, Textarea } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { reviewsApi, type GuestReview } from '../../../services/api/reviewsApi';

export function SupervisionReviewDrafts({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<GuestReview[]>([]);
  const [edited, setEdited] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reviewsApi
      .listByProperty(propertyId)
      .then((page) => {
        if (cancelled) return;
        // Brouillon prêt ET pas encore de réponse publiée.
        const withDrafts = page.content.filter((r) => r.hostResponseDraft && !r.hostResponse);
        setDrafts(withDrafts);
        setEdited(Object.fromEntries(withDrafts.map((r) => [r.id, r.hostResponseDraft ?? ''])));
      })
      .catch(() => {
        if (!cancelled) setDrafts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const publish = useCallback(
    async (review: GuestReview) => {
      const text = (edited[review.id] ?? '').trim();
      if (!text || publishing != null) return;
      setPublishing(review.id);
      try {
        await reviewsApi.respond(review.id, text);
        setDrafts((prev) => prev.filter((r) => r.id !== review.id)); // publié → retiré
      } catch {
        /* échec réseau → l'opérateur peut réessayer */
      } finally {
        setPublishing(null);
      }
    },
    [edited, publishing],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-3">
        <Spinner className="size-[18px]" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t('supervision.reviewDrafts.empty', 'Aucun brouillon de réponse en attente.')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('supervision.reviewDrafts.title', 'Brouillons de réponse (IA)')}
      </p>
      {drafts.map((review) => (
        <div className="p-2.5 rounded-lg bg-card border border-solid border-border" key={review.id}>
          <p className="text-xs font-semibold text-muted-foreground tabular-nums mb-[3px]">
            {(review.rating != null ? `${review.rating}/5 · ` : '') + (review.guestName || 'Voyageur')}
          </p>
          {review.reviewText && (
            <p className="text-xs text-foreground italic mb-1.5 leading-relaxed">
              «&nbsp;{review.reviewText.length > 160 ? `${review.reviewText.slice(0, 160)}…` : review.reviewText}&nbsp;»
            </p>
          )}
          {/* Pas de libelle visible : le bloc d'avis fait office d'intitule, le
              champ porte donc son nom en aria-label. */}
          <Textarea
            id={`review-draft-${review.id}`}
            rows={3}
            aria-label={t('supervision.reviewDrafts.title', 'Brouillon de réponse')}
            className="mb-1.5 text-xs leading-relaxed"
            value={edited[review.id] ?? ''}
            onChange={(e) => setEdited((prev) => ({ ...prev, [review.id]: e.target.value }))}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => publish(review)}
              disabled={publishing === review.id || !(edited[review.id] ?? '').trim()}
            >
              {publishing === review.id ? (
                <Spinner className="size-[13px]" />
              ) : (
                t('supervision.reviewDrafts.publish', 'Publier')
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
