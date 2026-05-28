package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste analyses de donnees, KPIs et rapports.
 *
 * <p>Reponsable des questions metier sur les chiffres : revenus, occupation,
 * tendances, performance comparative entre proprietes. 7 tools read-only.</p>
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
                Specialiste pour toute question d'analyse de donnees :
                - "Combien de reservations ce mois ?", "Mon revenu ?", "Mes biens a Paris ?"
                - Bilans financiers, top properties, tendances reservations
                - Previsions d'occupation, listes filtrees
                Read-only : ne modifie rien.""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "list_properties",
                "list_reservations",
                "get_dashboard_summary",
                "get_financial_summary",
                "get_properties_performance",
                "get_reservation_trend",
                "get_occupancy_forecast"
        );
    }
}
