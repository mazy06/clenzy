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
 * <p>8 tools : business insights par propriete, vue portfolio cross-property,
 * simulations pricing/calendrier, recommandation de prix, avis voyageurs (liste +
 * analyse) et benchmark concurrence. Tres haut signal/bruit — analyses lourdes.</p>
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

    /** Yield/simulations : l'erreur coute des euros reels → tier fort (T-03). */
    @Override
    public com.clenzy.service.agent.AgentTier tier() { return com.clenzy.service.agent.AgentTier.STRONG; }

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
                - "Suis-je au bon prix ?", "positionnement face au marche / concurrence" (sources PriceLabs, Beyond…)
                Read-only avec modeles d'elasticite, patterns AI et donnees de marche.""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "get_business_insights",
                "analyze_portfolio",
                "simulate_pricing_change",
                "recommend_price_adjustments",
                "simulate_calendar_block",
                "list_reviews",
                "analyze_reviews",
                "benchmark_competition"
        );
    }
}
