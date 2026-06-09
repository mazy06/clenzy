package com.clenzy.service;

import com.clenzy.model.ManagementContract;
import com.clenzy.model.Reservation;
import org.springframework.stereotype.Service;

/**
 * Oriente la facturation d'une réservation OTA importée selon le modèle de paiement du
 * contrat de gestion de la propriété :
 *
 * <ul>
 *   <li>facture de séjour (conciergerie → client) : {@code DIRECT} et {@code CONCIERGE_COLLECTS},
 *       ou en l'absence de contrat (comportement historique préservé) ;</li>
 *   <li>facture de commission (conciergerie → propriétaire) : déléguée à
 *       {@link CommissionInvoiceService}, qui décide lui-même de l'applicabilité.</li>
 * </ul>
 *
 * En {@code OWNER_COLLECTS}, la conciergerie n'émet pas la facture de séjour (le propriétaire la
 * facture lui-même) ; en {@code OTA_COHOST_SPLIT}, la répartition est réglée à la source par l'OTA.
 */
@Service
public class OtaReservationInvoicingService {

    private final AutoInvoiceService autoInvoiceService;
    private final CommissionInvoiceService commissionInvoiceService;
    private final ManagementContractService managementContractService;

    public OtaReservationInvoicingService(AutoInvoiceService autoInvoiceService,
                                          CommissionInvoiceService commissionInvoiceService,
                                          ManagementContractService managementContractService) {
        this.autoInvoiceService = autoInvoiceService;
        this.commissionInvoiceService = commissionInvoiceService;
        this.managementContractService = managementContractService;
    }

    /**
     * Génère les factures applicables pour une réservation OTA fraîchement importée.
     * Chaque génération est isolée et idempotente (services sous-jacents @Transactional).
     */
    public void invoiceImportedReservation(Reservation reservation) {
        ManagementContract.PaymentModel model = resolvePaymentModel(reservation);

        // Facture de séjour : la conciergerie est vendeuse (DIRECT / CONCIERGE_COLLECTS / pas de contrat).
        if (model == ManagementContract.PaymentModel.DIRECT
                || model == ManagementContract.PaymentModel.CONCIERGE_COLLECTS) {
            autoInvoiceService.generateForReservation(reservation);
        }

        // Facture de commission : applicable en OWNER_COLLECTS / CONCIERGE_COLLECTS (skip interne sinon).
        commissionInvoiceService.generateForReservation(reservation);
    }

    private ManagementContract.PaymentModel resolvePaymentModel(Reservation reservation) {
        Long propertyId = reservation.getProperty() != null ? reservation.getProperty().getId() : null;
        if (propertyId == null) {
            return ManagementContract.PaymentModel.DIRECT;
        }
        return managementContractService.getActiveContract(propertyId, reservation.getOrganizationId())
            .map(ManagementContract::getPaymentModel)
            .orElse(ManagementContract.PaymentModel.DIRECT);
    }
}
