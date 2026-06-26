package com.clenzy.service.agent.tools;

import com.clenzy.dto.noise.NoiseAlertDto;
import com.clenzy.service.NoiseAlertService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GetNoiseAlertsToolTest {

    private NoiseAlertService noiseAlertService;
    private GetNoiseAlertsTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        noiseAlertService = mock(NoiseAlertService.class);
        om = new ObjectMapper();
        tool = new GetNoiseAlertsTool(noiseAlertService, om);
        ctx = AgentContext.minimal(7L, "user-123");
    }

    private static NoiseAlertDto alert(Long id, Long propertyId, String propertyName,
                                       String severity, double measuredDb) {
        return new NoiseAlertDto(
                id, propertyId, propertyName,
                99L, "Capteur salon",
                severity, measuredDb, 70,
                "Nuit", "WEBHOOK",
                true, false, false,
                false, "agent-keycloak-id", null, "note interne nominative",
                LocalDateTime.of(2026, 6, 25, 23, 30));
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_noise_alerts", tool.name());
        assertEquals("get_noise_alerts", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void listsRecentNoiseAlerts_passingOrgIdAndFilters() throws Exception {
        List<NoiseAlertDto> alerts = List.of(
                alert(1L, 10L, "Loft Bastille", "CRITICAL", 85.0),
                alert(2L, 20L, "Studio Lyon", "WARNING", 72.0)
        );
        Page<NoiseAlertDto> page = new PageImpl<>(alerts, Pageable.ofSize(20), 2);
        when(noiseAlertService.getAlerts(eq(7L), isNull(), isNull(), any())).thenReturn(page);

        ToolResult result = tool.execute(om.createObjectNode(), ctx);

        assertFalse(result.isError());
        assertEquals("list", result.displayHint());

        // Le orgId du contexte est bien transmis au service (multi-tenant).
        verify(noiseAlertService).getAlerts(eq(7L), isNull(), isNull(), any());

        JsonNode payload = om.readTree(result.content());
        assertEquals(2, payload.path("count").asInt());
        assertEquals(2, payload.path("totalAlerts").asInt());

        JsonNode first = payload.path("items").get(0);
        assertEquals(1L, first.path("id").asLong());
        assertEquals("Loft Bastille", first.path("propertyName").asText());
        assertEquals("Capteur salon", first.path("deviceName").asText());
        assertEquals("CRITICAL", first.path("severity").asText());
        assertEquals(85.0, first.path("measuredDb").asDouble());
        assertEquals(70, first.path("thresholdDb").asInt());
        assertEquals("Nuit", first.path("timeWindowLabel").asText());
        assertEquals("WEBHOOK", first.path("source").asText());
        assertFalse(first.path("acknowledged").asBoolean());
        assertEquals("2026-06-25T23:30", first.path("createdAt").asText());
    }

    @Test
    void doesNotExposePersonalData_acknowledgedByAndNotes() throws Exception {
        Page<NoiseAlertDto> page = new PageImpl<>(
                List.of(alert(1L, 10L, "Loft Bastille", "WARNING", 71.0)),
                Pageable.ofSize(20), 1);
        when(noiseAlertService.getAlerts(anyLong(), any(), any(), any())).thenReturn(page);

        String content = tool.execute(om.createObjectNode(), ctx).content();

        // PII volontairement omise du payload renvoye au LLM.
        assertFalse(content.contains("acknowledgedBy"));
        assertFalse(content.contains("agent-keycloak-id"));
        assertFalse(content.contains("notes"));
        assertFalse(content.contains("note interne nominative"));
    }

    @Test
    void appliesPropertyAndSeverityFilters_andClampsLimit() {
        Page<NoiseAlertDto> page = new PageImpl<>(List.of(), Pageable.ofSize(30), 0);
        when(noiseAlertService.getAlerts(anyLong(), any(), any(), any())).thenReturn(page);

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 55);
        args.put("severity", "critical"); // accepte en minuscules
        args.put("limit", 999);           // clampe a 30

        tool.execute(args, ctx);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(noiseAlertService).getAlerts(eq(7L), eq(55L), eq("CRITICAL"), pageableCaptor.capture());
        assertEquals(30, pageableCaptor.getValue().getPageSize());
    }

    @Test
    void invalidSeverity_ignored() {
        Page<NoiseAlertDto> page = new PageImpl<>(List.of(), Pageable.ofSize(20), 0);
        when(noiseAlertService.getAlerts(anyLong(), any(), any(), any())).thenReturn(page);

        ObjectNode args = om.createObjectNode();
        args.put("severity", "bogus");

        tool.execute(args, ctx);

        verify(noiseAlertService).getAlerts(eq(7L), isNull(), isNull(), any());
    }
}
