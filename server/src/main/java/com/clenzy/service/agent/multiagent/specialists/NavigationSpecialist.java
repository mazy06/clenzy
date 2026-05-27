package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste navigation : oriente l'utilisateur vers la bonne page du PMS.
 *
 * <p>1 seul tool : suggest_navigation. Active quand l'user demande "ou je
 * configure", "ou trouver", ou apres un insight qui appelle un parametrage.</p>
 */
@Component
public class NavigationSpecialist extends AbstractAgentSpecialist {

    public NavigationSpecialist(ChatLLMProvider chatProvider,
                                  ToolRegistry toolRegistry,
                                  ObjectMapper objectMapper,
                                  MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "navigation"; }

    @Override
    public String domain() { return "Navigation dans le PMS : suggerer la bonne page pour une action"; }

    @Override
    public String description() {
        return """
                Specialiste pour orienter l'user vers la bonne page du PMS :
                - "Ou je configure la tarification dynamique ?"
                - "Comment activer l'IA analytics ?"
                - "Ou voir mes revenus mensuels ?"
                Produit un bouton cliquable vers /route.""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of("suggest_navigation");
    }
}
