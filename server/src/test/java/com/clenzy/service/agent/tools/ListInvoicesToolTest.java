package com.clenzy.service.agent.tools;

import com.clenzy.dto.InvoiceDto;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.model.InvoiceType;
import com.clenzy.service.InvoiceGeneratorService;
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
import static org.mockito.Mockito.*;

class ListInvoicesToolTest {

    private InvoiceGeneratorService invoiceGeneratorService;
    private ListInvoicesTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        invoiceGeneratorService = mock(InvoiceGeneratorService.class);
        om = new ObjectMapper();
        tool = new ListInvoicesTool(invoiceGeneratorService, om);
        ctx = AgentContext.minimal(1L, "user-123");
    }

    private static InvoiceDto invoice(Long id, String number, LocalDate date,
                                      InvoiceStatus status, BigDecimal ttc) {
        return new InvoiceDto(
                id, 1L, number, date, date.plusDays(30),
                "EUR", "FR",
                ttc.multiply(BigDecimal.valueOf(0.9)), ttc.multiply(BigDecimal.valueOf(0.1)), ttc,
                "Ma Conciergerie", "1 rue X", "FR123",
                "Jean Client", "2 rue Y", null,
                42L, null, null, null, null,
                status, InvoiceType.GUEST,
                "Mentions", "card", null,
                List.of(), null);
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("list_invoices", tool.name());
        assertEquals("list_invoices", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void listsInvoices_mostRecentFirst_withoutBuyerPii() throws Exception {
        when(invoiceGeneratorService.listInvoices()).thenReturn(List.of(
                invoice(1L, "F-2026-001", LocalDate.of(2026, 1, 10), InvoiceStatus.PAID, BigDecimal.valueOf(100)),
                invoice(2L, "F-2026-005", LocalDate.of(2026, 3, 15), InvoiceStatus.SENT, BigDecimal.valueOf(250))
        ));

        ToolResult result = tool.execute(om.createObjectNode(), ctx);

        assertFalse(result.isError());
        assertEquals("list", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(2, payload.path("count").asInt());
        assertEquals(2, payload.path("totalAvailable").asInt());

        JsonNode items = payload.path("items");
        // Trie par date desc : la facture de mars (F-2026-005) passe en premier.
        assertEquals("F-2026-005", items.get(0).path("invoiceNumber").asText());
        assertEquals("F-2026-001", items.get(1).path("invoiceNumber").asText());
        assertEquals("SENT", items.get(0).path("status").asText());
        assertEquals("GUEST", items.get(0).path("invoiceType").asText());
        assertEquals(42L, items.get(0).path("reservationId").asLong());

        // PII acheteur jamais exposee.
        String content = result.content();
        assertFalse(content.contains("Jean Client"));
        assertFalse(content.contains("buyerName"));
        assertFalse(content.contains("buyerAddress"));
    }

    @Test
    void statusFilter_keepsOnlyMatching() throws Exception {
        when(invoiceGeneratorService.listInvoices()).thenReturn(List.of(
                invoice(1L, "F-1", LocalDate.of(2026, 1, 10), InvoiceStatus.PAID, BigDecimal.TEN),
                invoice(2L, "F-2", LocalDate.of(2026, 2, 10), InvoiceStatus.SENT, BigDecimal.TEN),
                invoice(3L, "F-3", LocalDate.of(2026, 3, 10), InvoiceStatus.PAID, BigDecimal.TEN)
        ));

        ObjectNode args = om.createObjectNode();
        args.put("status", "paid");

        JsonNode payload = om.readTree(tool.execute(args, ctx).content());
        assertEquals(2, payload.path("count").asInt());
        assertEquals("PAID", payload.path("statusFilter").asText());
        for (JsonNode item : payload.path("items")) {
            assertEquals("PAID", item.path("status").asText());
        }
    }

    @Test
    void unknownStatus_throwsToolExecutionException() {
        ObjectNode args = om.createObjectNode();
        args.put("status", "NOPE");
        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        verify(invoiceGeneratorService, never()).listInvoices();
    }
}
