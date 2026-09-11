package com.clenzy.service;

import com.clenzy.model.Guest;
import com.clenzy.model.GuestReview;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Photos de voyageurs d'une PAGE d'avis.
 *
 * <p>Deux choses a prouver, et ce sont les deux raisons d'etre du lot : une
 * seule requete quel que soit le nombre d'avis, et aucune fuite entre
 * organisations — un avis ne peut pas se voir attribuer la photo d'une
 * reservation qui appartient a quelqu'un d'autre.</p>
 */
@ExtendWith(MockitoExtension.class)
class ReviewGuestAvatarResolverTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private GuestPhotoUrlResolver photoUrls;

    private ReviewGuestAvatarResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new ReviewGuestAvatarResolver(reservationRepository, photoUrls);
        lenient().when(photoUrls.publicUrl(org.mockito.ArgumentMatchers.anyLong(),
                                           org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(call -> "/api/guests/" + call.getArgument(0) + "/photo?ticket=t");
    }

    private GuestReview review(long id, Long reservationId, Long orgId) {
        GuestReview review = new GuestReview();
        review.setId(id);
        review.setReservationId(reservationId);
        review.setOrganizationId(orgId);
        return review;
    }

    private Reservation reservation(long id, Long orgId, Long guestId) {
        Reservation reservation = new Reservation();
        reservation.setId(id);
        reservation.setOrganizationId(orgId);
        if (guestId != null) {
            Guest guest = new Guest();
            guest.setId(guestId);
            guest.setAvatarUrl("guests/" + guestId + "/photo.jpg");
            reservation.setGuest(guest);
        }
        return reservation;
    }

    @Test
    void whenPageHasManyReviews_thenReservationsAreLoadedInOneQuery() {
        List<GuestReview> reviews = List.of(
                review(1L, 11L, 7L),
                review(2L, 12L, 7L),
                review(3L, 13L, 7L));
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 7L, 101L),
                                    reservation(12L, 7L, 102L),
                                    reservation(13L, 7L, 103L)));

        Map<Long, String> photos = resolver.forReviews(reviews);

        assertThat(photos).hasSize(3);
        assertThat(photos.get(1L)).isEqualTo("/api/guests/101/photo?ticket=t");
        verify(reservationRepository, times(1)).findAllWithGuestByIdIn(anyCollection());
    }

    @Test
    void whenReservationBelongsToAnotherOrganization_thenNoPhotoIsAttached() {
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 999L, 101L)));

        Map<Long, String> photos = resolver.forReviews(List.of(review(1L, 11L, 7L)));

        assertThat(photos).isEmpty();
    }

    @Test
    void whenGuestHasNoPhoto_thenTheReviewIsAbsentRatherThanMappedToNull() {
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 7L, null)));

        Map<Long, String> photos = resolver.forReviews(List.of(review(1L, 11L, 7L)));

        assertThat(photos).isEmpty();
    }

    @Test
    void whenNoReviewCarriesAReservation_thenNothingIsQueried() {
        Map<Long, String> photos = resolver.forReviews(List.of(review(1L, null, 7L)));

        assertThat(photos).isEmpty();
        verify(reservationRepository, never()).findAllWithGuestByIdIn(anyCollection());
    }
}
