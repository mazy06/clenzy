package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.dto.InvoiceDto;
import com.clenzy.model.InvoiceStatus;
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

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool {@code list_invoices} — liste les factures de l'organisation courante.
 *
 * <p>Filtres optionnels : {@code status} (DRAFT, SENT, ISSUED, PAID, OVERDUE,
 * CANCELLED, CREDIT_NOTE) et {@code limit} (defaut 20, max 30). Trie par date de
 * facture decroissante (plus recentes en premier). Lecture seule.</p>
 *
 * <p>Delegue a {@link InvoiceGeneratorService#listInvoices()} qui resout l'org via
 * le {@code TenantContext} — l'assistant herite des memes garanties de filtrage
 * multi-tenant que l'endpoint REST {@code GET /api/invoices}.</p>
 *
 * <p><b>PII</b> : le nom et l'adresse de l'acheteur (client) ne sont PAS exposes
 * au LLM. Seuls le numero, les montants, la devise, le statut, les dates, la
 * nature et la reservation liee sont retournes.</p>
 */
@Component
public class ListInvoicesTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(ListInvoicesTool.class);
    private static final String NAME = "list_invoices";
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 30;

    private final InvoiceGeneratorService invoiceGeneratorService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public ListInvoicesTool(InvoiceGeneratorService invoiceGeneratorService, ObjectMapper objectMapper) {
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
        final InvoiceStatus statusFilter = parseStatus(args.path("status"));
        final int limit = Math.min(MAX_LIMIT,
                Math.max(1, args.path("limit").asInt(DEFAULT_LIMIT)));

        try {
            List<InvoiceDto> invoices = invoiceGeneratorService.listInvoices();

            List<Map<String, Object>> items = invoices.stream()
                    .filter(dto -> statusFilter == null || statusFilter.equals(dto.status()))
                    // Plus recentes d'abord (invoiceDate desc, nulls en dernier).
                    .sorted(Comparator.comparing(
                            InvoiceDto::invoiceDate,
                            Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(limit)
                    .map(this::toItem)
                    .collect(java.util.stream.Collectors.toCollection(ArrayList::new));

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("items", items);
            payload.put("count", items.size());
            payload.put("totalAvailable", invoices.size());
            if (statusFilter != null) {
                payload.put("statusFilter", statusFilter.name());
            }
            return ToolResult.success(objectMapper.writeValueAsString(payload), "list");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize invoices", e);
        } catch (Exception e) {
            log.warn("list_invoices failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Factures indisponibles (" + e.getMessage() + ")", e);
        }
    }

    /** Mappe un {@link InvoiceDto} en item LLM — sans PII acheteur. */
    private Map<String, Object> toItem(InvoiceDto dto) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", dto.id());
        m.put("invoiceNumber", dto.invoiceNumber());
        m.put("invoiceDate", dto.invoiceDate() != null ? dto.invoiceDate().toString() : null);
        m.put("dueDate", dto.dueDate() != null ? dto.dueDate().toString() : null);
        m.put("currency", dto.currency());
        m.put("totalHt", dto.totalHt());
        m.put("totalTax", dto.totalTax());
        m.put("totalTtc", dto.totalTtc());
        m.put("status", dto.status() != null ? dto.status().name() : null);
        m.put("invoiceType", dto.invoiceType() != null ? dto.invoiceType().name() : null);
        m.put("reservationId", dto.reservationId());
        m.put("paidAt", dto.paidAt() != null ? dto.paidAt().toString() : null);
        return m;
    }

    /** Resout le filtre statut (insensible a la casse), null si absent. */
    private InvoiceStatus parseStatus(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull() || !node.isTextual()) {
            return null;
        }
        String raw = node.asText().trim();
        if (raw.isEmpty()) {
            return null;
        }
        try {
            return InvoiceStatus.valueOf(raw.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ToolExecutionException(NAME,
                    "Statut de facture inconnu: " + raw
                            + " (attendus: DRAFT, SENT, ISSUED, PAID, OVERDUE, CANCELLED, CREDIT_NOTE)");
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "status": {"type":"string","enum":["DRAFT","SENT","ISSUED","PAID","OVERDUE","CANCELLED","CREDIT_NOTE"],"description":"Filtre optionnel sur le statut de la facture."},
                        "limit":  {"type":"integer","minimum":1,"maximum":30,"description":"Nombre maximum de factures a retourner (defaut 20, max 30)."}
                      },
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.readOnly(
                    NAME,
                    "Liste les factures (montants HT/TVA/TTC, statut, nature GUEST/COMMISSION), recentes d'abord. Filtres status, limit (defaut 20). Pour 'factures impayees'.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
