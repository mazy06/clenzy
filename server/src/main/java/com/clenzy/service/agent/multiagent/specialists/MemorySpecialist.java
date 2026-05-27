package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste memoire long-terme : enregistrer/oublier des faits utilisateur.
 *
 * <p>2 tools : remember_fact (silencieux) + forget_fact (confirmation requise).
 * Active quand l'user demande explicitement "souviens-toi que..." ou "oublie...".</p>
 */
@Component
public class MemorySpecialist extends AbstractAgentSpecialist {

    public MemorySpecialist(ChatLLMProvider chatProvider,
                              ToolRegistry toolRegistry,
                              ObjectMapper objectMapper,
                              MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "memory"; }

    @Override
    public String domain() { return "Memoire long-terme : enregistrer ou oublier des faits, preferences, objectifs"; }

    @Override
    public String description() {
        return """
                Specialiste pour la gestion de la memoire long-terme cross-conversations :
                - "Souviens-toi que je prefere le briefing a 8h"
                - "Oublie le fait que l'owner 42 est difficile"
                - "Note mon objectif Q3 : 80% d'occupation"
                4 scopes : preference, fact, goal, project (snake_case keys).""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of("remember_fact", "forget_fact");
    }
}
