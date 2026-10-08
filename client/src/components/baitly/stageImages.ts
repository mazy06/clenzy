/**
 * Baitly — registre des illustrations générées pour les scènes « bleu nuit ».
 *
 * Toutes viennent des jeux déjà livrés dans `public/images/` (natures mortes en
 * bleu nuit, ivoire et laiton) : aucune image nouvelle, donc aucune dérive de
 * style entre les écrans de première arrivée et le reste de l'application.
 *
 * On référence ici un NOM SÉMANTIQUE (`calendar`, `cleaning`…) plutôt qu'un
 * chemin : si une illustration est remplacée, un seul fichier bouge.
 */
const hitl = (name: string) => `/images/hitl/${name}.webp`;
const kpi = (name: string) => `/images/dashboard-kpis/${name}.webp`;
const finance = (name: string) => `/images/finance-kpis/${name}.png`;
const property = (name: string) => `/images/property-metrics/${name}.webp`;
const device = (name: string) => `/images/connected-devices/${name}.webp`;
const notification = (name: string) => `/images/notifications/${name}.webp`;

export const STAGE_IMAGES = {
  // Planning, canaux, calendrier
  calendar: hitl('calendar'),
  channelSync: hitl('channel-sync'),
  distribution: hitl('distribution'),
  syncProblem: hitl('sync-problem'),
  overbooking: hitl('overbooking'),
  // Opérations
  cleaning: hitl('cleaning'),
  maintenance: hitl('maintenance'),
  propertyMaintenance: hitl('property-maintenance'),
  assignment: hitl('assignment'),
  workReview: hitl('work-review'),
  providerSearch: hitl('provider-search'),
  departures: '/images/dashboard-operations/departures.webp',
  cleanings: '/images/dashboard-operations/cleanings.webp',
  // Voyageurs et communication
  conversation: hitl('conversation'),
  welcomeGuide: hitl('welcome-guide'),
  travelerForm: hitl('traveler-form'),
  guestExperience: hitl('guest-experience'),
  lateCheckout: hitl('late-checkout'),
  reviews: hitl('reviews'),
  translation: hitl('translation'),
  inbox: '/images/dashboard-actions/messages.webp',
  // Argent et documents
  pricing: hitl('pricing'),
  pricingSeasons: hitl('pricing-optimization'),
  pricingUp: hitl('pricing-increase'),
  promotion: hitl('promotion-end'),
  payment: hitl('payment'),
  paymentReminder: hitl('payment-reminder'),
  deposit: hitl('deposit'),
  refund: hitl('refund'),
  ownerTransfer: hitl('owner-transfer'),
  serviceTransfer: hitl('service-transfer'),
  ownerReport: hitl('owner-report'),
  touristTax: hitl('tourist-tax'),
  mandate: hitl('management-contract'),
  quotes: hitl('quotes'),
  approval: hitl('approval'),
  security: hitl('security'),
  // Indicateurs du tableau de bord
  adr: kpi('adr'),
  bookings: kpi('bookings'),
  occupancy: kpi('occupancy'),
  rating: kpi('rating'),
  revenue: kpi('revenue'),
  revpan: kpi('revpan'),
  // Finances
  received: finance('received'),
  pending: finance('pending'),
  transfer: finance('transfer'),
  documents: finance('documents'),
  // Fiche logement
  photos: property('photos'),
  bedrooms: property('bedrooms'),
  bathrooms: property('bathrooms'),
  capacity: property('capacity'),
  surface: property('surface'),
  // Pilotage
  automation: '/images/portfolio-metrics/automated-actions.webp',
  timeSaved: '/images/portfolio-metrics/time-saved.webp',
  pendingReview: '/images/portfolio-metrics/pending-review.webp',
  assistant: '/images/assistant/baitly-assistant.webp',
  taskAssigned: '/images/dashboard-actions/intervention-assignment.webp',
  taskOverdue: '/images/dashboard-actions/intervention-overdue.webp',
  servicePayment: '/images/dashboard-actions/service-payment.webp',
  // Objets connectés
  lock: device('baitly-lock'),
  noiseSensor: device('baitly-noise'),
  thermostat: device('baitly-thermostat'),
  keybox: device('baitly-keybox'),
  smoke: device('baitly-smoke'),
  motion: device('baitly-motion'),
  camera: device('baitly-camera'),
  accessCode: notification('access-code'),
  // Équipe
  team: notification('team-assigned'),
  teamDirectory: notification('team-directory'),
  profile: notification('user-profile'),
  bell: notification('automation'),
  messageReceived: notification('message-received'),
  property: notification('property'),
  reservation: notification('reservation'),
  document: notification('document'),
} as const;

export type StageImageKey = keyof typeof STAGE_IMAGES;

/** Photographies de logement déjà livrées avec l'application (voir `assets/images`). */
export { default as apartmentPhoto } from '../../assets/images/appartement.png';
export { default as villaPhoto } from '../../assets/images/villa.png';
export { default as loftPhoto } from '../../assets/images/loft.png';
