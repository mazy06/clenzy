package com.clenzy.service;

import com.clenzy.model.Guest;
import com.clenzy.model.Notification;
import com.clenzy.model.Reservation;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
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
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Faits resolus a la LECTURE pour un lot de notifications.
 *
 * <p>Quatre choses a prouver : une seule requete de sejours quel que soit le
 * nombre de lignes (l'ecran se recharge en continu), le sejour retrouve par la
 * CARTE quand les faits ne le portent pas, aucune fuite entre organisations a
 * aucun des deux sauts, et des faits illisibles qui n'empechent pas de lire la
 * page.</p>
 */
@ExtendWith(MockitoExtension.class)
class NotificationFactsResolverTest {

    @Mock private ReservationRepository reservationRepository;
    @Mock private SupervisionSuggestionRepository suggestionRepository;
    @Mock private GuestPhotoUrlResolver photoUrls;

    private NotificationFactsResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new NotificationFactsResolver(reservationRepository, suggestionRepository,
                photoUrls, new ObjectMapper());
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

    private Reservation reservationWithCode(long id, Long orgId, Long guestId, String code) {
        Reservation reservation = reservation(id, orgId, guestId);
        reservation.setConfirmationCode(code);
        return reservation;
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

        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(rows);

        assertThat(facts).hasSize(3);
        assertThat(facts.get(1L).guestAvatarUrl()).isEqualTo("/api/guests/101/photo?ticket=t");
        verify(reservationRepository, times(1)).findAllWithGuestByIdIn(anyCollection());
    }

    @Test
    void whenTwoNotificationsShareAStay_thenBothGetThePhotoFromOneLookup() {
        // Cas courant : plusieurs messages envoyes sur le meme sejour.
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 7L, 101L)));

        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(List.of(
                notification(1L, 7L, "{\"reservationId\":11}"),
                notification(2L, 7L, "{\"reservationId\":11}")));

        assertThat(facts).containsOnlyKeys(1L, 2L);
        verify(reservationRepository, times(1)).findAllWithGuestByIdIn(anyCollection());
    }

    @Test
    void whenTheStayBelongsToAnotherOrganization_thenNoPhotoIsAttached() {
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 999L, 101L)));

        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(
                List.of(notification(1L, 7L, "{\"reservationId\":11}")));

        assertThat(facts).isEmpty();
    }

    @Test
    void whenTheNotificationHasNoOrganization_thenItOpensNoStay() {
        // Evenement plateforme : l'absence d'organisation n'est pas un
        // laissez-passer, on exige l'egalite.
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 7L, 101L)));

        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(
                List.of(notification(1L, null, "{\"reservationId\":11}")));

        assertThat(facts).isEmpty();
    }

    @Test
    void whenGuestHasNoPhoto_thenTheNotificationIsAbsentRatherThanMappedToNull() {
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 7L, null)));

        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(
                List.of(notification(1L, 7L, "{\"reservationId\":11}")));

        assertThat(facts).isEmpty();
    }

    @Test
    void whenNoNotificationCarriesAStay_thenNothingIsQueried() {
        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(List.of(
                notification(1L, 7L, null),
                notification(2L, 7L, "{\"property\":\"Studio Jemmapes\"}"),
                notification(3L, 7L, "pas du json")));

        assertThat(facts).isEmpty();
        verify(reservationRepository, never()).findAllWithGuestByIdIn(anyCollection());
    }

    private SupervisionSuggestion card(long id, Long orgId, Long reservationId) {
        SupervisionSuggestion suggestion = new SupervisionSuggestion();
        suggestion.setId(id);
        suggestion.setOrganizationId(orgId);
        suggestion.setReservationId(reservationId);
        return suggestion;
    }

    @Test
    void whenFactsCarryOnlyTheCard_thenTheStayIsFoundThroughIt() {
        // Notification emise avant que le sejour ne rejoigne les faits : sa carte
        // ne renotifiera pas (deduplication), la fiche resterait muette a vie.
        when(suggestionRepository.findAllById(anyIterable()))
                .thenReturn(List.of(card(556L, 7L, 515L)));
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(515L, 7L, 101L)));

        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(
                List.of(notification(1L, 7L, "{\"suggestionId\":556,\"actionType\":\"NOSHOW_MARK\"}")));

        assertThat(facts.get(1L).reservationId()).isEqualTo(515L);
        assertThat(facts.get(1L).guestAvatarUrl()).isEqualTo("/api/guests/101/photo?ticket=t");
    }

    @Test
    void whenTheStayIsAlreadyInTheFacts_thenItIsNotRepublished() {
        // Le regreffer serait du bruit : il est deja la, ecrit a l'emission.
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 7L, 101L)));

        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(
                List.of(notification(1L, 7L, "{\"reservationId\":11}")));

        assertThat(facts.get(1L).reservationId()).isNull();
        assertThat(facts.get(1L).guestAvatarUrl()).isNotNull();
        verify(suggestionRepository, never()).findAllById(anyIterable());
    }

    @Test
    void whenFactsCarryOnlyTheReference_thenTheStayIsFoundThroughIt() {
        // Message envoye avant que l'identifiant du sejour ne rejoigne les faits :
        // seule sa reference affichable reste, et elle suffit a retrouver le visage.
        when(reservationRepository.findAllWithGuestByConfirmationCodeIn(eq(7L), anyCollection()))
                .thenReturn(List.of(reservationWithCode(515L, 7L, 101L, "SD-76-0041")));
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservationWithCode(515L, 7L, 101L, "SD-76-0041")));

        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(
                List.of(notification(1L, 7L, "{\"reservationReference\":\"SD-76-0041\"}")));

        assertThat(facts.get(1L).reservationId()).isEqualTo(515L);
        assertThat(facts.get(1L).guestAvatarUrl()).isEqualTo("/api/guests/101/photo?ticket=t");
    }

    @Test
    void whenTheReferenceIsLookedUp_thenItIsScopedToTheNotificationOrganization() {
        // Un code de confirmation n'est unique qu'a l'interieur d'une
        // organisation : interroger sans elle rendrait le sejour d'une autre.
        when(reservationRepository.findAllWithGuestByConfirmationCodeIn(eq(7L), anyCollection()))
                .thenReturn(List.of());

        assertThat(resolver.forNotifications(
                List.of(notification(1L, 7L, "{\"reservationReference\":\"SD-76-0041\"}")))).isEmpty();
        verify(reservationRepository).findAllWithGuestByConfirmationCodeIn(eq(7L), anyCollection());
        verify(reservationRepository, never()).findAllWithGuestByIdIn(anyCollection());
    }

    @Test
    void whenTheStayIsAlreadyKnownById_thenTheReferenceIsNotLookedUp() {
        // La reference n'est qu'un repli : elle ne doit pas couter une requete
        // quand les faits portent deja l'identifiant.
        when(reservationRepository.findAllWithGuestByIdIn(anyCollection()))
                .thenReturn(List.of(reservation(11L, 7L, 101L)));

        resolver.forNotifications(List.of(
                notification(1L, 7L, "{\"reservationId\":11,\"reservationReference\":\"SD-76-0041\"}")));

        verify(reservationRepository, never())
                .findAllWithGuestByConfirmationCodeIn(org.mockito.ArgumentMatchers.anyLong(), anyCollection());
    }

    @Test
    void whenTheCardDesignatesALockRatherThanAStay_thenTheDeviceIsResolved() {
        // Une alerte de batterie ne designe aucun sejour : son identifiant de
        // serrure vit dans les parametres de la carte. Sans lui, la fiche
        // restait un paragraphe — et rien ne fera renotifier une carte en
        // attente.
        SupervisionSuggestion lockCard = card(551L, 7L, null);
        lockCard.setActionParams("{\"deviceId\":8}");
        when(suggestionRepository.findAllById(anyIterable())).thenReturn(List.of(lockCard));

        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(
                List.of(notification(1L, 7L,
                        "{\"suggestionId\":551,\"actionType\":\"LOCK_BATTERY_REPLACE\"}")));

        assertThat(facts.get(1L).deviceId()).isEqualTo(8L);
        assertThat(facts.get(1L).reservationId()).isNull();
        // Aucun sejour a charger : la requete des sejours n'a pas lieu d'etre.
        verify(reservationRepository, never()).findAllWithGuestByIdIn(anyCollection());
    }

    @Test
    void whenTheCardCarriesNoParameters_thenNothingIsInvented() {
        SupervisionSuggestion bare = card(551L, 7L, null);
        when(suggestionRepository.findAllById(anyIterable())).thenReturn(List.of(bare));

        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(
                List.of(notification(1L, 7L, "{\"suggestionId\":551}")));

        assertThat(facts).isEmpty();
    }

    @Test
    void whenTheCardBelongsToAnotherOrganization_thenItOpensNoStay() {
        when(suggestionRepository.findAllById(anyIterable()))
                .thenReturn(List.of(card(556L, 999L, 515L)));

        Map<Long, NotificationFactsResolver.ReadFacts> facts = resolver.forNotifications(
                List.of(notification(1L, 7L, "{\"suggestionId\":556}")));

        assertThat(facts).isEmpty();
        verify(reservationRepository, never()).findAllWithGuestByIdIn(anyCollection());
    }
}
