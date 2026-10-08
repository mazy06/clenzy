package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.InvoiceRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Objects;
import java.util.Optional;

/**
 * Génère la facture de commission de gestion (conciergerie → propriétaire) pour une
 * réservation OTA, selon le modèle de paiement du contrat de gestion :
 *
 * <ul>
 *   <li>{@code OWNER_COLLECTS} : facture ISSUED, règlement distinct à recouvrer.</li>
 *   <li>{@code CONCIERGE_COLLECTS} : facture ISSUED, retenue à rapprocher avec les fonds reçus.
 *       Le modèle contractuel et l'import OTA ne prouvent jamais le règlement.</li>
 *   <li>{@code DIRECT} / {@code OTA_COHOST_SPLIT} / pas de contrat : aucune facture
 *       (DIRECT = répartition Stripe via SplitPaymentService ; split = réglé à la source par l'OTA).</li>
 * </ul>
 *
 * Idempotent (skip si une facture COMMISSION existe déjà pour la réservation) et résilient
 * (ne bloque jamais l'import : l'appelant encadre l'appel d'un try/catch).
 */
@Service
public class CommissionInvoiceService {

    private static final Logger log = LoggerFactory.getLogger(CommissionInvoiceService.class);

    private final InvoiceGeneratorService invoiceGeneratorService;
    private final InvoiceNumberingService numberingService;
    private final InvoiceRepository invoiceRepository;
    private final FiscalProfileRepository fiscalProfileRepository;
    private final ManagementContractService managementContractService;
    private final EntityManager em;

    public CommissionInvoiceService(InvoiceGeneratorService invoiceGeneratorService,
                                    InvoiceNumberingService numberingService,
                                    InvoiceRepository invoiceRepository,
                                    FiscalProfileRepository fiscalProfileRepository,
                                    ManagementContractService managementContractService, EntityManager em) {
        this.invoiceGeneratorService = invoiceGeneratorService;
        this.numberingService = numberingService;
        this.invoiceRepository = invoiceRepository;
        this.fiscalProfileRepository = fiscalProfileRepository;
        this.managementContractService = managementContractService;
        this.em = em;
    }

    /**
     * Génère, numérote et fixe le statut de la facture de commission d'une réservation.
     *
     * @return la facture créée, ou {@code null} si non applicable (skip).
     */
    @Transactional
    public Invoice generateForReservation(Reservation reservation) {
        Long orgId = reservation.getOrganizationId();
        if (reservation.getId() == null || orgId == null) return null;
        // Sérialise les imports/rejeux et la préparation du reversement sur la même dette.
        reservation = em.find(Reservation.class, reservation.getId(), LockModeType.PESSIMISTIC_WRITE);
        if (reservation == null || !Objects.equals(orgId, reservation.getOrganizationId())) {
            throw new IllegalStateException("Réservation de commission inaccessible.");
        }
        Long propertyId = reservation.getProperty() != null ? reservation.getProperty().getId() : null;
        if (propertyId == null) {
            return null;
        }

        Optional<ManagementContract> contractOpt =
            managementContractService.getActiveContract(propertyId, orgId);
        if (contractOpt.isEmpty()) {
            return null; // pas de contrat actif = pas de commission
        }
        ManagementContract contract = contractOpt.get();
        ManagementContract.PaymentModel model = contract.getPaymentModel();

        // Seuls OWNER_COLLECTS et CONCIERGE_COLLECTS donnent lieu à une facture de commission.
        if (model != ManagementContract.PaymentModel.OWNER_COLLECTS
                && model != ManagementContract.PaymentModel.CONCIERGE_COLLECTS) {
            return null;
        }

        BigDecimal rate = contract.getCommissionRate();
        if (rate == null || rate.compareTo(BigDecimal.ZERO) <= 0) {
            return null; // pas de taux = rien à facturer
        }

        // Idempotent : une seule facture de commission par réservation.
        if (invoiceRepository.findByReservationIdAndInvoiceType(
                reservation.getId(), InvoiceType.COMMISSION).isPresent()) {
            log.debug("Facture de commission deja existante pour reservation {}, skip", reservation.getId());
            return null;
        }

        // Skip si pas de profil fiscal configuré (cohérent avec AutoInvoiceService).
        if (fiscalProfileRepository.findByOrganizationId(orgId).isEmpty()) {
            log.warn("Pas de profil fiscal pour org {}, skip facture commission reservation {}",
                orgId, reservation.getId());
            return null;
        }

        Invoice invoice = invoiceGeneratorService.generateCommissionFromReservation(reservation, contract, orgId);
        if (invoice.getTotalTtc() == null || invoice.getTotalTtc().compareTo(BigDecimal.ZERO) <= 0) {
            log.debug("Commission nulle pour reservation {}, facture non emise", reservation.getId());
            return null;
        }

        if(!numberingService.checkAndRecord(invoice,"COMMISSION")) return invoiceRepository.save(invoice);
        String number = numberingService.generateNextNumberFor(invoice);
        invoice.setInvoiceNumber(number);
        invoice.setInvoiceDate(LocalDate.now());

        invoice.setStatus(InvoiceStatus.ISSUED);
        if (model == ManagementContract.PaymentModel.CONCIERGE_COLLECTS) {
            // Intention de retenue seulement : aucun paidAt sans preuve de règlement.
            invoice.setPaymentMethod("RETENUE_REVERSEMENT");
            invoice.setDueDate(null);
        }

        invoice = invoiceRepository.save(invoice);
        numberingService.checkAndRecord(invoice,"COMMISSION");
        log.info("Facture commission {} ({}) generee pour reservation {} (totalTTC={})",
            number, invoice.getStatus(), reservation.getId(), invoice.getTotalTtc());
        return invoice;
    }
}
