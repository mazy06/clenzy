package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.Reservation;
import com.clenzy.service.ReservationService;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code list_reservations} — liste des reservations sur une fenetre de dates.
 *
 * <p>Wraps {@link ReservationService#getReservations(String, java.util.List, LocalDate, LocalDate)}.
 * Filtres : {@code from} (date debut), {@code to} (date fin), {@code propertyId} (optionnel),
 * {@code status} (optionnel, filtrage en memoire car le service ne le supporte pas
 * directement), {@code limit}.</p>
 *
 * <p>Par defaut : aujourd'hui jusqu'a +30 jours. Limit max 50.</p>
 */
@Component
public class ListReservationsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(ListReservationsTool.class);
    private static final String NAME = "list_reservations";
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;
    private static final int DEFAULT_WINDOW_DAYS = 30;

    private final ReservationService reservationService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public ListReservationsTool(ReservationService reservationService, ObjectMapper objectMapper) {
        this.reservationService = reservationService;
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
        LocalDate today = LocalDate.now();
        LocalDate from = parseDate(args.path("from").asText(null), today);
        LocalDate to = parseDate(args.path("to").asText(null), today.plusDays(DEFAULT_WINDOW_DAYS));
        if (from.isAfter(to)) {
            throw new ToolExecutionException(NAME, "from > to (verifier les dates)");
        }
        int limit = Math.min(MAX_LIMIT, Math.max(1, args.path("limit").asInt(DEFAULT_LIMIT)));
        Long propertyId = args.hasNonNull("propertyId") ? args.path("propertyId").asLong() : null;
        String statusFilter = optString(args, "status");

        List<Long> propertyIds = propertyId != null ? List.of(propertyId) : null;

        try {
            List<Reservation> all = reservationService.getReservations(
                    context.keycloakId(), propertyIds, from, to);

            List<Reservation> filtered = all.stream()
                    .filter(r -> statusFilter == null
                            || (r.getStatus() != null && r.getStatus().equalsIgnoreCase(statusFilter)))
                    .sorted(Comparator.comparing(Reservation::getCheckIn,
                            Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList();

            List<Map<String, Object>> items = filtered.stream()
                    .limit(limit)
                    .map(this::compact)
                    .toList();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("from", from.toString());
            payload.put("to", to.toString());
            payload.put("items", items);
            payload.put("count", items.size());
            payload.put("totalMatching", filtered.size());
            payload.put("truncated", filtered.size() > items.size());

            String json = objectMapper.writeValueAsString(payload);
            return ToolResult.success(json, "list");
        } catch (RuntimeException e) {
            // RuntimeException("Utilisateur introuvable") -> message clair pour le LLM
            String msg = e.getMessage() != null ? e.getMessage() : "unknown error";
            log.warn("list_reservations: lookup failed: {}", msg);
            throw new ToolExecutionException(NAME,
                    "Liste reservations indisponible (" + msg + ")", e);
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize reservations", e);
        }
    }

    private Map<String, Object> compact(Reservation r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        if (r.getProperty() != null) {
            m.put("propertyId", r.getProperty().getId());
            m.put("propertyName", r.getProperty().getName());
        }
        if (r.getGuestName() != null) m.put("guestName", r.getGuestName());
        if (r.getCheckIn() != null) m.put("checkIn", r.getCheckIn().toString());
        if (r.getCheckOut() != null) m.put("checkOut", r.getCheckOut().toString());
        if (r.getStatus() != null) m.put("status", r.getStatus());
        if (r.getSource() != null) m.put("source", r.getSource());
        if (r.getTotalPrice() != null) {
            m.put("totalPrice", r.getTotalPrice());
            if (r.getCurrency() != null) m.put("currency", r.getCurrency());
        }
        if (r.getConfirmationCode() != null) m.put("confirmationCode", r.getConfirmationCode());
        return m;
    }

    private static LocalDate parseDate(String raw, LocalDate fallback) {
        if (raw == null || raw.isBlank()) return fallback;
        try {
            return LocalDate.parse(raw);
        } catch (Exception e) {
            return fallback;
        }
    }

    private static String optString(JsonNode args, String key) {
        JsonNode node = args.path(key);
        if (node.isMissingNode() || node.isNull()) return null;
        String s = node.asText("");
        return s.isBlank() ? null : s;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "from":       {"type":"string","format":"date","description":"Date debut (ISO YYYY-MM-DD). Defaut = aujourd'hui."},
                        "to":         {"type":"string","format":"date","description":"Date fin (ISO YYYY-MM-DD). Defaut = aujourd'hui + 30j."},
                        "propertyId": {"type":"integer","description":"Filtre sur une propriete specifique"},
                        "status":     {"type":"string","description":"Filtre par statut (CONFIRMED, PENDING, CANCELLED, ...)"},
                        "limit":      {"type":"integer","minimum":1,"maximum":50,"description":"Nombre max d'items (defaut 20)"}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Liste les reservations sur une fenetre de dates, filtres propriete/statut. Defaut : aujourd'hui +30j. Pour 'combien de resa', 'qui arrive demain'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
