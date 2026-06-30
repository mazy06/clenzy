package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste operations terrain : menages, interventions, calendrier, statuts.
 *
 * <p>6 tools dont 4 write (avec confirmation user — gere au niveau orchestrator
 * qui forward le tool_confirmation_request).</p>
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
                Specialiste pour les actions et consultations operationnelles :
                - "Liste les menages a faire", "Cree une intervention maintenance"
                - "Assigne cette intervention a Marie", "Bloque ces dates"
                - "Mets cette propriete en MAINTENANCE"
                - Statut de synchro des canaux, alertes de bruit, changement de statut d'une intervention, tarif override
                - Creation d'une reservation directe (le prix est calcule serveur), generation d'une facture de sejour
                Write tools avec confirmation user requise.""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "list_cleaning_tasks",
                "get_interventions_by_status",
                "create_intervention",
                "assign_intervention",
                "block_calendar_day",
                "update_property_status",
                "get_channel_sync_status",
                "get_noise_alerts",
                "update_intervention_status",
                "set_rate_override",
                "create_reservation",
                "create_invoice",
                "detect_operational_risks"
        );
    }
}
