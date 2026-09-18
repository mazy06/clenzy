import apiClient from '../apiClient';

/**
 * Code d'un type d'upsell.
 *
 * Une CHAÎNE libre et non une union fermée : le référentiel vit en base et
 * s'enrichit sans déploiement. Figer la liste ici aurait reproduit côté front
 * exactement le verrou qu'on vient de retirer côté serveur.
 *
 * Les neuf codes historiques restent listés pour l'autocomplétion et pour les
 * quelques endroits qui les nomment — l'union reste ouverte via `(string & {})`.
 */
export type UpsellTypeId =
  | 'EARLY_CHECKIN'
  | 'LATE_CHECKOUT'
  | 'CLEANING'
  | 'TRANSFER'
  | 'BREAKFAST'
  | 'PARKING'
  | 'EQUIPMENT'
  | 'EXPERIENCE'
  | 'OTHER'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

/** Type du référentiel, servi par `GET /upsells/types`. */
export interface UpsellTypeDto {
  id: number;
  code: string;
  labelFr: string;
  labelEn: string;
  description?: string;
  iconKey?: string;
  /** Prestation correspondante du catalogue place de marché, quand il y en a une. */
  serviceItemCode?: string;
  /** true = proposé à toutes les organisations, donc non modifiable ici. */
  platform: boolean;
  /** Type historique référencé nommément par le code : non supprimable. */
  system: boolean;
  sortOrder: number;
}

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
  /** Diffusion par canal : proposé dans le livret numérique. */
  diffuseOnLivret: boolean;
  /** Diffusion par canal : proposé dans le booking engine. */
  diffuseOnBooking: boolean;
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
  /** Diffusion par canal (null/absent = inchangé en update, défaut true à la création). */
  diffuseOnLivret?: boolean | null;
  diffuseOnBooking?: boolean | null;
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

  /** Référentiel des types : ceux de la plateforme et ceux de l'organisation. */
  listTypes: () => apiClient.get<UpsellTypeDto[]>('/upsells/types'),

  /** Ajoute un type propre à l'organisation. Le code dérive du libellé s'il est omis. */
  createType: (data: { code?: string; label: string; description?: string; iconKey?: string }) =>
    apiClient.post<UpsellTypeDto>('/upsells/types', data),

  /** Retire le type du choix sans le supprimer : les offres existantes le portent encore. */
  deactivateType: (id: number) => apiClient.delete(`/upsells/types/${id}`),
};
