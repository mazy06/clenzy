import React from 'react';
import {
  Bathtub,
  Bolt,
  Business,
  Calculate,
  Campaign,
  CleaningServices,
  ConciergeBell,
  Deck,
  Engineering,
  Flag,
  Gavel,
  GppGood,
  Handyman,
  HealthAndSafety,
  Inventory2,
  KingBed,
  LocalLaundryService,
  Lock,
  Luggage,
  MapIcon,
  MoreHoriz,
  People,
  PhotoCamera,
  Restaurant,
  Sanitizer,
  Shield,
  Speed,
  Verified,
  VerifiedUser,
  VpnKey,
  WeatherDroplets,
  Weekend,
  Widgets,
  Yard,
} from '../../icons';
import type { StatusTone } from '../../components/baitly/StatusChip';
import type {
  CategoryFamily,
  EngagementMode,
  PricingModel,
  ProviderSource,
  ProviderStatus,
  ServicePayer,
  ServiceRecurrence,
} from '../../services/api/marketplaceProvidersApi';

/**
 * Vocabulaire partage des deux ecrans de la place de marche.
 *
 * Regroupe ici plutot que duplique : la liste et la fiche doivent nommer et
 * teinter un statut de la MEME facon, sinon la meme fiche se lit differemment
 * selon l'ecran ou on la regarde.
 */

// ─── Statuts ────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<ProviderStatus, string> = {
  PENDING_REVIEW: 'À examiner',
  ACTIVE: 'Publié',
  SUSPENDED: 'Suspendu',
  REJECTED: 'Refusé',
  ARCHIVED: 'Archivé',
};

/**
 * Tons semantiques, pas decoratifs : « à examiner » demande une action, donc
 * l'ambre ; « refusé » est un aboutissement neutre, pas une alerte, donc le
 * gris. Reserver le rouge au suspendu garde son pouvoir d'attirer l'œil.
 */
export const STATUS_TONES: Record<ProviderStatus, StatusTone> = {
  PENDING_REVIEW: 'warn',
  ACTIVE: 'ok',
  SUSPENDED: 'err',
  REJECTED: 'neutral',
  ARCHIVED: 'neutral',
};

export const STATUS_ORDER: ProviderStatus[] = [
  'PENDING_REVIEW',
  'ACTIVE',
  'SUSPENDED',
  'REJECTED',
  'ARCHIVED',
];

// ─── Modes d'engagement ─────────────────────────────────────────────────────

export const ENGAGEMENT_LABELS: Record<EngagementMode, string> = {
  INDEPENDENT: 'Indépendant',
  AFFILIATED: 'Rattaché',
  EXCLUSIVE: 'Exclusif',
};

export const ENGAGEMENT_HINTS: Record<EngagementMode, string> = {
  INDEPENDENT: 'Sa propre organisation. Travaille pour qui il veut.',
  AFFILIATED: 'Membre d’une organisation, toujours proposé aux autres.',
  EXCLUSIVE: 'Réservé à son organisation. Retiré du catalogue.',
};

export const ENGAGEMENT_TONES: Record<EngagementMode, StatusTone> = {
  INDEPENDENT: 'accent',
  AFFILIATED: 'info',
  EXCLUSIVE: 'neutral',
};

export const ENGAGEMENT_ORDER: EngagementMode[] = ['INDEPENDENT', 'AFFILIATED', 'EXCLUSIVE'];

// ─── Origine d'une fiche ────────────────────────────────────────────────────

export const SOURCE_LABELS: Record<ProviderSource, string> = {
  LANDING: 'Candidature spontanée',
  ADMIN: 'Saisie par l’équipe',
  INVITATION: 'Compte existant repris',
  PROSPECT: 'Issu de la prospection',
};

// ─── Catégories de service ──────────────────────────────────────────────────

/**
 * Icône par catégorie, résolue sur la clef renvoyée par le serveur.
 *
 * Le référentiel vit en base et peut grandir sans déploiement : toute clef
 * inconnue retombe sur une icône neutre plutôt que de laisser un trou.
 */
const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  // Exploitation
  cleaning: <CleaningServices />,
  laundry: <LocalLaundryService />,
  linen: <KingBed />,
  supplies: <Inventory2 />,
  keys: <VpnKey />,
  logistics: <Luggage />,
  security: <Shield />,
  concierge: <ConciergeBell />,
  // Technique
  handyman: <Handyman />,
  locksmith: <Lock />,
  yard: <Yard />,
  pool: <WeatherDroplets />,
  pest: <Sanitizer />,
  regulatory: <GppGood />,
  renovation: <Engineering />,
  // Voyageur
  culinary: <Restaurant />,
  driver: <MapIcon />,
  mobility: <Speed />,
  guide: <Flag />,
  activities: <Deck />,
  wellness: <Bathtub />,
  childcare: <People />,
  pet: <HealthAndSafety />,
  equipment: <Widgets />,
  // Propriétaire
  camera: <PhotoCamera />,
  furnishing: <Weekend />,
  marketing: <Campaign />,
  admin: <Gavel />,
  accounting: <Calculate />,
  insurance: <VerifiedUser />,
  utilities: <Bolt />,
  // Divers
  more: <MoreHoriz />,
};

