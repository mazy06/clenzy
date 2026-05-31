package com.clenzy.service.agent.tools;

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

import static org.junit.jupiter.api.Assertions.*;

class SuggestNavigationToolTest {

    private ObjectMapper om;
    private SuggestNavigationTool tool;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        om = new ObjectMapper();
        tool = new SuggestNavigationTool(om);
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private ObjectNode validArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("path", "/settings");
        args.put("label", "Aller aux parametres");
        args.put("reason", "Configurer la tarification dynamique");
        return args;
    }

    @Test
    void name_and_descriptor_readOnly() {
        assertEquals("suggest_navigation", tool.name());
        assertEquals("suggest_navigation", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        assertEquals("object", schema.path("type").asText());
        String req = schema.path("required").toString();
        assertTrue(req.contains("path"));
        assertTrue(req.contains("label"));
        assertTrue(req.contains("reason"));
    }

    @Nested
    @DisplayName("Argument validation")
    class Validation {

        @Test
        void missingPath_throws() {
            ObjectNode args = validArgs();
            args.remove("path");
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args, ctx));
            assertTrue(ex.getMessage().toLowerCase().contains("path"));
        }

        @Test
        void blankPath_throws() {
            ObjectNode args = validArgs();
            args.put("path", "");
            assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        }

        @Test
        void missingLabel_throws() {
            ObjectNode args = validArgs();
            args.remove("label");
            assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        }

        @Test
        void blankLabel_throws() {
            ObjectNode args = validArgs();
            args.put("label", "  ");
            assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        }

        @Test
        void missingReason_throws() {
            ObjectNode args = validArgs();
            args.remove("reason");
            assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        }
    }

    @Nested
    @DisplayName("Route whitelist")
    class Whitelist {

        @Test
        void unknownRoute_throws() {
            ObjectNode args = validArgs();
            args.put("path", "/non-existent-page");
            ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                    () -> tool.execute(args, ctx));
            assertTrue(ex.getMessage().contains("non autorisee"));
        }

        @Test
        void dashboard_isAllowed() {
            ObjectNode args = validArgs();
            args.put("path", "/dashboard");
            assertDoesNotThrow(() -> tool.execute(args, ctx));
        }

        @Test
        void properties_isAllowed() {
            ObjectNode args = validArgs();
            args.put("path", "/properties");
            assertDoesNotThrow(() -> tool.execute(args, ctx));
        }

        @Test
        void monitoring_isAllowed() {
            ObjectNode args = validArgs();
            args.put("path", "/monitoring");
            assertDoesNotThrow(() -> tool.execute(args, ctx));
        }

        @Test
        void allowedRouteWithQueryString_works() {
            ObjectNode args = validArgs();
            args.put("path", "/settings?tab=ai");
            assertDoesNotThrow(() -> tool.execute(args, ctx));
        }

        @Test
        void allowedRouteWithMultipleQueryParams_works() {
            ObjectNode args = validArgs();
            args.put("path", "/reports?tab=financial&year=2026");
            assertDoesNotThrow(() -> tool.execute(args, ctx));
        }

        @Test
        void unknownRouteWithQueryString_throws() {
            ObjectNode args = validArgs();
            args.put("path", "/foobar?tab=x");
            assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        }
    }

    @Test
    void happyPath_returnsNavigationPayload() throws Exception {
        ToolResult result = tool.execute(validArgs(), ctx);

        assertFalse(result.isError());
        assertEquals("navigation", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals("/settings", payload.path("path").asText());
        assertEquals("Aller aux parametres", payload.path("label").asText());
        assertEquals("Configurer la tarification dynamique", payload.path("reason").asText());
        assertFalse(payload.has("icon"));
    }

    @Test
    void iconProvided_isAddedToPayload() throws Exception {
        ObjectNode args = validArgs();
        args.put("icon", "Settings");

        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        assertEquals("Settings", payload.path("icon").asText());
    }

    @Test
    void blankIcon_isNotAdded() throws Exception {
        ObjectNode args = validArgs();
        args.put("icon", "");

        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        assertFalse(payload.has("icon"));
    }

    @Test
    void payloadWithQueryString_preservesFullPath() throws Exception {
        ObjectNode args = validArgs();
        args.put("path", "/tarification?tab=yield");

        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());
        assertEquals("/tarification?tab=yield", payload.path("path").asText());
    }
}
