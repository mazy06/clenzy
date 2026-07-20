package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste marketing (campagne L2 — agent Marketing, domaines V3) :
 * acquisition, visibilite, reputation et revenus additionnels, sur les
 * OUTILS EXISTANTS uniquement (attribution canal, benchmark concurrence,
 * upsells, avis, evenements locaux).
 *
 * <p>Hors mandat (services metier a construire, cf. journal L2) : campagnes
 * sortantes (emailing/SEO/ads), génération de contenu d'annonces en masse.</p>
 */
@Component
public class MarketingSpecialist extends AbstractAgentSpecialist {

    public MarketingSpecialist(ChatLLMProvider chatProvider,
                               ToolRegistry toolRegistry,
                               ObjectMapper objectMapper,
                               MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "marketing"; }

    @Override
    public String domain() { return "Marketing : acquisition par canal, reputation (avis), upsells, visibilite locale"; }

    @Override
    public String description() {
        return """
                Specialiste marketing et acquisition :
                - "D'ou viennent mes reservations ?" → get_channel_attribution (mix Airbnb/direct/...)
                - "Quels revenus additionnels proposer ?" → suggest_upsells
                - "Que disent les avis de mes logements ?" → analyze_reviews / list_reviews
                  (reputation = premier levier de conversion)
                - "Quels evenements locaux pour ajuster ma visibilite ?" → get_local_events
                - "La demande progresse-t-elle ?" → get_reservation_trend
                Lecture seule — aucune action d'ecriture dans ce mandat.""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "get_channel_attribution",
                "suggest_upsells",
                "analyze_reviews",
                "list_reviews",
                "get_local_events",
                "get_reservation_trend"
        );
    }
}
