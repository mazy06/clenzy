package com.clenzy.service.agent.tools;

import com.clenzy.dto.PropertyDto;
import com.clenzy.model.PropertyStatus;
import com.clenzy.service.PropertyService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class UpdatePropertyStatusToolTest {

    private PropertyService propertyService;
    private UpdatePropertyStatusTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        propertyService = mock(PropertyService.class);
        om = new ObjectMapper();
        tool = new UpdatePropertyStatusTool(propertyService, om);
        ctx = AgentContext.minimal(2L, "user-2");
    }

    private ObjectNode validArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 42);
        args.put("status", "ARCHIVED");
        return args;
    }

    private PropertyDto stubDto(String status) {
        PropertyDto dto = new PropertyDto();
        dto.id = 42L;
        dto.name = "Studio Marais";
        if (status != null) dto.status = PropertyStatus.valueOf(status);
        return dto;
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("update_property_status", tool.name());
        assertEquals("update_property_status", tool.descriptor().name());
        assertTrue(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        String req = schema.path("required").toString();
        assertTrue(req.contains("propertyId"));
        assertTrue(req.contains("status"));
    }

    @Test
    void missingPropertyId_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("status", "ACTIVE");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("propertyid"));
    }

    @Test
    void missingStatus_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 42);
        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
    }

    @Test
    void emptyArgs_throws() {
        assertThrows(ToolExecutionException.class, () -> tool.execute(om.createObjectNode(), ctx));
    }

    @Test
    void happyPath_returnsSummary() throws Exception {
        when(propertyService.updateStatus(42L, "ARCHIVED")).thenReturn(stubDto("ARCHIVED"));

        ToolResult result = tool.execute(validArgs(), ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(42L, payload.path("id").asLong());
        assertEquals("Studio Marais", payload.path("name").asText());
        assertEquals("ARCHIVED", payload.path("newStatus").asText());
        assertTrue(payload.path("message").asText().contains("ARCHIVED"));
    }

    @Test
    void invalidEnumValue_wrappedAsToolExecutionException() {
        when(propertyService.updateStatus(anyLong(), anyString()))
                .thenThrow(new IllegalArgumentException("bad enum"));

        ObjectNode args = validArgs();
        args.put("status", "BOGUS");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("Statut invalide"));
        assertTrue(ex.getMessage().contains("ARCHIVED"));
    }

    @Test
    void otherException_wrappedAsToolExecutionException() {
        when(propertyService.updateStatus(anyLong(), anyString()))
                .thenThrow(new RuntimeException("DB down"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().contains("DB down"));
        assertEquals("update_property_status", ex.getToolName());
    }

    @Test
    void nullStatusOnDto_serializedAsNull() throws Exception {
        when(propertyService.updateStatus(anyLong(), anyString())).thenReturn(stubDto(null));

        ToolResult result = tool.execute(validArgs(), ctx);
        JsonNode payload = om.readTree(result.content());
        assertTrue(payload.path("newStatus").isNull());
    }

    @Test
    void serviceCalledWithExactArgs() {
        when(propertyService.updateStatus(anyLong(), anyString())).thenReturn(stubDto("INACTIVE"));

        ObjectNode args = validArgs();
        args.put("status", "INACTIVE");
        tool.execute(args, ctx);

        verify(propertyService).updateStatus(42L, "INACTIVE");
    }
}
