package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.ReservationDto;
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
 * Tool {@code update_reservation_status} — change le STATUT d'une reservation
 * (confirmed / pending / cancelled). Aucune notion de paiement n'est touchee.
 *
 * <p>requiresConfirmation = true — action d'ecriture, gatee par confirmation HITL.</p>
 *
 * <p>Delegue ENTIEREMENT a {@link ReservationService#update} (il n'existe pas de
 * methode dediee "changement de statut seul") : un {@link ReservationDto} ne
 * portant que l'id et le statut est applique — le mapper ignore les champs null,
 * donc seuls le statut et la synchronisation calendrier associee sont modifies.
 * Le service porte la transaction, la validation d'org et la machine a etats du
 * calendrier (book/cancel/move selon la transition).</p>
 *
 * <p>Specialist suggere : communication.</p>
 */
@Component
public class UpdateReservationStatusTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(UpdateReservationStatusTool.class);
    private static final String NAME = "update_reservation_status";

    private final ReservationService reservationService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public UpdateReservationStatusTool(ReservationService reservationService, ObjectMapper objectMapper) {
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
        if (!args.hasNonNull("status") || args.path("status").asText().isBlank()) {
            throw new ToolExecutionException(NAME, "status est requis");
        }
        Long reservationId = args.path("reservationId").asLong();
        // Les statuts de reservation sont stockes en minuscules (confirmed/pending/cancelled).
        String status = args.path("status").asText().trim().toLowerCase();

        try {
            // DTO minimal id + status : le mapper ignore les champs null, le service
            // applique explicitement le statut et synchronise le calendrier.
            ReservationDto statusOnly = new ReservationDto(
                    reservationId, null, null, null, null, null, null, null,
                    null, null, null, null, status, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null,
                    null, null);

            Reservation updated = reservationService.update(reservationId, statusOnly, context.keycloakId());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", updated.getId());
            if (updated.getProperty() != null) {
                payload.put("propertyName", updated.getProperty().getName());
            }
            payload.put("guestName", updated.getGuestName());
            payload.put("newStatus", updated.getStatus());
            payload.put("message", "Reservation #" + reservationId + " : statut mis a jour vers " + updated.getStatus() + ".");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("update_reservation_status failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Mise a jour du statut impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "reservationId": {"type":"integer","description":"REQUIS : ID de la reservation"},
                        "status": {"type":"string","enum":["confirmed","pending","cancelled"],"description":"REQUIS : nouveau statut (confirmed, pending ou cancelled)"}
                      },
                      "required": ["reservationId","status"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Change le statut d'une reservation (confirmed/pending/cancelled). N'affecte ni montant ni paiement ; calendrier sync automatiquement. Confirmer obligatoirement.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
