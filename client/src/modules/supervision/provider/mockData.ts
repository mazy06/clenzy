/* ============================================================
   Données de démo — Superviseur d'agents IA

   Port fidèle de `MON` (app.js) et `PORTFOLIO` (variants.js), normalisé
   dans les formes du data-contract :
   - le `valid` embarqué dans l'agent de la démo est remonté en PendingAction ;
   - le HTML (<b>…) est retiré (le front ne rend jamais de HTML brut — règle
     d'échappement CLAUDE.md ; l'emphase sera modélisée autrement si besoin).

   `task` / `motif` / `reasoning` / `feed.text` sont du contenu produit par
   l'agent (pas du chrome) → restent des chaînes (FR), pas des clés i18n.
   ============================================================ */

import type {
  OrchestratorSnapshot,
  PortfolioSnapshot,
} from '../types';

// ─── Helpers temps (ISO) ─────────────────────────────────────────────────────

function isoHoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** ISO du jour à HH:MM (pour le journal). */
function todayAtIso(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}

export type PropertyScenario = 'showcase' | 'calm';

/** Réservations mock référencées par les comètes (placeholders ; le mapping réel = Phase 5). */
export const MOCK_RESERVATION_FAMILLE_ROUX = 'resa-famille-roux';
export const MOCK_RESERVATION_LEA_MARCHAND = 'resa-lea-marchand';

// ─── Snapshot par logement ───────────────────────────────────────────────────

/**
 * Construit un OrchestratorSnapshot de démo pour un logement.
 * `showcase` = le scénario complet (1 act, 1 wait, 1 think, 2 veille).
 * `calm`     = un seul agent actif, rien à valider.
 */
