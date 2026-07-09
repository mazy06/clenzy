/* ============================================================
   <SupervisionReviewDrafts> — brouillons de réponse d'avis (REP)

   Affiché dans le drawer de l'agent Réputation : liste les avis d'un
   logement pour lesquels l'IA a préparé un brouillon de réponse
   (host_response_draft) non encore publié. L'opérateur relit, édite et
   publie (PUT /reviews/{id}/respond → host_response). Jamais de publication
   automatique — l'humain valide toujours.
   ============================================================ */

import { useCallback, useEffect, useState } from 'react';
import { Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
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
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={18} />
      </Box>
    );
  }

  if (drafts.length === 0) {
    return (
      <Typography sx={{ fontSize: 12.5, color: 'var(--muted, #6b7196)' }}>
        {t('supervision.reviewDrafts.empty', 'Aucun brouillon de réponse en attente.')}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: 'var(--muted, #6b7196)',
        }}
      >
        {t('supervision.reviewDrafts.title', 'Brouillons de réponse (IA)')}
      </Typography>
      {drafts.map((review) => (
        <Box
          key={review.id}
          sx={{
            p: 1.25,
            borderRadius: '10px',
            bgcolor: 'var(--surface-2, #f6f7fb)',
            border: '1px solid var(--line, #e6e8ef)',
          }}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #6b7196)', mb: 0.5 }}>
            {(review.rating != null ? `${review.rating}/5 · ` : '') + (review.guestName || 'Voyageur')}
          </Typography>
          {review.reviewText && (
            <Typography
              sx={{ fontSize: 12, color: 'var(--body, #3a3f5a)', fontStyle: 'italic', mb: 1, lineHeight: 1.4 }}
            >
              «&nbsp;{review.reviewText.length > 160 ? `${review.reviewText.slice(0, 160)}…` : review.reviewText}&nbsp;»
            </Typography>
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
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              variant="contained"
              onClick={() => publish(review)}
              disabled={publishing === review.id || !(edited[review.id] ?? '').trim()}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {publishing === review.id ? (
                <CircularProgress size={13} sx={{ color: 'inherit' }} />
              ) : (
                t('supervision.reviewDrafts.publish', 'Publier')
              )}
            </Button>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
