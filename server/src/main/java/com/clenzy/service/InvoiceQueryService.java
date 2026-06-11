package com.clenzy.service;

import com.clenzy.model.DocumentType;
import com.clenzy.model.Invoice;
import com.clenzy.repository.DocumentTemplateRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lectures factures cote API : telechargement PDF (avec isolation org) et
 * statut du template FACTURE. Extrait de InvoiceController (audit T-ARCH-01,
 * regle 4 « Lecons de l'audit 2026-06 »).
 */
@Service
public class InvoiceQueryService {

    private final InvoiceRepository invoiceRepository;
    private final DocumentTemplateRepository documentTemplateRepository;
    private final InvoicePdfService invoicePdfService;
    private final TenantContext tenantContext;

    public InvoiceQueryService(InvoiceRepository invoiceRepository,
                               DocumentTemplateRepository documentTemplateRepository,
                               InvoicePdfService invoicePdfService,
                               TenantContext tenantContext) {
        this.invoiceRepository = invoiceRepository;
        this.documentTemplateRepository = documentTemplateRepository;
        this.invoicePdfService = invoicePdfService;
        this.tenantContext = tenantContext;
    }

    /** PDF d'une facture pret a servir (nom de fichier + contenu). */
    public record InvoicePdfFile(String filename, byte[] content) {}

    /** Statut du template actif de type FACTURE ({@code templateName} null si absent). */
    public record InvoiceTemplateStatus(boolean hasTemplate, String templateName) {}

    /**
     * Genere le PDF d'une facture de l'organisation courante.
     *
     * Volontairement NON annotee @Transactional : invoicePdfService.generatePdf
     * fait un POST HTTP vers Gotenberg (avec retries Resilience4j) et garder une
     * connexion DB pendant la conversion epuiserait le pool (regle audit n°2).
     * Le chargement passe par un fetch-join ({@code findWithLinesById}) : la
     * transaction courte est portee par le proxy Spring Data (pas
     * d'auto-invocation, regle 6) et les lignes LAZY sont initialisees avant de
     * sortir de la session (open-in-view=false dans tous les profils).
     * L'org est validee explicitement (meme message « introuvable » pour ne pas
     * divulguer l'existence cross-org).
     */
    public InvoicePdfFile generatePdf(Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Invoice invoice = invoiceRepository.findWithLinesById(id)
            .orElseThrow(() -> new IllegalArgumentException("Facture introuvable: " + id));

        if (!invoice.getOrganizationId().equals(orgId)) {
            throw new IllegalArgumentException("Facture introuvable: " + id);
        }

        byte[] pdfBytes = invoicePdfService.generatePdf(invoice);
        String filename = "Facture_" + invoice.getInvoiceNumber().replace("/", "-") + ".pdf";
        return new InvoicePdfFile(filename, pdfBytes);
    }

    /**
     * Verifie si un template actif de type FACTURE existe.
     * Utilise par le frontend pour afficher un avertissement si aucun template n'est configure.
     */
    @Transactional(readOnly = true)
    public InvoiceTemplateStatus getInvoiceTemplateStatus() {
        boolean hasTemplate = documentTemplateRepository.existsByDocumentTypeAndActiveTrue(DocumentType.FACTURE);
        String templateName = null;
        if (hasTemplate) {
            templateName = documentTemplateRepository.findByDocumentTypeAndActiveTrue(DocumentType.FACTURE)
                .map(t -> t.getName())
                .orElse(null);
        }
        return new InvoiceTemplateStatus(hasTemplate, templateName);
    }
}
