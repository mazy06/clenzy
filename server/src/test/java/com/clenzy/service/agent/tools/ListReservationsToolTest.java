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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ListReservationsToolTest {

    private ReservationService reservationService;
    private ListReservationsTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        reservationService = mock(ReservationService.class);
        om = new ObjectMapper();
        tool = new ListReservationsTool(reservationService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    private static Reservation reservation(Long id, Long propId, String propName,
                                            LocalDate checkIn, LocalDate checkOut, String status) {
        Reservation r = new Reservation();
        r.setId(id);
        Property p = new Property();
        p.setId(propId);
        p.setName(propName);
        r.setProperty(p);
        r.setGuestName("Guest " + id);
        r.setCheckIn(checkIn);
        r.setCheckOut(checkOut);
        r.setStatus(status);
        r.setSource("Airbnb");
        r.setTotalPrice(new BigDecimal("250.00"));
        r.setCurrency("EUR");
        return r;
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("list_reservations", tool.name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void noArgs_defaultsToTodayPlus30Days() {
        when(reservationService.getReservations(anyString(), any(), any(), any())).thenReturn(List.of());

        tool.execute(om.createObjectNode(), ctx);

        verify(reservationService).getReservations(eq("user-123"), isNull(),
                eq(LocalDate.now()), eq(LocalDate.now().plusDays(30)));
    }

    @Test
    void withPropertyIdAndDates_filtersPassedToService() {
        when(reservationService.getReservations(anyString(), any(), any(), any())).thenReturn(List.of());

        ObjectNode args = om.createObjectNode();
        args.put("from", "2026-06-01");
        args.put("to", "2026-06-30");
        args.put("propertyId", 42);

        tool.execute(args, ctx);

        verify(reservationService).getReservations(eq("user-123"),
                eq(List.of(42L)),
                eq(LocalDate.parse("2026-06-01")),
                eq(LocalDate.parse("2026-06-30")));
    }

    @Test
    void statusFilter_appliedInMemory() throws Exception {
        Reservation r1 = reservation(1L, 10L, "P1",
                LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5), "CONFIRMED");
        Reservation r2 = reservation(2L, 10L, "P1",
                LocalDate.of(2026, 6, 10), LocalDate.of(2026, 6, 12), "CANCELLED");
        when(reservationService.getReservations(anyString(), any(), any(), any())).thenReturn(List.of(r1, r2));

        ObjectNode args = om.createObjectNode();
        args.put("status", "confirmed"); // case-insensitive

        ToolResult result = tool.execute(args, ctx);
        JsonNode payload = om.readTree(result.content());

        assertEquals(1, payload.path("count").asInt());
        assertEquals(1, payload.path("items").size());
        assertEquals("CONFIRMED", payload.path("items").get(0).path("status").asText());
    }

    @Test
    void sortedByCheckInAscending() throws Exception {
        Reservation r1 = reservation(1L, 10L, "P1",
                LocalDate.of(2026, 6, 10), LocalDate.of(2026, 6, 12), "CONFIRMED");
        Reservation r2 = reservation(2L, 10L, "P1",
                LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5), "CONFIRMED");
        when(reservationService.getReservations(anyString(), any(), any(), any())).thenReturn(List.of(r1, r2));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode payload = om.readTree(result.content());

        assertEquals(2L, payload.path("items").get(0).path("id").asLong(), "Earlier date first");
        assertEquals(1L, payload.path("items").get(1).path("id").asLong());
    }

    @Test
    void invalidDateRange_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("from", "2026-07-01");
        args.put("to", "2026-06-01");

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().contains("from > to"));
    }

    @Test
    void serviceThrows_wrappedAsToolExecutionException() {
        when(reservationService.getReservations(anyString(), any(), any(), any()))
                .thenThrow(new RuntimeException("Utilisateur introuvable"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertTrue(ex.getMessage().contains("Utilisateur introuvable"));
    }

    @Test
    void itemPayloadCompact_includesPropertyAndPrice() throws Exception {
        Reservation r = reservation(7L, 99L, "Villa Med",
                LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5), "CONFIRMED");
        r.setConfirmationCode("ABC123");
        when(reservationService.getReservations(anyString(), any(), any(), any())).thenReturn(List.of(r));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);
        JsonNode item = om.readTree(result.content()).path("items").get(0);

        assertEquals(7L, item.path("id").asLong());
        assertEquals(99L, item.path("propertyId").asLong());
        assertEquals("Villa Med", item.path("propertyName").asText());
        assertEquals("Guest 7", item.path("guestName").asText());
        assertEquals("2026-06-01", item.path("checkIn").asText());
        assertEquals("2026-06-05", item.path("checkOut").asText());
        assertEquals("Airbnb", item.path("source").asText());
        assertEquals("EUR", item.path("currency").asText());
        assertEquals("ABC123", item.path("confirmationCode").asText());
        assertEquals(0, new BigDecimal("250.00").compareTo(item.path("totalPrice").decimalValue()));
    }
}
