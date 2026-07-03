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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Tool {@code get_financial_summary} — bar chart financier par mois sur
 * une fenetre temporelle.
 *
 * <p>Aggregations :</p>
 * <ul>
 *   <li><b>revenue</b> : somme {@code Reservation.totalPrice} par mois (sur checkIn)</li>
 *   <li><b>expenses</b> : somme {@code Intervention.actualCost} par mois (sur scheduledDate)</li>
 *   <li><b>profit</b> : revenue - expenses</li>
 * </ul>
 *
 * <p>Retourne un payload {@code chart_bar} compatible avec {@link
 * com.clenzy.service.agent.AgentSseEvent#toolCallExecuted}, consomme par le
 * widget frontend {@code BarChartWidget}.</p>
 *
 * <p>Aligne avec la {@code FinancialMonthlyData} de
 * {@code services/api/reportsApi.ts} (meme shape : {@code month/revenue/expenses/profit}).</p>
 */
@Component
public class GetFinancialSummaryTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetFinancialSummaryTool.class);
    private static final String NAME = "get_financial_summary";
    private static final int DEFAULT_MONTHS = 6;
    private static final int MAX_MONTHS = 24;
    private static final int AGGREGATION_PAGE_SIZE = 500;
    private static final DateTimeFormatter MONTH_KEY_FMT = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final String[] MONTHS_FR_SHORT = {
            "Jan", "Fev", "Mar", "Avr", "Mai", "Juin",
            "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"
    };

    private final ReservationService reservationService;
    private final InterventionService interventionService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetFinancialSummaryTool(ReservationService reservationService,
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
        int months = Math.min(MAX_MONTHS, Math.max(1, args.path("months").asInt(DEFAULT_MONTHS)));
        Long propertyId = args.hasNonNull("propertyId") ? args.path("propertyId").asLong() : null;

        LocalDate today = LocalDate.now();
        LocalDate from = today.minusMonths(months - 1L).withDayOfMonth(1);
        LocalDate to = today.withDayOfMonth(today.lengthOfMonth());

        try {
            // ── Revenue : reservations.totalPrice groupe par mois (checkIn) ───────
            List<Long> propertyIds = propertyId != null ? List.of(propertyId) : null;
            List<Reservation> reservations = reservationService.getReservations(
                    context.keycloakId(), propertyIds, from, to);

            // ── Expenses : interventions.actualCost groupe par mois (scheduledDate) ─
            Page<InterventionResponse> interventionsPage = interventionService.listWithRoleBasedAccess(
                    PageRequest.of(0, AGGREGATION_PAGE_SIZE),
                    propertyId, null, null, null,
                    from.toString(), to.toString(),
                    context.jwt());

            // TreeMap pour ordre chronologique
            Map<String, MonthFinancials> byMonth = new TreeMap<>();
            for (int i = 0; i < months; i++) {
                LocalDate monthStart = from.plusMonths(i);
                byMonth.put(monthStart.format(MONTH_KEY_FMT), new MonthFinancials());
            }

            // Aggregate revenue
            for (Reservation r : reservations) {
                if (r.getCheckIn() == null || r.getTotalPrice() == null) continue;
                String key = r.getCheckIn().format(MONTH_KEY_FMT);
                MonthFinancials m = byMonth.get(key);
                if (m == null) continue;
                m.revenue = m.revenue.add(r.getTotalPrice());
            }

            // Aggregate expenses
            for (InterventionResponse i : interventionsPage.getContent()) {
                LocalDate intvDate = parseInterventionDate(i);
                if (intvDate == null || i.actualCost() == null) continue;
                String key = intvDate.format(MONTH_KEY_FMT);
                MonthFinancials m = byMonth.get(key);
                if (m == null) continue;
                m.expenses = m.expenses.add(i.actualCost());
            }

            // Convertir en items : [{ name: 'Avr', revenue: 1200, expenses: 300, profit: 900 }]
            List<Map<String, Object>> items = new java.util.ArrayList<>();
            BigDecimal totalRevenue = BigDecimal.ZERO;
            BigDecimal totalExpenses = BigDecimal.ZERO;
            for (Map.Entry<String, MonthFinancials> entry : byMonth.entrySet()) {
                LocalDate monthStart = LocalDate.parse(entry.getKey() + "-01");
                MonthFinancials stats = entry.getValue();
                BigDecimal profit = stats.revenue.subtract(stats.expenses);
                totalRevenue = totalRevenue.add(stats.revenue);
                totalExpenses = totalExpenses.add(stats.expenses);

                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", MONTHS_FR_SHORT[monthStart.getMonthValue() - 1]);
                m.put("revenue", round2(stats.revenue));
                m.put("expenses", round2(stats.expenses));
                m.put("profit", round2(profit));
                items.add(m);
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("title", "Bilan financier sur " + months + " mois");
            payload.put("series", List.of(
                    Map.of("key", "revenue", "label", "Revenus", "color", "#4A9B8E"),
                    Map.of("key", "expenses", "label", "Depenses", "color", "#C97A7A"),
                    Map.of("key", "profit", "label", "Profit", "color", "#6B8A9A")
            ));
            payload.put("totalRevenue", round2(totalRevenue));
            payload.put("totalExpenses", round2(totalExpenses));
            payload.put("totalProfit", round2(totalRevenue.subtract(totalExpenses)));

            return ToolResult.success(objectMapper.writeValueAsString(payload), "chart_bar");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("get_financial_summary failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Bilan financier indisponible (" + e.getMessage() + ")", e);
        }
    }

    /** Extrait une LocalDate exploitable d'une intervention. */
    private static LocalDate parseInterventionDate(InterventionResponse i) {
        // Priorite : scheduledDate (string YYYY-MM-DD), sinon startTime
        if (i.scheduledDate() != null && !i.scheduledDate().isBlank()) {
            try {
                return LocalDate.parse(i.scheduledDate());
            } catch (Exception ignored) {
                // fallthrough
            }
        }
        LocalDateTime dt = i.startTime() != null ? i.startTime() : i.createdAt();
        return dt != null ? dt.toLocalDate() : null;
    }

    private static double round2(BigDecimal v) {
        return v.setScale(2, java.math.RoundingMode.HALF_UP).doubleValue();
    }

    private static class MonthFinancials {
        BigDecimal revenue = BigDecimal.ZERO;
        BigDecimal expenses = BigDecimal.ZERO;
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
                    "Bar chart du bilan financier mensuel sur N mois (defaut 6) : revenus, depenses, profit + totaux. Pour 'bilan', 'CA', 'depenses', 'profit', 'rentabilite'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
