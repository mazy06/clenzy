import apiClient from '../apiClient';

/** Catégories d'upsell (cf. UpsellType backend). */
export type UpsellTypeId =
  | 'EARLY_CHECKIN'
  | 'LATE_CHECKOUT'
  | 'CLEANING'
  | 'TRANSFER'
  | 'BREAKFAST'
  | 'PARKING'
  | 'EQUIPMENT'
  | 'EXPERIENCE'
  | 'OTHER';

/** Offre d'upsell (catalogue hôte). */
export interface UpsellOffer {
  id: number;
  propertyId: number | null;
  type: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
  // Productisation (2.10) : conditionnel + fenêtre horaire
  minNights: number | null;
  leadTimeHours: number | null;
  /** Bundle (2.10) : CSV des ids d'offres incluses ; non vide = bundle. */
  bundleOfferIds: string | null;
}

/** Création / mise à jour d'une offre. */
export interface UpsellOfferRequest {
  propertyId?: number | null;
  type?: string;
  title: string;
  description?: string | null;
  price: number;
  currency?: string;
  imageUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
  /** Séjour minimal (nuits) pour proposer l'offre ; null/0 = toujours. */
  minNights?: number | null;
  /** Délai minimal (heures) avant l'arrivée pour commander ; null/0 = aucun. */
  leadTimeHours?: number | null;
  /** Bundle (2.10) : CSV des ids d'offres incluses ; vide = offre simple. */
  bundleOfferIds?: string | null;
}

/** Commande d'upsell (vente). */
export interface UpsellOrder {
  id: number;
  reservationId: number;
  title: string;
  amount: number;
  currency: string;
  platformFeeAmount: number | null;
  hostAmount: number | null;
  status: string;
  guestEmail: string | null;
  createdAt: string;
  paidAt: string | null;
}

/** Offre d'upsell exposée au guest sur le livret (page publique). */
export interface PublicUpsell {
  offerId: number;
  type: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  /** Bundle (2.10) : titres des offres incluses (vide si offre simple). */
  bundleItems: string[];
}

export const upsellApi = {
  listOffers: () => apiClient.get<UpsellOffer[]>('/upsells/offers'),
  createOffer: (data: UpsellOfferRequest) => apiClient.post<UpsellOffer>('/upsells/offers', data),
  updateOffer: (id: number, data: UpsellOfferRequest) =>
    apiClient.put<UpsellOffer>(`/upsells/offers/${id}`, data),
  removeOffer: (id: number) => apiClient.delete(`/upsells/offers/${id}`),
  listOrders: () => apiClient.get<UpsellOrder[]>('/upsells/orders'),
};
