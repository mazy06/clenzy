import airbnbUrl from '../assets/brands/airbnb.svg';
import bookingUrl from '../assets/brands/bookingdotcom.svg';
import expediaUrl from '../assets/brands/expedia.svg';
import googleUrl from '../assets/brands/google.svg';
import stripeUrl from '../assets/brands/stripe.svg';
import whatsappUrl from '../assets/brands/whatsapp.svg';
import brevoUrl from '../assets/brands/brevo.svg';
import anthropicUrl from '../assets/brands/anthropic.svg';
import payzoneUrl from '../assets/brands/payzone.svg';
import youcanUrl from '../assets/brands/youcanpay.svg';
import agodaUrl from '../assets/brands/wk-agoda.svg';
import awsUrl from '../assets/brands/wk-aws.svg';
import hotelsUrl from '../assets/brands/si-hotelsdotcom.svg';
import wiseUrl from '../assets/brands/si-wise.svg';
import nvidiaUrl from '../assets/brands/si-nvidia.svg';
import mapboxUrl from '../assets/brands/si-mapbox.svg';
import osmUrl from '../assets/brands/si-openstreetmap.svg';
import deeplUrl from '../assets/brands/si-deepl.svg';
import cloudflareUrl from '../assets/brands/si-cloudflare.svg';
import sentryUrl from '../assets/brands/si-sentry.svg';
import firebaseUrl from '../assets/brands/si-firebase.svg';
import viatorUrl from '../assets/brands/pl-viator.png';
import gygUrl from '../assets/brands/pl-getyourguide.svg';

/**
 * Écosystème connecté au PMS — services externes RÉELLEMENT intégrés (client
 * HTTP / SDK appelé en production). Les intégrations encore à l'état
 * d'ébauche (enum, OAuth seul, stub) sont volontairement exclues : le mur
 * annonce « connecté », il ne doit lister que ce qui l'est.
 *
 * Rendu des tuiles (cf. `PartnerMarquee`) :
 *  - `mask` : logo monochrome à tracé unique → fond couleur de marque + glyphe
 *    peint. C'est le rendu « icône d'application », le plus lisible en petit.
 *  - `logoUrl` seul : logo multicolore ou wordmark → tuile claire, logo contenu.
 *  - ni l'un ni l'autre : monogramme teinté, pour les marques dont le logo
 *    n'est pas disponible sous licence libre — on ne fabrique pas de faux logo.
 */

export interface BrandDef {
  name: string;
  logoUrl?: string;
  mono?: string;
  /** Couleur de marque : fond de tuile (masque ou monogramme). */
  color?: string;
  /** Logo monochrome peint via masque CSS. */
  mask?: boolean;
  /** Couleur du glyphe masqué, quand le blanc manque de contraste. */
  glyph?: string;
  /** Wordmark (plus large que haut) : hauteur contrainte, largeur libre — sans
      quoi la boîte carrée l'écraserait. */
  wide?: boolean;
  category: string;
}

