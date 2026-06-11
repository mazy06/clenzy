package com.clenzy.service.tags;

import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.clenzy.service.tags.TagFormatting.formatDate;
import static com.clenzy.service.tags.TagFormatting.formatDateTime;
import static com.clenzy.service.tags.TagFormatting.formatMoney;
import static com.clenzy.service.tags.TagFormatting.safeStr;

/**
 * Builders de groupes de tags partages entre plusieurs resolveurs
 * (client/technicien depuis User, property, intervention).
 * <p>
 * Extraits de TagResolverService (T-SOLID-5) — rendu strictement identique.
 */
@Component
public class EntityTagBuilders {

    private static final Logger log = LoggerFactory.getLogger(EntityTagBuilders.class);

    private final CheckInInstructionsRepository checkInInstructionsRepository;
    private final ObjectMapper objectMapper;

    public EntityTagBuilders(CheckInInstructionsRepository checkInInstructionsRepository,
                             ObjectMapper objectMapper) {
        this.checkInInstructionsRepository = checkInInstructionsRepository;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> clientTags(User user) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("nom", safeStr(user.getLastName()));
        tags.put("prenom", safeStr(user.getFirstName()));
        tags.put("nom_complet", safeStr(user.getFullName()));
        tags.put("email", safeStr(user.getEmail()));
        tags.put("telephone", safeStr(user.getPhoneNumber()));
        tags.put("societe", safeStr(user.getCompanyName()));
        tags.put("ville", safeStr(user.getCity()));
        tags.put("code_postal", safeStr(user.getPostalCode()));
        tags.put("role", user.getRole() != null ? user.getRole().name() : "");
        return tags;
    }

    /**
     * Tags client/technicien vides — fallback quand l'entite n'existe pas.
     */
    public Map<String, Object> emptyClientTags() {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("nom", "");
        tags.put("prenom", "");
        tags.put("nom_complet", "");
        tags.put("email", "");
        tags.put("telephone", "");
        tags.put("societe", "");
        tags.put("ville", "");
        tags.put("code_postal", "");
        tags.put("role", "");
        return tags;
    }

    public Map<String, Object> propertyTags(Property property) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("nom", safeStr(property.getName()));
        tags.put("adresse", safeStr(property.getAddress()));
        tags.put("ville", safeStr(property.getCity()));
        tags.put("code_postal", safeStr(property.getPostalCode()));
        tags.put("pays", safeStr(property.getCountry()));
        tags.put("type", property.getType() != null ? property.getType().name() : "");
        tags.put("surface", property.getSquareMeters() != null ? property.getSquareMeters() + " m²" : "");
        tags.put("chambres", property.getBedroomCount() != null ? String.valueOf(property.getBedroomCount()) : "");
        tags.put("salles_bain", property.getBathroomCount() != null ? String.valueOf(property.getBathroomCount()) : "");
        tags.put("capacite", property.getMaxGuests() != null ? String.valueOf(property.getMaxGuests()) : "");
        tags.put("prix_nuit", formatMoney(property.getNightlyPrice()));
        tags.put("check_in", safeStr(property.getDefaultCheckInTime()));
        tags.put("check_out", safeStr(property.getDefaultCheckOutTime()));
        tags.put("instructions_acces", safeStr(property.getAccessInstructions()));

        // Check-in instructions (from separate entity)
        if (property.getId() != null) {
            checkInInstructionsRepository.findByPropertyId(property.getId()).ifPresentOrElse(ci -> {
                tags.put("access_code", safeStr(ci.getAccessCode()));
                tags.put("wifi_name", safeStr(ci.getWifiName()));
                tags.put("wifi_password", safeStr(ci.getWifiPassword()));
                tags.put("parking_info", safeStr(ci.getParkingInfo()));
                tags.put("arrival_instructions", safeStr(ci.getArrivalInstructions()));
                tags.put("departure_instructions", safeStr(ci.getDepartureInstructions()));
                tags.put("house_rules", safeStr(ci.getHouseRules()));
                tags.put("emergency_contact", safeStr(ci.getEmergencyContact()));
            }, () -> {
                tags.put("access_code", "");
                tags.put("wifi_name", "");
                tags.put("wifi_password", "");
                tags.put("parking_info", "");
                tags.put("arrival_instructions", "");
                tags.put("departure_instructions", "");
                tags.put("house_rules", "");
                tags.put("emergency_contact", "");
            });
        }

