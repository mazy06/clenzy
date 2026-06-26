package com.clenzy.service.agent.tools;

import com.clenzy.dto.ReservationDto;
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
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class UpdateReservationStatusToolTest {

    private ReservationService reservationService;
    private UpdateReservationStatusTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        reservationService = mock(ReservationService.class);
        om = new ObjectMapper();
        tool = new UpdateReservationStatusTool(reservationService, om);
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private ObjectNode validArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("reservationId", 555);
        args.put("status", "confirmed");
        return args;
    }

    private Reservation stubReservation(String status) {
        Reservation r = new Reservation();
        r.setId(555L);
        Property p = new Property();
        p.setName("Loft Bastille");
        r.setProperty(p);
        r.setGuestName("Alice");
        r.setStatus(status);
        return r;
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("update_reservation_status", tool.name());
        assertEquals("update_reservation_status", tool.descriptor().name());
        assertTrue(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        String req = schema.path("required").toString();
        assertTrue(req.contains("reservationId"));
        assertTrue(req.contains("status"));
    }

    @Test
    void missingReservationId_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("status", "confirmed");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("reservationid"));
    }

    @Test
    void missingStatus_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("reservationId", 555);
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("status"));
    }

    @Test
    void happyPath_returnsSummary() throws Exception {
        when(reservationService.update(eq(555L), any(ReservationDto.class), eq("user-1")))
                .thenReturn(stubReservation("confirmed"));

        ToolResult result = tool.execute(validArgs(), ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(555L, payload.path("id").asLong());
        assertEquals("Loft Bastille", payload.path("propertyName").asText());
        assertEquals("Alice", payload.path("guestName").asText());
        assertEquals("confirmed", payload.path("newStatus").asText());
        assertTrue(payload.path("message").asText().contains("confirmed"));
    }

    @Test
    void delegatesToService_withIdAndStatusOnly() {
        when(reservationService.update(eq(555L), any(ReservationDto.class), eq("user-1")))
                .thenReturn(stubReservation("confirmed"));

        tool.execute(validArgs(), ctx);

        ArgumentCaptor<ReservationDto> dtoCaptor = ArgumentCaptor.forClass(ReservationDto.class);
        verify(reservationService).update(eq(555L), dtoCaptor.capture(), eq("user-1"));
        ReservationDto sent = dtoCaptor.getValue();
        assertEquals(555L, sent.id());
        assertEquals("confirmed", sent.status());
        // DTO minimal : aucun autre champ ne doit etre porte (evite d'ecraser l'entite).
        assertNull(sent.propertyId());
        assertNull(sent.guestName());
        assertNull(sent.checkIn());
        assertNull(sent.totalPrice());
    }

    @Test
    void statusNormalizedToLowercase() {
        when(reservationService.update(eq(555L), any(ReservationDto.class), eq("user-1")))
                .thenReturn(stubReservation("cancelled"));

        ObjectNode args = om.createObjectNode();
        args.put("reservationId", 555);
        args.put("status", "CANCELLED");
        tool.execute(args, ctx);

        ArgumentCaptor<ReservationDto> dtoCaptor = ArgumentCaptor.forClass(ReservationDto.class);
        verify(reservationService).update(eq(555L), dtoCaptor.capture(), eq("user-1"));
        assertEquals("cancelled", dtoCaptor.getValue().status());
    }

    @Test
    void serviceThrows_wrappedAsToolExecutionException() {
        when(reservationService.update(any(Long.class), any(ReservationDto.class), any()))
                .thenThrow(new RuntimeException("Reservation non trouvee: 555"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().contains("Reservation non trouvee"));
        assertEquals("update_reservation_status", ex.getToolName());
    }
}
