package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Phase C3 — Availability Rules PAR CANAL (arbitrage produit S3
 * « open/close disponibilite par canal ») : fermer ou limiter UN canal OTA
 * (ex. couper Airbnb seul sur un week-end) sans toucher l'ARI global —
 * l'availability poussee par le PMS reste inchangee, la regle s'applique en
 * OVERLAY cote Channex ({@code type: close_out}).
 */
@Service
public class ChannexAvailabilityRuleService {

    private static final Logger log = LoggerFactory.getLogger(ChannexAvailabilityRuleService.class);

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;

    public ChannexAvailabilityRuleService(ChannexClient channexClient,
                                          ChannexPropertyMappingRepository mappingRepository) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
    }

    /** Vue d'une regle existante. */
    public record ChannelRuleView(String id, String title, String type,
                                  String startDate, String endDate,
                                  List<String> days, List<String> affectedChannels) {}

    /** Demande de fermeture d'un ou plusieurs canaux sur une plage. */
    public record CloseChannelRequest(
        String title,
        List<String> channelIds,
        LocalDate startDate,
        LocalDate endDate,
        /** Jours de semaine concernes ("mo".."su") — null/vide = tous. */
        List<String> days
    ) {}

    private static final List<String> ALL_DAYS =
        List.of("mo", "tu", "we", "th", "fr", "sa", "su");

    public List<ChannelRuleView> list(Long clenzyPropertyId, Long orgId) {
        ChannexPropertyMapping mapping = requireMapping(clenzyPropertyId, orgId);
        List<ChannelRuleView> rules = new ArrayList<>();
        for (JsonNode node : channexClient.listChannelAvailabilityRules(mapping.getChannexPropertyId())) {
            JsonNode attributes = node.path("attributes");
            List<String> days = new ArrayList<>();
            attributes.path("days").forEach(d -> days.add(d.asText()));
            List<String> channels = new ArrayList<>();
            attributes.path("affected_channels").forEach(c -> channels.add(c.asText()));
            rules.add(new ChannelRuleView(
                node.path("id").asText(attributes.path("id").asText(null)),
                attributes.path("title").asText(null),
                attributes.path("type").asText(null),
                attributes.path("start_date").asText(null),
                attributes.path("end_date").asText(null),
                days, channels));
        }
        return rules;
    }

    /** Ferme les canaux demandes sur la plage (close_out). Retourne l'id de la regle. */
    public String closeChannels(Long clenzyPropertyId, Long orgId, CloseChannelRequest request) {
        if (request.channelIds() == null || request.channelIds().isEmpty()) {
            throw new IllegalArgumentException("Au moins un canal a fermer est requis");
        }
        if (request.startDate() == null || request.endDate() == null
            || request.endDate().isBefore(request.startDate())) {
            throw new IllegalArgumentException("Plage de dates invalide");
        }
        ChannexPropertyMapping mapping = requireMapping(clenzyPropertyId, orgId);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", request.title() != null && !request.title().isBlank()
            ? request.title() : "Fermeture Baitly");
        payload.put("type", "close_out");
        payload.put("affected_channels", request.channelIds());
        payload.put("affected_room_types", List.of(mapping.getChannexRoomTypeId()));
        payload.put("days", request.days() != null && !request.days().isEmpty()
            ? request.days() : ALL_DAYS);
        payload.put("start_date", request.startDate().toString());
        payload.put("end_date", request.endDate().toString());
        payload.put("property_id", mapping.getChannexPropertyId());

        String ruleId = channexClient.createChannelAvailabilityRule(payload);
        log.info("ChannexAvailabilityRule: close_out cree rule={} property={} canaux={} [{}, {}]",
            ruleId, clenzyPropertyId, request.channelIds(), request.startDate(), request.endDate());
        return ruleId;
    }

    /**
     * Supprime une regle (= rouvre le canal). Ownership : la regle doit
     * appartenir a la property Channex mappee (verifie via la liste — l'id
     * seul ne porte pas l'org).
     */
    public void deleteRule(Long clenzyPropertyId, Long orgId, String ruleId) {
        boolean owned = list(clenzyPropertyId, orgId).stream()
            .anyMatch(rule -> ruleId.equals(rule.id()));
        if (!owned) {
            throw new org.springframework.security.access.AccessDeniedException(
                "Regle " + ruleId + " etrangere a la propriete " + clenzyPropertyId);
        }
        channexClient.deleteChannelAvailabilityRule(ruleId);
        log.info("ChannexAvailabilityRule: regle {} supprimee (property={})", ruleId, clenzyPropertyId);
    }

    private ChannexPropertyMapping requireMapping(Long clenzyPropertyId, Long orgId) {
        return mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId));
    }
}
