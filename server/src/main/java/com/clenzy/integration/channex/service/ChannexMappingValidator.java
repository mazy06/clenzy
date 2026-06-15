package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
import com.clenzy.integration.channex.dto.ChannexRatePlanDto;
import com.clenzy.integration.channex.dto.ChannexRoomTypeDto;
import com.clenzy.integration.channex.dto.MappingValidationReport;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Valide l'intégrité d'un mapping Channex (CLZ Domaine 1) : la property, le room type et les rate
 * plans référencés existent-ils encore côté hub ? Les identifiants peuvent devenir orphelins si la
 * configuration Channex change hors de Clenzy → cette validation détecte ces dérives.
 */
@Component
public class ChannexMappingValidator {

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;

    public ChannexMappingValidator(ChannexClient channexClient,
                                   ChannexPropertyMappingRepository mappingRepository) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
    }

    /**
     * Charge le mapping d'une propriété (org-scopé) et le valide. {@code empty} si aucun mapping.
     */
    public Optional<MappingValidationReport> validateByProperty(Long orgId, Long propertyId) {
        return mappingRepository.findByClenzyPropertyId(propertyId, orgId).map(this::validate);
    }

    public MappingValidationReport validate(ChannexPropertyMapping mapping) {
        List<String> issues = new ArrayList<>();
        String propertyId = mapping.getChannexPropertyId();

        try {
            ChannexPropertyDto property = channexClient.getProperty(propertyId);
            if (property == null || property.id() == null) {
                issues.add("Property Channex introuvable : " + propertyId);
                return new MappingValidationReport(false, issues); // inutile d'aller plus loin
            }
        } catch (Exception e) {
            issues.add("Property Channex inaccessible (" + propertyId + ") : " + e.getMessage());
            return new MappingValidationReport(false, issues);
        }

        try {
            Set<String> roomTypeIds = channexClient.fetchRoomTypesForProperty(propertyId).stream()
                .map(ChannexRoomTypeDto::id).collect(Collectors.toSet());
            String mappedRoomType = mapping.getChannexRoomTypeId();
            if (mappedRoomType != null && !roomTypeIds.contains(mappedRoomType)) {
                issues.add("Room type introuvable cote hub : " + mappedRoomType);
            }
        } catch (Exception e) {
            issues.add("Room types inaccessibles : " + e.getMessage());
        }

        try {
            Set<String> ratePlanIds = channexClient.fetchRatePlansForProperty(propertyId).stream()
                .map(ChannexRatePlanDto::id).collect(Collectors.toSet());
            for (String rpId : mapping.getTargetRatePlanIds()) {
                if (!ratePlanIds.contains(rpId)) {
                    issues.add("Rate plan introuvable cote hub : " + rpId);
                }
            }
        } catch (Exception e) {
            issues.add("Rate plans inaccessibles : " + e.getMessage());
        }

        return new MappingValidationReport(issues.isEmpty(), issues);
    }
}
