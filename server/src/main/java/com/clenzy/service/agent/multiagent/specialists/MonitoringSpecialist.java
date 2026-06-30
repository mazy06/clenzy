package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste SURVEILLANCE / santé opérationnelle (read-only).
 *
 * <p>Issu du rebalancing : regroupe les tools de monitoring jusque-là dispersés
 * dans {@code operations} (qui dépassait 10) et {@code data_analyst} : ménages à
 * faire, distribution des interventions, santé de sync des canaux, alertes de
 * bruit, risques opérationnels, snapshot KPI plateforme. 6 tools read-only.
 * Mappé sur l'agent constellation {@code ops}.</p>
 */
@Component
public class MonitoringSpecialist extends AbstractAgentSpecialist {

    public MonitoringSpecialist(ChatLLMProvider chatProvider,
                                ToolRegistry toolRegistry,
                                ObjectMapper objectMapper,
                                MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "monitoring"; }

    @Override
    public String domain() { return "Surveillance / sante operationnelle : menages, sync canaux, bruit, risques, KPI systeme"; }

    @Override
    public String description() {
        return """
                Specialiste pour la SURVEILLANCE et la sante operationnelle (read-only) :
                - "Quels menages sont a faire ?", "Distribution de mes interventions par statut ?"
                - "Mes calendriers sont-ils synchronises ?", "Quels canaux sont en retard ?"
                - "Y a-t-il des alertes de bruit ?", "Quels risques operationnels a venir ?"
                - "Etat du systeme / KPI plateforme (readiness, sync, double bookings) ?"
                Ne modifie rien. Pour AGIR (creer/assigner une intervention, bloquer des dates) : voir operations.""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "list_cleaning_tasks",
                "get_interventions_by_status",
                "get_channel_sync_status",
                "get_noise_alerts",
                "detect_operational_risks",
                "get_dashboard_summary"
        );
    }
}