export function buildPropertySnapshot(
  propertyId: string,
  scenario: PropertyScenario = 'showcase',
): OrchestratorSnapshot {
  if (scenario === 'calm') {
    return {
      scope: 'property',
      propertyId,
      online: true,
      summary: 'Coordonne 5 agents · tout est sous contrôle',
      globalAutonomy: 'notify',
      paused: false,
      agents: [
        { id: 'com', status: 'veille', autonomy: 'notify', task: 'Aucun message en attente', metrics: [{ label: 'messages traités', value: '12' }, { label: 'en autonomie', value: '98%' }] },
        { id: 'rev', status: 'veille', autonomy: 'notify', task: 'Tarifs alignés sur la demande', metrics: [{ label: 'revenu / nuit', value: '+8%' }, { label: 'ajustements', value: '6' }] },
        { id: 'ops', status: 'act', autonomy: 'full', task: 'Confirme le ménage du 8 juil. avec le prestataire', reservationId: null, metrics: [{ label: 'interventions', value: '4' }, { label: 'dans les temps', value: '100%' }] },
        { id: 'fin', status: 'veille', autonomy: 'suggest', task: 'À jour', metrics: [{ label: 'paiements', value: '9' }, { label: 'litige', value: '0' }] },
        { id: 'rep', status: 'veille', autonomy: 'suggest', task: 'Note moyenne 4,8 ★', metrics: [{ label: 'note moy.', value: '4,8★' }, { label: 'avis traités', value: '2' }] },
      ],
      pending: [],
      feed: [
        { id: 'f-c1', at: todayAtIso('13:50'), agentId: 'ops', text: 'Opérations a confirmé le créneau ménage du 8 juil.' },
        { id: 'f-c2', at: todayAtIso('11:12'), agentId: 'com', text: "Communication a envoyé les instructions d'arrivée à M. Chen" },
        { id: 'f-c3', at: todayAtIso('09:40'), agentId: 'fin', text: "Finance a encaissé l'acompte Airbnb (740 €)" },
      ],
      dayMetrics: { timeSaved: '2h10', autoActions: 11, awaiting: 0 },
    };
  }

  // showcase — logement vitrine
  return {
    scope: 'property',
    propertyId,
    online: true,
    summary: 'Coordonne 5 agents · 1 action attend ta validation',
    globalAutonomy: 'notify',
    paused: false,
    agents: [
      {
        id: 'com',
        status: 'act',
        autonomy: 'notify',
        task: 'Répond à un message Airbnb — Famille Roux',
        reservationId: MOCK_RESERVATION_FAMILLE_ROUX,
        metrics: [{ label: 'messages traités', value: '12' }, { label: 'en autonomie', value: '98%' }],
      },
      {
        id: 'rev',
        status: 'wait',
        autonomy: 'notify',
        task: 'Propose −12 % sur le 20–22 juil.',
        reservationId: MOCK_RESERVATION_LEA_MARCHAND,
        metrics: [{ label: 'revenu / nuit', value: '+8%' }, { label: 'ajustements', value: '6' }],
      },
      {
        id: 'ops',
        status: 'think',
        autonomy: 'full',
        task: 'Planifie le ménage du départ du 12 juil.',
        thinkingProgress: 62,
        metrics: [{ label: 'interventions', value: '4' }, { label: 'dans les temps', value: '100%' }],
      },
      {
        id: 'fin',
        status: 'veille',
        autonomy: 'suggest',
        task: 'À jour · prochaine clôture propriétaire le 31 juil.',
        metrics: [{ label: 'paiements', value: '9' }, { label: 'litige', value: '0' }],
      },
      {
        id: 'rep',
        status: 'veille',
        autonomy: 'suggest',
        task: 'Aucun nouvel avis · note moyenne 4,9 ★',
        metrics: [{ label: 'note moy.', value: '4,9★' }, { label: 'avis traités', value: '3' }],
      },
    ],
    pending: [
      {
        id: 'pa-rev-2022',
        agentId: 'rev',
        title: 'Baisser le tarif du 20–22 juil. de −12 %',
        motif: 'Faible demande détectée sur ce créneau (3 nuits libres à J−25).',
        reasoning:
          '3 nuits encore libres à J−25 sur ce créneau. Deux annonces comparables du Marais sont 9 à 14 % moins chères. Une baisse de 12 % porte la probabilité de réservation de 38 % à ~71 % sans descendre sous ton prix plancher (148 €/nuit).',
        reservationId: MOCK_RESERVATION_LEA_MARCHAND,
        createdAt: isoMinutesAgo(12),
        expiresAt: isoHoursFromNow(4),
      },
    ],
    feed: [
      { id: 'f-1', at: todayAtIso('14:32'), agentId: 'rev', text: 'Revenue a ajusté le tarif du 14–17 juil. (+8 %)' },
      { id: 'f-2', at: todayAtIso('14:30'), agentId: 'com', text: 'Communication a résolu un message voyageur en autonomie' },
      { id: 'f-3', at: todayAtIso('14:28'), agentId: 'ops', text: 'Opérations a créé une intervention ménage (départ du 12)' },
      { id: 'f-4', at: todayAtIso('14:21'), agentId: 'fin', text: 'Finance a rapproché un paiement Booking de 920 €' },
      { id: 'f-5', at: todayAtIso('14:09'), agentId: 'rep', text: 'Réputation a répondu à un avis 5★ en autonomie' },
    ],
    dayMetrics: { timeSaved: '3h40', autoActions: 18, awaiting: 1 },
  };
}

// ─── Agrégat portefeuille ────────────────────────────────────────────────────

