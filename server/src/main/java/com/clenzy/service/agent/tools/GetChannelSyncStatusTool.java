package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.ChannelSyncHealthDto;
import com.clenzy.dto.PropertyDto;
import com.clenzy.service.ChannelSyncHealthService;
import com.clenzy.service.PropertyService;
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

/**
 * Tool {@code get_channel_sync_status} — sante de la synchronisation multi-canaux
 * (Airbnb / iCal Booking.com / Vrbo / autres PMS) pour l'organisation.
 *
 * <p>Pour chaque logement de l'organisation, retourne le nombre de canaux
 * synchronises recemment (lastSyncAt &lt; 24h) sur le total de canaux actifs,
 * et un statut derive : {@code OK} (tout sync), {@code STALE} (au moins un canal
 * en retard), {@code NO_CHANNELS} (aucun canal connecte). Lecture seule.</p>
 *
 * <p>Delegue a {@link ChannelSyncHealthService#getHealthByPropertyIds(List)} pour
 * l'agregation (filtre multi-tenant via {@code TenantContext} cote service) et a
 * {@link PropertyService#search} pour enumerer les logements de l'org — l'assistant
 * herite des memes garanties que les endpoints REST.</p>
 */
@Component
public class GetChannelSyncStatusTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetChannelSyncStatusTool.class);
    private static final String NAME = "get_channel_sync_status";
    private static final int MAX_PROPERTIES = 25;

    private final ChannelSyncHealthService channelSyncHealthService;
    private final PropertyService propertyService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetChannelSyncStatusTool(ChannelSyncHealthService channelSyncHealthService,
                                    PropertyService propertyService,
                                    ObjectMapper objectMapper) {
        this.channelSyncHealthService = channelSyncHealthService;
        this.propertyService = propertyService;
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
        try {
            // Enumerer les logements de l'org (filtre Hibernate actif via search).
            Page<PropertyDto> page = propertyService.search(
                    PageRequest.of(0, MAX_PROPERTIES, Sort.by("name").ascending()),
                    null, null, null, null);

            List<PropertyDto> properties = page.getContent();
            List<Long> propertyIds = properties.stream()
                    .map(p -> p.id)
                    .filter(id -> id != null)
                    .toList();

            Map<Long, ChannelSyncHealthDto> healthByProperty =
                    channelSyncHealthService.getHealthByPropertyIds(propertyIds);

            List<Map<String, Object>> items = new ArrayList<>();
            int withChannels = 0;
            int allSynced = 0;
            int stale = 0;
            for (PropertyDto p : properties) {
                ChannelSyncHealthDto health = healthByProperty.get(p.id);
                int synced = health != null ? health.synced() : 0;
                int total = health != null ? health.total() : 0;

                String status;
                if (total == 0) {
                    status = "NO_CHANNELS";
                } else if (synced >= total) {
                    status = "OK";
                    withChannels++;
                    allSynced++;
                } else {
                    status = "STALE";
                    withChannels++;
                    stale++;
                }

                items.add(toItem(p, synced, total, status));
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("count", items.size());
            payload.put("propertiesWithChannels", withChannels);
            payload.put("fullySynced", allSynced);
            payload.put("stale", stale);
            payload.put("staleThresholdHours", 24);
            return ToolResult.success(objectMapper.writeValueAsString(payload), "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize channel sync status", e);
        } catch (Exception e) {
            log.warn("get_channel_sync_status failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Statut de synchronisation des canaux indisponible (" + e.getMessage() + ")", e);
        }
    }

    private Map<String, Object> toItem(PropertyDto p, int synced, int total, String status) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("propertyId", p.id);
        m.put("propertyName", p.name);
        m.put("syncedChannels", synced);
        m.put("totalChannels", total);
        m.put("status", status);
        return m;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {},
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Sante de synchro des canaux (Airbnb, iCal Booking/Vrbo) par logement : statut OK / STALE (>24h) / NO_CHANNELS. Pour 'synchro a jour', 'canaux en erreur'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
