package com.clenzy.service.agent.tools;

import com.clenzy.dto.CreateInterventionRequest;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
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
import org.mockito.ArgumentCaptor;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class CreateInterventionToolTest {

    private InterventionService interventionService;
    private UserRepository userRepository;
    private CreateInterventionTool tool;
    private ObjectMapper om;
    private AgentContext ctx;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        interventionService = mock(InterventionService.class);
        userRepository = mock(UserRepository.class);
        om = new ObjectMapper();
        tool = new CreateInterventionTool(interventionService, userRepository, om);

        jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("user-1")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        ctx = new AgentContext(1L, "user-1", jwt, "fr", null, null);
    }

    private static User user(long id) {
        User u = new User();
        u.setId(id);
        u.setKeycloakId("user-1");
        return u;
    }

    private ObjectNode validArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 10);
        args.put("title", "Nettoyage complet");
        args.put("type", "HOUSEKEEPING");
        args.put("scheduledDate", "2026-07-15");
        return args;
    }

    private static InterventionResponse response() {
        return InterventionResponse.builder()
                .id(42L)
                .title("Nettoyage complet")
                .type("HOUSEKEEPING")
                .status("PENDING")
                .propertyId(10L)
                .propertyName("Loft")
                .scheduledDate("2026-07-15")
                .build();
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("create_intervention", tool.name());
        assertEquals("create_intervention", tool.descriptor().name());
        assertTrue(tool.descriptor().requiresConfirmation(), "write tool requires confirmation");
        JsonNode schema = tool.descriptor().jsonSchema();
        assertEquals("object", schema.path("type").asText());
        assertTrue(schema.path("required").toString().contains("propertyId"));
        assertTrue(schema.path("required").toString().contains("title"));
        assertTrue(schema.path("required").toString().contains("type"));
        assertTrue(schema.path("required").toString().contains("scheduledDate"));
    }

    @Nested
    @DisplayName("Required validation")
    class RequiredValidation {

        @Test
        void missingPropertyId_throws() {
            ObjectNode args = validArgs();
            args.remove("propertyId");
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args, ctx));
            assertTrue(ex.getMessage().toLowerCase().contains("propertyid"));
        }

        @Test
        void missingTitle_throws() {
            ObjectNode args = validArgs();
            args.remove("title");
            assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        }

        @Test
        void emptyTitle_throws() {
            ObjectNode args = validArgs();
            args.put("title", "   ");
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args, ctx));
            assertTrue(ex.getMessage().toLowerCase().contains("vide")
                    || ex.getMessage().toLowerCase().contains("title"));
        }

        @Test
        void missingType_throws() {
            ObjectNode args = validArgs();
            args.remove("type");
            assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        }

        @Test
        void missingScheduledDate_throws() {
            ObjectNode args = validArgs();
            args.remove("scheduledDate");
            assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        }

        @Test
        void nullJwt_throws() {
            AgentContext noJwt = AgentContext.minimal(1L, "user-1");
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(validArgs(), noJwt));
            assertTrue(ex.getMessage().contains("JWT"));
        }
    }

    @Test
    void userNotInDb_throws() {
        when(userRepository.findByKeycloakId("user-1")).thenReturn(Optional.empty());
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("introuvable"));
    }

    @Test
    void happyPath_buildsRequestWithDefaults_andReturnsSummary() throws Exception {
        when(userRepository.findByKeycloakId("user-1")).thenReturn(Optional.of(user(7L)));
        when(interventionService.create(any(), eq(jwt))).thenReturn(response());

        ToolResult result = tool.execute(validArgs(), ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(42L, payload.path("id").asLong());
        assertEquals("Loft", payload.path("propertyName").asText());
        assertTrue(payload.path("message").asText().contains("42"));

        ArgumentCaptor<CreateInterventionRequest> captor = ArgumentCaptor.forClass(CreateInterventionRequest.class);
        verify(interventionService).create(captor.capture(), eq(jwt));
        CreateInterventionRequest sent = captor.getValue();
        assertEquals(10L, sent.propertyId());
        assertEquals(7L, sent.requestorId());
        assertEquals("HOUSEKEEPING", sent.type());
        assertEquals("MEDIUM", sent.priority(), "default priority");
        assertEquals(2, sent.estimatedDurationHours(), "default duration");
        assertNull(sent.description());
        assertNull(sent.assignedToType());
        assertNull(sent.assignedToId());
    }

    @Test
    void customPriorityAndDuration_andDescription_arePropagated() {
        when(userRepository.findByKeycloakId("user-1")).thenReturn(Optional.of(user(7L)));
        when(interventionService.create(any(), eq(jwt))).thenReturn(response());

        ObjectNode args = validArgs();
        args.put("priority", "URGENT");
        args.put("estimatedDurationHours", 6);
        args.put("description", "Urgence apres incident");

        tool.execute(args, ctx);

        ArgumentCaptor<CreateInterventionRequest> captor = ArgumentCaptor.forClass(CreateInterventionRequest.class);
        verify(interventionService).create(captor.capture(), eq(jwt));
        CreateInterventionRequest sent = captor.getValue();
        assertEquals("URGENT", sent.priority());
        assertEquals(6, sent.estimatedDurationHours());
        assertEquals("Urgence apres incident", sent.description());
    }

    @Test
    void interventionServiceThrows_wrappedAsToolExecutionException() {
        when(userRepository.findByKeycloakId("user-1")).thenReturn(Optional.of(user(7L)));
        when(interventionService.create(any(), eq(jwt)))
                .thenThrow(new RuntimeException("permission denied"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().contains("permission denied"));
        assertEquals("create_intervention", ex.getToolName());
    }
}