export function categoryIcon(iconKey?: string): React.ReactElement {
  if (!iconKey) return <Business />;
  return CATEGORY_ICONS[iconKey] ?? <Business />;
}

// ─── Familles de métiers ────────────────────────────────────────────────────

export const FAMILY_LABELS: Record<CategoryFamily, string> = {
  OPERATIONS: 'Exploitation',
  TECHNICAL: 'Technique & réglementaire',
  GUEST: 'Services au voyageur',
  OWNER: 'Services au propriétaire',
  OTHER: 'Divers',
};

/** Ordre de lecture : du quotidien vers l'occasionnel. */
export const FAMILY_ORDER: CategoryFamily[] = [
  'OPERATIONS', 'TECHNICAL', 'GUEST', 'OWNER', 'OTHER',
];

// ─── Récurrence et payeur ───────────────────────────────────────────────────

export const RECURRENCE_LABELS: Record<ServiceRecurrence, string> = {
  ONE_OFF: 'Ponctuel',
  PER_STAY: 'Par séjour',
  WEEKLY: 'Hebdomadaire',
  MONTHLY: 'Mensuel',
  SEASONAL: 'Saisonnier',
  ANNUAL: 'Annuel',
  MULTI_YEAR: 'Pluriannuel',
};

export const PAYER_LABELS: Record<ServicePayer, string> = {
  OWNER: 'Propriétaire',
  GUEST: 'Voyageur',
  AGENCY: 'Agence',
};

// ─── Modèles de prix ────────────────────────────────────────────────────────

const PRICING_SUFFIX: Record<PricingModel, string> = {
  HOURLY: '/h',
  FLAT: '',
  PER_UNIT: '',
  PER_SQM: '/m²',
  ON_QUOTE: '',
};

/**
 * Prix d'une prestation en toutes lettres.
 *
 * Une prestation sur devis renvoie « Sur devis » et jamais « 0 € » : un zéro se
 * lirait comme gratuit.
 */
export function formatOfferPrice(
  amount: number | undefined,
  currency: string,
  pricingModel: PricingModel,
  unitLabel?: string,
  locale = 'fr-FR',
  onQuote = 'Sur devis',
): string {
  if (pricingModel === 'ON_QUOTE' || amount === undefined || amount === null) {
    return onQuote;
  }
  const formatted = formatMoney(amount, currency, locale);
  if (pricingModel === 'PER_UNIT' && unitLabel) return `${formatted} / ${unitLabel}`;
  return `${formatted}${PRICING_SUFFIX[pricingModel]}`;
}

export function formatMoney(amount: number, currency: string, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

// ─── Disponibilités ─────────────────────────────────────────────────────────

/** ISO-8601 : l'indice 0 du tableau correspond au jour 1 (lundi). */
export const DAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const DAY_NAMES = [
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche',
];

/**
 * Résumé de disponibilité.
 *
 * **Aucune déclaration vaut disponible** — même convention que le moteur
 * d'affectation. Afficher « indisponible » pour un agenda vide ferait passer
 * pour fermés la majorité des professionnels, qui ne remplissent pas ce champ.
 */
export function availabilitySummary(availableDays: number[], weeklyRestricted = false): string {
  if (weeklyRestricted && availableDays?.length === 0) return "Aucun créneau autorisé";
  if (!availableDays || availableDays.length === 0) return 'Sans contrainte déclarée';
  if (availableDays.length === 7) return 'Sept jours sur sept';
  return availableDays
    .slice()
    .sort((a, b) => a - b)
    .map((day) => DAY_NAMES[day - 1]?.slice(0, 3) ?? '')
    .filter(Boolean)
    .join(', ');
}

// ─── Conformité ─────────────────────────────────────────────────────────────

export type ComplianceState = 'expired' | 'expiring' | 'valid' | 'missing';

/**
 * État d'une pièce justificative.
 *
 * `missing` n'est PAS une alerte : la plupart des dossiers sont incomplets à
 * l'inscription, et les signaler tous noierait les pièces réellement périmées.
 */
export function complianceState(expiresAt: string | undefined, today = new Date()): ComplianceState {
  if (!expiresAt) return 'missing';
  // Une échéance est une date civile, comme le LocalDate du serveur.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(expiresAt) ? `${expiresAt}T00:00:00` : expiresAt);
  if (Number.isNaN(date.getTime())) return 'missing';
  const day = new Date(today);
  day.setHours(0, 0, 0, 0);
  if (date < day) return 'expired';
  const in30Days = new Date(day);
  in30Days.setDate(in30Days.getDate() + 30);
  return date < in30Days ? 'expiring' : 'valid';
}

export const COMPLIANCE_TONES: Record<ComplianceState, StatusTone> = {
  expired: 'err',
  expiring: 'warn',
  valid: 'ok',
  missing: 'neutral',
};

export const COMPLIANCE_LABELS: Record<ComplianceState, string> = {
  expired: 'Expirée',
  expiring: 'Expire bientôt',
  valid: 'À jour',
  missing: 'Non fournie',
};

// ─── Divers ─────────────────────────────────────────────────────────────────

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'Français', en: 'Anglais', ar: 'Arabe', es: 'Espagnol',
  de: 'Allemand', it: 'Italien', pt: 'Portugais', nl: 'Néerlandais',
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

export const VERIFIED_ICON = <Verified />;
