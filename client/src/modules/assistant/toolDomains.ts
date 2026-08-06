/* ============================================================
   Traduction outil → domaine métier + nature (lecture / écriture)

   L'UI de l'assistant ne montre JAMAIS le nom technique d'un outil
   (`get_dashboard_summary`) : c'est du jargon LLM, proscrit côté produit
   (cf. la même règle sur la constellation de supervision). On expose à la
   place le DOMAINE touché et la NATURE de l'accès :
   « Calendrier consulté », « Tarifs mis à jour ».

   Regrouper par domaine plutôt que traduire les 66 outils un par un a deux
   vertus : le libellé reste juste quand un outil est ajouté (repli `data`),
   et la charge de traduction reste bornée (10 domaines × 2 natures).
   ============================================================ */

export type ToolDomain =
  | 'calendar'
  | 'pricing'
  | 'messaging'
  | 'operations'
  | 'finance'
  | 'reviews'
  | 'properties'
  | 'channels'
  | 'knowledge'
  | 'data';

const DOMAIN_BY_TOOL: Record<string, ToolDomain> = {
  // Calendrier & réservations
  get_availability: 'calendar',
  block_calendar_day: 'calendar',
  batch_block_calendar: 'calendar',
  preview_batch_block_calendar: 'calendar',
  simulate_calendar_block: 'calendar',
  list_reservations: 'calendar',
  get_reservation_details: 'calendar',
  get_reservation_trend: 'calendar',
  create_reservation: 'calendar',
  cancel_reservation: 'calendar',
  update_reservation_status: 'calendar',
  get_occupancy_forecast: 'calendar',
  forecast_demand_longterm: 'calendar',

  // Tarification
  set_rate_override: 'pricing',
  simulate_pricing_change: 'pricing',
  recommend_price_adjustments: 'pricing',
  get_price_quote: 'pricing',
  check_rate_parity: 'pricing',
  benchmark_market: 'pricing',

  // Voyageurs & messages
  send_guest_message: 'messaging',
  list_guests: 'messaging',
  segment_guests: 'messaging',
  suggest_upsells: 'messaging',

  // Opérations & interventions
  create_intervention: 'operations',
  assign_intervention: 'operations',
  update_intervention_status: 'operations',
  get_interventions_by_status: 'operations',
  list_cleaning_tasks: 'operations',
  get_ops_analytics: 'operations',
  predict_maintenance_needs: 'operations',
  detect_operational_risks: 'operations',
  get_noise_alerts: 'operations',

  // Finance
  create_invoice: 'finance',
  list_invoices: 'finance',
  initiate_refund: 'finance',
  settle_intervention_payment: 'finance',
  send_owner_statement: 'finance',
  get_financial_summary: 'finance',
  get_owner_payout_summary: 'finance',
  get_billing_overview: 'finance',
  detect_unpaid_interventions: 'finance',
  get_property_pnl: 'finance',
  compute_tourist_tax: 'finance',

  // Réputation
  reply_to_review: 'reviews',
  list_reviews: 'reviews',
  analyze_reviews: 'reviews',

  // Logements
  list_properties: 'properties',
  get_property_details: 'properties',
  get_property_amenities: 'properties',
  get_properties_performance: 'properties',
  update_property_status: 'properties',

  // Canaux de distribution
  trigger_channel_sync: 'channels',
  open_close_channel_availability: 'channels',
  get_channel_sync_status: 'channels',
  get_channel_attribution: 'channels',

  // Connaissance & mémoire
  search_knowledge_base: 'knowledge',
  remember_fact: 'knowledge',
  forget_fact: 'knowledge',
};

/**
 * Outils d'ÉCRITURE — miroir des `ToolDescriptor.write(...)` côté serveur
 * (`server/src/main/java/com/clenzy/service/agent/tools`). Sert au libellé
 * (« mis à jour » plutôt que « consulté ») ; ce n'est PAS un garde-fou :
 * l'autorisation d'écrire et la pause de confirmation restent serveur.
 */
const WRITE_TOOLS = new Set<string>([
  'assign_intervention',
  'batch_block_calendar',
  'block_calendar_day',
  'cancel_reservation',
  'create_intervention',
  'create_invoice',
  'create_reservation',
  'forget_fact',
  'initiate_refund',
  'open_close_channel_availability',
  'reply_to_review',
  'send_guest_message',
  'send_owner_statement',
  'set_rate_override',
  'settle_intervention_payment',
  'trigger_channel_sync',
  'update_intervention_status',
  'update_property_status',
  'update_reservation_status',
]);

/** Domaine métier d'un outil ; `data` pour tout outil transverse ou inconnu. */
export function toolDomainOf(toolName: string | undefined | null): ToolDomain {
  if (!toolName) return 'data';
  return DOMAIN_BY_TOOL[toolName] ?? 'data';
}

export function isWriteTool(toolName: string | undefined | null): boolean {
  return toolName != null && WRITE_TOOLS.has(toolName);
}

/** Clé i18n du libellé affiché pour un outil exécuté. */
export function toolLabelKey(toolName: string | undefined | null): string {
  return `assistant.tool.${toolDomainOf(toolName)}.${isWriteTool(toolName) ? 'write' : 'read'}`;
}
