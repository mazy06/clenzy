/**
 * Parcours prestataire — appels au backend Baitly.
 *
 * <p>Surface publique : aucun jeton d'authentification ne circule ici. Les deux
 * secrets manipulés — le jeton de dépôt et le jeton d'activation — sont rendus
 * une seule fois par le serveur et ne transitent que dans le corps ou le chemin
 * des requêtes qui les utilisent.</p>
 */

import { runtimeEnvOr } from '../../src/config/runtimeConfig';

const API_BASE_URL = runtimeEnvOr('VITE_API_URL', 'http://localhost:8084');
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
  captchaToken?: string;
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

/**
 * Messages de repli, quand le serveur ne dit rien d'exploitable.
 *
 * <p>Ce module n'est pas un composant : il ne peut pas lire le contexte de
 * langue. Il lit donc l'attribut `lang` du document, que le fournisseur de
 * langue tient a jour — la meme source que celle sur laquelle s'appuient le
 * lecteur d'ecran et la bascule de police.</p>
 */
const FALLBACKS: Record<string, Record<string, string>> = {
  fr: {
    catalog: 'Catalogue indisponible.',
    terms: 'Conditions indisponibles.',
    send: 'L’envoi a échoué. Réessayez.',
    resume: 'Le dossier ne peut pas être repris.',
    confirm: 'La confirmation a échoué.',
    upload: 'Le dépôt a échoué.',
    activate: 'L’activation a échoué.',
  },
  en: {
    catalog: 'Catalogue unavailable.',
    terms: 'Terms unavailable.',
    send: 'Sending failed. Please try again.',
    resume: 'This application cannot be resumed.',
    confirm: 'Confirmation failed.',
    upload: 'The upload failed.',
    activate: 'Activation failed.',
  },
  ar: {
    catalog: 'الكتالوج غير متاح.',
    terms: 'الشروط غير متاحة.',
    send: 'فشل الإرسال. حاول مرة أخرى.',
    resume: 'لا يمكن استئناف هذا الطلب.',
    confirm: 'فشل التأكيد.',
    upload: 'فشل الرفع.',
    activate: 'فشل التفعيل.',
  },
};

function fallbackMessage(key: string): string {
  const lang = (document.documentElement.lang || 'fr').split('-')[0];
  return (FALLBACKS[lang] ?? FALLBACKS.fr)[key] ?? FALLBACKS.fr[key];
}

async function readError(response: Response, key: string): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new ApiError(body?.message || fallbackMessage(key), response.status);
}

export const marketplaceApi = {
  async getCategories(): Promise<ServiceCategory[]> {
    const response = await fetch(`${BASE}/categories`);
    if (!response.ok) await readError(response, 'catalog');
    return response.json();
  },

  async getTermsVersion(): Promise<string> {
    const response = await fetch(`${BASE}/terms-version`);
    if (!response.ok) await readError(response, 'terms');
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
    if (!response.ok) await readError(response, 'send');
    return 'session';
  },

  async migrateApplicationSession(token: string): Promise<void> {
    const response = await fetch(`${BASE}/applications/session`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'BaitlyApplication' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) await readError(response, 'resume');
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
    if (!response.ok) await readError(response, 'confirm');
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
    if (!response.ok) await readError(response, 'upload');
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
    if (!response.ok) await readError(response, 'activate');
    return (await response.json()).message as string;
  },
};
