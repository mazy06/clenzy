package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatMessage;
import com.clenzy.config.ai.ToolDescriptor;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifie le scoping par domaine de {@link ToolScopeSelector} : socle transverse
 * toujours present, outils du domaine detecte exposes, hors-sujet exclus, et
 * degradations sures (petite liste = no-op, message vague = staples).
 */
class ToolScopeSelectorTest {

    /** Catalogue realiste (noms reels des tools de l'assistant). */
    private static final List<String> ALL_TOOL_NAMES = List.of(
            "advance_workflow", "analyze_portfolio", "analyze_reviews", "assign_intervention",
            "batch_block_calendar", "benchmark_competition", "block_calendar_day", "cancel_reservation",
            "create_intervention", "create_invoice", "create_reservation", "detect_operational_risks",
            "detect_unpaid_interventions", "forecast_demand_longterm", "forget_fact", "get_availability",
            "get_billing_overview", "get_business_insights", "get_channel_attribution",
            "get_channel_sync_status", "get_dashboard_summary", "get_financial_summary",
            "get_interventions_by_status", "get_local_events", "get_noise_alerts", "get_occupancy_forecast",
            "get_ops_analytics", "get_owner_payout_summary", "get_price_quote", "get_properties_performance",
            "get_property_amenities", "get_property_details", "get_property_pnl", "get_reservation_details",
            "get_reservation_trend", "get_weather_forecast", "list_cleaning_tasks", "list_guests",
            "list_invoices", "list_properties", "list_reservations", "list_reviews",
            "predict_maintenance_needs", "preview_batch_block_calendar", "recommend_price_adjustments",
            "remember_fact", "reply_to_review", "search_knowledge_base", "segment_guests",
            "send_guest_message", "send_owner_statement", "set_rate_override", "settle_intervention_payment", "simulate_calendar_block",
            "trigger_channel_sync",
            "simulate_pricing_change", "start_workflow", "suggest_navigation", "suggest_upsells",
            "update_intervention_status", "update_property_status", "update_reservation_status");

    private static final List<ToolDescriptor> ALL_TOOLS = ALL_TOOL_NAMES.stream()
            .map(name -> ToolDescriptor.readOnly(name, "desc " + name,
                    JsonNodeFactory.instance.objectNode()))
            .collect(Collectors.toList());

    private static List<String> namesOf(List<ToolDescriptor> tools) {
        return tools.stream().map(ToolDescriptor::name).toList();
    }

    private static List<ToolDescriptor> select(String userMessage) {
        return ToolScopeSelector.select(ALL_TOOLS, List.of(ChatMessage.user(userMessage)));
    }

    @Test
    void financeMessage_exposesFinanceToolsAndCore_excludesUnrelated() {
        List<String> names = namesOf(select("Fais-moi le bilan financier du mois, revenus et dépenses"));

        // Domaine finance
        assertThat(names).contains("get_financial_summary", "get_billing_overview", "list_invoices",
                "get_owner_payout_summary");
        // Socle transverse toujours present
        assertThat(names).contains("suggest_navigation", "search_knowledge_base", "get_business_insights");
        // Hors-sujet exclus
        assertThat(names).doesNotContain("get_noise_alerts", "get_weather_forecast", "reply_to_review");
        // Bien plus petit que le catalogue complet
        assertThat(names.size()).isLessThan(ALL_TOOLS.size());
    }

    @Test
    void reserveVerb_triggersReservationDomain() {
        // Le verbe impératif « réserve/réserver » (stem "reserv") doit exposer create_reservation.
        List<String> names = namesOf(select("Réserve le logement pour ce client la semaine prochaine"));

        assertThat(names).contains("create_reservation", "update_reservation_status");
    }

    @Test
    void operationsMessage_exposesInterventionTools() {
        List<String> names = namesOf(select("Le ménage de demain n'est pas assigné, planifie une intervention"));

        assertThat(names).contains("create_intervention", "assign_intervention",
                "get_interventions_by_status", "list_cleaning_tasks");
        assertThat(names).doesNotContain("get_financial_summary", "benchmark_competition");
    }

