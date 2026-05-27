package com.clenzy.service.agent.tools;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.service.InterventionService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
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
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ListCleaningTasksToolTest {

    private InterventionService interventionService;
    private ListCleaningTasksTool tool;
    private ObjectMapper om;
    private Jwt jwt;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        interventionService = mock(InterventionService.class);
        om = new ObjectMapper();
        tool = new ListCleaningTasksTool(interventionService, om);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("user-123")
                .claim("realm_access", Map.of("roles", List.of("ROLE_HOST")))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        ctx = new AgentContext(1L, "user-123", jwt, "fr", null, null);
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("list_cleaning_tasks", tool.name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void typeAlwaysHOUSEKEEPING_jwtPassed() {
        Page<InterventionResponse> empty = new PageImpl<>(List.of(), Pageable.ofSize(20), 0);
        when(interventionService.listWithRoleBasedAccess(any(), any(), anyString(),
                any(), any(), any(), any(), any())).thenReturn(empty);

        tool.execute(om.createObjectNode(), ctx);

        ArgumentCaptor<String> typeCap = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Jwt> jwtCap = ArgumentCaptor.forClass(Jwt.class);
        verify(interventionService).listWithRoleBasedAccess(any(), isNull(), typeCap.capture(),
                isNull(), isNull(), isNull(), isNull(), jwtCap.capture());
        assertEquals("HOUSEKEEPING", typeCap.getValue());
        assertEquals(jwt, jwtCap.getValue());
    }

    @Test
    void nullJwt_throwsBeforeServiceCall() {
        AgentContext noJwt = AgentContext.minimal(1L, "u");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), noJwt));
        assertTrue(ex.getMessage().contains("JWT requis"));
        verifyNoInteractions(interventionService);
    }

    @Test
    void filtersPassedToService() {
        Page<InterventionResponse> empty = new PageImpl<>(List.of(), Pageable.ofSize(20), 0);
        when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                any(), any(), any(), any())).thenReturn(empty);

        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 7);
        args.put("status", "PENDING");
        args.put("priority", "HIGH");
        args.put("from", "2026-06-01");
        args.put("to", "2026-06-30");

        tool.execute(args, ctx);

        verify(interventionService).listWithRoleBasedAccess(any(),
                eq(7L), eq("HOUSEKEEPING"), eq("PENDING"), eq("HIGH"),
                eq("2026-06-01"), eq("2026-06-30"), eq(jwt));
    }

    @Test
    void compactItemContainsKeyFields() throws Exception {
        InterventionResponse r = InterventionResponse.builder()
                .id(42L)
                .title("Menage check-out")
                .status("PENDING")
                .priority("HIGH")
                .propertyId(7L)
                .propertyName("Loft Bastille")
                .scheduledDate("2026-06-01")
                .assignedToName("Alice")
                .assignedUserRole("HOUSEKEEPER")
                .progressPercentage(0)
                .build();

        Page<InterventionResponse> page = new PageImpl<>(List.of(r), Pageable.ofSize(20), 1);
        when(interventionService.listWithRoleBasedAccess(any(), any(), any(), any(),
                any(), any(), any(), any())).thenReturn(page);

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode item = om.readTree(result.content()).path("items").get(0);

        assertEquals(42L, item.path("id").asLong());
        assertEquals("Menage check-out", item.path("title").asText());
        assertEquals("PENDING", item.path("status").asText());
        assertEquals("HIGH", item.path("priority").asText());
        assertEquals(7L, item.path("propertyId").asLong());
        assertEquals("Loft Bastille", item.path("propertyName").asText());
        assertEquals("2026-06-01", item.path("scheduledDate").asText());
        assertEquals("Alice", item.path("assignedTo").asText());
        assertEquals("HOUSEKEEPER", item.path("assignedRole").asText());
    }
}
