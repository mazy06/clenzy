package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.InvoiceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Génère la facture de commission de gestion (conciergerie → propriétaire) pour une
 * réservation OTA, selon le modèle de paiement du contrat de gestion :
 *
 * <ul>
 *   <li>{@code OWNER_COLLECTS} : l'OTA a versé au propriétaire → facture ISSUED = créance à recouvrer.</li>
 *   <li>{@code CONCIERGE_COLLECTS} : la conciergerie a encaissé → facture PAID = commission retenue
 *       sur le reversement.</li>
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

    public CommissionInvoiceService(InvoiceGeneratorService invoiceGeneratorService,
                                    InvoiceNumberingService numberingService,
                                    InvoiceRepository invoiceRepository,
                                    FiscalProfileRepository fiscalProfileRepository,
                                    ManagementContractService managementContractService) {
        this.invoiceGeneratorService = invoiceGeneratorService;
        this.numberingService = numberingService;
        this.invoiceRepository = invoiceRepository;
        this.fiscalProfileRepository = fiscalProfileRepository;
        this.managementContractService = managementContractService;
    }

    /**
     * Génère, numérote et fixe le statut de la facture de commission d'une réservation.
     *
     * @return la facture créée, ou {@code null} si non applicable (skip).
     */
    @Transactional
    public Invoice generateForReservation(Reservation reservation) {
        Long orgId = reservation.getOrganizationId();
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

        String number = numberingService.generateNextNumber(orgId);
        invoice.setInvoiceNumber(number);
        invoice.setInvoiceDate(LocalDate.now());

        if (model == ManagementContract.PaymentModel.CONCIERGE_COLLECTS) {
            // La conciergerie a encaissé l'OTA : commission retenue sur le reversement → réglée.
            invoice.setStatus(InvoiceStatus.PAID);
            invoice.setPaidAt(LocalDateTime.now());
            invoice.setPaymentMethod("RETENUE_REVERSEMENT");
        } else {
            // OWNER_COLLECTS : le propriétaire a encaissé l'OTA → créance à recouvrer.
            invoice.setStatus(InvoiceStatus.ISSUED);
        }

        invoice = invoiceRepository.save(invoice);
        log.info("Facture commission {} ({}) generee pour reservation {} (totalTTC={})",
            number, invoice.getStatus(), reservation.getId(), invoice.getTotalTtc());
        return invoice;
    }
}
