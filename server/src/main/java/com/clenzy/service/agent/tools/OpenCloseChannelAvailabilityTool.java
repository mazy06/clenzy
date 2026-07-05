package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.integration.channel.ChannelAvailabilityService;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
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

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Tool {@code open_close_channel_availability} — ouvre ou ferme la vente sur
 * UN canal precis (ex. fermer Airbnb seul sur une plage, laisser Booking
 * ouvert), via {@link ChannelAvailabilityService} (S3).
 *
 * <p>requiresConfirmation = true : c'est un mutateur vers les OTAs (meme
 * mecanisme que {@code trigger_channel_sync}) — l'orchestrateur n'execute
 * jamais ce tool sans confirmation utilisateur prealable. Candidat naturel
 * aux Regles de Confiance.</p>
 *
 * <p>Tenant-safety : le service valide l'ownership de la propriete
 * (OrganizationAccessGuard) et le mapping canal est filtre par
 * (propertyId, channel, orgId).</p>
 */
@Component
public class OpenCloseChannelAvailabilityTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(OpenCloseChannelAvailabilityTool.class);
    private static final String NAME = "open_close_channel_availability";

    private final ChannelAvailabilityService channelAvailabilityService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public OpenCloseChannelAvailabilityTool(ChannelAvailabilityService channelAvailabilityService,
                                            ObjectMapper objectMapper) {
        this.channelAvailabilityService = channelAvailabilityService;
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
        Long propertyId = requiredLong(args, "propertyId");
        ChannelName channel = parseChannel(requiredText(args, "channel"));
        LocalDate from = parseDate(requiredText(args, "from"), "from");
        LocalDate to = parseDate(requiredText(args, "to"), "to");
        boolean open = parseAction(requiredText(args, "action"));

        try {
            SyncResult result = channelAvailabilityService.setChannelAvailability(
                    context.organizationId(), propertyId, channel, from, to, open);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("propertyId", propertyId);
            payload.put("channel", channel.name());
            payload.put("action", open ? "open" : "close");
            payload.put("from", from.toString());
            payload.put("to", to.toString());
            payload.put("status", result.getStatus().name());
            payload.put("message", result.getMessage() != null
                    ? result.getMessage()
                    : (open ? "Vente rouverte sur " : "Vente fermee sur ") + channel
                            + " du " + from + " au " + to + " inclus.");
            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME, e.getMessage());
        } catch (ToolExecutionException e) {
            throw e;
        } catch (Exception e) {
            log.warn("open_close_channel_availability failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Operation impossible (" + e.getMessage() + ")", e);
        }
    }

    // ---- Parsing des arguments ----

    private static Long requiredLong(JsonNode args, String field) {
        if (!args.hasNonNull(field)) {
            throw new ToolExecutionException(NAME, field + " est requis");
        }
        return args.path(field).asLong();
    }

    private static String requiredText(JsonNode args, String field) {
        if (!args.hasNonNull(field) || args.path(field).asText().isBlank()) {
            throw new ToolExecutionException(NAME, field + " est requis");
        }
        return args.path(field).asText();
    }

    private static ChannelName parseChannel(String raw) {
        try {
            return ChannelName.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME, "Canal inconnu: " + raw
                    + " (attendu: AIRBNB, BOOKING, EXPEDIA, VRBO, ...)");
        }
    }

    private static LocalDate parseDate(String raw, String field) {
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new ToolExecutionException(NAME,
                    field + " invalide: " + raw + " (format attendu: YYYY-MM-DD)");
        }
    }

    private static boolean parseAction(String raw) {
        String action = raw.trim().toLowerCase(Locale.ROOT);
        if ("open".equals(action)) return true;
        if ("close".equals(action)) return false;
        throw new ToolExecutionException(NAME, "action invalide: " + raw + " (attendu: open | close)");
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"REQUIS : ID de la propriete"},
                        "channel": {"type":"string","description":"REQUIS : canal cible (AIRBNB, BOOKING, EXPEDIA, VRBO...)"},
                        "from": {"type":"string","description":"REQUIS : debut de plage YYYY-MM-DD (inclus)"},
                        "to": {"type":"string","description":"REQUIS : fin de plage YYYY-MM-DD (INCLUSE, max 365 jours)"},
                        "action": {"type":"string","enum":["open","close"],"description":"REQUIS : close = fermer la vente sur ce canal uniquement, open = rouvrir (re-push de l'etat reel)"}
                      },
                      "required": ["propertyId", "channel", "from", "to", "action"]
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Ferme ou rouvre la vente sur UN canal precis (ex. fermer Airbnb seul du 10 au 15 aout, "
                            + "Booking reste ouvert). Pour 'ferme Airbnb', 'bloque la vente sur Booking', "
                            + "'rouvre le canal'. Confirmation requise.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
