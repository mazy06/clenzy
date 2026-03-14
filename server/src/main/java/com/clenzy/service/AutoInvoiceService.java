package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.DocumentGenerationRepository;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.InvoiceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Orchestrateur de generation automatique de factures.
 *
 * Appele depuis les webhooks Stripe (pas de TenantContext).
 * Cree une entite Invoice (donnees fiscales) et la lie au PDF DocumentGeneration.
 *
 * Idempotent : skip silencieusement si une facture existe deja pour la meme source.
 * Resilient : ne jamais bloquer la confirmation de paiement (try/catch dans l'appelant).
 */
@Service
public class AutoInvoiceService {

    private static final Logger log = LoggerFactory.getLogger(AutoInvoiceService.class);

    private final InvoiceGeneratorService invoiceGeneratorService;
    private final InvoiceNumberingService numberingService;
    private final InvoiceRepository invoiceRepository;
    private final FiscalProfileRepository fiscalProfileRepository;
    private final DocumentGenerationRepository documentGenerationRepository;

    public AutoInvoiceService(InvoiceGeneratorService invoiceGeneratorService,
                               InvoiceNumberingService numberingService,
                               InvoiceRepository invoiceRepository,
                               FiscalProfileRepository fiscalProfileRepository,
                               DocumentGenerationRepository documentGenerationRepository) {
        this.invoiceGeneratorService = invoiceGeneratorService;
        this.numberingService = numberingService;
        this.invoiceRepository = invoiceRepository;
        this.fiscalProfileRepository = fiscalProfileRepository;
        this.documentGenerationRepository = documentGenerationRepository;
    }

    /**
     * Genere, emet et marque comme payee une facture pour une reservation.
     * Skip silencieusement si une facture existe deja (idempotent).
     */
    @Transactional
    public Invoice generateForReservation(Reservation reservation) {
        Long orgId = reservation.getOrganizationId();

        // Idempotent : skip si facture existe deja
        if (invoiceRepository.findByReservationId(reservation.getId()).isPresent()) {
            log.debug("Facture deja existante pour reservation {}, skip", reservation.getId());
            return null;
        }

        // Skip si pas de fiscal profile
        if (fiscalProfileRepository.findByOrganizationId(orgId).isEmpty()) {
            log.warn("Pas de profil fiscal pour org {}, skip auto-invoice pour reservation {}",
                orgId, reservation.getId());
            return null;
        }

        // Generer DRAFT
        Invoice invoice = invoiceGeneratorService.generateFromReservation(reservation, orgId);

        // Emettre et marquer PAID directement (paiement Stripe deja recu)
        String number = numberingService.generateNextNumber(orgId);
        invoice.setInvoiceNumber(number);
        invoice.setInvoiceDate(java.time.LocalDate.now());
        invoice.setStatus(InvoiceStatus.PAID);
        invoice.setPaidAt(LocalDateTime.now());
        invoice.setPaymentMethod("STRIPE");

        // Lier au PDF DocumentGeneration (si deja genere)
        linkDocumentGeneration(invoice, ReferenceType.RESERVATION, reservation.getId());

        invoice = invoiceRepository.save(invoice);
        log.info("Auto-facture {} generee et payee pour reservation {} (totalTTC={})",
            number, reservation.getId(), invoice.getTotalTtc());

        return invoice;
    }

    /**
     * Genere, emet et marque comme payee une facture pour une intervention.
     * Skip silencieusement si une facture existe deja (idempotent).
     */
    @Transactional
    public Invoice generateForIntervention(Intervention intervention) {
        Long orgId = intervention.getOrganizationId();

        // Idempotent : skip si facture existe deja
        if (invoiceRepository.findByInterventionId(intervention.getId()).isPresent()) {
            log.debug("Facture deja existante pour intervention {}, skip", intervention.getId());
            return null;
        }

        // Skip si pas de fiscal profile
        if (fiscalProfileRepository.findByOrganizationId(orgId).isEmpty()) {
            log.warn("Pas de profil fiscal pour org {}, skip auto-invoice pour intervention {}",
                orgId, intervention.getId());
            return null;
        }

        // Generer DRAFT
        Invoice invoice = invoiceGeneratorService.generateFromIntervention(intervention, orgId);

        // Emettre et marquer PAID directement (paiement Stripe deja recu)
        String number = numberingService.generateNextNumber(orgId);
        invoice.setInvoiceNumber(number);
        invoice.setInvoiceDate(java.time.LocalDate.now());
        invoice.setStatus(InvoiceStatus.PAID);
        invoice.setPaidAt(LocalDateTime.now());
        invoice.setPaymentMethod("STRIPE");

        // Lier au PDF DocumentGeneration (si deja genere)
        linkDocumentGeneration(invoice, ReferenceType.INTERVENTION, intervention.getId());

        invoice = invoiceRepository.save(invoice);
        log.info("Auto-facture {} generee et payee pour intervention {} (totalTTC={})",
            number, intervention.getId(), invoice.getTotalTtc());

        return invoice;
    }

    /**
     * Lie une facture au dernier DocumentGeneration (PDF) pour la meme reference.
     */
    private void linkDocumentGeneration(Invoice invoice, ReferenceType refType, Long refId) {
        try {
            documentGenerationRepository
                .findByReferenceTypeAndReferenceIdOrderByCreatedAtDesc(refType, refId)
                .stream()
                .filter(dg -> dg.getDocumentType() == DocumentType.FACTURE)
                .findFirst()
                .ifPresent(dg -> invoice.setDocumentGenerationId(dg.getId()));
        } catch (Exception e) {
            log.warn("Impossible de lier DocumentGeneration pour {} {}: {}",
                refType, refId, e.getMessage());
        }
    }
}