        return tags;
    }

    public Map<String, Object> interventionTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("id", String.valueOf(intervention.getId()));
        tags.put("titre", safeStr(intervention.getTitle()));
        tags.put("description", safeStr(intervention.getDescription()));
        tags.put("type", safeStr(intervention.getType()));
        tags.put("statut", intervention.getStatus() != null ? intervention.getStatus().name() : "");
        tags.put("priorite", safeStr(intervention.getPriority()));
        tags.put("date_planifiee", formatDate(intervention.getScheduledDate()));
        tags.put("date_debut", formatDateTime(intervention.getStartTime()));
        tags.put("date_fin", formatDateTime(intervention.getEndTime()));
        tags.put("date_completion", formatDateTime(intervention.getCompletedAt()));
        tags.put("duree_estimee", intervention.getEstimatedDurationHours() != null
                ? intervention.getEstimatedDurationHours() + "h" : "");
        tags.put("duree_reelle", intervention.getActualDurationMinutes() != null
                ? intervention.getActualDurationMinutes() + " min" : "");
        tags.put("cout_estime", formatMoney(intervention.getEstimatedCost()));
        tags.put("cout_reel", formatMoney(intervention.getActualCost()));
        tags.put("notes", parseStepNotes(intervention.getNotes()));
        tags.put("notes_technicien", safeStr(intervention.getTechnicianNotes()));
        tags.put("instructions", safeStr(intervention.getSpecialInstructions()));
        tags.put("progression", intervention.getProgressPercentage() != null
                ? intervention.getProgressPercentage() + "%" : "0%");
        // Liste par defaut : une seule ligne avec la description de l'intervention
        Map<String, Object> defaultLine = new LinkedHashMap<>();
        defaultLine.put("description", safeStr(intervention.getDescription()));
        defaultLine.put("quantite", "1");
        defaultLine.put("prix_unitaire", formatMoney(intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost()));
        defaultLine.put("total", formatMoney(intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost()));
        tags.put("lignes", List.of(defaultLine));
        return tags;
    }

    /**
     * Parse le JSON des notes d'etapes et retourne un texte lisible.
     * Format attendu : {"rooms":{"general":"texte"}, "inspection":"texte", "after_photos":"texte"}
     * Retourne une concatenation des valeurs textuelles, sans les cles JSON.
     */
    private String parseStepNotes(String notesJson) {
        if (notesJson == null || notesJson.isBlank()) return "";
        // Not JSON — return as-is (plain text notes)
        if (!notesJson.trim().startsWith("{")) return notesJson;
        try {
            final JsonNode root = objectMapper.readTree(notesJson);
            final List<String> parts = new ArrayList<>();
            root.fields().forEachRemaining(entry -> {
                final JsonNode value = entry.getValue();
                if (value.isTextual() && !value.asText().isBlank()) {
                    parts.add(value.asText().trim());
                } else if (value.isObject()) {
                    // e.g. "rooms": {"general": "texte", "0": "note piece 1"}
                    value.fields().forEachRemaining(sub -> {
                        if (sub.getValue().isTextual() && !sub.getValue().asText().isBlank()) {
                            parts.add(sub.getValue().asText().trim());
                        }
                    });
                }
            });
            return String.join("\n", parts);
        } catch (Exception e) {
            log.debug("Could not parse step notes JSON, using raw value: {}", e.getMessage());
            return notesJson;
        }
    }
}
