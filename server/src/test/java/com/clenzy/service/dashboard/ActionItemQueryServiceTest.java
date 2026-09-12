package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.dto.DashboardOperationsDto.ActionItemsDto;
import com.clenzy.model.ActionItem;
import com.clenzy.model.Guest;
import com.clenzy.model.Reservation;
import com.clenzy.model.UserRole;
import com.clenzy.repository.ActionItemRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.GuestPhotoUrlResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Qui voit quoi.
 *
 * <p>La file est commune à toute l'organisation : une seule table, un seul
 * balayage. Tout le cloisonnement se joue donc à la <b>lecture</b>, et une
 * erreur ici expose directement les données d'un logement à quelqu'un qui n'y a
 * pas droit, ou noie un hôte sous des pannes qu'il ne peut pas réparer.</p>
 */
class ActionItemQueryServiceTest {

    private static final Long ORG = 12L;
    private static final Instant NOW = Instant.parse("2026-07-29T09:00:00Z");

    private ActionItemRepository actionItemRepository;
    private PropertyRepository propertyRepository;
    private ReservationRepository reservationRepository;
    private ActionItemQueryService service;

    @BeforeEach
    void setUp() {
        actionItemRepository = mock(ActionItemRepository.class);
        propertyRepository = mock(PropertyRepository.class);
        reservationRepository = mock(ReservationRepository.class);
        when(reservationRepository.findAllWithGuestByIdIn(any())).thenReturn(List.of());
        service = new ActionItemQueryService(actionItemRepository, propertyRepository,
                reservationRepository, mock(GuestPhotoUrlResolver.class),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static ActionItem row(ActionItemKind kind, String subjectRef, Long propertyId) {
        final ActionItem item = new ActionItem();
        item.setId((long) subjectRef.hashCode());
        item.setOrganizationId(ORG);
        item.setKind(kind.name());
        item.setSubjectRef(subjectRef);
        item.setSeverity("warning");
        item.setPropertyId(propertyId);
        return item;
    }

    private void queueContains(ActionItem... rows) {
        when(actionItemRepository.findOpenForOrg(any(), any())).thenReturn(List.of(rows));
    }

    /** Une ligne visant une réservation : c'est par elle qu'on remonte au voyageur. */
    private static ActionItem rowOnReservation(ActionItemKind kind, String subjectRef, Long reservationId) {
        final ActionItem item = row(kind, subjectRef, 300L);
        item.setTargetId(reservationId);
        return item;
    }

    private static Reservation reservation(Long id, Long orgId, Long guestId) {
        final Guest guest = new Guest();
        guest.setId(guestId);
        guest.setAvatarUrl("guests/" + guestId + "/photo.jpg");
        final Reservation reservation = new Reservation();
        reservation.setId(id);
        reservation.setOrganizationId(orgId);
        reservation.setGuest(guest);
        return reservation;
    }

    @Test
    void whenTheSubjectIsTheGuestOfTheStay_thenTheirPhotoIsAttached() {
        final GuestPhotoUrlResolver photos = mock(GuestPhotoUrlResolver.class);
        when(photos.publicUrl(76L, "guests/76/photo.jpg")).thenReturn("/api/guests/76/photo?ticket=t");
        when(reservationRepository.findAllWithGuestByIdIn(any()))
                .thenReturn(List.of(reservation(455L, ORG, 76L)));
        service = new ActionItemQueryService(actionItemRepository, propertyRepository,
                reservationRepository, photos, Clock.fixed(NOW, ZoneOffset.UTC));
        queueContains(rowOnReservation(ActionItemKind.RESERVATION_PENDING, "pending:455", 455L));

        assertThat(service.getActionItems(ORG, UserRole.SUPER_MANAGER, "kc-staff").items())
                .extracting(item -> item.subjectAvatarUrl())
                .containsExactly("/api/guests/76/photo?ticket=t");
    }

    @Test
    void whenTheStayBelongsToAnotherOrganization_thenNoPhotoCrossesOver() {
        final GuestPhotoUrlResolver photos = mock(GuestPhotoUrlResolver.class);
        // La requête ne filtre pas sur l'organisation : c'est la lecture qui doit
        // comparer. Sans ce garde, une ligne dont le targetId vise le séjour d'une
        // AUTRE organisation en servirait la photo.
        when(reservationRepository.findAllWithGuestByIdIn(any()))
                .thenReturn(List.of(reservation(455L, 99L, 76L)));
        service = new ActionItemQueryService(actionItemRepository, propertyRepository,
                reservationRepository, photos, Clock.fixed(NOW, ZoneOffset.UTC));
        queueContains(rowOnReservation(ActionItemKind.RESERVATION_PENDING, "pending:455", 455L));

        assertThat(service.getActionItems(ORG, UserRole.SUPER_MANAGER, "kc-staff").items())
                .extracting(item -> item.subjectAvatarUrl())
                .containsOnlyNulls();
    }

    @Test
    void whenTheKindHasNoGuestSubject_thenTheStayIsNotEvenLookedUp() {
        // `targetId` ne désigne une réservation que pour certaines natures : pour
        // un ménage en retard, c'est l'intervention. Y chercher un voyageur
        // afficherait la photo de quelqu'un qui n'a rien à voir avec la ligne.
        queueContains(rowOnReservation(ActionItemKind.INTERVENTION_OVERDUE, "overdue:455", 455L));

        assertThat(service.getActionItems(ORG, UserRole.SUPER_MANAGER, "kc-staff").items())
                .extracting(item -> item.subjectAvatarUrl())
                .containsOnlyNulls();
        verify(reservationRepository, never()).findAllWithGuestByIdIn(any());
    }

    @Test
    void whenTheViewerIsNotPlatformStaff_thenTechnicalNoiseIsHidden() {
        queueContains(
                row(ActionItemKind.BALANCE_DUE, "balance:1", 300L),
                row(ActionItemKind.OUTBOX_DEAD_LETTER, "outbox:9", null),
                row(ActionItemKind.AUTOMATION_FAILED, "automation:4", null),
                row(ActionItemKind.INTEGRATION_DISCONNECTED, "connection:airbnb:2", null));

        final ActionItemsDto items = service.getActionItems(ORG, UserRole.SUPERVISOR, "kc-supervisor");

        // Un superviseur ne peut ni comprendre ni éteindre une file de messages
        // saturée : la lui montrer ne produirait que du bruit.
        assertThat(items.items()).extracting(item -> item.kind())
                .containsExactly(ActionItemKind.BALANCE_DUE);
        assertThat(items.total()).isEqualTo(1);
    }

    @Test
    void whenTheViewerIsPlatformStaff_thenNothingIsHidden() {
        queueContains(
                row(ActionItemKind.BALANCE_DUE, "balance:1", 300L),
                row(ActionItemKind.OUTBOX_DEAD_LETTER, "outbox:9", null));

        assertThat(service.getActionItems(ORG, UserRole.SUPER_MANAGER, "kc-staff").items())
                .hasSize(2);
    }

    @Test
    void whenTheViewerIsAHost_thenOnlyTheirPropertiesAreVisible() {
        when(propertyRepository.findIdsByOwnerKeycloakId("kc-owner", ORG))
                .thenReturn(List.of(300L));
        queueContains(
                row(ActionItemKind.BALANCE_DUE, "balance:1", 300L),
                row(ActionItemKind.BALANCE_DUE, "balance:2", 999L));

        assertThat(service.getActionItems(ORG, UserRole.HOST, "kc-owner").items())
                .extracting(item -> item.id())
                .containsExactly("balance:1");
    }

    @Test
    void whenTheViewerIsAHost_thenOrganizationWideActionsRemainVisible() {
        when(propertyRepository.findIdsByOwnerKeycloakId("kc-owner", ORG))
                .thenReturn(List.of(300L));
        // Une ligne sans logement porte une obligation de l ORGANISATION : RGPD,
        // taxe, invitation. La masquer à l exploitant revenait à lui cacher ses
        // propres échéances — un propriétaire tiers, lui, n a pas cet écran.
        queueContains(row(ActionItemKind.INVITATION_EXPIRED, "invitation:7", null));

        assertThat(service.getActionItems(ORG, UserRole.HOST, "kc-owner").items())
                .extracting(item -> item.id())
                .containsExactly("invitation:7");
    }

    @Test
    void whenTheViewerIsFieldStaff_thenNothingLeaksAtAll() {
        // Soldes, prestations et avis relèvent de la gestion : un intervenant ne
        // doit pas recevoir le carnet de l'organisation. Vérifié sans même lire
        // la table — le court-circuit fait partie du contrat.
        final ActionItemsDto items = service.getActionItems(ORG, UserRole.HOUSEKEEPER, "kc-hk");

        assertThat(items.items()).isEmpty();
        assertThat(items.total()).isZero();
        assertThat(items.totalsByKind()).isEmpty();
    }

    @Test
    void whenOneKindFloodsTheQueue_thenTheOthersStillGetSeen() {
        final ActionItem[] rows = new ActionItem[15];
        for (int i = 0; i < 14; i++) {
            rows[i] = row(ActionItemKind.REVIEW_UNANSWERED, "review:" + i, 300L);
        }
        rows[14] = row(ActionItemKind.FEED_STALE, "feed:1", 300L);
        queueContains(rows);

        final ActionItemsDto items = service.getActionItems(ORG, UserRole.SUPERVISOR, "kc");

        // Le plafond par nature existe pour ça : sans lui, quatorze avis
        // pousseraient le calendrier en panne hors de la carte.
        assertThat(items.items()).filteredOn(item -> item.kind() == ActionItemKind.FEED_STALE)
                .hasSize(1);
        assertThat(items.items()).filteredOn(item -> item.kind() == ActionItemKind.REVIEW_UNANSWERED)
                .hasSize(10);
        // Le décompte, lui, porte sur AVANT plafonnement : l'écran doit pouvoir
        // écrire « Avis sans réponse (14) » en n'en affichant que trois.
        assertThat(items.totalsByKind()).containsEntry(ActionItemKind.REVIEW_UNANSWERED, 14);
        assertThat(items.total()).isEqualTo(15);
    }

    @Test
    void whenTheTableHoldsAKindThisVersionIgnores_thenTheDashboardStillLoads() {
        // La table survit au code : après un retour arrière, elle peut contenir
        // des natures que cette version ne connaît plus. Les laisser lever une
        // exception ferait tomber tout le tableau de bord.
        final ActionItem unknown = row(ActionItemKind.BALANCE_DUE, "future:1", 300L);
        unknown.setKind("A_KIND_FROM_THE_FUTURE");
        queueContains(unknown, row(ActionItemKind.BALANCE_DUE, "balance:1", 300L));

        assertThat(service.getActionItems(ORG, UserRole.SUPERVISOR, "kc").items()).hasSize(1);
    }
}
