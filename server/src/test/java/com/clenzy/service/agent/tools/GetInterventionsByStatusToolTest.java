package com.clenzy.service.agent.tools;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.service.InterventionService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class GetInterventionsByStatusToolTest {

    private InterventionService interventionService;
    private GetInterventionsByStatusTool tool;
    private ObjectMapper om;
    private AgentContext ctx;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        interventionService = mock(InterventionService.class);
        om = new ObjectMapper();
        tool = new GetInterventionsByStatusTool(interventionService, om);

        jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        ctx = new AgentContext(1L, "user-123", jwt, "fr", null, null);
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_interventions_by_status", tool.name());
        assertEquals("get_interventions_by_status", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation(), "read-only tool");
    }

    @Test
    void nullJwt_throws() {
        AgentContext noJwt = AgentContext.minimal(1L, "u");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), noJwt));
        assertTrue(ex.getMessage().contains("JWT requis"));
    }

    @Test
    void groupsByStatus_sortedDesc() throws Exception {
        // 3 PENDING, 2 IN_PROGRESS, 5 COMPLETED → sort: 5/3/2
        List<InterventionResponse> interventions = List.of(
                buildIntv("PENDING"), buildIntv("PENDING"), buildIntv("PENDING"),
                buildIntv("IN_PROGRESS"), buildIntv("IN_PROGRESS"),
                buildIntv("COMPLETED"), buildIntv("COMPLETED"), buildIntv("COMPLETED"),
                buildIntv("COMPLETED"), buildIntv("COMPLETED")
        );
        Page<InterventionResponse> page = new PageImpl<>(interventions, Pageable.ofSize(500), 10);
        when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                any(), any(), any(), any())).thenReturn(page);

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        assertFalse(result.isError());
        assertEquals("chart_pie", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        JsonNode items = payload.path("items");
        assertEquals(3, items.size());

        // Top sorted DESC : COMPLETED(5), PENDING(3), IN_PROGRESS(2)
        assertEquals("COMPLETED", items.get(0).path("name").asText());
        assertEquals(5, items.get(0).path("value").asInt());
        assertEquals("PENDING", items.get(1).path("name").asText());
        assertEquals(3, items.get(1).path("value").asInt());
        assertEquals("IN_PROGRESS", items.get(2).path("name").asText());
        assertEquals(2, items.get(2).path("value").asInt());
    }

    @Test
    void emptyResult_returnsEmptyItems() throws Exception {
        when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());
        assertEquals(0, payload.path("items").size());
        assertEquals(0L, payload.path("totalCount").asLong());
    }

    @Test
    void filtersForwarded_propertyIdAndType() {
        when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(), Pageable.ofSize(500), 0));

        com.fasterxml.jackson.databind.node.ObjectNode args = om.createObjectNode();
        args.put("propertyId", 42);
        args.put("type", "HOUSEKEEPING");
        args.put("from", "2026-01-01");
        args.put("to", "2026-12-31");

        tool.execute(args, ctx);

        verify(interventionService).listWithRoleBasedAccess(any(),
                eq(42L), eq("HOUSEKEEPING"), isNull(), isNull(),
                eq("2026-01-01"), eq("2026-12-31"), eq(jwt));
    }

    @Test
    void payloadHasTitleAndCenterLabel() throws Exception {
        when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(buildIntv("COMPLETED")), Pageable.ofSize(500), 1));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        assertNotNull(payload.path("title").asText(null));
        assertEquals("interventions", payload.path("centerLabel").asText());
        assertEquals(1L, payload.path("totalCount").asLong());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private InterventionResponse buildIntv(String status) {
        return InterventionResponse.builder()
                .id(1L)
                .title("Test")
                .status(status)
                .propertyId(1L)
                .build();
    }
}
