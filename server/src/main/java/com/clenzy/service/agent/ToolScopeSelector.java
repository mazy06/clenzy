package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ToolDescriptor;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Sélection des outils exposés au LLM par PERTINENCE, pour le chemin mono-agent.
 *
 * <p><b>Pourquoi</b> : le mono-agent envoyait ses ~60 {@link ToolDescriptor}
 * (descriptions + JSON schemas ≈ 4,9k tokens) à CHAQUE appel LLM, ré-payés à
 * chaque itération de la boucle d'outils. La grande majorité est hors-sujet pour
 * une requête donnée. On réduit l'ensemble à un <b>socle transverse</b> +
 * les outils du/des <b>domaine(s)</b> détecté(s) dans le message utilisateur.</p>
 *
 * <p><b>Détection par domaine, pas par outil</b> : on matche des <i>stems</i>
 * (racines de mots, sans accents) sur les derniers messages utilisateur, et on
 * expose l'ENSEMBLE cohérent d'outils du domaine (ex. « bilan » → tous les outils
 * finance). Grossier volontairement : il suffit de reconnaître le DOMAINE, pas
 * l'outil exact — bien plus robuste qu'un scoring par mot-clé fin.</p>
 *
 * <p><b>Dégradations sûres</b> : aucun domaine reconnu → socle + staples communs ;
 * dépassement du plafond → on garde le socle + le reste dans l'ordre du registre ;
 * résultat vide (ne devrait pas arriver, le socle est non vide) → repli sur la
 * liste complète. Un nom d'outil inconnu dans les tables ci-dessous est ignoré
 * silencieusement (on filtre la liste réelle role-filtrée).</p>
 *
 * <p>Stateless (utilitaire statique pur, comme {@link RoleToolPolicy}). N'affecte
 * QUE le mono-agent : le multi-agent scope déjà via ses specialists (≤10 outils),
 * et les rôles opérationnels sont déjà réduits à 5 outils en amont.</p>
 */
public final class ToolScopeSelector {

    private ToolScopeSelector() {}

    /** Kill-switch de compilation : repasser à false rétablit l'envoi de tous les outils. */
    private static final boolean ENABLED = true;

    /** Plafond de sécurité : jamais plus d'outils exposés que ça (l'union de domaines reste bornée). */
    private static final int MAX_EXPOSED = 26;

    /** En-deçà de ce nombre d'outils disponibles, on ne scope pas (déjà petit — ex. rôle opérationnel). */
    private static final int MIN_TO_SCOPE = 14;

    /** Nombre de derniers messages utilisateur pris en compte pour le scoring (contexte des follow-ups). */
    private static final int USER_MESSAGES_SCANNED = 3;

    /** Outils transverses toujours exposés (méta / utiles quel que soit le domaine). */
    private static final Set<String> CORE = Set.of(
            "suggest_navigation",
            "search_knowledge_base",
            "remember_fact",
            "forget_fact",
            "get_dashboard_summary",
            "get_business_insights");

    /** Staples de lecture exposés quand AUCUN domaine n'est reconnu (message vague mais actionnable). */
    private static final Set<String> GENERAL_FALLBACK = Set.of(
            "list_properties",
            "get_property_details",
            "list_reservations",
            "get_reservation_details",
            "get_availability",
            "get_financial_summary",
            "get_interventions_by_status",
            "list_guests");

    /** Un domaine = des racines de mots à reconnaître + l'ensemble cohérent d'outils à exposer. */
    private record Domain(Set<String> stems, Set<String> tools) {}