/** Construit le PortfolioSnapshot de démo (8 logements ; cf. constante PORTFOLIO). */
export function buildPortfolioSnapshot(): PortfolioSnapshot {
  return {
    scope: 'portfolio',
    propertyCount: 8,
    online: true,
    globalAutonomy: 'notify',
    paused: false,
    agents: [
      {
        id: 'com',
        status: 'act',
        autonomy: 'notify',
        propertyCount: 3,
        task: 'Répond à 5 conversations voyageurs sur 3 logements',
        items: [
          { propertyId: 'p-marais', propertyName: 'Duplex Marais', status: 'act', task: 'Répond à un message Airbnb — Famille Roux' },
          { propertyId: 'p-montmartre', propertyName: 'Studio Montmartre', status: 'act', task: "Envoie les instructions d'arrivée à M. Chen" },
          { propertyId: 'p-bastille', propertyName: 'Appart. Bastille', status: 'think', task: 'Rédige une réponse à une demande tardive' },
        ],
      },
      {
        id: 'rev',
        status: 'wait',
        autonomy: 'notify',
        propertyCount: 3,
        task: '3 ajustements de prix attendent ta validation',
        items: [
          { propertyId: 'p-marais', propertyName: 'Duplex Marais', status: 'wait', task: 'Baisser le tarif du 20–22 juil. (−12 %)' },
          { propertyId: 'p-montmartre', propertyName: 'Studio Montmartre', status: 'wait', task: 'Monter le tarif du 2–4 août (+9 %)' },
          { propertyId: 'p-loft-bastille', propertyName: 'Loft Bastille', status: 'wait', task: 'Aligner le week-end du 26 juil. (−7 %)' },
        ],
      },
      {
        id: 'ops',
        status: 'act',
        autonomy: 'full',
        propertyCount: 2,
        task: 'Coordonne 2 ménages de départ',
        items: [
          { propertyId: 'p-marais', propertyName: 'Duplex Marais', status: 'act', task: 'Confirme le ménage du départ du 12' },
          { propertyId: 'p-canal', propertyName: 'Loft Canal St-Martin', status: 'think', task: 'Compare 2 créneaux prestataires' },
        ],
      },
      {
        id: 'fin',
        status: 'think',
        autonomy: 'suggest',
        propertyCount: 1,
        task: 'Rapproche les paiements du mois sur 1 logement',
        items: [
          { propertyId: 'p-montmartre', propertyName: 'Studio Montmartre', status: 'think', task: 'Rapproche un paiement Booking de 920 €' },
        ],
      },
      {
        id: 'rep',
        status: 'veille',
        autonomy: 'suggest',
        propertyCount: 0,
        task: 'Surveille les avis · note moyenne 4,9 ★ sur le portefeuille',
        items: [],
      },
    ],
    pending: [
      {
        id: 'gp-rev-marais',
        agentId: 'rev',
        propertyId: 'p-marais',
        propertyName: 'Duplex Marais',
        title: 'Baisser le tarif du 20–22 juil. de −12 %',
        motif: 'Faible demande détectée (3 nuits libres à J−25).',
        reasoning:
          'Deux annonces comparables du Marais sont 9 à 14 % moins chères. Une baisse de 12 % porte la probabilité de réservation de 38 % à ~71 % sans descendre sous ton prix plancher.',
        reservationId: MOCK_RESERVATION_LEA_MARCHAND,
        createdAt: isoMinutesAgo(18),
        expiresAt: isoHoursFromNow(4),
      },
      {
        id: 'gp-rev-montmartre',
        agentId: 'rev',
        propertyId: 'p-montmartre',
        propertyName: 'Studio Montmartre',
        title: 'Monter le tarif du 2–4 août de +9 %',
        motif: 'Pic de demande détecté (festival du quartier).',
        reasoning:
          'Le taux de recherche sur ce créneau est 2,3× supérieur à la normale et il ne reste que 2 nuits libres. +9 % reste sous le prix des 3 annonces concurrentes encore disponibles.',
        createdAt: isoMinutesAgo(9),
        expiresAt: isoHoursFromNow(5),
      },
      {
        id: 'gp-ops-bastille',
        agentId: 'ops',
        propertyId: 'p-loft-bastille',
        propertyName: 'Loft Bastille',
        title: 'Remplacer le prestataire ménage du 14 juil.',
        motif: "Le prestataire habituel s'est désisté.",
        reasoning:
          'Un prestataire noté 4,8 ★ est disponible sur le même créneau, au même tarif. Sans action, le ménage du départ du 14 ne serait pas couvert.',
        createdAt: isoMinutesAgo(5),
        expiresAt: isoHoursFromNow(6),
      },
    ],
    feed: [
      { id: 'gf-1', at: todayAtIso('14:32'), agentId: 'rev', propertyName: 'Duplex Marais', text: 'Revenue a ajusté le tarif du 14–17 juil. (+8 %)' },
      { id: 'gf-2', at: todayAtIso('14:30'), agentId: 'com', propertyName: 'Studio Montmartre', text: 'Communication a résolu un message voyageur' },
      { id: 'gf-3', at: todayAtIso('14:28'), agentId: 'ops', propertyName: 'Loft Canal St-Martin', text: 'Opérations a créé une intervention ménage' },
      { id: 'gf-4', at: todayAtIso('14:18'), agentId: 'fin', propertyName: 'Appart. Bastille', text: 'Finance a clôturé un relevé propriétaire' },
    ],
    dayMetrics: { timeSaved: '14h20', autoActions: 83, awaiting: 3 },
  };
}
