/* ============================================================
   <SupervisionReviewDrafts> — brouillons de réponse d'avis (REP)

   Affiché dans le drawer de l'agent Réputation : liste les avis d'un
   logement pour lesquels l'IA a préparé un brouillon de réponse
   (host_response_draft) non encore publié. L'opérateur relit, édite et
   publie (PUT /reviews/{id}/respond → host_response). Jamais de publication
   automatique — l'humain valide toujours.
   ============================================================ */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Spinner } from '../../../components/ui';
import { Button, TextField } from '@mui/material';
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
      <p className="cn-text-body1 text-[12.5px] text-[var(--muted,_#6b7196)]">
        {t('supervision.reviewDrafts.empty', 'Aucun brouillon de réponse en attente.')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="cn-text-body1 text-[11px] font-bold tracking-[.06em] uppercase text-[var(--muted,_#6b7196)]">
        {t('supervision.reviewDrafts.title', 'Brouillons de réponse (IA)')}
      </p>
      {drafts.map((review) => (
        <div className="p-[7.5px] rounded-[10px] bg-[var(--surface-2,_#f6f7fb)] border border-solid border-[var(--line,_#e6e8ef)]" key={review.id}>
          <p className="cn-text-body1 text-[12px] font-bold text-[var(--muted,_#6b7196)] mb-[3px]">
            {(review.rating != null ? `${review.rating}/5 · ` : '') + (review.guestName || 'Voyageur')}
          </p>
          {review.reviewText && (
            <p className="cn-text-body1 text-[12px] text-[var(--body,_#3a3f5a)] italic mb-1.5 leading-[1.4]">
              «&nbsp;{review.reviewText.length > 160 ? `${review.reviewText.slice(0, 160)}…` : review.reviewText}&nbsp;»
            </p>
          )}
          <TextField
            value={edited[review.id] ?? ''}
            onChange={(e) => setEdited((prev) => ({ ...prev, [review.id]: e.target.value }))}
            multiline
            minRows={3}
            fullWidth
            size="small"
            aria-label={t('supervision.reviewDrafts.title', 'Brouillon de réponse')}
            sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: 12.5, lineHeight: 1.5 } }}
          />
          <div className="flex justify-end">
            <Button
              size="small"
              variant="contained"
              onClick={() => publish(review)}
              disabled={publishing === review.id || !(edited[review.id] ?? '').trim()}
              sx={{ textTransform: 'none', fontWeight: 700 }}
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
