package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.Reservation;
import com.clenzy.service.ReservationService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tool {@code cancel_reservation} — annule une reservation (status = CANCELLED).
 *
 * <p>requiresConfirmation = true — action destructive irreversible.</p>
 */
@Component
public class CancelReservationTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(CancelReservationTool.class);
    private static final String NAME = "cancel_reservation";

    private final ReservationService reservationService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public CancelReservationTool(ReservationService reservationService, ObjectMapper objectMapper) {
        this.reservationService = reservationService;
        this.objectMapper = objectMapper;
        this.descriptor = buildDescriptor(objectMapper);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public ToolDescriptor descriptor() {
        return descriptor;
    }

    @Override
    public ToolResult execute(JsonNode args, AgentContext context) {
        if (!args.hasNonNull("reservationId")) {
            throw new ToolExecutionException(NAME, "reservationId est requis");
        }
        Long reservationId = args.path("reservationId").asLong();

        try {
            Reservation cancelled = reservationService.cancel(reservationId);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", cancelled.getId());
            if (cancelled.getProperty() != null) {
                payload.put("propertyName", cancelled.getProperty().getName());
            }
            payload.put("guestName", cancelled.getGuestName());
            payload.put("checkIn", cancelled.getCheckIn() != null ? cancelled.getCheckIn().toString() : null);
            payload.put("checkOut", cancelled.getCheckOut() != null ? cancelled.getCheckOut().toString() : null);
            payload.put("newStatus", cancelled.getStatus());
            payload.put("message", "Reservation #" + reservationId + " annulee.");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("cancel_reservation failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Annulation impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "reservationId": {"type":"integer","description":"REQUIS : ID de la reservation a annuler"}
                      },
                      "required": ["reservationId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Annule une reservation (status = CANCELLED). Action irreversible. Le calendar libere les jours bloques. Confirmer obligatoirement.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
