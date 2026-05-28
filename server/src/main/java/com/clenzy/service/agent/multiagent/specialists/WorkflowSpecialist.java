package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste workflows guides multi-etapes (onboarding, cloture mois, etc.).
 *
 * <p>2 tools : start_workflow + advance_workflow. Active quand l'user demande
 * "aide-moi a...", "guide-moi pour...", "comment je fais pour...".</p>
 */
@Component
public class WorkflowSpecialist extends AbstractAgentSpecialist {

    public WorkflowSpecialist(ChatLLMProvider chatProvider,
                                ToolRegistry toolRegistry,
                                ObjectMapper objectMapper,
                                MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "workflow"; }

    @Override
    public String domain() { return "Procedures guidees multi-etapes (onboarding propriete, cloture mois, prep haute saison)"; }

    @Override
    public String description() {
        return """
                Specialiste pour lancer ou poursuivre une procedure guidee :
                - "Aide-moi a creer une nouvelle propriete" → onboard_property
                - "Cloture mon mois" → end_of_month_closing
                - "Prepare la haute saison" → prepare_high_season
                Stateful : le specialiste maintient l'etat du workflow via run_id.""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of("start_workflow", "advance_workflow");
    }
}
