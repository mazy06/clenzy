package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste maintenance (campagne X7 — agent Maintenance, fiche metier n°7) :
 * curatif (ordres de travail), preventif (interventions planifiees a date
 * future), prediction sur signaux (historique + capteurs IoT Minut).
 *
 * <p>Extrait du mandat d'{@code operations} (turnover/menage) : la maintenance
 * a sa propre logique — anticiper les pannes plutot que subir les urgences.</p>
 */
@Component
public class MaintenanceSpecialist extends AbstractAgentSpecialist {

    public MaintenanceSpecialist(ChatLLMProvider chatProvider,
                                 ToolRegistry toolRegistry,
                                 ObjectMapper objectMapper,
                                 MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "maintenance"; }

    @Override
    public String domain() { return "Maintenance : ordres de travail, preventif planifie, prediction de pannes (historique + IoT)"; }

    @Override
    public String description() {
        return """
                Specialiste maintenance des logements :
                - "Quels equipements risquent de tomber en panne ?" → predict_maintenance_needs
                  (historique interventions + signaux capteurs)
                - "Y a-t-il des risques operationnels cette semaine ?" → detect_operational_risks
                - "Planifie l'entretien de la chaudiere pour le 15/11" → create_intervention
                  (type maintenance, date FUTURE = preventif ; confirmation requise)
                - "Ou en sont mes interventions de maintenance ?" → get_interventions_by_status
                - "Des alertes bruit/capteurs sur mes logements ?" → get_noise_alerts
                - Affectation/suivi : assign_intervention, update_intervention_status (confirmation).
                Lecture seule SAUF create/assign/update intervention (write, avec confirmation).""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "predict_maintenance_needs",
                "detect_operational_risks",
                "create_intervention",
                "assign_intervention",
                "update_intervention_status",
                "get_interventions_by_status",
                "get_noise_alerts"
        );
    }
}
