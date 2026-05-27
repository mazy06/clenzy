package com.clenzy.service.agent.tools;

import com.clenzy.dto.kpi.KpiDtos.KpiItemDto;
import com.clenzy.dto.kpi.KpiDtos.KpiSnapshotDto;
import com.clenzy.service.KpiService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GetDashboardSummaryToolTest {

    private KpiService kpiService;
    private GetDashboardSummaryTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        kpiService = mock(KpiService.class);
        om = new ObjectMapper();
        tool = new GetDashboardSummaryTool(kpiService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_dashboard_summary", tool.name());
        assertEquals("get_dashboard_summary", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation(), "read-only tool");
    }

    @Test
    void execute_returnsCompactSnapshot() throws Exception {
        KpiItemDto uptime = new KpiItemDto("UPTIME", "Uptime", "99.95%", 99.95,
                ">= 99.9%", 99.9, "%", "OK", true, 10);
        KpiItemDto latency = new KpiItemDto("API_LATENCY_P95", "API P95", "120ms", 120,
                "< 200ms", 200, "ms", "OK", false, 5);
        KpiSnapshotDto snapshot = new KpiSnapshotDto(1L, "2026-05-25T10:00:00Z",
                0.95, false, List.of(uptime, latency), "scheduled");

        when(kpiService.computeCurrentSnapshot()).thenReturn(snapshot);

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(0.95, payload.path("readinessScore").asDouble(), 0.0001);
        assertFalse(payload.path("criticalFailed").asBoolean());
        assertEquals(2, payload.path("kpiCount").asInt());

        JsonNode kpis = payload.path("kpis");
        assertEquals(2, kpis.size());
        assertEquals("UPTIME", kpis.get(0).path("id").asText());
        assertEquals("99.95%", kpis.get(0).path("value").asText());
        assertEquals("OK", kpis.get(0).path("status").asText());
        assertTrue(kpis.get(0).path("critical").asBoolean());
        // non-critical KPI doesn't expose the field
        assertFalse(kpis.get(1).has("critical"));
    }

    @Test
    void execute_wrapsKpiServiceFailure() {
        when(kpiService.computeCurrentSnapshot()).thenThrow(new RuntimeException("boom"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertEquals("get_dashboard_summary", ex.getToolName());
        assertTrue(ex.getMessage().contains("boom"));
    }
}
