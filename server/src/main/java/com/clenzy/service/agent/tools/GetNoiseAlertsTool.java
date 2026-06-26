package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.noise.NoiseAlertDto;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Tool {@code get_noise_alerts} — alertes de bruit recentes (capteurs Minut) pour
 * l'organisation.
 *
 * <p>Retourne les dernieres alertes : logement, niveau mesure / seuil, severite,
 * creneau horaire, source et statut d'acquittement. Lecture seule. Optionnellement
 * filtrable par {@code propertyId} et par {@code severity} (WARNING / CRITICAL).</p>
 *
 * <p>Delegue a {@link NoiseAlertService#getAlerts} (filtrage par {@code orgId}
 * cote service). <b>Aucune donnee personnelle n'est exposee</b> : les champs
 * {@code acknowledgedBy} (identite de l'utilisateur ayant acquitte) et
 * {@code notes} (texte libre potentiellement nominatif) sont volontairement omis.</p>
 */
@Component
public class GetNoiseAlertsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetNoiseAlertsTool.class);
    private static final String NAME = "get_noise_alerts";
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 30;
    private static final Set<String> VALID_SEVERITIES = Set.of("WARNING", "CRITICAL");

    private final NoiseAlertService noiseAlertService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetNoiseAlertsTool(NoiseAlertService noiseAlertService, ObjectMapper objectMapper) {
        this.noiseAlertService = noiseAlertService;
        this.objectMapper = objectMapper;
        this.descriptor = buildDescriptor(objectMapper);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public ToolDescriptor descriptor() {
        return descriptor;
    }

    @Override
    public ToolResult execute(JsonNode args, AgentContext context) {
        Long propertyId = parsePropertyId(args.path("propertyId"));
        String severity = parseSeverity(args.path("severity"));
        int limit = Math.min(MAX_LIMIT, Math.max(1, args.path("limit").asInt(DEFAULT_LIMIT)));

        try {
            // Filtrage par orgId cote service (defense en profondeur multi-tenant).
            Page<NoiseAlertDto> page = noiseAlertService.getAlerts(
                    context.organizationId(),
                    propertyId,
                    severity,
                    PageRequest.of(0, limit, Sort.by("createdAt").descending()));

            List<Map<String, Object>> items = new ArrayList<>();
            for (NoiseAlertDto alert : page.getContent()) {
                items.add(toItem(alert));
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("count", items.size());
            payload.put("totalAlerts", page.getTotalElements());
            return ToolResult.success(objectMapper.writeValueAsString(payload), "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize noise alerts", e);
        } catch (Exception e) {
            log.warn("get_noise_alerts failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Alertes de bruit indisponibles (" + e.getMessage() + ")", e);
        }
    }

    /** Mappe vers une vue PII-free : pas de acknowledgedBy ni de notes (texte libre). */
    private Map<String, Object> toItem(NoiseAlertDto a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.id());
        m.put("propertyId", a.propertyId());
        m.put("propertyName", a.propertyName());
        m.put("deviceName", a.deviceName());
        m.put("severity", a.severity());
        m.put("measuredDb", a.measuredDb());
        m.put("thresholdDb", a.thresholdDb());
        m.put("timeWindowLabel", a.timeWindowLabel());
        m.put("source", a.source());
        m.put("acknowledged", a.acknowledged());
        m.put("createdAt", a.createdAt() != null ? a.createdAt().toString() : null);
        return m;
    }

    private Long parsePropertyId(JsonNode node) {
        if (node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isNumber()) {
            return node.asLong();
        }
        if (node.isTextual() && !node.asText().isBlank()) {
            try {
                return Long.parseLong(node.asText().trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String parseSeverity(JsonNode node) {
        if (node.isMissingNode() || node.isNull() || !node.isTextual()) {
            return null;
        }
        String value = node.asText().trim().toUpperCase();
        return VALID_SEVERITIES.contains(value) ? value : null;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"ID du logement pour filtrer les alertes. Omettre pour toute l'organisation."},
                        "severity":   {"type":"string","enum":["WARNING","CRITICAL"],"description":"Filtre par severite. Omettre pour toutes les severites."},
                        "limit":      {"type":"integer","minimum":1,"maximum":30,"description":"Nombre maximum d'alertes (defaut 20, max 30)"}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Retourne les alertes de bruit recentes (capteurs Minut) de l'organisation : logement, niveau de bruit mesure et seuil, severite (WARNING/CRITICAL), creneau horaire, source et statut d'acquittement. Filtrable par propertyId et severity. Utiliser pour 'y a-t-il eu du bruit', 'alertes de nuisance sonore', 'quels logements ont declenche une alerte bruit', 'depassements de seuil sonore'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
