package com.clenzy.controller;

import com.clenzy.dto.GenerateInvoiceRequest;
import com.clenzy.dto.InvoiceDto;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.model.InvoiceType;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.service.InvoiceGeneratorService;
import com.clenzy.service.InvoicePaymentService;
import com.clenzy.service.InvoicePdfService;
import com.clenzy.service.InvoiceQueryService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvoiceControllerTest {

    @Mock private InvoiceGeneratorService invoiceGeneratorService;
    @Mock private InvoicePdfService invoicePdfService;
    @Mock private InvoicePaymentService invoicePaymentService;
    @Mock private InvoiceRepository invoiceRepository;
    @Mock private DocumentTemplateRepository documentTemplateRepository;
    @Mock private TenantContext tenantContext;

    private InvoiceController controller;

    @BeforeEach
    void setUp() {
        // Pattern Vague A : service REEL construit au-dessus des mocks repository/tenant
        // pour garder la couverture bout-en-bout (isolation org du telechargement PDF).
        controller = new InvoiceController(invoiceGeneratorService, invoicePaymentService,
                new InvoiceQueryService(invoiceRepository, documentTemplateRepository,
                        invoicePdfService, tenantContext));
    }

    private InvoiceDto dto(Long id) {
        return new InvoiceDto(id, 1L, "INV-001", LocalDate.now(), LocalDate.now().plusDays(30),
                "EUR", "FR", null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, InvoiceStatus.DRAFT, InvoiceType.GUEST, null, null, null,
                List.of(), LocalDateTime.now());
    }

    @Test
    void list_returnsAll() {
        when(invoiceGeneratorService.listInvoices()).thenReturn(List.of(dto(1L), dto(2L)));

        ResponseEntity<List<InvoiceDto>> response = controller.listInvoices();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void get_byId() {
        when(invoiceGeneratorService.getInvoice(5L)).thenReturn(dto(5L));

        ResponseEntity<InvoiceDto> response = controller.getInvoice(5L);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().id()).isEqualTo(5L);
    }

    @Test
    void generate_returnsCreated() {
        GenerateInvoiceRequest req = new GenerateInvoiceRequest(10L, null, null, null, null);
        when(invoiceGeneratorService.generateFromReservation(req)).thenReturn(dto(99L));

        ResponseEntity<InvoiceDto> response = controller.generate(req);
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().id()).isEqualTo(99L);
    }

    @Test
    void issue_returnsUpdated() {
        when(invoiceGeneratorService.issueInvoice(5L)).thenReturn(dto(5L));

        ResponseEntity<InvoiceDto> response = controller.issue(5L);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void cancel_withReason() {
        when(invoiceGeneratorService.cancelInvoice(5L, "Mistake")).thenReturn(dto(5L));

        ResponseEntity<InvoiceDto> response = controller.cancel(5L, "Mistake");
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void cancel_nullReason() {
        when(invoiceGeneratorService.cancelInvoice(5L, null)).thenReturn(dto(5L));

        ResponseEntity<InvoiceDto> response = controller.cancel(5L, null);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void downloadPdf_success() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Invoice invoice = new Invoice();
        invoice.setId(5L);
        invoice.setOrganizationId(1L);
        invoice.setInvoiceNumber("INV/2026/001");
        when(invoiceRepository.findWithLinesById(5L)).thenReturn(Optional.of(invoice));
        when(invoicePdfService.generatePdf(invoice)).thenReturn(new byte[]{1, 2, 3});

        ResponseEntity<byte[]> response = controller.downloadPdf(5L);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).hasSize(3);
        assertThat(response.getHeaders().getContentDisposition().getFilename()).contains("Facture_INV-2026-001.pdf");
    }

    @Test
    void downloadPdf_notFound_throws() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(invoiceRepository.findWithLinesById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.downloadPdf(99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("introuvable");
    }

    @Test
    void downloadPdf_wrongOrg_throws() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        Invoice invoice = new Invoice();
        invoice.setId(5L);
        invoice.setOrganizationId(999L);
        when(invoiceRepository.findWithLinesById(5L)).thenReturn(Optional.of(invoice));

        assertThatThrownBy(() -> controller.downloadPdf(5L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void send_callsService() {
        when(invoiceGeneratorService.getInvoice(5L)).thenReturn(dto(5L));

        ResponseEntity<InvoiceDto> response = controller.send(5L);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        verify(invoicePaymentService).sendInvoice(5L);
    }

    @Test
    void pay_callsOrchestrator() {
        PaymentResult ok = PaymentResult.success("s_1", "https://pay.test");
        PaymentTransaction txn = new PaymentTransaction();
        PaymentOrchestrationResult orchResult = new PaymentOrchestrationResult(txn, ok, PaymentProviderType.STRIPE);
        when(invoicePaymentService.payInvoice(5L, PaymentProviderType.STRIPE, "https://ok", "https://cancel"))
                .thenReturn(orchResult);

        ResponseEntity<PaymentOrchestrationResult> response = controller.pay(5L, PaymentProviderType.STRIPE,
                "https://ok", "https://cancel");
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(orchResult);
    }

    @Test
    void pay_nullParams() {
        PaymentResult ok = PaymentResult.success("s_1", "https://pay.test");
        PaymentTransaction txn = new PaymentTransaction();
        PaymentOrchestrationResult orchResult = new PaymentOrchestrationResult(txn, ok, PaymentProviderType.STRIPE);
        when(invoicePaymentService.payInvoice(5L, null, null, null)).thenReturn(orchResult);

        ResponseEntity<PaymentOrchestrationResult> response = controller.pay(5L, null, null, null);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void templateStatus_hasTemplate() {
        when(documentTemplateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.FACTURE)).thenReturn(true);
        DocumentTemplate dt = new DocumentTemplate();
        dt.setName("MyTemplate");
        when(documentTemplateRepository.findByDocumentTypeAndActiveTrue(DocumentType.FACTURE))
                .thenReturn(Optional.of(dt));

        ResponseEntity<Map<String, Object>> response = controller.getTemplateStatus();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Map<String, Object> body = response.getBody();
        assertThat(body).containsEntry("hasTemplate", true);
        assertThat(body).containsEntry("templateName", "MyTemplate");
    }

    @Test
    void templateStatus_noTemplate() {
        when(documentTemplateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.FACTURE)).thenReturn(false);

        ResponseEntity<Map<String, Object>> response = controller.getTemplateStatus();
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        Map<String, Object> body = response.getBody();
        assertThat(body).containsEntry("hasTemplate", false);
        assertThat(body).containsEntry("templateName", "");
    }

    @Test
    void duplicate_returnsCreated() {
        when(invoiceGeneratorService.generateDuplicate(5L)).thenReturn(dto(99L));

        ResponseEntity<InvoiceDto> response = controller.duplicate(5L);
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().id()).isEqualTo(99L);
    }
}
