package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.GuestListDto;
import com.clenzy.service.GuestService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code list_guests} — voyageurs de l'organisation (avec recherche).
 *
 * <p>Delegue a {@link GuestService#listGuests(Long, String, String)} (filtrage
 * par {@code organizationId}). Lecture seule. Le contact (email / telephone) n'est
 * PAS expose au LLM — seulement nom, canal et statistiques de fidelite.</p>
 */
@Component
public class ListGuestsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(ListGuestsTool.class);
    private static final String NAME = "list_guests";
    private static final int MAX_RESULTS = 30;

    private final GuestService guestService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public ListGuestsTool(GuestService guestService, ObjectMapper objectMapper) {
        this.guestService = guestService;
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
        String search = optString(args, "search");
        String channel = optString(args, "channel");
        try {
            List<GuestListDto> guests = guestService.listGuests(context.organizationId(), search, channel);
            List<Map<String, Object>> items = guests.stream()
                    .limit(MAX_RESULTS)
                    .map(this::toItem)
                    .toList();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("count", items.size());
            payload.put("totalMatched", guests.size());
            payload.put("truncated", guests.size() > items.size());
            return ToolResult.success(objectMapper.writeValueAsString(payload), "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize guests", e);
        } catch (Exception e) {
            log.warn("list_guests failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME, "Liste des voyageurs indisponible (" + e.getMessage() + ")", e);
        }
    }

    private Map<String, Object> toItem(GuestListDto g) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", g.id());
        m.put("name", g.fullName());
        if (g.channel() != null) m.put("channel", g.channel());
        m.put("totalStays", g.totalStays());
        m.put("totalSpent", g.totalSpent());
        if (g.language() != null) m.put("language", g.language());
        return m;
    }

    private static String optString(JsonNode args, String key) {
        JsonNode n = args.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        String s = n.asText("");
        return s.isBlank() ? null : s;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "search":  {"type":"string","description":"Recherche par nom ou email (optionnel)."},
                        "channel": {"type":"string","description":"Filtre par canal d'acquisition (airbnb, booking, direct...) (optionnel)."}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Liste les voyageurs (guests) de l'organisation avec leurs statistiques de fidelite (nombre de sejours, total depense, canal, langue). Filtres optionnels : search (nom/email), channel. Utiliser pour 'mes voyageurs', 'infos sur le client X', 'qui sont mes meilleurs clients'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
