package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.ReservationRefundService;
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
 * Tool {@code initiate_refund} — initie un remboursement Stripe sur une
 * reservation en paiement direct (campagne T-10, gabarit Phase 4 §3).
 *
 * <p>requiresConfirmation = true, invariant paiement : quel que soit le niveau
 * d'autonomie configure, un remboursement passe TOUJOURS par la carte HITL.
 * Le montant est calcule/borne SERVEUR ({@link ReservationRefundService}) —
 * un montant fourni par le LLM n'est qu'un cross-check.</p>
 */
@Component
public class InitiateRefundTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(InitiateRefundTool.class);
    private static final String NAME = "initiate_refund";

    private final ReservationRefundService refundService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public InitiateRefundTool(ReservationRefundService refundService, ObjectMapper objectMapper) {
        this.refundService = refundService;
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
        if (!args.hasNonNull("reservationId") || !args.hasNonNull("reason")) {
            throw new ToolExecutionException(NAME, "reservationId et reason sont requis");
        }
        Long reservationId = args.path("reservationId").asLong();
        String reason = args.path("reason").asText();
        Long amountCents = args.hasNonNull("amountCents") ? args.path("amountCents").asLong() : null;

        try {
            ReservationRefundService.RefundOutcome outcome = refundService.initiateRefund(
                    reservationId, amountCents, reason, context.organizationId());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("reservationId", outcome.reservationId());
            payload.put("amountCents", outcome.amountCents());
            payload.put("currency", outcome.currency());
            payload.put("reason", outcome.reason());
            payload.put("message", "Remboursement initie aupres de Stripe (traitement sous quelques jours).");
            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw new ToolExecutionException(NAME, e.getMessage());
        } catch (Exception e) {
            log.warn("initiate_refund failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Remboursement impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "reservationId": {"type":"integer","description":"REQUIS : ID de la reservation (paiement direct Stripe)"},
                        "reason":        {"type":"string","enum":["CANCELLATION","GESTURE","DISPUTE"],"description":"REQUIS : CANCELLATION = montant de la politique (calcule serveur), GESTURE/DISPUTE = amountCents requis"},
                        "amountCents":   {"type":"integer","description":"Montant en CENTIMES. Omis pour CANCELLATION (politique). Borne serveur par le cash encaisse."}
                      },
                      "required": ["reservationId", "reason"]
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Initie un remboursement Stripe (resa en paiement direct). Montant calcule/borne SERVEUR. Pour 'rembourse la resa X', 'geste commercial de N euros'. Confirmation requise.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
