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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AssignInterventionToolTest {

    private InterventionService interventionService;
    private AssignInterventionTool tool;
    private ObjectMapper om;
    private AgentContext ctx;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        interventionService = mock(InterventionService.class);
        om = new ObjectMapper();
        tool = new AssignInterventionTool(interventionService, om);

        jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("user-1")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        ctx = new AgentContext(1L, "user-1", jwt, "fr", null, null);
    }

    private ObjectNode args(Long interventionId, Long userId, Long teamId) {
        ObjectNode args = om.createObjectNode();
        if (interventionId != null) args.put("interventionId", interventionId);
        if (userId != null) args.put("userId", userId);
        if (teamId != null) args.put("teamId", teamId);
        return args;
    }

    private InterventionResponse responseFor(Long id, String assigneeName, String type) {
        return InterventionResponse.builder()
                .id(id)
                .title("Test Intervention")
                .status("ASSIGNED")
                .assignedToName(assigneeName)
                .assignedToType(type)
                .build();
    }

    @Nested
    @DisplayName("descriptor and naming")
    class Descriptor {

        @Test
        void name_isAssignIntervention() {
            assertEquals("assign_intervention", tool.name());
        }

        @Test
        void descriptor_isWriteToolRequiringConfirmation() {
            assertEquals("assign_intervention", tool.descriptor().name());
            assertTrue(tool.descriptor().requiresConfirmation());
            JsonNode schema = tool.descriptor().jsonSchema();
            assertEquals("object", schema.path("type").asText());
            assertTrue(schema.path("required").toString().contains("interventionId"));
            assertTrue(schema.path("properties").has("userId"));
            assertTrue(schema.path("properties").has("teamId"));
        }
    }

    @Nested
    @DisplayName("argument validation")
    class Validation {

        @Test
        @DisplayName("requires JWT")
        void nullJwt_throws() {
            AgentContext noJwt = AgentContext.minimal(1L, "u");
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args(1L, 10L, null), noJwt));
            assertTrue(ex.getMessage().contains("JWT"));
        }

        @Test
        @DisplayName("requires interventionId")
        void missingInterventionId_throws() {
            ObjectNode args = args(null, 10L, null);
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args, ctx));
            assertTrue(ex.getMessage().toLowerCase().contains("interventionid"));
        }

        @Test
        @DisplayName("requires either userId or teamId")
        void neitherUserNorTeam_throws() {
            ObjectNode args = args(1L, null, null);
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args, ctx));
            assertTrue(ex.getMessage().contains("userId OU teamId"));
        }

        @Test
        @DisplayName("rejects both userId and teamId provided")
        void bothUserAndTeam_throws() {
            ObjectNode args = args(1L, 10L, 20L);
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args, ctx));
            assertTrue(ex.getMessage().contains("ET teamId"));
        }
    }

    @Nested
    @DisplayName("execute - happy paths")
    class HappyPath {

        @Test
        @DisplayName("assigns to user")
        void assignToUser_callsServiceAndReturnsSummary() throws Exception {
            InterventionResponse resp = responseFor(42L, "Jean Dupont", "USER");
            when(interventionService.assign(eq(42L), eq(10L), eq(null), eq(jwt)))
                    .thenReturn(resp);

            ToolResult result = tool.execute(args(42L, 10L, null), ctx);

            assertFalse(result.isError());
            assertEquals("summary", result.displayHint());

            JsonNode payload = om.readTree(result.content());
            assertEquals(42L, payload.path("id").asLong());
            assertEquals("Test Intervention", payload.path("title").asText());
            assertEquals("USER", payload.path("assignedToType").asText());
            assertEquals("Jean Dupont", payload.path("assignedToName").asText());
            assertTrue(payload.path("message").asText().contains("42"));
            assertTrue(payload.path("message").asText().contains("Jean Dupont"));
        }

        @Test
        @DisplayName("assigns to team")
        void assignToTeam_callsServiceWithTeamId() throws Exception {
            InterventionResponse resp = responseFor(42L, "Cleaning Team A", "TEAM");
            when(interventionService.assign(eq(42L), eq(null), eq(20L), eq(jwt)))
                    .thenReturn(resp);

            ToolResult result = tool.execute(args(42L, null, 20L), ctx);

            assertFalse(result.isError());
            JsonNode payload = om.readTree(result.content());
            assertEquals("TEAM", payload.path("assignedToType").asText());
            assertEquals("Cleaning Team A", payload.path("assignedToName").asText());
        }
    }

    @Nested
    @DisplayName("execute - service failures")
    class ServiceFailures {

        @Test
        @DisplayName("wraps generic exception in ToolExecutionException")
        void runtimeException_wraps() {
            when(interventionService.assign(any(), any(), any(), any()))
                    .thenThrow(new RuntimeException("intervention not found"));

            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args(42L, 10L, null), ctx));
            assertEquals("assign_intervention", ex.getToolName());
            assertTrue(ex.getMessage().contains("intervention not found"));
        }

        @Test
        @DisplayName("propagates permission error message")
        void permissionDenied_wrapsWithMessage() {
            when(interventionService.assign(any(), any(), any(), any()))
                    .thenThrow(new RuntimeException("permission refusee"));

            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args(42L, 10L, null), ctx));
            assertTrue(ex.getMessage().contains("permission refusee"));
        }
    }
}
