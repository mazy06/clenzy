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
  Agent,
  AgentId,
  AgentMetric,
  AgentStatus,
  AutonomyLevel,
  FeedEntry,
  OrchestratorSnapshot,
  PendingAction,
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

export type PropertyScenario = 'showcase' | 'calm' | 'demo';

/** Réservations mock référencées par les comètes (placeholders ; le mapping réel = Phase 5). */
export const MOCK_RESERVATION_FAMILLE_ROUX = 'resa-famille-roux';
export const MOCK_RESERVATION_LEA_MARCHAND = 'resa-lea-marchand';

// ─── Snapshot par logement (démo VARIÉE par logement) ─────────────────────────
// En mode démo, chaque logement affiche une situation différente (états d'agents,
// orbites/autonomie, cartes à valider, journal « En direct ») pour visualiser
// TOUTES les possibilités. Déterministe : dérivé d'un hash de l'id du logement.

const AGENT_ORDER: AgentId[] = ['com', 'rev', 'ops', 'fin', 'rep'];

const AGENT_METRICS: Record<AgentId, AgentMetric[]> = {
  com: [{ label: "messages traités", value: "12" }, { label: "en autonomie", value: "98%" }],
  rev: [{ label: "revenu / nuit", value: "+8%" }, { label: "ajustements", value: "6" }],
  ops: [{ label: "interventions", value: "4" }, { label: "dans les temps", value: "100%" }],
  fin: [{ label: "paiements", value: "9" }, { label: "litige", value: "0" }],
  rep: [{ label: "note moy.", value: "4,9★" }, { label: "avis traités", value: "3" }],
};

interface Sit { status: AgentStatus; autonomy: AutonomyLevel; task: string; thinkingProgress?: number }

// 6 situations : couvrent act / think / wait / veille / esc + autonomies suggest / notify / full.
const SITUATIONS: Record<AgentId, Sit>[] = [
  {
    com: { status: "act", autonomy: "notify", task: "Répond à un message Airbnb — Famille Roux" },
    rev: { status: "wait", autonomy: "notify", task: "Propose −12 % sur le 20–22 juil." },
    ops: { status: "think", autonomy: "full", task: "Planifie le ménage du départ du 12 juil.", thinkingProgress: 62 },
    fin: { status: "veille", autonomy: "suggest", task: "À jour · clôture propriétaire le 31 juil." },
    rep: { status: "veille", autonomy: "suggest", task: "Aucun nouvel avis · 4,9 ★" },
  },
  {
    com: { status: "veille", autonomy: "notify", task: "Aucun message en attente" },
    rev: { status: "act", autonomy: "full", task: "Applique une hausse +6 % sur le pont du 15" },
    ops: { status: "veille", autonomy: "notify", task: "Interventions à jour" },
    fin: { status: "wait", autonomy: "suggest", task: "Intervention à régler — Reprise d’enduit" },
    rep: { status: "veille", autonomy: "suggest", task: "Note moyenne 4,8 ★" },
  },
  {
    com: { status: "act", autonomy: "notify", task: "Traite une demande de check-in anticipé" },
    rev: { status: "esc", autonomy: "notify", task: "Écart de parité détecté sur Booking" },
    ops: { status: "act", autonomy: "full", task: "Assigne l’équipe ménage du 8" },
    fin: { status: "veille", autonomy: "suggest", task: "À jour" },
    rep: { status: "think", autonomy: "suggest", task: "Analyse un avis 2 ★", thinkingProgress: 40 },
  },
  {
    com: { status: "veille", autonomy: "notify", task: "Messages traités" },
    rev: { status: "veille", autonomy: "full", task: "Tarifs alignés sur la demande" },
    ops: { status: "act", autonomy: "full", task: "Coordonne 3 interventions aujourd’hui" },
    fin: { status: "act", autonomy: "notify", task: "Émet la facture du séjour clôturé" },
    rep: { status: "veille", autonomy: "suggest", task: "4,9 ★" },
  },
  {
    com: { status: "act", autonomy: "full", task: "Relance un panier abandonné (2 nuits)" },
    rev: { status: "veille", autonomy: "notify", task: "Aucun ajustement nécessaire" },
    ops: { status: "veille", autonomy: "suggest", task: "Prochain ménage le 9" },
    fin: { status: "veille", autonomy: "suggest", task: "À jour" },
    rep: { status: "act", autonomy: "notify", task: "Répond à un avis 5 ★" },
  },
  {
    com: { status: "veille", autonomy: "suggest", task: "Messages traités" },
    rev: { status: "veille", autonomy: "notify", task: "Tarifs à jour" },
    ops: { status: "veille", autonomy: "full", task: "Interventions planifiées" },
    fin: { status: "veille", autonomy: "suggest", task: "À jour" },
    rep: { status: "wait", autonomy: "notify", task: "Propose une réponse à un avis 3 ★" },
  },
];