    @Test
    void unpaidCleaningMessage_exposesDetectAndSettle() {
        List<String> names = namesOf(select("J'ai un ménage impayé, je veux le régler"));

        assertThat(names).contains("detect_unpaid_interventions", "settle_intervention_payment");
    }

    // ─── Scoping V2 (T-04) : stems ambigus purges + stems courts en match exact ──

    @Test
    void commonVerbDemande_doesNotExposePricingTools() {
        // « je te demande... » est du francais courant, pas une intention pricing.
        List<String> names = namesOf(select("Je te demande de m'aider a retrouver un document"));

        assertThat(names).doesNotContain("recommend_price_adjustments", "set_rate_override",
                "benchmark_competition");
    }

    @Test
    void combienDeTemps_doesNotExposeWeatherTools() {
        // « combien de temps » n'est pas une question meteo.
        List<String> names = namesOf(select("Combien de temps faut-il pour un menage complet ?"));

        assertThat(names).doesNotContain("get_weather_forecast", "get_local_events");
        // Le domaine interventions, lui, est bien detecte.
        assertThat(names).contains("list_cleaning_tasks");
    }

    @Test
    void ownerIntent_exposesOwnerRelationTools() {
        // Domaine relation proprietaire (T-09).
        List<String> names = namesOf(select("Envoie le relevé de reversements de juin au propriétaire Martin"));

        assertThat(names).contains("send_owner_statement", "get_owner_payout_summary", "get_property_pnl");
    }

    @Test
    void weatherIntent_stillExposesWeatherTools() {
        List<String> names = namesOf(select("Quelle meteo demain a Lyon pour mes voyageurs ?"));

        assertThat(names).contains("get_weather_forecast", "get_local_events");
    }

    @Test
    void shortStem_matchesExactAndPlural_only() {
        // « prix » (stem court) en mot exact → pricing expose.
        assertThat(namesOf(select("Quel est le prix moyen de la nuit en aout ?")))
                .contains("recommend_price_adjustments", "get_price_quote");
        // « kpis » (pluriel d'un stem court) → analytics expose.
        assertThat(namesOf(select("Montre-moi les kpis du portefeuille")))
                .contains("analyze_portfolio", "get_ops_analytics");
    }

    @Test
    void vagueMessage_fallsBackToCorePlusStaples_notFullCatalog() {
        List<String> names = namesOf(select("Bonjour, tu peux m'aider ?"));

        // Socle + staples de lecture
        assertThat(names).contains("suggest_navigation", "get_dashboard_summary",
                "list_properties", "list_reservations");
        // Pas le catalogue entier, et pas d'outils de niche
        assertThat(names.size()).isLessThan(ALL_TOOLS.size());
        assertThat(names).doesNotContain("get_noise_alerts", "reply_to_review");
    }

    @Test
    void alwaysIncludesCoreTools() {
        List<String> names = namesOf(select("Analyse la performance de mon portefeuille"));

        assertThat(names).contains("suggest_navigation", "search_knowledge_base",
                "remember_fact", "forget_fact", "get_dashboard_summary", "get_business_insights");
    }

    @Test
    void smallToolList_isReturnedUnchanged() {
        // Rôle opérationnel : 5 outils → sous le seuil de scoping, no-op.
        List<ToolDescriptor> operational = ALL_TOOLS.stream()
                .filter(d -> List.of("get_interventions_by_status", "list_cleaning_tasks",
                        "update_intervention_status", "get_weather_forecast", "suggest_navigation")
                        .contains(d.name()))
                .collect(Collectors.toList());

        List<ToolDescriptor> result = ToolScopeSelector.select(operational,
                List.of(ChatMessage.user("montre mes ménages")));

        assertThat(result).isSameAs(operational);
    }

    @Test
    void neverExceedsSafetyCap() {
        // Message multi-domaines (finance + calendrier + pricing + ops + communication).
        List<String> names = namesOf(select(
                "bilan financier, bloque le calendrier, ajuste les tarifs, planifie un ménage, "
                        + "réponds aux avis et envoie un message au voyageur"));

        assertThat(names.size()).isLessThanOrEqualTo(26);
        // Le socle survit au plafonnement.
        assertThat(names).contains("suggest_navigation", "get_business_insights");
    }
}
