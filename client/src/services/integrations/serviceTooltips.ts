/**
 * Metadata des tooltips pour TOUS les services d'integration affiches dans
 * l'onglet Integrations (Signature, Pricing, Accounting, Compliance, KYC,
 * Channel Manager, OTAs).
 *
 * <h2>Source de verite unique</h2>
 * <p>Cle = provider ID (en majuscules pour la plupart, lowercase pour les
 * OTAs qui suivent leur convention). Permet a chaque card de looker up
 * sa tooltip data sans duplication.</p>
 *
 * <h2>Format aligne sur servicesCatalog.ts</h2>
 * <p>Memes champs (description, accessModality, websiteUrl, region) pour
 * que le composant {@code ServiceTooltip} puisse render uniformement les
 * tooltips de tout l'ecran.</p>
 */

export interface ServiceTooltipData {
  description: string;
  accessModality: string;
  websiteUrl: string;
  region?: 'FR' | 'EU' | 'MA' | 'KSA' | 'MENA' | 'Global';
}

export const SERVICE_TOOLTIPS: Record<string, ServiceTooltipData> = {
  // ─── Signature electronique (QTSP francais + OAuth) ────────────────────
  YOUSIGN: {
    description:
      "QTSP français basé à Caen, certifié ANSSI. Signature électronique SES, AES et QES (équivalent juridique de la signature manuscrite). Pure player avec tarification adaptée PME.",
    accessModality:
      'Compte Yousign Pro requis. Génération API key dans Settings → API. Tarification au volume de signatures (~0.50-2 €/signature selon plan).',
    websiteUrl: 'https://yousign.com',
    region: 'FR',
  },
  UNIVERSIGN: {
    description:
      "QTSP français (groupe Quadient), historiquement implanté dans le secteur bancaire et assurance. Niveaux SES, AES, QES disponibles.",
    accessModality:
      'Contrat partenaire B2B requis. API key fournie après contractualisation. Tarification au volume + frais de setup.',
    websiteUrl: 'https://universign.com',
    region: 'FR',
  },
  DOCAPOSTE: {
    description:
      "Filiale du Groupe La Poste, QTSP français certifié ANSSI. SES, AES, QES + Lettre Recommandée Électronique (LRE) — utile pour les mises en demeure et notifications légales.",
    accessModality:
      'Compte DocaPoste Pro. API key via portail développeur après validation KYC. Tarification au volume.',
    websiteUrl: 'https://www.docaposte.com',
    region: 'FR',
  },
  DOCUSIGN: {
    description:
      "Leader mondial de la signature électronique. SES + AES + QES via partenariats avec QTSP européens. Authentification OAuth2 (Authorization Code Grant ou JWT Grant).",
    accessModality:
      'Compte développeur DocuSign (sandbox gratuit, prod facturée). Créer une intégration → Integration Key + Secret. Tarification par envoi.',
    websiteUrl: 'https://developers.docusign.com',
    region: 'Global',
  },
  PENNYLANE: {
    description:
      "Solution française de comptabilité + signature électronique (SES) intégrée. Utilisée par 250 000+ PME en France. OAuth2 pour API Entreprise v2.",
    accessModality:
      'Compte développeur Pennylane (sur dossier). Client ID + Secret après validation. API gratuite pour le sync facturation comptable.',
    websiteUrl: 'https://developers.pennylane.com',
    region: 'FR',
  },
  ODOO: {
    description:
      "ERP open-source polyvalent. Module Sign (Odoo Enterprise) pour signature électronique SES + AES. Connexion via API key sur instance SaaS ou self-hosted.",
    accessModality:
      "Instance Odoo Enterprise requise (15-30 €/utilisateur/mois). Générer API key dans Settings → Users → API Keys. Module Sign à installer séparément.",
    websiteUrl: 'https://www.odoo.com/documentation',
    region: 'Global',
  },

  // ─── Tarification dynamique ────────────────────────────────────────────
  PRICELABS: {
    description:
      "Leader mondial du dynamic pricing court-séjour (NYC). 250 000+ listings, recommandations basées sur la demande locale, occupancy, événements. Couvre tous marchés FR/MA/KSA.",
    accessModality:
      'Compte PriceLabs (~20-30 €/listing/mois). API key dans Account Settings → API Integration après souscription.',
    websiteUrl: 'https://hello.pricelabs.co',
    region: 'Global',
  },
  BEYOND: {
    description:
      "Concurrent direct de PriceLabs (San Francisco). Algorithme propriétaire de tarification nuit-par-nuit. Très utilisé en Europe et US.",
    accessModality:
      "Compte Beyond Pro (tarification au revenue généré, ~1 % du CA additionnel). API key après onboarding commercial.",
    websiteUrl: 'https://www.beyondpricing.com',
    region: 'Global',
  },
  WHEELHOUSE: {
    description:
      "3e acteur majeur du dynamic pricing (San Francisco). Focus sur la comparaison concurrentielle avec les listings similaires dans la zone géographique.",
    accessModality:
      "Compte Wheelhouse (~24 $/listing/mois). API key fournie sur demande après souscription.",
    websiteUrl: 'https://www.usewheelhouse.com',
    region: 'Global',
  },

  // ─── Comptabilite (OAuth2) ─────────────────────────────────────────────
  QUICKBOOKS: {
    description:
      "Solution comptable n°1 mondiale (Intuit). Très utilisée en US/UK/Canada/Australie. Sync factures + dépenses + reporting financier consolidé.",
    accessModality:
      "Compte Intuit Developer (sandbox gratuit). Créer une app → Client ID + Secret. OAuth2 Authorization Code Grant + realmId multi-company.",
    websiteUrl: 'https://developer.intuit.com',
    region: 'Global',
  },
  XERO: {
    description:
      "Leader comptabilité cloud UK / Australie / Nouvelle-Zélande. Forte croissance US et EU. Multi-tenant (un compte peut gérer plusieurs organisations comptables).",
    accessModality:
      "Compte Xero Developer (gratuit). Créer une app dans /myapps → Client ID + Secret. OAuth2 + scope offline_access pour refresh tokens.",
    websiteUrl: 'https://developer.xero.com',
    region: 'EU',
  },
  SAGE: {
    description:
      "Sage Business Cloud Accounting — leader compta SMB en France et Europe. Multi-business (gestion de plusieurs sociétés sous un compte).",
    accessModality:
      "Compte Sage Developer + contrat partenaire. Client ID + Secret après approbation (~2 semaines). OAuth2 scope full_access.",
    websiteUrl: 'https://developer.sage.com',
    region: 'EU',
  },

  // ─── Conformite legale (declaration voyageurs) ─────────────────────────
  CHEKIN: {
    description:
      "SaaS espagnol d'automatisation de la fiche police (CERFA 11253*04 pour la France) + équivalents ES/IT/PT. KYC voyageur + génération de l'attestation + envoi automatique aux autorités.",
    accessModality:
      "Compte Chekin Pro (~5 €/check-in selon plan). API key dans Settings → Integrations après souscription.",
    websiteUrl: 'https://chekin.com',
    region: 'EU',
  },
  POLICE_MA: {
    description:
      "Connecteur direct DGSN (Direction Générale de la Sûreté Nationale du Maroc). Déclaration obligatoire des voyageurs dès la 1ère nuit, contrôle régulier des établissements.",
    accessModality:
      "Compte établissement DGSN (déclaration via le portail officiel ou contact préfecture locale). Identifiant établissement + API key fournis aux hébergeurs déclarés.",
    websiteUrl: 'https://www.dgsn.gov.ma',
    region: 'MA',
  },
  ABSHER_KSA: {
    description:
      "Plateforme nationale Absher du Ministère de l'Intérieur saoudien. Enregistrement obligatoire des voyageurs non-résidents. Connecté à Tawakkalna pour les contrôles tourisme.",
    accessModality:
      "Inscription établissement via le portail MOI (Ministry of Interior). API key fournie après validation administrative + licence touristique SCTH.",
    websiteUrl: 'https://www.absher.sa',
    region: 'KSA',
  },

  // ─── KYC / Verification d'identite ─────────────────────────────────────
  SUMSUB: {
    description:
      "Leader MENA + Europe de la vérification d'identité. KYC + KYB + transaction monitoring. Accepté par les banques saoudiennes et organismes de paiement européens.",
    accessModality:
      "Compte Sumsub (~0.50-3 €/vérification selon plan). App Token + API key dans Dashboard → Developers.",
    websiteUrl: 'https://sumsub.com',
    region: 'MENA',
  },
  VERIFF: {
    description:
      "KYC estonien réputé pour son bon rapport qualité/prix. Liveness detection + document check + AML screening. Couverture EU + MENA + global.",
    accessModality:
      "Compte Veriff (essai gratuit puis pricing au volume, ~1-2 €/vérification). API key dans Settings → Integrations.",
    websiteUrl: 'https://www.veriff.com',
    region: 'EU',
  },
  ONFIDO: {
    description:
      "KYC premium global (UK). Qualité UX exceptionnelle, intégré dans Revolut, Bolt, Zopa. ~95 % approval rate, fraud detection AI.",
    accessModality:
      "Compte Onfido (pricing au volume, plus cher mais qualité supérieure). API key dans Dashboard → API tokens.",
    websiteUrl: 'https://onfido.com',
    region: 'Global',
  },

  // ─── Channel Manager middleware ────────────────────────────────────────
  SITEMINDER: {
    description:
      "Channel manager leader mondial (Australie). ~250 OTAs intégrés y compris des marchés niches MENA / Asie / LATAM. Très utilisé par les hôtels indépendants et conciergeries premium.",
    accessModality:
      "Contrat partenaire SiteMinder (à partir de ~80 $/propriété/mois). API key fournie après onboarding commercial.",
    websiteUrl: 'https://www.siteminder.com',
    region: 'Global',
  },
  HOSTAWAY: {
    description:
      "Channel manager STR (US), focus court-séjour. Intégration native Airbnb + Booking + Vrbo + Expedia. Concurrent direct de Guesty et Smoobu.",
    accessModality:
      "Compte Hostaway (~30-50 $/propriété/mois). API key dans Settings → API + IP whitelist.",
    websiteUrl: 'https://www.hostaway.com',
    region: 'Global',
  },
  RENTALS_UNITED: {
    description:
      "Channel manager STR (Espagne). 60+ OTAs y compris des marchés MENA et Europe centrale. Très utilisé en France et au Maroc pour les agences multi-propriétés.",
    accessModality:
      "Compte Rentals United (~30 €/propriété/mois). API credentials dans Settings → Integration.",
    websiteUrl: 'https://rentalsunited.com',
    region: 'EU',
  },
  CHANNEX: {
    description:
      "Channel manager STR (UK). 100+ OTAs (Airbnb, Booking.com, Vrbo, Expedia, HomeToGo, Trip.com…). API REST moderne avec webhooks, documentation publique complète. Recommandé pour les conciergeries françaises 10-50 biens.",
    accessModality:
      "Compte Channex en pay-as-you-go (~10 £ / £8 / £6 par bien/mois selon le tier). Sandbox gratuit. API key dans le dashboard Channex après onboarding (<1 jour).",
    websiteUrl: 'https://channex.io',
    region: 'Global',
  },

  // ─── OTAs (channels de reservation) ────────────────────────────────────
  airbnb: {
    description:
      "Leader mondial de la location courte durée. Connexion OAuth2 native via Airbnb Partner API. ~70 % des bookings courts séjours en France.",
    accessModality:
      "Compte Airbnb Partner (sur dossier). Client ID + Secret après validation. Scopes : listings, reservations, messaging.",
    websiteUrl: 'https://partners.airbnb.com',
    region: 'Global',
  },
  booking: {
    description:
      "Leader OTA hôtels et locations. Très fort en Europe, croissance MENA. Connexion via Booking.com Connectivity (API XML) — hotelId + credentials.",
    accessModality:
      "Compte Booking.com Extranet Pro + demande accès Connectivity (~2-4 semaines de validation). Username + Password fournis par le compte manager.",
    websiteUrl: 'https://connect.booking.com',
    region: 'Global',
  },
  expedia: {
    description:
      "Leader OTA US + groupe Expedia (Hotels.com, Vrbo, Trivago). Connexion via Expedia Partner Solutions (EPS). API key + Secret.",
    accessModality:
      "Compte Expedia Partner Central + accès EPS sur dossier. API key + Secret après contractualisation.",
    websiteUrl: 'https://welcome.expediagroup.com',
    region: 'Global',
  },
  hotels: {
    description:
      "Filiale du groupe Expedia, focus marché US/EU. Partage la même API technique que Expedia (EPS). Visibilité additionnelle sur le réseau Hotels.com.",
    accessModality:
      "Inclus dans le contrat Expedia Partner Solutions. Propriétés activables individuellement via le Partner Central.",
    websiteUrl: 'https://www.hotels.com',
    region: 'Global',
  },
  agoda: {
    description:
      "OTA asiatique (Booking Holdings), focus Asie + MENA. Très utilisé par les touristes saoudiens et émiratis. API YCS (Yield Control System).",
    accessModality:
      "Compte Agoda Partner Hub + activation YCS API sur demande. propertyId + apiKey fournis par le compte manager.",
    websiteUrl: 'https://partnerhub.agoda.com',
    region: 'MENA',
  },
  tripcom: {
    description:
      "OTA chinois (Trip.com Group), accès aux touristes chinois et asiatiques. Croissance forte au Moyen-Orient. Connectivité via Open Distribution Platform (ODP).",
    accessModality:
      "Compte Trip.com Partner + accès ODP sur dossier. Partner ID + API key fournis après validation commerciale.",
    websiteUrl: 'https://www.trip.com',
    region: 'MENA',
  },
  vrbo: {
    description:
      "Filiale Expedia spécialisée location courte durée (ex-HomeAway US). Concurrent direct d'Airbnb sur le segment maisons / villas.",
    accessModality:
      "Compte Vrbo Partner Central. OAuth2 + listing ID. Accès aux API via le portail Expedia Partner Solutions.",
    websiteUrl: 'https://www.vrbo.com',
    region: 'Global',
  },
  abritel: {
    description:
      "Marque française du groupe Vrbo/Expedia, focus locations vacances FR. Partage l'infrastructure technique Vrbo (HomeAway API).",
    accessModality:
      "Inclus dans le contrat Vrbo Partner. Listing ID + OAuth tokens.",
    websiteUrl: 'https://www.abritel.fr',
    region: 'FR',
  },
  hometogo: {
    description:
      "Métamoteur allemand (Berlin) qui agrège 25M+ annonces de location. Distribution multi-OTA + connexion iCal pour propriétés individuelles.",
    accessModality:
      "Compte HomeToGo Partner + Partner ID + endpoint iCal de votre PMS. Validation manuelle des propriétés.",
    websiteUrl: 'https://www.hometogo.com',
    region: 'EU',
  },
  gathern: {
    description:
      "OTA saoudien spécialisé locations de chalets et villas. Très utilisé par les locaux KSA pour les week-ends et tourisme intérieur.",
    accessModality:
      "Compte Gathern Partner (validation locale + licence SCTH requise). API key fournie après onboarding.",
    websiteUrl: 'https://gathern.co',
    region: 'KSA',
  },
  rentelly: {
    description:
      "Plateforme B2B de courtage location courte durée (MENA). Connecte les hosts à des distributeurs grossistes locaux.",
    accessModality:
      "Compte Rentelly Partner. API key fournie après accord commercial.",
    websiteUrl: 'https://rentelly.com',
    region: 'MENA',
  },
  kease: {
    description:
      "Plateforme B2B MENA pour la distribution multi-OTA des locations courte durée. Focus marché saoudien et émirats.",
    accessModality:
      "Compte Kease Partner. API key + onboarding commercial requis.",
    websiteUrl: 'https://kease.app',
    region: 'MENA',
  },
  stay: {
    description:
      "Plateforme officielle saoudienne (SCTH — Saudi Commission for Tourism). Programme Stay.sa pour les hébergements licenciés.",
    accessModality:
      "Établissement licencié SCTH requis (KYC + classification touristique). API key fournie par l'autorité.",
    websiteUrl: 'https://stay.sa',
    region: 'KSA',
  },
  mabeet: {
    description:
      "Plateforme saoudienne de réservation B2B/B2C. Focus tourisme intérieur Royaume + voyageurs religieux (Mecque, Médine).",
    accessModality:
      "Compte Mabeet Partner. API key fournie après accord commercial + validation licence touristique.",
    websiteUrl: 'https://mabeet.com',
    region: 'KSA',
  },
  almosafer: {
    description:
      "Leader OTA Arabie Saoudite (groupe Seera). ~6M utilisateurs actifs/mois. Très différenciant pour capter le marché saoudien — aucun PMS occidental ne l'intègre nativement.",
    accessModality:
      "Contrat partenaire Seera Group requis (validation commerciale longue). API key + endpoints fournis après accord.",
    websiteUrl: 'https://www.almosafer.com',
    region: 'KSA',
  },
  tajawal: {
    description:
      "OTA MENA (groupe Seera, propriétaire d'Almosafer). N°1 sur les courts séjours MENA. Forte présence Émirats, Arabie, Égypte.",
    accessModality:
      "Inclus dans le contrat Seera Group (idem Almosafer). Activation des propriétés au cas par cas.",
    websiteUrl: 'https://www.tajawal.com',
    region: 'MENA',
  },
  wego: {
    description:
      "Métamoteur dominant en KSA + EAU + Maroc (basé à Dubaï). Distribue vers 100+ OTAs partenaires.",
    accessModality:
      "Compte Wego Partner (validation manuelle). API key + Partner ID après accord.",
    websiteUrl: 'https://www.wego.com',
    region: 'MENA',
  },
};
