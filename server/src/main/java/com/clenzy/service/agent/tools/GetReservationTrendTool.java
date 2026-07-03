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
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Tool {@code get_reservation_trend} — courbe (line chart) du nombre de
 * reservations par mois sur les N derniers mois.
 *
 * <p>Retourne un payload {@code chart_line} consomme par le widget frontend
 * {@code LineChartWidget}. Format aligne avec {@code MonthlyInterventionData}
 * du module /reports : {@code [{ name: "Jan", total: 12, confirmed: 10 }]}.</p>
 */
@Component
public class GetReservationTrendTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetReservationTrendTool.class);
    private static final String NAME = "get_reservation_trend";
    private static final int DEFAULT_MONTHS = 6;
    private static final int MAX_MONTHS = 24;
    private static final DateTimeFormatter MONTH_KEY_FMT = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final String[] MONTHS_FR_SHORT = {
            "Jan", "Fev", "Mar", "Avr", "Mai", "Juin",
            "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"
    };

    private final ReservationService reservationService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetReservationTrendTool(ReservationService reservationService, ObjectMapper objectMapper) {
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
        int months = Math.min(MAX_MONTHS, Math.max(1, args.path("months").asInt(DEFAULT_MONTHS)));
        Long propertyId = args.hasNonNull("propertyId") ? args.path("propertyId").asLong() : null;

        LocalDate today = LocalDate.now();
        LocalDate from = today.minusMonths(months - 1L).withDayOfMonth(1);
        LocalDate to = today.withDayOfMonth(today.lengthOfMonth());

        try {
            List<Long> propertyIds = propertyId != null ? List.of(propertyId) : null;
            List<Reservation> reservations = reservationService.getReservations(
                    context.keycloakId(), propertyIds, from, to);

            // Agregation : count par mois ET par statut. On groupe sur le checkIn.
            // TreeMap pour conserver l'ordre chronologique sur la cle yyyy-MM.
            Map<String, MonthStats> byMonth = new TreeMap<>();

            // Initialiser tous les mois de la fenetre meme s'ils sont vides
            for (int i = 0; i < months; i++) {
                LocalDate monthStart = from.plusMonths(i);
                byMonth.put(monthStart.format(MONTH_KEY_FMT), new MonthStats());
            }

            for (Reservation r : reservations) {
                if (r.getCheckIn() == null) continue;
                String key = r.getCheckIn().format(MONTH_KEY_FMT);
                MonthStats stats = byMonth.get(key);
                if (stats == null) continue; // hors fenetre (defense)
                stats.total++;
                if ("CONFIRMED".equalsIgnoreCase(r.getStatus())) stats.confirmed++;
                if ("CANCELLED".equalsIgnoreCase(r.getStatus())) stats.cancelled++;
            }

            // Convertir en items [{ name: "Avr", total: 12, confirmed: 10, cancelled: 2 }]
            List<Map<String, Object>> items = new java.util.ArrayList<>();
            for (Map.Entry<String, MonthStats> entry : byMonth.entrySet()) {
                LocalDate monthStart = LocalDate.parse(entry.getKey() + "-01");
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", MONTHS_FR_SHORT[monthStart.getMonthValue() - 1]);
                m.put("total", entry.getValue().total);
                m.put("confirmed", entry.getValue().confirmed);
                if (entry.getValue().cancelled > 0) {
                    m.put("cancelled", entry.getValue().cancelled);
                }
                items.add(m);
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("title", "Reservations sur " + months + " mois");
            payload.put("series", List.of(
                    Map.of("key", "total", "label", "Total"),
                    Map.of("key", "confirmed", "label", "Confirmees")
            ));

            return ToolResult.success(objectMapper.writeValueAsString(payload), "chart_line");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("get_reservation_trend failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Trend indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static class MonthStats {
        int total = 0;
        int confirmed = 0;
        int cancelled = 0;
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "months":     {"type":"integer","minimum":1,"maximum":24,"description":"Nombre de mois retroactifs (defaut 6)"},
                        "propertyId": {"type":"integer","description":"Filtre sur une propriete (optionnel)"}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Line chart des reservations par mois sur N mois (defaut 6) : total, confirmed, cancelled. Pour 'evolution', 'tendance', 'historique', saisonnalite.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
