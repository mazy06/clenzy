import apiClient from '../apiClient';
import type { ServicePriceConfig } from './pricingConfigApi';

// Prestations « travaux » PROPRES au technicien connecté (surcouche). L'org et
// l'utilisateur sont résolus côté serveur ; on ne lit/écrit QUE ses lignes.
export const technicianPrestationsApi = {
  getMine() {
    return apiClient.get<ServicePriceConfig[]>('/technician-prestations');
  },

  // Catalogue org (services actifs) pour pré-lister l'écran du technicien.
  catalogue() {
    return apiClient.get<ServicePriceConfig[]>('/technician-prestations/catalogue');
  },

  updateMine(items: ServicePriceConfig[]) {
    return apiClient.put<ServicePriceConfig[]>('/technician-prestations', items);
  },

  // P2 — ids des techniciens de l'org qui proposent au moins un des types donnés.
  offering(types: string[]) {
    if (types.length === 0) return Promise.resolve<number[]>([]);
    const qs = types.map((t) => `types=${encodeURIComponent(t)}`).join('&');
    return apiClient.get<number[]>(`/technician-prestations/offering?${qs}`);
  },

  // P3 — prestations (actives) d'un technicien donné, pour appliquer ses tarifs.
  forUser(userId: number) {
    return apiClient.get<ServicePriceConfig[]>(`/technician-prestations/for-user/${userId}`);
  },
};
