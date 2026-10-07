package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class InvoicePaymentRecipientTest {
    final ReservationRepository reservations = mock(ReservationRepository.class);
    final InterventionRepository interventions = mock(InterventionRepository.class);
    final InvoicePaymentRecipient service = new InvoicePaymentRecipient(reservations, interventions);

    Invoice invoice(InvoiceType type) {
        var i = new Invoice(); i.setOrganizationId(7L); i.setInvoiceType(type); i.setReservationId(1L); return i;
    }
    Reservation stay() {
        var r = new Reservation(); r.setId(1L); r.setOrganizationId(7L);
        var owner = new User(); owner.setEmail("owner@example.test"); owner.setFirstName("Owner");
        var p = new Property(); p.setOwner(owner); r.setProperty(p);
        var guest = new Guest(); guest.setEmail("guest@example.test"); r.setGuest(guest);
        when(reservations.findById(1L)).thenReturn(Optional.of(r)); return r;
    }

    @Test void commissionGoesToOwnerAndNeverToTraveler() {
        stay();
        assertThat(service.resolve(invoice(InvoiceType.COMMISSION)).email()).isEqualTo("owner@example.test");
    }
    @Test void accommodationGoesToTraveler() {
        stay();
        assertThat(service.resolve(invoice(InvoiceType.GUEST)).email()).isEqualTo("guest@example.test");
    }
    @Test void interventionGoesToRequestorRatherThanAssignedProvider() {
        var i = invoice(InvoiceType.GUEST); i.setReservationId(null); i.setInterventionId(2L);
        var mission = new Intervention(); mission.setOrganizationId(7L);
        var requestor = new User(); requestor.setEmail("requestor@example.test"); mission.setRequestor(requestor);
        when(interventions.findById(2L)).thenReturn(Optional.of(mission));
        assertThat(service.resolve(i).email()).isEqualTo("requestor@example.test");
        verifyNoInteractions(reservations);
    }
    @Test void foreignOrganizationHasNoRecipient() {
        stay().setOrganizationId(8L);
        assertThatThrownBy(() -> service.resolve(invoice(InvoiceType.COMMISSION))).hasMessageContaining("destinataire");
    }
    @Test void buyerDisplayNameCannotSubstituteForMissingEmail() {
        stay().getProperty().getOwner().setEmail(null);
        var i = invoice(InvoiceType.COMMISSION); i.setBuyerName("ACME Corp");
        assertThatThrownBy(() -> service.resolve(i)).hasMessageContaining("destinataire");
    }
}
