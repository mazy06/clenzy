package com.clenzy.service;

import com.clenzy.dto.GuestDeclarationRequest;
import com.clenzy.dto.OnlineCheckInSubmission;
import com.clenzy.model.OnlineCheckIn;
import com.clenzy.model.Reservation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Une seule saisie du voyageur, deux obligations remplies.
 *
 * <p>Le check-in en ligne et la fiche voyageur ne demandaient pas les mêmes
 * champs et vivaient dans deux formulaires : un voyageur pouvait compléter
 * intégralement le premier sans que la fiche existe. Ces tests figent la
 * jonction, et surtout son garde-fou.</p>
 */
class CheckInSubmissionServiceTest {

    private OnlineCheckInService checkInService;
    private GuestDeclarationService guestDeclarationService;
    private CheckInSubmissionService service;

    @BeforeEach
    void setUp() {
        checkInService = mock(OnlineCheckInService.class);
        guestDeclarationService = mock(GuestDeclarationService.class);
        service = new CheckInSubmissionService(checkInService, guestDeclarationService);
    }

    private void checkInResolvesTo(Long reservationId) {
        final OnlineCheckIn checkIn = new OnlineCheckIn();
        if (reservationId != null) {
            final Reservation reservation = new Reservation();
            reservation.setId(reservationId);
            checkIn.setReservation(reservation);
        }
        when(checkInService.completeCheckIn(any(), any())).thenReturn(checkIn);
    }

    private static OnlineCheckInSubmission withIdentity() {
        return new OnlineCheckInSubmission(
                "Sofia", "Marchetti", "sofia@test.com", "+212600000000",
                "AB1234", "PASSPORT", "15:00", null, 2, null,
                null, "1990-04-12", "Milan", "Italienne", "Via Roma 1", "Italie");
    }

    @Test
    void whenTheGuestGivesTheirIdentity_thenTheFormIsFiled() {
        checkInResolvesTo(42L);

        service.submit(UUID.randomUUID(), withIdentity());

        final ArgumentCaptor<GuestDeclarationRequest> filed =
                ArgumentCaptor.forClass(GuestDeclarationRequest.class);
        verify(guestDeclarationService).submitDeclaration(eq(42L), filed.capture());
        assertThat(filed.getValue().declarants()).singleElement().satisfies(declarant -> {
            assertThat(declarant.firstName()).isEqualTo("Sofia");
            assertThat(declarant.birthDate()).isEqualTo("1990-04-12");
            assertThat(declarant.nationality()).isEqualTo("Italienne");
            // La piece d'identite vient du check-in : elle n'est plus a resaisir.
            assertThat(declarant.idDocumentNumber()).isEqualTo("AB1234");
        });
    }

    @Test
    void whenTheIdentityIsIncomplete_thenNothingIsFiled() {
        // Une fiche partielle serait reputee deposee sans l'etre : l'alerte
        // disparaitrait alors que l'obligation resterait. Mieux vaut pas de
        // fiche du tout, et une alerte qui tient.
        checkInResolvesTo(42L);

        service.submit(UUID.randomUUID(), new OnlineCheckInSubmission(
                "Sofia", "Marchetti", "sofia@test.com", null,
                null, null, null, null, 1, null,
                null, null, null, null, null, null));

        verifyNoInteractions(guestDeclarationService);
    }

    @Test
    void whenTheCheckInHasNoBooking_thenNothingIsFiled() {
        checkInResolvesTo(null);

        service.submit(UUID.randomUUID(), withIdentity());

        verifyNoInteractions(guestDeclarationService);
    }
}
