package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.model.Reservation;
import com.clenzy.service.InterventionService;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Tool {@code get_properties_performance} — comparaison des proprietes les
 * plus actives (bar chart).
 *
 * <p>Aligne avec {@code PropertyStatData} du module reports
 * ({@code services/api/reportsApi.ts}). Series : revenus + nombre d'interventions
 * par propriete, sur une fenetre temporelle. Top N (defaut 10) trie par revenus.</p>
 */
@Component
public class GetPropertiesPerformanceTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetPropertiesPerformanceTool.class);
    private static final String NAME = "get_properties_performance";
    private static final int DEFAULT_TOP_N = 10;
    private static final int MAX_TOP_N = 20;
    private static final int DEFAULT_MONTHS = 6;
    private static final int AGGREGATION_PAGE_SIZE = 500;

    private final ReservationService reservationService;
    private final InterventionService interventionService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetPropertiesPerformanceTool(ReservationService reservationService,
                                         InterventionService interventionService,
                                         ObjectMapper objectMapper) {
        this.reservationService = reservationService;
        this.interventionService = interventionService;
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
        if (context.jwt() == null) {
            throw new ToolExecutionException(NAME, "JWT requis (role-based filtering interventions)");
        }
        int months = Math.max(1, args.path("months").asInt(DEFAULT_MONTHS));
        int topN = Math.min(MAX_TOP_N, Math.max(1, args.path("limit").asInt(DEFAULT_TOP_N)));

        LocalDate today = LocalDate.now();
        LocalDate from = today.minusMonths(months - 1L).withDayOfMonth(1);
        LocalDate to = today.withDayOfMonth(today.lengthOfMonth());

        try {
            // ── Aggregate revenue par propriete (Reservation.totalPrice) ─────────
            List<Reservation> reservations = reservationService.getReservations(
                    context.keycloakId(), null, from, to);

            Map<Long, PropertyStats> byProperty = reservations.stream()
                    .filter(r -> r.getProperty() != null && r.getProperty().getId() != null)
                    .collect(Collectors.toMap(
                            r -> r.getProperty().getId(),
                            this::statsFromReservation,
                            PropertyStats::merge
                    ));

            // ── Aggregate interventions par propriete ───────────────────────────
            Page<InterventionResponse> interventionsPage = interventionService.listWithRoleBasedAccess(
                    PageRequest.of(0, AGGREGATION_PAGE_SIZE),
                    null, null, null, null,
                    from.toString(), to.toString(),
                    context.jwt());

            for (InterventionResponse i : interventionsPage.getContent()) {
                if (i.propertyId() == null) continue;
                PropertyStats stats = byProperty.computeIfAbsent(i.propertyId(),
                        k -> new PropertyStats(i.propertyName() != null ? i.propertyName() : ("Prop #" + k)));
                if (stats.name == null && i.propertyName() != null) stats.name = i.propertyName();
                stats.interventions++;
            }

            // ── Top N tri par revenus DESC (a defaut, par # interventions) ──────
            List<Map<String, Object>> items = byProperty.values().stream()
                    .sorted((a, b) -> {
                        int byRevenue = b.revenue.compareTo(a.revenue);
                        if (byRevenue != 0) return byRevenue;
                        return Integer.compare(b.interventions, a.interventions);
                    })
                    .limit(topN)
                    .map(this::toItem)
                    .toList();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("title", "Top " + items.size() + " proprietes (sur " + months + " mois)");
            payload.put("series", List.of(
                    Map.of("key", "revenue", "label", "Revenus", "color", "#4A9B8E"),
                    Map.of("key", "interventions", "label", "Interventions", "color", "#6B8A9A")
            ));
            payload.put("propertyCount", byProperty.size());

            return ToolResult.success(objectMapper.writeValueAsString(payload), "chart_bar");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("get_properties_performance failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Performance proprietes indisponible (" + e.getMessage() + ")", e);
        }
    }

    // ─── Aggregation helpers ─────────────────────────────────────────────────

    private PropertyStats statsFromReservation(Reservation r) {
        PropertyStats s = new PropertyStats(
                r.getProperty().getName() != null
                        ? r.getProperty().getName()
                        : "Prop #" + r.getProperty().getId());
        if (r.getTotalPrice() != null) {
            s.revenue = r.getTotalPrice();
        }
        s.reservations = 1;
        return s;
    }

    private Map<String, Object> toItem(PropertyStats s) {
        Map<String, Object> m = new LinkedHashMap<>();
        // Tronquer le nom pour ne pas casser l'axe X du bar chart
        m.put("name", s.name != null && s.name.length() > 16
                ? s.name.substring(0, 14) + "…"
                : s.name);
        m.put("revenue", s.revenue.setScale(2, RoundingMode.HALF_UP).doubleValue());
        m.put("interventions", s.interventions);
        m.put("reservations", s.reservations);
        return m;
    }

    private static class PropertyStats {
        String name;
        BigDecimal revenue = BigDecimal.ZERO;
        int interventions = 0;
        int reservations = 0;

        PropertyStats(String name) {
            this.name = name;
        }

        PropertyStats merge(PropertyStats other) {
            this.revenue = this.revenue.add(other.revenue);
            this.interventions += other.interventions;
            this.reservations += other.reservations;
            if (this.name == null) this.name = other.name;
            return this;
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "months": {"type":"integer","minimum":1,"maximum":24,"description":"Fenetre temporelle en mois (defaut 6)"},
                        "limit":  {"type":"integer","minimum":1,"maximum":20,"description":"Top N proprietes (defaut 10, max 20)"}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Affiche un bar chart des Top N proprietes les plus performantes (revenus + nombre d'interventions) sur une fenetre temporelle. Utiliser pour 'meilleures proprietes', 'classement', 'ranking', 'top performers', 'quelle propriete genere le plus'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
