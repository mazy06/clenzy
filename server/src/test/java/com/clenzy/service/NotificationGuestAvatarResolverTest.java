package com.clenzy.service;

import com.clenzy.model.Guest;
import com.clenzy.model.Notification;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ReservationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * Photos de voyageurs d'un LOT de notifications.
 *
 * <p>Trois choses a prouver : une seule requete quel que soit le nombre de
 * lignes (l'ecran se recharge en continu), aucune fuite entre organisations, et
 * des faits illisibles qui n'empechent pas de lire la page.</p>
 */
@ExtendWith(MockitoExtension.class)
class NotificationGuestAvatarResolverTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private GuestPhotoUrlResolver photoUrls;

    private NotificationGuestAvatarResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new NotificationGuestAvatarResolver(reservationRepository, photoUrls, new ObjectMapper());
        lenient().when(photoUrls.publicUrl(org.mockito.ArgumentMatchers.anyLong(),
                                           org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(call -> "/api/guests/" + call.getArgument(0) + "/photo?ticket=t");
    }

    private Notification notification(long id, Long orgId, String metadata) {
        Notification notification = new Notification();
        notification.setId(id);
        notification.setOrganizationId(orgId);
        notification.setMetadata(metadata);
        return notification;
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
    void whenPageHasManyNotifications_thenStaysAreLoadedInOneQuery() {
        List<Notification> rows = List.of(
                notification(1L, 7L, "{\"reservationId\":11}"),
                notification(2L, 7L, "{\"reservationId\":12}"),
                notification(3L, 7L, "{\"reservationId\":13}"));
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 7L, 101L),
                                    reservation(12L, 7L, 102L),
                                    reservation(13L, 7L, 103L)));

        Map<Long, String> photos = resolver.forNotifications(rows);

        assertThat(photos).hasSize(3);
        assertThat(photos.get(1L)).isEqualTo("/api/guests/101/photo?ticket=t");
        verify(reservationRepository, times(1)).findAllWithGuestByIdIn(anyCollection());
    }

    @Test
    void whenTwoNotificationsShareAStay_thenBothGetThePhotoFromOneLookup() {
        // Cas courant : plusieurs messages envoyes sur le meme sejour.
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 7L, 101L)));

        Map<Long, String> photos = resolver.forNotifications(List.of(
                notification(1L, 7L, "{\"reservationId\":11}"),
                notification(2L, 7L, "{\"reservationId\":11}")));

        assertThat(photos).containsOnlyKeys(1L, 2L);
        verify(reservationRepository, times(1)).findAllWithGuestByIdIn(anyCollection());
    }

    @Test
    void whenTheStayBelongsToAnotherOrganization_thenNoPhotoIsAttached() {
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 999L, 101L)));

        Map<Long, String> photos = resolver.forNotifications(
                List.of(notification(1L, 7L, "{\"reservationId\":11}")));

        assertThat(photos).isEmpty();
    }

    @Test
    void whenTheNotificationHasNoOrganization_thenItOpensNoStay() {
        // Evenement plateforme : l'absence d'organisation n'est pas un
        // laissez-passer, on exige l'egalite.
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 7L, 101L)));

        Map<Long, String> photos = resolver.forNotifications(
                List.of(notification(1L, null, "{\"reservationId\":11}")));

        assertThat(photos).isEmpty();
    }

    @Test
    void whenGuestHasNoPhoto_thenTheNotificationIsAbsentRatherThanMappedToNull() {
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 7L, null)));

        Map<Long, String> photos = resolver.forNotifications(
                List.of(notification(1L, 7L, "{\"reservationId\":11}")));

        assertThat(photos).isEmpty();
    }

    @Test
    void whenNoNotificationCarriesAStay_thenNothingIsQueried() {
        Map<Long, String> photos = resolver.forNotifications(List.of(
                notification(1L, 7L, null),
                notification(2L, 7L, "{\"property\":\"Studio Jemmapes\"}"),
                notification(3L, 7L, "pas du json")));

        assertThat(photos).isEmpty();
        verify(reservationRepository, never()).findAllWithGuestByIdIn(anyCollection());
    }
}
