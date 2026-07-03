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
 * Tool {@code get_reservation_details} — detail d'une reservation.
 *
 * <p>Delegue a {@link ReservationService#getByIdFetchAll(Long)} (filtre tenant
 * Hibernate actif) + verification defensive de l'organisation (regle d'audit #3 :
 * tout chargement par id valide l'org). Lecture seule. Le contact guest (email /
 * telephone) n'est PAS expose au LLM — seulement le nom.</p>
 */
@Component
public class GetReservationDetailsTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(GetReservationDetailsTool.class);
    private static final String NAME = "get_reservation_details";

    private final ReservationService reservationService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public GetReservationDetailsTool(ReservationService reservationService, ObjectMapper objectMapper) {
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
        long reservationId = args.path("reservationId").asLong(0);
        if (reservationId <= 0) {
            throw new ToolExecutionException(NAME, "reservationId requis (utiliser list_reservations pour le trouver).");
        }
        try {
            Reservation r = reservationService.getByIdFetchAll(reservationId);
            // Defense in depth : ne jamais exposer une resa hors de l'org du requester.
            if (context.organizationId() != null
                    && !context.organizationId().equals(r.getOrganizationId())) {
                throw new ToolExecutionException(NAME, "Reservation hors de votre organisation.");
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("guestName", r.getGuestName());
            m.put("guestCount", r.getGuestCount());
            m.put("checkIn", r.getCheckIn() != null ? r.getCheckIn().toString() : null);
            m.put("checkOut", r.getCheckOut() != null ? r.getCheckOut().toString() : null);
            m.put("status", r.getStatus());
            m.put("source", r.getSource());
            m.put("sourceName", r.getSourceName());
            m.put("totalPrice", r.getTotalPrice());
            m.put("currency", r.getCurrency());
            if (r.getPaymentStatus() != null) m.put("paymentStatus", r.getPaymentStatus().name());
            m.put("confirmationCode", r.getConfirmationCode());
            if (r.getProperty() != null) {
                m.put("propertyId", r.getProperty().getId());
                m.put("propertyName", r.getProperty().getName());
            }
            return ToolResult.success(objectMapper.writeValueAsString(m), "details");
        } catch (ToolExecutionException e) {
            throw e;
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize reservation", e);
        } catch (Exception e) {
            log.warn("get_reservation_details failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME, "Detail de la reservation indisponible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "reservationId": {"type":"integer","description":"ID de la reservation (obtenu via list_reservations)."}
                      },
                      "required": ["reservationId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Detail d'une reservation : voyageur, dates, prix total, statut, canal, paiement, code de confirmation, logement. Pour 'detail reservation', 'qui arrive'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