    private static final List<Domain> DOMAINS = List.of(
            new Domain(
                    Set.of("finance", "financ", "bilan", "chiffre", "affaire", "revenu", "depense",
                            "profit", "rentab", "facture", "invoice", "paiement", "payer", "payout",
                            "versement", "billing", "impaye", "regler", "encaiss", "marge", "pnl"),
                    Set.of("get_financial_summary", "get_billing_overview", "list_invoices",
                            "create_invoice", "get_owner_payout_summary", "get_property_pnl",
                            "detect_unpaid_interventions", "settle_intervention_payment", "get_price_quote")),
            new Domain(
                    Set.of("menage", "intervention", "maintenance", "technicien", "nettoy", "checkin",
                            "checkout", "tache", "assign", "planifi", "reparation", "prestataire"),
                    Set.of("create_intervention", "assign_intervention", "update_intervention_status",
                            "get_interventions_by_status", "list_cleaning_tasks",
                            "predict_maintenance_needs", "detect_operational_risks")),
            new Domain(
                    Set.of("reserv", "resa", "sejour", "arrivee", "depart", "voyageur",
                            "booking", "nuitee", "nuit"),
                    Set.of("list_reservations", "get_reservation_details", "create_reservation",
                            "cancel_reservation", "update_reservation_status", "get_reservation_trend")),
            new Domain(
                    Set.of("calendrier", "dispo", "disponib", "occupation", "bloqu", "planning", "agenda"),
                    Set.of("get_availability", "block_calendar_day", "batch_block_calendar",
                            "preview_batch_block_calendar", "simulate_calendar_block",
                            "get_occupancy_forecast")),
            new Domain(
                    // « demande » retiré (T-04) : verbe francais ultra-courant (« je te
                    // demande... ») → exposait les outils pricing hors sujet. La prevision
                    // de demande reste couverte par « forecast » / « prevision ».
                    Set.of("prix", "tarif", "pricing", "tarification", "saison", "override", "augment",
                            "baiss", "yield", "benchmark", "concurrent", "concurrence", "prevision",
                            "upsell", "forecast"),
                    Set.of("recommend_price_adjustments", "simulate_pricing_change", "set_rate_override",
                            "get_price_quote", "benchmark_competition", "forecast_demand_longterm",
                            "suggest_upsells", "get_occupancy_forecast")),
            new Domain(
                    Set.of("logement", "propriete", "appartement", "studio", "amenity", "equipement",
                            "photo", "adresse"),
                    Set.of("list_properties", "get_property_details", "get_property_amenities",
                            "update_property_status", "get_properties_performance")),
            new Domain(
                    Set.of("analyse", "analyt", "kpi", "performance", "tendance", "portefeuille",
                            "portfolio", "statistiq", "rapport", "insight", "risque"),
                    Set.of("analyze_portfolio", "get_ops_analytics", "get_properties_performance",
                            "get_reservation_trend", "detect_operational_risks", "get_business_insights")),
            new Domain(
                    Set.of("message", "guest", "client", "avis", "review", "repond", "email",
                            "whatsapp", "envoi", "envoy", "segment", "annulation", "communiqu"),
                    Set.of("send_guest_message", "list_guests", "segment_guests", "list_reviews",
                            "analyze_reviews", "reply_to_review")),
            new Domain(
                    Set.of("channel", "airbnb", "booking", "vrbo", "ical", "attribution", "canal",
                            "synchro", "sync"),
                    Set.of("get_channel_sync_status", "get_channel_attribution")),
            new Domain(
                    // « temps » (« combien de temps... »), « local », « activite », « sortie »
                    // retires (T-04) : mots francais trop generiques → outils meteo exposes
                    // hors sujet. Les intentions meteo/evenements restent couvertes par les
                    // stems specifiques ci-dessous.
                    Set.of("meteo", "weather", "pluie", "neige", "canicule", "evenement",
                            "concert", "festival", "tourisme", "touristiq"),
                    Set.of("get_weather_forecast", "get_local_events")),
            new Domain(
                    Set.of("bruit", "noise", "sonore", "decibel", "capteur", "nuisance"),
                    Set.of("get_noise_alerts")),
            new Domain(
                    // Pas de stem générique « comment » (aimant à faux positifs : toute
                    // question française « comment… » + « commentaire »).
                    Set.of("workflow", "procedure", "guide", "etape", "checklist"),
                    Set.of("start_workflow", "advance_workflow")));

