package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste screening voyageurs (campagne L2 — agent Screening, domaines V3) :
 * profil et fiabilite d'un guest AVANT ou PENDANT un sejour, a partir de
 * l'historique interne (sejours passes, annulations, segments, avis lies).
 * LECTURE SEULE — aucune decision automatique d'acceptation/refus.
 *
 * <p>Hors mandat (services metier a construire, cf. journal L2) : scoring
 * pre-reservation temps reel (le {@code BookingFraudScoringService} du booking
 * engine score des signaux de checkout en vol, pas un guest du PMS), controle
 * d'identite, listes externes.</p>
 */
@Component
public class GuestScreeningSpecialist extends AbstractAgentSpecialist {

    public GuestScreeningSpecialist(ChatLLMProvider chatProvider,
                                    ToolRegistry toolRegistry,
                                    ObjectMapper objectMapper,
                                    MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "screening"; }

    @Override
    public String domain() { return "Screening voyageurs : profil, historique et fiabilite d'un guest (lecture seule)"; }

    @Override
    public String description() {
        return """
                Specialiste screening des voyageurs (LECTURE SEULE) :
                - "Ce guest est-il fiable ?" → list_guests + get_reservation_details
                  (sejours passes, annulations, incidents connus en interne)
                - "Quel est le profil de mes guests recurrents ?" → segment_guests
                - "Des avis/incidents lies a ce voyageur ?" → analyze_reviews / list_reviews
                - "Historique de ses reservations chez moi ?" → list_reservations
                Toujours factuel : rapporte l'historique INTERNE, ne juge pas la personne,
                ne recommande jamais un refus automatique — la decision reste humaine.""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "list_guests",
                "segment_guests",
                "list_reservations",
                "get_reservation_details",
                "analyze_reviews",
                "list_reviews"
        );
    }
}
