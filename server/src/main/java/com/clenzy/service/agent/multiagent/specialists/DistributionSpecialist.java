package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste distribution multicanal (campagne X7 — agent Distribution/Channel,
 * fiche metier n°2) : sante de synchronisation, attribution par canal,
 * resynchronisation manuelle, disponibilites.
 *
 * <p>Extrait du mandat de {@code monitoring} (qui ne portait que la lecture) :
 * la distribution merite son cluster — c'est la que se joue l'anti-overbooking.</p>
 */
@Component
public class DistributionSpecialist extends AbstractAgentSpecialist {

    public DistributionSpecialist(ChatLLMProvider chatProvider,
                                  ToolRegistry toolRegistry,
                                  ObjectMapper objectMapper,
                                  MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "distribution"; }

    @Override
    public String domain() { return "Distribution multicanal : sante de synchro OTA, attribution par canal, resynchronisation"; }

    @Override
    public String description() {
        return """
                Specialiste de la distribution multicanal (Airbnb, Booking via iCal, Vrbo...) :
                - "Mes canaux sont-ils synchronises ?", "La synchro Airbnb est-elle a jour ?" → get_channel_sync_status
                - "Quel canal me rapporte le plus ?", "Repartition de mes resas par canal ?" → get_channel_attribution
                - "Resynchronise l'appartement X", "Force la synchro des calendriers" → trigger_channel_sync
                  (push reel vers les OTAs, confirmation requise)
                - "Le logement est-il disponible du X au Y ?" → get_availability (verif anti-overbooking)
                Lecture seule SAUF trigger_channel_sync (write, avec confirmation).""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "get_channel_sync_status",
                "get_channel_attribution",
                "trigger_channel_sync",
                "get_availability",
                "list_properties"
        );
    }
}
