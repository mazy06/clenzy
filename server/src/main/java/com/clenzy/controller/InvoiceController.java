package com.clenzy.controller;

import com.clenzy.dto.GenerateInvoiceRequest;
import com.clenzy.dto.InvoiceDto;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.model.DocumentType;
import com.clenzy.model.Invoice;
import com.clenzy.model.PaymentProviderType;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.service.InvoiceGeneratorService;
import com.clenzy.service.InvoicePaymentService;
import com.clenzy.service.InvoicePdfService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller REST pour la gestion des factures.
 *
 * Endpoints :
 * - GET    /api/invoices                     → liste des factures
 * - GET    /api/invoices/{id}                → detail d'une facture
 * - POST   /api/invoices/generate            → generer une facture DRAFT depuis une reservation
 * - POST   /api/invoices/{id}/issue          → emettre une facture (DRAFT → ISSUED)
 * - POST   /api/invoices/{id}/cancel         → annuler une facture (cree un avoir)
 * - GET    /api/invoices/{id}/pdf            → telecharger le PDF
 * - POST   /api/invoices/{id}/send           → envoyer une facture (DRAFT → SENT)
 * - POST   /api/invoices/{id}/pay            → payer une facture via orchestrateur
 * - GET    /api/invoices/template-status      → verifier si un template FACTURE existe
 * - POST   /api/invoices/{id}/duplicate       → generer un duplicata
 */
@RestController
@RequestMapping("/api/invoices")
@PreAuthorize("isAuthenticated()")
public class InvoiceController {

    private final InvoiceGeneratorService invoiceGeneratorService;
    private final InvoicePdfService invoicePdfService;
    private final InvoicePaymentService invoicePaymentService;
    private final InvoiceRepository invoiceRepository;
    private final DocumentTemplateRepository documentTemplateRepository;
    private final TenantContext tenantContext;

    public InvoiceController(InvoiceGeneratorService invoiceGeneratorService,
                              InvoicePdfService invoicePdfService,
                              InvoicePaymentService invoicePaymentService,
                              InvoiceRepository invoiceRepository,
                              DocumentTemplateRepository documentTemplateRepository,
                              TenantContext tenantContext) {
        this.invoiceGeneratorService = invoiceGeneratorService;
        this.invoicePdfService = invoicePdfService;
        this.invoicePaymentService = invoicePaymentService;
        this.invoiceRepository = invoiceRepository;
        this.documentTemplateRepository = documentTemplateRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Liste les factures de l'organisation courante.
     */
    @GetMapping
    public ResponseEntity<List<InvoiceDto>> listInvoices() {
        return ResponseEntity.ok(invoiceGeneratorService.listInvoices());
    }

    /**
     * Retourne le detail d'une facture.
     */
    @GetMapping("/{id}")
    public ResponseEntity<InvoiceDto> getInvoice(@PathVariable Long id) {
        return ResponseEntity.ok(invoiceGeneratorService.getInvoice(id));
    }

    /**
     * Genere une facture DRAFT a partir d'une reservation.
     */
    @PostMapping("/generate")
    public ResponseEntity<InvoiceDto> generate(@RequestBody GenerateInvoiceRequest request) {
        InvoiceDto invoice = invoiceGeneratorService.generateFromReservation(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(invoice);
    }

    /**
     * Emet une facture : attribue un numero sequentiel et passe en ISSUED.
     */
    @PostMapping("/{id}/issue")
    public ResponseEntity<InvoiceDto> issue(@PathVariable Long id) {
        return ResponseEntity.ok(invoiceGeneratorService.issueInvoice(id));
    }

    /**
     * Annule une facture emise en creant un avoir (CREDIT_NOTE).
     */
    @PostMapping("/{id}/cancel")
    public ResponseEntity<InvoiceDto> cancel(@PathVariable Long id,
                                              @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(invoiceGeneratorService.cancelInvoice(id, reason));
    }

    /**
     * Telecharge le PDF de la facture.
     */
    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Invoice invoice = invoiceRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Facture introuvable: " + id));

        if (!invoice.getOrganizationId().equals(orgId)) {
            throw new IllegalArgumentException("Facture introuvable: " + id);
        }

        byte[] pdfBytes = invoicePdfService.generatePdf(invoice);

        String filename = "Facture_" + invoice.getInvoiceNumber().replace("/", "-") + ".pdf";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment()
            .filename(filename)
            .build());
        headers.setContentLength(pdfBytes.length);

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    /**
     * Envoie une facture au client (DRAFT → SENT).
     */
    @PostMapping("/{id}/send")
    public ResponseEntity<InvoiceDto> send(@PathVariable Long id) {
        invoicePaymentService.sendInvoice(id);
        return ResponseEntity.ok(invoiceGeneratorService.getInvoice(id));
    }

    /**
     * Declenche le paiement d'une facture via l'orchestrateur.
     */
    @PostMapping("/{id}/pay")
    public ResponseEntity<PaymentOrchestrationResult> pay(
            @PathVariable Long id,
            @RequestParam(required = false) PaymentProviderType preferredProvider,
            @RequestParam(required = false) String successUrl,
            @RequestParam(required = false) String cancelUrl) {
        PaymentOrchestrationResult result = invoicePaymentService.payInvoice(
                id, preferredProvider, successUrl, cancelUrl);
        return ResponseEntity.ok(result);
    }

    /**
     * Verifie si un template actif de type FACTURE existe.
     * Utilise par le frontend pour afficher un avertissement si aucun template n'est configure.
     */
    @GetMapping("/template-status")
    public ResponseEntity<Map<String, Object>> getTemplateStatus() {
        boolean hasTemplate = documentTemplateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.FACTURE);
        String templateName = null;
        if (hasTemplate) {
            templateName = documentTemplateRepository.findByDocumentTypeAndActiveTrue(DocumentType.FACTURE)
                .map(t -> t.getName())
                .orElse(null);
        }
        return ResponseEntity.ok(Map.of(
            "hasTemplate", hasTemplate,
            "templateName", templateName != null ? templateName : ""
        ));
    }

    /**
     * Genere un duplicata d'une facture existante.
     */
    @PostMapping("/{id}/duplicate")
    public ResponseEntity<InvoiceDto> duplicate(@PathVariable Long id) {
        InvoiceDto duplicate = invoiceGeneratorService.generateDuplicate(id);
        return ResponseEntity.status(HttpStatus.CREATED).body(duplicate);
    }
}
