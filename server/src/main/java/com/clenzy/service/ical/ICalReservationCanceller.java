package com.clenzy.service.ical;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.CalendarEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Annulation cascade d'une reservation detectee comme annulee lors d'un sync iCal
 * (STATUS:CANCELLED dans le feed ou evenement disparu du feed) : paiement,
 * calendrier, interventions/ServiceRequests et factures brouillon.
 */
@Component
public class ICalReservationCanceller {

    private static final Logger log = LoggerFactory.getLogger(ICalReservationCanceller.class);

    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final InvoiceRepository invoiceRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final CalendarEngine calendarEngine;

    public ICalReservationCanceller(ReservationRepository reservationRepository,
                                    InterventionRepository interventionRepository,
                                    InvoiceRepository invoiceRepository,
                                    ServiceRequestRepository serviceRequestRepository,
                                    CalendarEngine calendarEngine) {
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.invoiceRepository = invoiceRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.calendarEngine = calendarEngine;
    }

    /**
     * Annule une reservation avec cascade vers paiements, interventions et factures.
     *
     * Note : on ne masque PAS la reservation du planning (hiddenFromPlanning reste false).
     * Le bloc s'affiche en rouge avec une croix pour que l'utilisateur puisse choisir
     * de le retirer manuellement (PATCH /api/reservations/{id}/hide).
     */
    public void cancelReservationWithCascade(Reservation reservation, ICalImportSession session) {
        reservation.setStatus("cancelled");

        // Annuler le paiement reservation (sauf si deja rembourse ou annule)
        if (reservation.getPaymentStatus() != null
                && reservation.getPaymentStatus() != PaymentStatus.REFUNDED
                && reservation.getPaymentStatus() != PaymentStatus.CANCELLED) {
            reservation.setPaymentStatus(PaymentStatus.CANCELLED);
        }
        reservationRepository.save(reservation);

        // Liberer les jours du calendrier — un echec laisse les jours bloques sans
        // retry automatique : compte dans le resultat de sync (pas de swallow).
        try {
            calendarEngine.cancel(reservation.getId(), session.orgId, "ical-sync");
        } catch (Exception e) {
            log.error("Erreur liberation calendrier reservation #{}: {}", reservation.getId(), e.getMessage());
            session.errors.add("Liberation calendrier reservation #" + reservation.getId()
                    + " : " + e.getMessage());
        }

        // Annuler les interventions (menage) liees
        cancelLinkedInterventions(reservation.getId(), session.orgId);

        // Annuler la facture brouillon liee
        cancelLinkedDraftInvoice(reservation.getId());

        log.info("iCal sync: annulation cascade reservation #{} (property #{}, uid={})",
                reservation.getId(), reservation.getProperty().getId(), reservation.getExternalUid());
    }

    /**
     * Annule les interventions et ServiceRequests liees a une reservation.
     * Les interventions deja COMPLETED ou deja CANCELLED ne sont pas touchees.
     * Les paiements d'interventions non encore regles sont annules.
     */
    private void cancelLinkedInterventions(Long reservationId, Long orgId) {
        // Annuler les interventions
        List<Intervention> interventions = interventionRepository.findByReservationId(reservationId, orgId);
        for (Intervention intervention : interventions) {
            if (intervention.getStatus() != InterventionStatus.CANCELLED
                    && intervention.getStatus() != InterventionStatus.COMPLETED) {
                intervention.setStatus(InterventionStatus.CANCELLED);
                if (intervention.getPaymentStatus() != null
                        && intervention.getPaymentStatus() != PaymentStatus.PAID
                        && intervention.getPaymentStatus() != PaymentStatus.REFUNDED) {
                    intervention.setPaymentStatus(PaymentStatus.CANCELLED);
                }
                interventionRepository.save(intervention);
                log.debug("Intervention #{} annulee (reservation #{} annulee via iCal)",
                        intervention.getId(), reservationId);
            }
        }

        // Annuler les ServiceRequests liees
        List<ServiceRequest> srs = serviceRequestRepository.findByReservationId(reservationId, orgId);
        for (ServiceRequest sr : srs) {
            if (sr.getStatus() != RequestStatus.CANCELLED && sr.getStatus() != RequestStatus.COMPLETED) {
                sr.setStatus(RequestStatus.CANCELLED);
                serviceRequestRepository.save(sr);
                log.debug("ServiceRequest #{} annulee (reservation #{} annulee via iCal)",
                        sr.getId(), reservationId);
            }
        }
    }

    /**
     * Annule la facture brouillon liee a une reservation.
     * Seules les factures DRAFT sont annulees ; les factures emises/payees ne sont pas touchees.
     */
    private void cancelLinkedDraftInvoice(Long reservationId) {
        // Annule les brouillons (séjour ET commission) ; les factures émises/payées restent intactes.
        for (Invoice invoice : invoiceRepository.findAllByReservationId(reservationId)) {
            if (invoice.getStatus() == InvoiceStatus.DRAFT) {
                invoice.setStatus(InvoiceStatus.CANCELLED);
                invoiceRepository.save(invoice);
                log.debug("Facture #{} annulee (reservation #{} annulee via iCal)",
                        invoice.getId(), reservationId);
            }
        }
    }
}
