package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste analyses de donnees : logements, reservations, occupation, tendances.
 *
 * <p>Questions metier sur les chiffres operationnels (hors finance, voir
 * {@code FinanceSpecialist}) : listes filtrees, details, disponibilite, devis,
 * tendances de reservations, prevision d'occupation, snapshot KPI. 10 tools
 * read-only.</p>
 */
@Component
public class DataAnalystSpecialist extends AbstractAgentSpecialist {

    public DataAnalystSpecialist(ChatLLMProvider chatProvider,
                                   ToolRegistry toolRegistry,
                                   ObjectMapper objectMapper,
                                   MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "data_analyst"; }

    @Override
    public String domain() { return "Analyse de donnees, KPIs, listes, rapports financiers et de performance"; }

    @Override
    public String description() {
        return """
                Specialiste pour l'analyse de donnees operationnelles (hors finance) :
                - "Combien de reservations ce mois ?", "Mes biens a Paris ?"
                - Tendances de reservations, prevision d'occupation, listes filtrees
                - Equipements / amenities d'un logement ("quels equipements ?", "le logement a-t-il une piscine ?")
                - Detail d'un logement ou d'une reservation, disponibilite (calendrier), devis de prix pour des dates
                - Snapshot KPI plateforme (readiness, sync, double bookings)
                Pour factures, revenus/depenses, versements proprietaires : voir le specialiste finance.
                Read-only : ne modifie rien.""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "list_properties",
                "get_property_amenities",
                "get_property_details",
                "get_availability",
                "get_price_quote",
                "list_reservations",
                "get_reservation_details",
                "get_dashboard_summary",
                "get_reservation_trend",
                "get_occupancy_forecast"
        );
    }
}
