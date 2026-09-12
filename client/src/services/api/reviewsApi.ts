import apiClient from '../apiClient';

/** Statistiques d'avis d'un logement — GET /api/reviews/stats/{propertyId} (org-scopé par le JWT). */
export interface ReviewStats {
  propertyId: number;
  averageRating: number;
  totalReviews: number;
  ratingDistribution?: Record<string, number>;
  sentimentBreakdown?: Record<string, number>;
}

/** Avis voyageur (GET /api/reviews) — inclut le brouillon de réponse IA (REP). */
export interface GuestReview {
  id: number;
  propertyId: number;
  channelName?: string | null;
  guestName?: string | null;
  rating?: number | null;
  reviewText?: string | null;
  hostResponse?: string | null;
  hostRespondedAt?: string | null;
  hostResponseDraft?: string | null;
  hostResponseDraftAt?: string | null;
  reviewDate?: string | null;
  /**
   * Photo du voyageur (URL signee relative), ou `null` : repli sur les
   * initiales. Servie par les routes de LECTURE, l'avis seul comme la liste —
   * une page entiere se resout en une requete cote serveur. A passer par
   * `guestPhotoSrc` avant tout `<img>`.
   */
  guestAvatarUrl?: string | null;
  /**
   * Séjour à l'origine de l'avis, ou `null` quand le canal ne l'a pas rattaché.
   *
   * Émis par `GuestReviewDto` depuis toujours ; il manquait simplement ici, et
   * ce qu'une interface ne déclare pas n'atteint jamais l'écran.
   */
  reservationId?: number | null;
  /** POSITIVE | NEUTRAL | NEGATIVE — analyse de sentiment du texte. */
  sentimentLabel?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | null;
  sentimentScore?: number | null;
  /** Thèmes détectés : CLEANLINESS, LOCATION, VALUE, COMMUNICATION… */
  tags?: string[] | null;
  language?: string | null;
}

interface Page<T> {
  content: T[];
}

export const reviewsApi = {
  /** Note moyenne + nombre d'avis d'un logement. */
  getStats(propertyId: number): Promise<ReviewStats> {
    return apiClient.get<ReviewStats>(`/reviews/stats/${propertyId}`);
  },

  /** Avis d'un logement (org-scopé). */
  listByProperty(propertyId: number, size = 50): Promise<Page<GuestReview>> {
    return apiClient.get<Page<GuestReview>>(`/reviews?propertyId=${propertyId}&size=${size}`);
  },

  /**
   * Avis de l'organisation, tous logements confondus ou filtrés sur l'un d'eux.
   * {@code propertyId} est optionnel côté serveur (ReviewController) : c'est ce
   * qui permet à l'écran global et à l'onglet d'un logement de partager la même
   * source, et donc d'afficher les mêmes avis.
   */
  list(params: { propertyId?: number; size?: number } = {}): Promise<Page<GuestReview>> {
    const search = new URLSearchParams({ size: String(params.size ?? 50) });
    if (params.propertyId != null) search.set('propertyId', String(params.propertyId));
    return apiClient.get<Page<GuestReview>>(`/reviews?${search.toString()}`);
  },

  /**
   * Avis complet — le tableau de bord ne transporte qu'un extrait de 140
   * caractères ; répondre suppose de lire le texte entier et le brouillon IA.
   */
  getById(id: number): Promise<GuestReview> {
    return apiClient.get<GuestReview>(`/reviews/${id}`);
  },

  /**
   * Demande à l'agent Réputation de rédiger un brouillon de réponse
   * (POST /api/reviews/{id}/draft-reply).
   *
   * Rien n'est publié : le serveur n'écrit que `hostResponseDraft`, et c'est
   * l'hôte qui décide ensuite de l'insérer dans sa réponse.
   */
  draftReply(id: number): Promise<GuestReview> {
    return apiClient.post<GuestReview>(`/reviews/${id}/draft-reply`);
  },

  /** Publie une réponse d'hôte (PUT /api/reviews/{id}/respond). */
  respond(id: number, response: string): Promise<GuestReview> {
    return apiClient.put<GuestReview>(`/reviews/${id}/respond`, { response });
  },
};
