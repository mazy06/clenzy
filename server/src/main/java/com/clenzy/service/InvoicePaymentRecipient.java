package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Objects;

/** Destinataire métier partagé par Checkout et le lien de règlement Baitly. */
@Service
@Transactional(readOnly = true)
public class InvoicePaymentRecipient {
    private final ReservationRepository reservations;
    private final InterventionRepository interventions;

    public InvoicePaymentRecipient(ReservationRepository reservations, InterventionRepository interventions) {
        this.reservations = reservations; this.interventions = interventions;
    }

    public record Recipient(String email, String name) {}

    public Recipient resolve(Invoice invoice) {
        if (invoice.getInvoiceType() == InvoiceType.COMMISSION) {
            var stay = reservation(invoice);
            if (stay == null || stay.getProperty() == null) throw missing();
            return user(stay.getProperty().getOwner());
        }
        if (invoice.getInterventionId() != null) {
            var mission = interventions.findById(invoice.getInterventionId()).orElseThrow(InvoicePaymentRecipient::missing);
            if (!Objects.equals(invoice.getOrganizationId(), mission.getOrganizationId())) throw missing();
            return user(mission.getRequestor());
        }
        var stay = reservation(invoice);
        if (stay != null && stay.getGuest() != null) {
            return checked(stay.getGuest().getEmail(), stay.getGuest().getFullName());
        }
        throw missing();
    }

    private Reservation reservation(Invoice invoice) {
        if (invoice.getReservationId() == null) return null;
        return reservations.findById(invoice.getReservationId())
                .filter(r -> Objects.equals(invoice.getOrganizationId(), r.getOrganizationId())).orElse(null);
    }

    private static Recipient user(User user) {
        if (user == null) throw missing();
        return checked(user.getEmail(), ((user.getFirstName() == null ? "" : user.getFirstName()) + " "
                + (user.getLastName() == null ? "" : user.getLastName())).trim());
    }

    private static Recipient checked(String email, String name) {
        if (email == null || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw missing();
        return new Recipient(email, name);
    }

    private static IllegalStateException missing() {
        return new IllegalStateException("Le destinataire de cette facture doit être renseigné avant son règlement.");
    }
}
