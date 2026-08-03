import { describe, it, expect } from 'vitest';
import { parseReviewMotif } from '../components/ConstellationQueue';

describe('parseReviewMotif', () => {
  it('whenScannerReviewMotif_thenStructuredWithStarsMetaQuoteAndAdvice', () => {
    const motif =
      'Avis 5/5 de Thomas R. le 18 mai 2026 (BOOKING_ENGINE), sans réponse hôte. '
      + '« Le duplex est encore plus beau en vrai. Piscine et jacuzzi au top. » '
      + 'Rédiger une réponse publique : un avis positif sans réponse est une occasion manquée.';

    const review = parseReviewMotif(motif);

    expect(review).toEqual({
      rating: 5,
      meta: 'Thomas R. · 18 mai 2026 · Booking Engine',
      quote: 'Le duplex est encore plus beau en vrai. Piscine et jacuzzi au top.',
      rest: 'Rédiger une réponse publique : un avis positif sans réponse est une occasion manquée.',
    });
  });

  it('whenSourceMissing_thenMetaWithoutSource', () => {
    const review = parseReviewMotif(
      'Avis 4/5 de Inès K. le 4 mai 2026, sans réponse hôte. « Accueil chaleureux. » Répondre.',
    );

    expect(review).toMatchObject({ rating: 4, meta: 'Inès K. · 4 mai 2026', quote: 'Accueil chaleureux.' });
  });

  it('whenMotifHasAnotherShape_thenNull_fallbackToRawText', () => {
    expect(parseReviewMotif('Faible demande détectée sur ce créneau.')).toBeNull();
    expect(parseReviewMotif(undefined)).toBeNull();
  });
});
