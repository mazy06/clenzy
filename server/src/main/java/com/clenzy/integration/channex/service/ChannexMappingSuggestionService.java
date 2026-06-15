package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.MappingSuggestion;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.integration.channex.service.MappingSuggestionMatcher.ChannexCandidate;
import com.clenzy.integration.channex.service.MappingSuggestionMatcher.ClenzyCandidate;
import com.clenzy.repository.PropertyRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Propose des appariements Clenzy ↔ Channex pour les propriétés non encore mappées (CLZ Domaine 1).
 * Rassemble les candidats (propriétés Clenzy non mappées + propriétés hub Channex non mappées) et
 * délègue l'appariement à {@link MappingSuggestionMatcher} (logique pure).
 */
@Service
public class ChannexMappingSuggestionService {

    private final ChannexPropertyMappingRepository mappingRepository;
    private final PropertyRepository propertyRepository;
    private final ChannexClient channexClient;
    private final MappingSuggestionMatcher matcher;

    public ChannexMappingSuggestionService(ChannexPropertyMappingRepository mappingRepository,
                                           PropertyRepository propertyRepository,
                                           ChannexClient channexClient,
                                           MappingSuggestionMatcher matcher) {
        this.mappingRepository = mappingRepository;
        this.propertyRepository = propertyRepository;
        this.channexClient = channexClient;
        this.matcher = matcher;
    }

    public List<MappingSuggestion> suggest(Long orgId) {
        List<ChannexPropertyMapping> mappings = mappingRepository.findAllByOrgId(orgId);
        Set<Long> mappedClenzy = mappings.stream()
            .map(ChannexPropertyMapping::getClenzyPropertyId).collect(Collectors.toSet());
        Set<String> mappedChannex = mappings.stream()
            .map(ChannexPropertyMapping::getChannexPropertyId).collect(Collectors.toSet());

        List<ClenzyCandidate> clenzy = propertyRepository.findByOrgWithRawAmenities(orgId).stream()
            .filter(p -> !mappedClenzy.contains(p.getId()))
            .map(p -> new ClenzyCandidate(p.getId(), p.getName()))
            .toList();

        List<ChannexCandidate> channex = new ArrayList<>();
        JsonNode raw = channexClient.fetchAllPropertiesRaw();
        if (raw != null && raw.has("data")) {
            for (JsonNode node : raw.get("data")) {
                String id = node.path("id").asText(null);
                if (id == null || mappedChannex.contains(id)) continue;
                String title = node.path("attributes").path("title").asText(null);
                channex.add(new ChannexCandidate(id, title));
            }
        }

        return matcher.suggest(clenzy, channex);
    }
}
