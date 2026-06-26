package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste insights strategiques + simulations what-if.
 *
 * <p>4 tools : business insights par propriete, vue portfolio cross-property,
 * simulations pricing et calendrier. Tres haut signal/bruit — ces tools font
 * des analyses lourdes.</p>
 */
@Component
public class InsightsSpecialist extends AbstractAgentSpecialist {

    public InsightsSpecialist(ChatLLMProvider chatProvider,
                                ToolRegistry toolRegistry,
                                ObjectMapper objectMapper,
                                MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "insights"; }

    @Override
    public String domain() { return "Insights strategiques (anomalies, recommandations) + simulations what-if pricing/calendrier"; }

    @Override
    public String description() {
        return """
                Specialiste pour les questions strategiques et les simulations :
                - "Quels sont les insights pour la villa Bastille ?"
                - "Analyse mon portfolio globalement"
                - "Que se passe-t-il si je baisse de 10% en juillet ?"
                - "Combien je perds si je bloque ces dates ?"
                - "Quels sont mes derniers avis voyageurs ?"
                Read-only avec modeles d'elasticite et patterns AI.""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "get_business_insights",
                "analyze_portfolio",
                "simulate_pricing_change",
                "simulate_calendar_block",
                "list_reviews"
        );
    }
}
