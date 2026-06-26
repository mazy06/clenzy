package com.clenzy.service.agent.tools;

import com.clenzy.dto.GuestListDto;
import com.clenzy.service.GuestService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ListGuestsToolTest {

    private GuestService guestService;
    private ListGuestsTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        guestService = mock(GuestService.class);
        om = new ObjectMapper();
        tool = new ListGuestsTool(guestService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    private static GuestListDto guest(Long id, String full, int stays) {
        return new GuestListDto(id, "A", "B", "a@x.fr", "+33", full, "direct",
                stays, new BigDecimal("900"), "fr", null, 1L, "Org");
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("list_guests", tool.name());
        assertEquals("list_guests", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void listsGuestsWithStats() throws Exception {
        when(guestService.listGuests(eq(1L), any(), any()))
                .thenReturn(List.of(guest(1L, "Alice Smith", 3)));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        assertFalse(result.isError());
        assertEquals("list", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(1, payload.path("count").asInt());
        JsonNode item = payload.path("items").get(0);
        assertEquals("Alice Smith", item.path("name").asText());
        assertEquals(3, item.path("totalStays").asInt());
        // Le contact (email/phone) NE doit PAS fuiter dans le contexte LLM.
        assertTrue(item.path("email").isMissingNode());
        assertTrue(item.path("phone").isMissingNode());
    }

    @Test
    void searchPassedToService() {
        when(guestService.listGuests(eq(1L), eq("alice"), isNull())).thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("search", "alice");

        tool.execute(args, ctx);
        verify(guestService).listGuests(1L, "alice", null);
    }
}
