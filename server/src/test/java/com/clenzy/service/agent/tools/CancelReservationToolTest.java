package com.clenzy.service.agent.tools;

import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.service.ReservationService;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class CancelReservationToolTest {

    private ReservationService reservationService;
    private CancelReservationTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        reservationService = mock(ReservationService.class);
        om = new ObjectMapper();
        tool = new CancelReservationTool(reservationService, om);
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private ObjectNode validArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("reservationId", 555);
        return args;
    }

    private Reservation stubReservation() {
        Reservation r = new Reservation();
        r.setId(555L);
        Property p = new Property();
        p.setName("Loft Bastille");
        r.setProperty(p);
        r.setGuestName("Alice");
        r.setCheckIn(LocalDate.of(2026, 6, 1));
        r.setCheckOut(LocalDate.of(2026, 6, 5));
        r.setStatus("CANCELLED");
        return r;
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("cancel_reservation", tool.name());
        assertEquals("cancel_reservation", tool.descriptor().name());
        assertTrue(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        String req = schema.path("required").toString();
        assertTrue(req.contains("reservationId"));
    }

    @Test
    void missingReservationId_throws() {
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("reservationid"));
    }

    @Test
    void happyPath_returnsSummary() throws Exception {
        when(reservationService.cancel(555L)).thenReturn(stubReservation());

        ToolResult result = tool.execute(validArgs(), ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(555L, payload.path("id").asLong());
        assertEquals("Loft Bastille", payload.path("propertyName").asText());
        assertEquals("Alice", payload.path("guestName").asText());
        assertEquals("2026-06-01", payload.path("checkIn").asText());
        assertEquals("2026-06-05", payload.path("checkOut").asText());
        assertEquals("CANCELLED", payload.path("newStatus").asText());
        assertTrue(payload.path("message").asText().contains("annulee"));
    }

    @Test
    void serviceThrows_wrappedAsToolExecutionException() {
        when(reservationService.cancel(anyLong()))
                .thenThrow(new RuntimeException("Reservation introuvable"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().contains("Reservation introuvable"));
        assertEquals("cancel_reservation", ex.getToolName());
    }

    @Test
    void nullProperty_doesNotIncludePropertyName() throws Exception {
        Reservation r = new Reservation();
        r.setId(555L);
        r.setProperty(null);
        r.setGuestName("Bob");
        r.setStatus("CANCELLED");
        when(reservationService.cancel(anyLong())).thenReturn(r);

        ToolResult result = tool.execute(validArgs(), ctx);
        JsonNode payload = om.readTree(result.content());
        assertFalse(payload.has("propertyName"));
        assertEquals("Bob", payload.path("guestName").asText());
    }

    @Test
    void nullCheckInAndCheckOut_serializedAsNull() throws Exception {
        Reservation r = new Reservation();
        r.setId(1L);
        r.setProperty(null);
        r.setGuestName("Z");
        r.setCheckIn(null);
        r.setCheckOut(null);
        r.setStatus("CANCELLED");
        when(reservationService.cancel(anyLong())).thenReturn(r);

        ToolResult result = tool.execute(validArgs(), ctx);
        JsonNode payload = om.readTree(result.content());
        assertTrue(payload.path("checkIn").isNull());
        assertTrue(payload.path("checkOut").isNull());
    }

    @Test
    void serviceCalledWithReservationId() {
        when(reservationService.cancel(anyLong())).thenReturn(stubReservation());
        tool.execute(validArgs(), ctx);
        verify(reservationService).cancel(555L);
    }
}
