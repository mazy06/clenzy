package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste ACTIONS operations terrain : interventions, calendrier, statuts, tarifs.
 *
 * <p>8 tools write (avec confirmation user — gere au niveau orchestrator qui forward
 * le tool_confirmation_request). La SURVEILLANCE read-only (ménages, statut sync,
 * bruit, risques) est portee par {@code MonitoringSpecialist}.</p>
 */
@Component
public class OperationsSpecialist extends AbstractAgentSpecialist {

    public OperationsSpecialist(ChatLLMProvider chatProvider,
                                  ToolRegistry toolRegistry,
                                  ObjectMapper objectMapper,
                                  MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "operations"; }

    @Override
    public String domain() { return "Operations terrain : menages, interventions, calendrier, statuts proprietes"; }

    @Override
    public String description() {
        return """
                Specialiste pour les ACTIONS operationnelles (qui modifient des donnees) :
                - "Cree une intervention maintenance", "Assigne cette intervention a Marie"
                - "Bloque ces dates", "Mets cette propriete en MAINTENANCE"
                - Changement de statut d'une intervention, tarif override
                - Creation d'une reservation directe (prix calcule serveur), generation d'une facture de sejour
                Write tools avec confirmation user requise.
                Pour la SURVEILLANCE (menages a faire, statut de sync, bruit, risques) : voir le specialiste monitoring.""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "create_intervention",
                "assign_intervention",
                "block_calendar_day",
                "update_property_status",
                "update_intervention_status",
                "set_rate_override",
                "create_reservation",
                "create_invoice"
        );
    }
}
