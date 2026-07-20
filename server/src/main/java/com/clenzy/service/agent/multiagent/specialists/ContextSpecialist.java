package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste contexte exterieur : meteo, evenements locaux, doc Baitly (RAG).
 *
 * <p>3 tools read-only. Sert a enrichir le contexte des recos pricing/promo
 * (ex: "pluie samedi → propose une promo last-minute") et a citer la doc.</p>
 */
@Component
public class ContextSpecialist extends AbstractAgentSpecialist {

    public ContextSpecialist(ChatLLMProvider chatProvider,
                               ToolRegistry toolRegistry,
                               ObjectMapper objectMapper,
                               MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "context"; }

    /** Utilitaire factuel (meteo/evenements/KB) : tier petit (T-03). */
    @Override
    public com.clenzy.service.agent.AgentTier tier() { return com.clenzy.service.agent.AgentTier.SMALL; }

    @Override
    public String domain() { return "Contexte exterieur : meteo, evenements locaux, documentation Baitly"; }

    @Override
    public String description() {
        return """
                Specialiste pour les contextes exterieurs et la documentation :
                - "Quelle meteo pour Paris ce week-end ?"
                - "Y a-t-il des evenements importants a Cannes en juillet ?"
                - "Comment fonctionne la synchronisation iCal dans Clenzy ?"
                Read-only avec cache Redis pour meteo (3h).""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "get_weather_forecast",
                "get_local_events",
                "search_knowledge_base"
        );
    }
}
