package com.clenzy.service.agent.tools;

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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class GetReservationDetailsToolTest {

    private ReservationService reservationService;
    private GetReservationDetailsTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        reservationService = mock(ReservationService.class);
        om = new ObjectMapper();
        tool = new GetReservationDetailsTool(reservationService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    private Reservation reservation(Long orgId) {
        Reservation r = new Reservation();
        r.setId(10L);
        r.setOrganizationId(orgId);
        r.setGuestName("Alice");
        r.setCheckIn(LocalDate.parse("2026-07-01"));
        r.setCheckOut(LocalDate.parse("2026-07-05"));
        r.setStatus("confirmed");
        r.setTotalPrice(new BigDecimal("400"));
        return r;
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("get_reservation_details", tool.name());
        assertEquals("get_reservation_details", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void withId_returnsDetails() throws Exception {
        when(reservationService.getByIdFetchAll(10L)).thenReturn(reservation(1L));

        ObjectNode args = om.createObjectNode();
        args.put("reservationId", 10);

        ToolResult result = tool.execute(args, ctx);
        assertFalse(result.isError());
        assertEquals("details", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals("Alice", payload.path("guestName").asText());
        assertEquals("confirmed", payload.path("status").asText());
        assertEquals("2026-07-01", payload.path("checkIn").asText());
    }

    @Test
    void reservationFromAnotherOrg_throws() {
        when(reservationService.getByIdFetchAll(10L)).thenReturn(reservation(999L));

        ObjectNode args = om.createObjectNode();
        args.put("reservationId", 10);

        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
    }

    @Test
    void missingId_throws() {
        assertThrows(ToolExecutionException.class, () -> tool.execute(om.createObjectNode(), ctx));
        verify(reservationService, never()).getByIdFetchAll(anyLong());
    }
}
