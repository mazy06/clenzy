package com.clenzy.service.agent.tools;

import com.clenzy.integration.channel.ChannelAvailabilityService;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.SyncResult;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OpenCloseChannelAvailabilityToolTest {

    private ChannelAvailabilityService channelAvailabilityService;
    private OpenCloseChannelAvailabilityTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        channelAvailabilityService = mock(ChannelAvailabilityService.class);
        om = new ObjectMapper();
        tool = new OpenCloseChannelAvailabilityTool(channelAvailabilityService, om);
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private ObjectNode validArgs(String action) {
        ObjectNode args = om.createObjectNode();
        args.put("propertyId", 42);
        args.put("channel", "AIRBNB");
        args.put("from", "2026-08-10");
        args.put("to", "2026-08-15");
        args.put("action", action);
        return args;
    }

    // ---- Descriptor : confirmation OBLIGATOIRE (mecanisme de refus sans confirmation) ----

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("open_close_channel_availability", tool.name());
        assertEquals("open_close_channel_availability", tool.descriptor().name());
        // L'orchestrateur refuse d'executer un tool requiresConfirmation sans
        // POST /assistant/tool-confirm prealable — meme mecanisme que trigger_channel_sync.
        assertTrue(tool.descriptor().requiresConfirmation());
        String req = tool.descriptor().jsonSchema().path("required").toString();
        assertTrue(req.contains("propertyId"));
        assertTrue(req.contains("channel"));
        assertTrue(req.contains("from"));
        assertTrue(req.contains("to"));
        assertTrue(req.contains("action"));
    }

    // ---- Validation des arguments ----

    @Test
    void missingPropertyId_throws() {
        ObjectNode args = validArgs("close");
        args.remove("propertyId");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("propertyId"));
        verifyNoInteractions(channelAvailabilityService);
    }

    @Test
    void unknownChannel_throws() {
        ObjectNode args = validArgs("close");
        args.put("channel", "LEBONCOIN");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("Canal inconnu"));
        verifyNoInteractions(channelAvailabilityService);
    }

    @Test
    void invalidDate_throws() {
        ObjectNode args = validArgs("close");
        args.put("from", "10/08/2026");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("from"));
        verifyNoInteractions(channelAvailabilityService);
    }

    @Test
    void invalidAction_throws() {
        ObjectNode args = validArgs("block");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("action"));
        verifyNoInteractions(channelAvailabilityService);
    }

    // ---- Delegation au service ----

    @Test
    void close_delegatesWithOrgFromContext() throws Exception {
        when(channelAvailabilityService.setChannelAvailability(
                eq(1L), eq(42L), eq(ChannelName.AIRBNB),
                eq(LocalDate.of(2026, 8, 10)), eq(LocalDate.of(2026, 8, 15)), eq(false)))
                .thenReturn(SyncResult.success("Fermeture poussee sur 6 jour(s)", 6, 12L));

        ToolResult result = tool.execute(validArgs("close"), ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());
        JsonNode payload = om.readTree(result.content());
        assertEquals(42L, payload.path("propertyId").asLong());
        assertEquals("AIRBNB", payload.path("channel").asText());
        assertEquals("close", payload.path("action").asText());
        assertEquals("SUCCESS", payload.path("status").asText());
    }

    @Test
    void open_delegatesWithOpenTrue() throws Exception {
        when(channelAvailabilityService.setChannelAvailability(
                anyLong(), anyLong(), any(), any(), any(), eq(true)))
                .thenReturn(SyncResult.success(6, 12L));

        ToolResult result = tool.execute(validArgs("open"), ctx);

        verify(channelAvailabilityService).setChannelAvailability(
                eq(1L), eq(42L), eq(ChannelName.AIRBNB),
                eq(LocalDate.of(2026, 8, 10)), eq(LocalDate.of(2026, 8, 15)), eq(true));
        JsonNode payload = om.readTree(result.content());
        assertEquals("open", payload.path("action").asText());
    }

    @Test
    void channelIsCaseInsensitive() {
        when(channelAvailabilityService.setChannelAvailability(
                anyLong(), anyLong(), eq(ChannelName.BOOKING), any(), any(), anyBoolean()))
                .thenReturn(SyncResult.success(6, 12L));

        ObjectNode args = validArgs("close");
        args.put("channel", "booking");
        tool.execute(args, ctx);

        verify(channelAvailabilityService).setChannelAvailability(
                anyLong(), anyLong(), eq(ChannelName.BOOKING), any(), any(), eq(false));
    }

    // ---- Propagation des erreurs metier ----

    @Test
    void serviceIllegalArgument_wrappedAsToolExecutionException() {
        when(channelAvailabilityService.setChannelAvailability(
                anyLong(), anyLong(), any(), any(), any(), anyBoolean()))
                .thenThrow(new IllegalArgumentException("Canal AIRBNB non connecte pour la propriete 42"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs("close"), ctx));
        assertTrue(ex.getMessage().contains("non connecte"));
        assertEquals("open_close_channel_availability", ex.getToolName());
    }
}