export const BRANDS: BrandDef[] = [
  /* ─── Distribution : OTA, channel manager, metasearch ────────────────────── */
  { name: 'Airbnb', logoUrl: airbnbUrl, mask: true, color: '#FF5A5F', category: 'Canaux' },
  { name: 'Booking.com', logoUrl: bookingUrl, mask: true, color: '#003580', category: 'Canaux' },
  { name: 'Expedia', logoUrl: expediaUrl, mask: true, color: '#00355F', category: 'Canaux' },
  { name: 'Vrbo', mono: 'Vr', color: '#1A5DBB', category: 'Canaux' },
  { name: 'Abritel', mono: 'Ab', color: '#1F5FA9', category: 'Canaux' },
  { name: 'Agoda', logoUrl: agodaUrl, wide: true, category: 'Canaux' },
  { name: 'Hotels.com', logoUrl: hotelsUrl, mask: true, color: '#D32F2F', category: 'Canaux' },
  { name: 'Google', logoUrl: googleUrl, mask: true, color: '#4285F4', category: 'Canaux' },
  { name: 'Leboncoin', mono: 'Lb', color: '#FF6E14', category: 'Canaux' },
  { name: 'Channex', mono: 'Cx', color: '#4353FF', category: 'Channel manager' },
  { name: 'iCal', mono: 'iC', color: '#5B6B7A', category: 'Channel manager' },

  /* ─── Activités & expériences (revenus additionnels) ─────────────────────── */
  { name: 'Viator', logoUrl: viatorUrl, category: 'Activités' },
  { name: 'GetYourGuide', logoUrl: gygUrl, category: 'Activités' },

  /* ─── Paiements ──────────────────────────────────────────────────────────── */
  { name: 'Stripe', logoUrl: stripeUrl, mask: true, color: '#635BFF', category: 'Paiements' },
  { name: 'CMI', mono: 'CMI', color: '#00843D', category: 'Paiements' },
  { name: 'PayZone', logoUrl: payzoneUrl, wide: true, category: 'Paiements' },
  { name: 'YouCan Pay', logoUrl: youcanUrl, wide: true, category: 'Paiements' },
  { name: 'PayTabs', mono: 'Pt', color: '#00A9CE', category: 'Paiements' },
  { name: 'Attijariwafa', mono: 'Aw', color: '#E9500E', category: 'Paiements' },

  /* ─── Versements & banque ────────────────────────────────────────────────── */
  { name: 'Wise', logoUrl: wiseUrl, mask: true, color: '#163300', glyph: '#9FE870', category: 'Versements' },
  { name: 'GoCardless', mono: 'Gc', color: '#1B1B1B', category: 'Versements' },
  { name: 'Virement SEPA', mono: 'SE', color: '#26478D', category: 'Versements' },

  /* ─── Comptabilité & facturation électronique ────────────────────────────── */
  { name: 'Pennylane', mono: 'Pl', color: '#0F3B57', category: 'Comptabilité' },
  { name: 'Factur-X', mono: 'FX', color: '#3C6E9B', category: 'Comptabilité' },
  { name: 'DGI Maroc', mono: 'DG', color: '#C1272D', category: 'Comptabilité' },
  { name: 'ZATCA', mono: 'ZA', color: '#1E7A52', category: 'Comptabilité' },

  /* ─── Conformité voyageurs & signature ───────────────────────────────────── */
  { name: 'Chekin', mono: 'Ck', color: '#2E5BFF', category: 'Conformité' },
  { name: 'Yousign', mono: 'Ys', color: '#7B61FF', category: 'Conformité' },
  { name: 'DocuSeal', mono: 'Ds', color: '#1F2937', category: 'Conformité' },

  /* ─── Messagerie & voyageurs ─────────────────────────────────────────────── */
  { name: 'WhatsApp', logoUrl: whatsappUrl, mask: true, color: '#25D366', category: 'Messagerie' },
  { name: 'Brevo', logoUrl: brevoUrl, mask: true, color: '#0B996E', category: 'Messagerie' },
  { name: 'Firebase', logoUrl: firebaseUrl, mask: true, color: '#FFCA28', glyph: '#1F2937', category: 'Messagerie' },
  { name: 'DeepL', logoUrl: deeplUrl, mask: true, color: '#0F2B46', category: 'Messagerie' },

  /* ─── Objets connectés ───────────────────────────────────────────────────── */
  { name: 'Nuki', mono: 'Nu', color: '#1D1D1B', category: 'Serrures' },
  { name: 'KeyNest', mono: 'Kn', color: '#FF8A00', category: 'Serrures' },
  { name: 'Tuya', mono: 'Ty', color: '#FF5A28', category: 'Serrures' },
  { name: 'Minut', mono: 'Mi', color: '#0F1D2F', category: 'Capteurs' },
  { name: 'Netatmo', mono: 'Nt', color: '#00A6A0', category: 'Capteurs' },

  /* ─── IA ─────────────────────────────────────────────────────────────────── */
  { name: 'Anthropic', logoUrl: anthropicUrl, mask: true, color: '#191919', category: 'IA' },
  { name: 'OpenAI', mono: 'AI', color: '#10A37F', category: 'IA' },
  { name: 'NVIDIA', logoUrl: nvidiaUrl, mask: true, color: '#76B900', glyph: '#10240A', category: 'IA' },
  { name: 'AWS Bedrock', logoUrl: awsUrl, wide: true, category: 'IA' },
  { name: 'Voyage AI', mono: 'Vo', color: '#5B3DF5', category: 'IA' },

  /* ─── Cartes, données & plateforme ───────────────────────────────────────── */
  { name: 'Mapbox', logoUrl: mapboxUrl, mask: true, color: '#1B1B21', category: 'Plateforme' },
  { name: 'OpenStreetMap', logoUrl: osmUrl, mask: true, color: '#7EBC6F', glyph: '#12341C', category: 'Plateforme' },
  { name: 'Open-Meteo', mono: 'OM', color: '#FF6A00', category: 'Plateforme' },
  { name: 'Cloudflare', logoUrl: cloudflareUrl, mask: true, color: '#F38020', category: 'Plateforme' },
  { name: 'Sentry', logoUrl: sentryUrl, mask: true, color: '#362D59', category: 'Plateforme' },
  { name: 'Keycloak', mono: 'Kc', color: '#4D4D4D', category: 'Plateforme' },
];