    /**
     * Réduit {@code roleTools} aux outils pertinents pour la conversation.
     *
     * @param roleTools outils déjà filtrés par rôle (source de vérité de l'ordre/registre)
     * @param history   historique LLM courant (on lit les derniers messages utilisateur)
     * @return sous-ensemble pertinent (ou {@code roleTools} tel quel si scoping désactivé/inapplicable)
     */
    public static List<ToolDescriptor> select(List<ToolDescriptor> roleTools, List<ChatMessage> history) {
        if (!ENABLED || roleTools == null || roleTools.size() <= MIN_TO_SCOPE) {
            return roleTools;
        }

        final Set<String> tokens = tokenize(recentUserText(history));

        final Set<String> selected = new LinkedHashSet<>(CORE);
        boolean anyDomain = false;
        for (Domain domain : DOMAINS) {
            if (matches(domain.stems(), tokens)) {
                selected.addAll(domain.tools());
                anyDomain = true;
            }
        }
        if (!anyDomain) {
            selected.addAll(GENERAL_FALLBACK);
        }

        // Matérialisation dans l'ordre du registre (ignore silencieusement les noms inconnus).
        List<ToolDescriptor> result = new ArrayList<>();
        for (ToolDescriptor d : roleTools) {
            if (selected.contains(d.name())) {
                result.add(d);
            }
        }

        if (result.isEmpty()) {
            return roleTools; // garde-fou : ne jamais priver le LLM de tous ses outils
        }
        return result.size() > MAX_EXPOSED ? cap(result) : result;
    }

    /** Plafonne en préservant d'abord le socle transverse, puis le reste dans l'ordre du registre. */
    private static List<ToolDescriptor> cap(List<ToolDescriptor> tools) {
        List<ToolDescriptor> capped = new ArrayList<>(MAX_EXPOSED);
        for (ToolDescriptor d : tools) {
            if (CORE.contains(d.name())) {
                capped.add(d);
            }
        }
        for (ToolDescriptor d : tools) {
            if (capped.size() >= MAX_EXPOSED) {
                break;
            }
            if (!CORE.contains(d.name())) {
                capped.add(d);
            }
        }
        return capped;
    }

    /**
     * Longueur en-deca de laquelle un stem est trop court pour un match par
     * prefixe fiable (T-04) : « prix » prefixerait « prixation »?, mais surtout
     * « nuit » matcherait « nuitamment », « avis » → « aviser », etc.
     */
    private static final int MIN_PREFIX_STEM_LENGTH = 5;

    /**
     * Match token/stem (T-04, scoping V2) :
     * <ul>
     *   <li>stem long (≥{@value MIN_PREFIX_STEM_LENGTH}) → prefixe (« reserv » matche
     *       « reservation », « reservations », « reserver ») ;</li>
     *   <li>stem court → match EXACT ou pluriel simple (« kpi » matche « kpi »/« kpis »
     *       mais plus « kpixyz ») — reduit les faux positifs des racines courtes.</li>
     * </ul>
     */
    private static boolean matches(Set<String> stems, Set<String> tokens) {
        for (String token : tokens) {
            for (String stem : stems) {
                if (stem.length() >= MIN_PREFIX_STEM_LENGTH) {
                    if (token.startsWith(stem)) {
                        return true;
                    }
                } else if (token.equals(stem) || token.equals(stem + "s")) {
                    return true;
                }
            }
        }
        return false;
    }

    /** Concatène le texte des derniers messages utilisateur (récents en priorité). */
    private static String recentUserText(List<ChatMessage> history) {
        if (history == null || history.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        int seen = 0;
        for (int i = history.size() - 1; i >= 0 && seen < USER_MESSAGES_SCANNED; i--) {
            ChatMessage m = history.get(i);
            if (ChatMessage.ROLE_USER.equals(m.role()) && m.content() != null && !m.content().isBlank()) {
                sb.append(m.content()).append(' ');
                seen++;
            }
        }
        return sb.toString();
    }

    /** Minuscule + suppression des accents + découpage en tokens alphanumériques. */
    private static Set<String> tokenize(String text) {
        if (text == null || text.isBlank()) {
            return Set.of();
        }
        String normalized = Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        Set<String> tokens = new LinkedHashSet<>();
        for (String token : normalized.split("[^a-z0-9]+")) {
            if (!token.isBlank()) {
                tokens.add(token);
            }
        }
        return tokens;
    }
}
