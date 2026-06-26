package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.GenerateInvoiceRequest;
import com.clenzy.dto.InvoiceDto;
import com.clenzy.service.InvoiceGeneratorService;
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
 * Tool {@code create_invoice} — genere une facture de sejour (DRAFT) a partir d'une
 * reservation.
 *
 * <p>requiresConfirmation = true — action a enjeu financier et fiscal (conformite NF).</p>
 *
 * <p><b>Argent / conformite</b> : ce tool NE PREND AUCUN MONTANT. Le montant (HT, TVA,
 * TTC), la devise, les lignes (hebergement, menage, taxe de sejour) et la numerotation
 * sont integralement derives <em>cote serveur</em> par {@link InvoiceGeneratorService}
 * a partir de l'entite {@link com.clenzy.model.Reservation} (montants encaisses aupres
 * du guest, decomposes TTC -> HT par le moteur fiscal). Le LLM ne peut donc pas
 * influencer le montant facture.</p>
 *
 * <p><b>Idempotence</b> : la generation est deleguee a
 * {@link InvoiceGeneratorService#generateFromReservation(GenerateInvoiceRequest)}, qui
 * refuse de creer une seconde facture de sejour active pour la meme reservation
 * (leve {@code IllegalStateException}, convertie ici en {@link ToolExecutionException}).
 * Le tool n'a donc pas de logique anti-doublon propre — il herite du garde-fou service.</p>
 *
 * <p><b>Multi-tenant</b> : le service resout l'organisation via le {@code TenantContext}
 * (deja actif dans le thread HTTP de l'assistant) exactement comme l'endpoint REST
 * {@code POST /api/invoices/generate}. L'assistant herite des memes garanties.</p>
 */
@Component
public class CreateInvoiceTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(CreateInvoiceTool.class);
    private static final String NAME = "create_invoice";

    private final InvoiceGeneratorService invoiceGeneratorService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public CreateInvoiceTool(InvoiceGeneratorService invoiceGeneratorService, ObjectMapper objectMapper) {
        this.invoiceGeneratorService = invoiceGeneratorService;
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

        // Aucun montant ne transite par le tool : on ne passe QUE l'id de reservation.
        // Les infos acheteur (null) sont resolues cote serveur depuis le guest de la
        // reservation ; la taxe de sejour (null) est omise. Le montant est calcule par
        // le service a partir de l'entite — jamais fourni par le LLM.
        GenerateInvoiceRequest request = new GenerateInvoiceRequest(
                reservationId, null, null, null, null);

        try {
            InvoiceDto invoice = invoiceGeneratorService.generateFromReservation(request);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", invoice.id());
            payload.put("invoiceNumber", invoice.invoiceNumber());
            payload.put("status", invoice.status() != null ? invoice.status().name() : null);
            payload.put("invoiceType", invoice.invoiceType() != null ? invoice.invoiceType().name() : null);
            payload.put("currency", invoice.currency());
            // Montants issus du resultat serveur (jamais des arguments du LLM).
            payload.put("totalHt", invoice.totalHt());
            payload.put("totalTax", invoice.totalTax());
            payload.put("totalTtc", invoice.totalTtc());
            payload.put("reservationId", invoice.reservationId());
            payload.put("invoiceDate", invoice.invoiceDate() != null ? invoice.invoiceDate().toString() : null);
            payload.put("message", "Facture brouillon (DRAFT) creee pour la reservation #" + reservationId
                    + ". Emettez-la pour lui attribuer un numero legal.");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (Exception e) {
            log.warn("create_invoice failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Generation de facture impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "reservationId": {"type":"integer","description":"REQUIS : ID de la reservation a facturer"}
                      },
                      "required": ["reservationId"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Genere une facture de sejour (brouillon DRAFT) pour une reservation. "
                    + "Le montant et la TVA sont calcules par le serveur a partir de la reservation : "
                    + "ne JAMAIS fournir de montant. Refuse si une facture existe deja pour cette reservation. "
                    + "Confirmer obligatoirement avant execution.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
