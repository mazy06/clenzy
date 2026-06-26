package com.clenzy.service.agent.tools;

import com.clenzy.dto.GenerateInvoiceRequest;
import com.clenzy.dto.InvoiceDto;
import com.clenzy.model.Invoice;
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
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CreateInvoiceToolTest {

    private InvoiceGeneratorService invoiceGeneratorService;
    private CreateInvoiceTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        invoiceGeneratorService = mock(InvoiceGeneratorService.class);
        om = new ObjectMapper();
        tool = new CreateInvoiceTool(invoiceGeneratorService, om);
        ctx = AgentContext.minimal(1L, "user-1");
    }

    private ObjectNode validArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("reservationId", 777);
        return args;
    }

    private InvoiceDto stubInvoice() {
        Invoice invoice = new Invoice();
        invoice.setId(42L);
        invoice.setOrganizationId(1L);
        invoice.setInvoiceNumber("DRAFT");
        invoice.setInvoiceDate(LocalDate.of(2026, 6, 26));
        invoice.setCurrency("EUR");
        invoice.setTotalHt(new BigDecimal("100.00"));
        invoice.setTotalTax(new BigDecimal("10.00"));
        invoice.setTotalTtc(new BigDecimal("110.00"));
        invoice.setReservationId(777L);
        invoice.setStatus(InvoiceStatus.DRAFT);
        invoice.setInvoiceType(InvoiceType.GUEST);
        return InvoiceDto.from(invoice);
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("create_invoice", tool.name());
        assertEquals("create_invoice", tool.descriptor().name());
        assertTrue(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        String req = schema.path("required").toString();
        assertTrue(req.contains("reservationId"));
    }

    @Test
    void schema_doesNotAcceptAnyAmount() {
        // Garde-fou conformite : le schema ne doit exposer AUCUN champ de montant au LLM.
        JsonNode props = tool.descriptor().jsonSchema().path("properties");
        assertTrue(props.has("reservationId"));
        assertFalse(props.has("amount"));
        assertFalse(props.has("totalTtc"));
        assertFalse(props.has("total"));
        assertFalse(props.has("price"));
        // additionalProperties=false → un montant injecte serait rejete a la validation du schema.
        assertFalse(tool.descriptor().jsonSchema().path("additionalProperties").asBoolean(true));
    }

    @Test
    void missingReservationId_throws() {
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(om.createObjectNode(), ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("reservationid"));
    }

    @Test
    void happyPath_returnsServerDerivedAmounts() throws Exception {
        when(invoiceGeneratorService.generateFromReservation(any(GenerateInvoiceRequest.class)))
                .thenReturn(stubInvoice());

        ToolResult result = tool.execute(validArgs(), ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        JsonNode payload = om.readTree(result.content());
        assertEquals(42L, payload.path("id").asLong());
        assertEquals("DRAFT", payload.path("invoiceNumber").asText());
        assertEquals("DRAFT", payload.path("status").asText());
        assertEquals("GUEST", payload.path("invoiceType").asText());
        assertEquals("EUR", payload.path("currency").asText());
        // Montants issus du resultat serveur, pas d'un argument (comparaison numerique : robuste au scale BigDecimal).
        assertEquals(110.00, payload.path("totalTtc").asDouble(), 0.001);
        assertEquals(100.00, payload.path("totalHt").asDouble(), 0.001);
        assertEquals(10.00, payload.path("totalTax").asDouble(), 0.001);
        assertEquals(777L, payload.path("reservationId").asLong());
        assertTrue(payload.path("message").asText().contains("777"));
    }

    @Test
    void serviceCalledWithReservationId_andNoAmountInRequest() {
        when(invoiceGeneratorService.generateFromReservation(any(GenerateInvoiceRequest.class)))
                .thenReturn(stubInvoice());

        tool.execute(validArgs(), ctx);

        ArgumentCaptor<GenerateInvoiceRequest> captor =
                ArgumentCaptor.forClass(GenerateInvoiceRequest.class);
        verify(invoiceGeneratorService).generateFromReservation(captor.capture());

        GenerateInvoiceRequest sent = captor.getValue();
        assertEquals(777L, sent.reservationId());
        // Aucun montant ni info acheteur fournis par le tool : tout est resolu cote serveur.
        assertNull(sent.buyerName());
        assertNull(sent.buyerAddress());
        assertNull(sent.buyerTaxId());
        assertNull(sent.touristTaxRatePerPerson());
    }

    @Test
    void duplicateInvoice_serviceThrows_wrappedAsToolExecutionException() {
        // Idempotence deleguee au service : une 2e facture active leve IllegalStateException.
        when(invoiceGeneratorService.generateFromReservation(any(GenerateInvoiceRequest.class)))
                .thenThrow(new IllegalStateException(
                        "Une facture existe deja pour la reservation 777 (facture FA-2026-0001)"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().contains("existe deja"));
        assertEquals("create_invoice", ex.getToolName());
    }

    @Test
    void reservationNotFound_serviceThrows_wrappedAsToolExecutionException() {
        when(invoiceGeneratorService.generateFromReservation(any(GenerateInvoiceRequest.class)))
                .thenThrow(new IllegalArgumentException("Reservation introuvable: 777"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().contains("introuvable"));
        assertEquals("create_invoice", ex.getToolName());
    }
}
