package com.clenzy.controller;

import com.clenzy.dto.GenerateInvoiceRequest;
import com.clenzy.dto.InvoiceDto;
import com.clenzy.model.Invoice;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.service.InvoiceGeneratorService;
import com.clenzy.service.InvoicePdfService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller REST pour la gestion des factures.
 *
 * Endpoints :
 * - GET    /api/invoices                  → liste des factures
 * - GET    /api/invoices/{id}             → detail d'une facture
 * - POST   /api/invoices/generate         → generer une facture DRAFT depuis une reservation
 * - POST   /api/invoices/{id}/issue       → emettre une facture (DRAFT → ISSUED)
 * - POST   /api/invoices/{id}/cancel      → annuler une facture (cree un avoir)
 * - GET    /api/invoices/{id}/pdf         → telecharger le PDF
 */
@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private final InvoiceGeneratorService invoiceGeneratorService;
    private final InvoicePdfService invoicePdfService;
    private final InvoiceRepository invoiceRepository;
    private final TenantContext tenantContext;

    public InvoiceController(InvoiceGeneratorService invoiceGeneratorService,
                              InvoicePdfService invoicePdfService,
                              InvoiceRepository invoiceRepository,
                              TenantContext tenantContext) {
        this.invoiceGeneratorService = invoiceGeneratorService;
        this.invoicePdfService = invoicePdfService;
        this.invoiceRepository = invoiceRepository;
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
}
