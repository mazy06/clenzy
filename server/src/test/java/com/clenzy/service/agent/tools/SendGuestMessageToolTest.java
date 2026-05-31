package com.clenzy.service.agent.tools;

import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageStatus;
import com.clenzy.service.messaging.GuestMessagingService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SendGuestMessageToolTest {

    private GuestMessagingService guestMessagingService;
    private SendGuestMessageTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        guestMessagingService = mock(GuestMessagingService.class);
        om = new ObjectMapper();
        tool = new SendGuestMessageTool(guestMessagingService, om);
        ctx = AgentContext.minimal(7L, "user-7");
    }

    private ObjectNode validArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("reservationId", 100);
        args.put("templateId", 200);
        return args;
    }

    private GuestMessageLog stubLog() {
        GuestMessageLog log = new GuestMessageLog();
        log.setId(999L);
        log.setStatus(MessageStatus.SENT);
        log.setChannel(MessageChannelType.EMAIL);
        return log;
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("send_guest_message", tool.name());
        assertEquals("send_guest_message", tool.descriptor().name());
        assertTrue(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        String req = schema.path("required").toString();
        assertTrue(req.contains("reservationId"));
        assertTrue(req.contains("templateId"));
    }

    @Test
    void missingReservationId_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("templateId", 200);
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("reservationid"));
    }

    @Test
    void missingTemplateId_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("reservationId", 100);
        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
    }

    @Test
    void emptyArgs_throws() {
        assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
    }

    @Test
    void happyPath_returnsSummary() throws Exception {
        when(guestMessagingService.sendMessage(100L, 200L, 7L)).thenReturn(stubLog());

        ToolResult result = tool.execute(validArgs(), ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(999L, payload.path("logId").asLong());
        assertEquals(100L, payload.path("reservationId").asLong());
        assertEquals(200L, payload.path("templateId").asLong());
        assertEquals("SENT", payload.path("status").asText());
        assertEquals("EMAIL", payload.path("channel").asText());
        assertTrue(payload.path("message").asText().contains("succes"));
    }

    @Test
    void serviceUsesContextOrganization() {
        when(guestMessagingService.sendMessage(eq(100L), eq(200L), eq(7L))).thenReturn(stubLog());

        tool.execute(validArgs(), ctx);

        verify(guestMessagingService).sendMessage(100L, 200L, 7L);
    }

    @Test
    void serviceThrows_wrappedAsToolExecutionException() {
        when(guestMessagingService.sendMessage(anyLong(), anyLong(), anyLong()))
                .thenThrow(new RuntimeException("Template introuvable"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().contains("Template introuvable"));
        assertEquals("send_guest_message", ex.getToolName());
    }

    @Test
    void nullStatusOrChannel_handled() throws Exception {
        GuestMessageLog log = new GuestMessageLog();
        log.setId(1L);
        log.setStatus(null);
        log.setChannel(null);
        when(guestMessagingService.sendMessage(anyLong(), anyLong(), anyLong())).thenReturn(log);

        ToolResult result = tool.execute(validArgs(), ctx);

        JsonNode payload = om.readTree(result.content());
        assertTrue(payload.path("status").isNull());
        assertTrue(payload.path("channel").isNull());
    }
}
