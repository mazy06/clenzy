package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste communication guest : envoi messages + annulation reservation.
 *
 * <p>2 write tools avec confirmation. Distinct d'Operations car focus sur
 * l'interaction guest (templates email/SMS/WhatsApp) et la gestion des
 * reservations cote relationnel.</p>
 */
@Component
public class CommunicationSpecialist extends AbstractAgentSpecialist {

    public CommunicationSpecialist(ChatLLMProvider chatProvider,
                                     ToolRegistry toolRegistry,
                                     ObjectMapper objectMapper,
                                     MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "communication"; }

    @Override
    public String domain() { return "Communication guest : messages templates + annulation reservation"; }

    @Override
    public String description() {
        return """
                Specialiste pour les interactions avec les guests :
                - "Liste mes voyageurs", "infos sur le client X", "mes meilleurs clients" (read)
                - "Envoie le message de bienvenue au guest de la resa 123"
                - "Annule la reservation 456 (motif: ...)", "Change le statut de la resa 789"
                - "Reponds a l'avis 12 : merci pour votre sejour..."
                Write tools avec confirmation user (irreversibles).""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of("list_guests", "segment_guests", "send_guest_message", "cancel_reservation",
                "update_reservation_status", "reply_to_review");
    }
}