const SUMMARIES = [
  "Coordonne 5 agents · 1 action attend ta validation",
  "Coordonne 5 agents · Revenue optimise en autonomie",
  "Coordonne 5 agents · attention requise",
  "Coordonne 5 agents · opérations en cours",
  "Coordonne 5 agents · relation voyageur active",
  "Coordonne 5 agents · tout est sous contrôle",
];
const GLOBAL_AUTONOMY: AutonomyLevel[] = ["notify", "full", "notify", "full", "notify", "suggest"];

const FEED_POOL: { agentId: AgentId; text: string }[] = [
  { agentId: "rev", text: "Revenue a ajusté le tarif du 14–17 juil. (+8 %)" },
  { agentId: "rev", text: "Revenue a appliqué une baisse last-minute (−12 %) sur le week-end" },
  { agentId: "rev", text: "Revenue a ouvert la disponibilité Booking pour le pont du 15" },
  { agentId: "com", text: "Communication a résolu un message voyageur en autonomie" },
  { agentId: "com", text: "Communication a envoyé les instructions d’arrivée" },
  { agentId: "com", text: "Communication a relancé un panier abandonné (2 nuits)" },
  { agentId: "ops", text: "Opérations a créé une intervention ménage (départ du 12)" },
  { agentId: "ops", text: "Opérations a assigné l’équipe Entretien au check-out du 8" },
  { agentId: "ops", text: "Opérations a confirmé la maintenance climatisation" },
  { agentId: "fin", text: "Finance a rapproché un paiement Booking de 920 €" },
  { agentId: "fin", text: "Finance a émis la facture #2026-0142 (250 €)" },
  { agentId: "fin", text: "Finance a clôturé le relevé propriétaire de juin" },
  { agentId: "fin", text: "Finance a initié un remboursement partiel (annulation)" },
  { agentId: "rep", text: "Réputation a répondu à un avis 5★ en autonomie" },
  { agentId: "rep", text: "Réputation a signalé un avis 2★ à modérer" },
  { agentId: "com", text: "Communication a confirmé un check-in anticipé" },
];

const FEED_TIMES = ["14:32", "14:21", "13:58", "13:40", "12:15", "11:12", "10:04", "09:22"];

/** Hash simple et stable de l'id → variété déterministe par logement. */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function buildFeed(seed: number): FeedEntry[] {
  return FEED_TIMES.map((time, k) => {
    const item = FEED_POOL[(seed + k) % FEED_POOL.length];
    return { id: `f-${seed}-${k}`, at: todayAtIso(time), agentId: item.agentId, text: item.text };
  });
}

function buildPending(seed: number, propertyId: string): PendingAction[] {
  const variant = seed % 4; // 0 = rien, 1 = suggestion prix, 2 = paiement, 3 = les deux
  const out: PendingAction[] = [];
  if (variant === 1 || variant === 3) {
    out.push({
      id: `pa-rev-${propertyId}`,
      agentId: "rev",
      title: "Baisser le tarif du 20–22 juil. de −12 %",
      motif: "Faible demande détectée sur ce créneau (3 nuits libres à J−25).",
      reasoning:
        "3 nuits libres à J−25. Deux annonces comparables sont 9 à 14 % moins chères. Une baisse de 12 % porte la probabilité de réservation de 38 % à ~71 % sans passer sous ton prix plancher.",
      createdAt: isoMinutesAgo(12),
      expiresAt: isoHoursFromNow(4),
      applyActionType: "PRICE_DROP",
      amountEur: 46,
    });
  }
  if (variant === 2 || variant === 3) {
    out.push({
      id: `pa-fin-${propertyId}`,
      agentId: "fin",
      title: "Régler une intervention de maintenance",
      motif: "Intervention terminée en attente de règlement.",
      reasoning:
        "Une intervention « Reprise d’enduit / plâtre » est terminée et attend le règlement pour être clôturée.",
      createdAt: isoMinutesAgo(30),
      expiresAt: isoHoursFromNow(8),
      kind: "payment",
      amountEur: 138,
    });
  }
  return out;
}

