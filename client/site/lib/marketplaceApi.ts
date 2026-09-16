/**
 * Parcours prestataire — appels au backend Baitly.
 *
 * <p>Surface publique : aucun jeton d'authentification ne circule ici. Les deux
 * secrets manipulés — le jeton de dépôt et le jeton d'activation — sont rendus
 * une seule fois par le serveur et ne transitent que dans le corps ou le chemin
 * des requêtes qui les utilisent.</p>
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8084';
const BASE = `${API_BASE_URL}/api/public/marketplace`;

export type PricingModel = import('../../src/types/providerPricing').ProviderPricingModel;

export interface ServiceItem {
  id: number;
  code: string;
  categoryCode: string;
  labelFr: string;
  labelEn?: string | null;
  defaultPricingModel?: PricingModel;
  sortOrder: number;
}

export interface ServiceCategory {
  id: number;
  code: string;
  labelFr: string;
  labelEn?: string | null;
  description?: string;
  family: string;
  /** Métier usuel de la location courte durée : proposé en tête. */
  common: boolean;
  sortOrder: number;
  items: ServiceItem[];
}

export interface OfferInput {
  categoryCode: string;
  serviceItemCode?: string;
  label: string;
  pricingModel: PricingModel;
  amount?: number | null;
  currency: string;
  unitLabel?: string;
}

export interface ApplicationPayload {
  displayName: string;
  legalName?: string;
  contactFirstName: string;
  contactLastName: string;
  email: string;
  phone?: string;
  website?: string;
  headline?: string;
  bio?: string;
  baseCity?: string;
  basePostalCode?: string;
  baseCountryCode?: string;
  travelRadiusKm?: number | null;
  languages: string[];
  registrationNumber?: string;
  categoryCodes: string[];
  offers: OfferInput[];
  zones: { countryCode: string; department?: string; city?: string; primary: boolean }[];
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
  acceptedTerms: boolean;
  termsVersion: string;
}

export type DocumentType =
  | 'COMPANY_REGISTRATION' | 'URSSAF_VIGILANCE' | 'LIABILITY_INSURANCE' | 'IDENTITY' | 'OTHER';

export interface ApplicationDocument {
  id: number;
  documentType: DocumentType;
  fileName: string;
  fileSize?: number;
  expiresAt?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  createdAt: string;
}

export interface ApplicationStatus {
  displayName: string;
  status: string;
  submittedAt: string;
  requiredTypes: DocumentType[];
  documents: ApplicationDocument[];
}

/** Porte le message du serveur, qui est déjà rédigé pour un humain. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function readError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new ApiError(body?.message || fallback, response.status);
}

export const marketplaceApi = {
  async getCategories(): Promise<ServiceCategory[]> {
    const response = await fetch(`${BASE}/categories`);
    if (!response.ok) await readError(response, 'Catalogue indisponible.');
    return response.json();
  },

  async getTermsVersion(): Promise<string> {
    const response = await fetch(`${BASE}/terms-version`);
    if (!response.ok) await readError(response, 'Conditions indisponibles.');
    return (await response.json()).version as string;
  },

  /** Le secret est envoyé exclusivement dans un cookie HttpOnly. */
  async apply(payload: ApplicationPayload): Promise<string> {
    const response = await fetch(`${BASE}/applications`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) await readError(response, "L'envoi a échoué. Réessayez.");
    return 'session';
  },

  async migrateApplicationSession(token: string): Promise<void> {
    const response = await fetch(`${BASE}/applications/session`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'BaitlyApplication' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) await readError(response, 'Le dossier ne peut pas être repris.');
  },

  /**
   * Confirme l'adresse du candidat.
   *
   * Le serveur répond identiquement qu'un dossier existe ou non : cet endpoint
   * ne doit pas devenir un moyen de savoir si une adresse a candidaté.
   */
  async confirmEmail(token: string): Promise<string> {
    const response = await fetch(
      `${BASE}/applications/confirm/${encodeURIComponent(token)}`, { method: 'POST' });
    if (!response.ok) await readError(response, 'La confirmation a échoué.');
    return (await response.json()).message as string;
  },

  async getStatus(token: string): Promise<ApplicationStatus> {
    const response = await fetch(`${BASE}/applications/${encodeURIComponent(token)}/status`, {
      credentials: 'include', headers: { 'X-Requested-With': 'BaitlyApplication' },
    });
    if (!response.ok) await readError(response, 'Dossier introuvable.');
    return response.json();
  },

  async uploadDocument(
    token: string, type: DocumentType, file: File, expiresAt?: string,
  ): Promise<ApplicationDocument> {
    const form = new FormData();
    form.append('type', type);
    form.append('file', file);
    if (expiresAt) form.append('expiresAt', expiresAt);

    const response = await fetch(
      `${BASE}/applications/${encodeURIComponent(token)}/documents`,
      { method: 'POST', body: form, credentials: 'include', headers: { 'X-Requested-With': 'BaitlyApplication' } },
    );
    if (!response.ok) await readError(response, 'Le dépôt a échoué.');
    return response.json();
  },

  /** À qui appartient un lien d'activation — affiché avant la saisie. */
  async getActivationTarget(token: string): Promise<string> {
    const response = await fetch(`${BASE}/activation/${encodeURIComponent(token)}`);
    if (!response.ok) await readError(response, "Ce lien n'est plus valable.");
    return (await response.json()).displayName as string;
  },

  /**
   * Pose le mot de passe du prestataire.
   *
   * Il part vers notre API, qui le transmet à Keycloak — ni journalisé, ni
   * conservé. Même chemin que l'inscription des clients.
   */
  async activate(token: string, password: string): Promise<string> {
    const response = await fetch(`${BASE}/activation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) await readError(response, "L'activation a échoué.");
    return (await response.json()).message as string;
  },
};
