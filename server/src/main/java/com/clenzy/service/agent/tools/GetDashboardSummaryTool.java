package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.kpi.KpiDtos.KpiItemDto;
import com.clenzy.dto.kpi.KpiDtos.KpiSnapshotDto;
import com.clenzy.service.KpiService;
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
 * Tool {@code get_dashboard_summary} — retourne le snapshot KPI courant.
 *
 * <p>Wraps {@link KpiService#computeCurrentSnapshot()}. Aucun argument requis :
 * le KpiService utilise le {@code TenantContext} courant (ThreadLocal) pour
 * filtrer par organisation, ce qui est deja resolu en amont par le filter Spring.</p>
 *
 * <p>Le payload retourne est compact (8-10 KPI principaux) — l'assistant peut
 * lire directement les valeurs formattees ({@code value} deja "99.95%", "25.4ms").</p>
 */
@Component
public class GetDashboardSummaryTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetDashboardSummaryTool.class);
    private static final String NAME = "get_dashboard_summary";

    private final KpiService kpiService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetDashboardSummaryTool(KpiService kpiService, ObjectMapper objectMapper) {
        this.kpiService = kpiService;
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
            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();

            // Payload compact pour le LLM : on garde id, name, value formattee, status, critical, target.
            // Pas besoin de targetValue numerique (le LLM lit le formatte).
            List<Map<String, Object>> kpis = snapshot.kpis().stream()
                    .map(this::compactKpi)
                    .toList();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("readinessScore", snapshot.readinessScore());
            payload.put("criticalFailed", snapshot.criticalFailed());
            payload.put("capturedAt", snapshot.capturedAt());
            payload.put("kpiCount", kpis.size());
            payload.put("kpis", kpis);

            String json = objectMapper.writeValueAsString(payload);
            return ToolResult.success(json, "summary");
        } catch (JsonProcessingException e) {
            log.error("get_dashboard_summary: failed to serialize snapshot", e);
            throw new ToolExecutionException(NAME, "Failed to serialize KPI snapshot", e);
        } catch (Exception e) {
            log.warn("get_dashboard_summary: KPI snapshot computation failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "KPI snapshot indisponible (" + e.getMessage() + ")", e);
        }
    }

    private Map<String, Object> compactKpi(KpiItemDto kpi) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", kpi.id());
        m.put("name", kpi.name());
        m.put("value", kpi.value());
        m.put("target", kpi.target());
        m.put("status", kpi.status());
        if (kpi.critical()) m.put("critical", true);
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
                    "Retourne le snapshot KPI courant de l'organisation (readiness score, KPI principaux : uptime, latence calendar, sync errors, double bookings, etc.). A utiliser quand l'utilisateur demande l'etat du systeme, les KPI, la sante de la plateforme.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