/**
 * Construit un OrchestratorSnapshot de démo pour un logement.
 * `demo`     = situation VARIÉE selon l'id du logement (exhaustif, mode démo planning).
 * `showcase` = scénario vitrine STABLE (1 act, 1 wait, 1 think, 2 veille) — défaut, tests.
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
        { id: 'com', status: 'veille', autonomy: 'notify', task: 'Aucun message en attente', metrics: AGENT_METRICS.com },
        { id: 'rev', status: 'veille', autonomy: 'notify', task: 'Tarifs alignés sur la demande', metrics: AGENT_METRICS.rev },
        { id: 'ops', status: 'act', autonomy: 'full', task: 'Confirme le ménage du 8 juil. avec le prestataire', reservationId: null, metrics: AGENT_METRICS.ops },
        { id: 'fin', status: 'veille', autonomy: 'suggest', task: 'À jour', metrics: AGENT_METRICS.fin },
        { id: 'rep', status: 'veille', autonomy: 'suggest', task: 'Note moyenne 4,8 ★', metrics: AGENT_METRICS.rep },
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

  // demo — situation dérivée de l'id : variété exhaustive entre logements
  // (états d'agents, orbites, cartes à valider + paiement, journal). Mode démo planning.
  if (scenario === 'demo') {
    const seed = hashSeed(propertyId);
    const idx = seed % SITUATIONS.length;
    const situation = SITUATIONS[idx];
    const agents: Agent[] = AGENT_ORDER.map((id) => ({
      id,
      status: situation[id].status,
      autonomy: situation[id].autonomy,
      task: situation[id].task,
      thinkingProgress: situation[id].thinkingProgress,
      metrics: AGENT_METRICS[id],
    }));
    const pending = buildPending(seed, propertyId);
    return {
      scope: 'property',
      propertyId,
      online: true,
      paused: false,
      summary: SUMMARIES[idx],
      globalAutonomy: GLOBAL_AUTONOMY[idx],
      agents,
      pending,
      feed: buildFeed(seed % FEED_POOL.length),
      dayMetrics: { timeSaved: `${2 + (seed % 4)}h${(seed % 6) * 10}`, autoActions: 8 + (seed % 20), awaiting: pending.length },
    };
  }

  // showcase — logement vitrine STABLE (défaut ; utilisé par les tests).
  return {
    scope: 'property',
    propertyId,
    online: true,
    summary: 'Coordonne 5 agents · 1 action attend ta validation',
    globalAutonomy: 'notify',
    paused: false,
    agents: [
      { id: 'com', status: 'act', autonomy: 'notify', task: 'Répond à un message Airbnb — Famille Roux', reservationId: MOCK_RESERVATION_FAMILLE_ROUX, metrics: AGENT_METRICS.com },
      { id: 'rev', status: 'wait', autonomy: 'notify', task: 'Propose −12 % sur le 20–22 juil.', reservationId: MOCK_RESERVATION_LEA_MARCHAND, metrics: AGENT_METRICS.rev },
      { id: 'ops', status: 'think', autonomy: 'full', task: 'Planifie le ménage du départ du 12 juil.', thinkingProgress: 62, metrics: AGENT_METRICS.ops },
      { id: 'fin', status: 'veille', autonomy: 'suggest', task: 'À jour · prochaine clôture propriétaire le 31 juil.', metrics: AGENT_METRICS.fin },
      { id: 'rep', status: 'veille', autonomy: 'suggest', task: 'Aucun nouvel avis · note moyenne 4,9 ★', metrics: AGENT_METRICS.rep },
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
