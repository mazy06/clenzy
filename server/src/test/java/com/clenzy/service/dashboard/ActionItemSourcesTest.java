package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.UserRole;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.GuestMessageLogRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Les jugements portés par chaque source.
 *
 * <p>Ces règles vivaient dans un service unique de huit cents lignes ; elles
 * sont maintenant dans des sources séparées, et sont testées là où elles sont
 * écrites. Ce qui est vérifié ici n'est pas le câblage — c'est le <b>jugement
 * métier</b> : à partir de quand une chose devient urgente, quel délai laisse
 * sa chance à l'automatisme, quel montant reste affiché.</p>
 */
@ExtendWith(MockitoExtension.class)
class ActionItemSourcesTest {

    private static final Long ORG = 12L;
    private static final Instant NOW = Instant.parse("2026-07-29T09:00:00Z");
    private static final LocalDateTime NOW_LOCAL =
            LocalDateTime.ofInstant(NOW, ZoneId.of("UTC"));
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneId.of("UTC"));

    private static final ActionItemContext CTX =
            ActionItemContext.of(ORG, UserRole.SUPER_ADMIN, null, CLOCK);

    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ConversationRepository conversationRepository;
    @Mock private GuestMessageLogRepository guestMessageLogRepository;
    @Mock private WelcomeGuideRepository welcomeGuideRepository;

    private static Property property(long id, String name) {
        final Property property = new Property();
        property.setId(id);
        property.setName(name);
        return property;
    }

    private static ServiceRequest cleaning(long id, String title, LocalDateTime desiredDate) {
        final ServiceRequest request = new ServiceRequest();
        request.setId(id);
        request.setTitle(title);
        request.setProperty(property(300L, "Appartement Duplex Marrakech"));
        request.setStatus(RequestStatus.PENDING);
        request.setDesiredDate(desiredDate);
        request.setEstimatedCost(new BigDecimal("95"));
        return request;
    }

    // Aucun stub par défaut : Mockito rend déjà une liste vide pour une méthode
    // non stubée. En poser un ici écraserait celui que le test vient d'établir —
    // c'est exactement ce qui faisait passer ces sources pour muettes.

    private ServiceRequestActionSource serviceRequests() {
        return new ServiceRequestActionSource(serviceRequestRepository);
    }

    private ReservationActionSource reservations() {
        return new ReservationActionSource(reservationRepository, welcomeGuideRepository);
    }

    @Test
    void whenServiceStaysUnassigned_thenItSurfacesWithItsCostAndProperty() {
        when(serviceRequestRepository.findStuckUnassignedForOrg(eq(ORG), any()))
                .thenReturn(List.of(cleaning(41L, "Menage Airbnb", NOW_LOCAL.plusDays(2))));

        final List<ActionItemDto> items = serviceRequests().collect(CTX);

        assertThat(items).hasSize(1);
        final ActionItemDto item = items.get(0);
        assertThat(item.kind()).isEqualTo(ActionItemKind.SERVICE_UNASSIGNED);
        assertThat(item.id()).isEqualTo("unassigned:41");
        assertThat(item.title()).isEqualTo("Menage Airbnb");
        assertThat(item.propertyName()).isEqualTo("Appartement Duplex Marrakech");
        // Le montant reste affiché : c'est l'ordre de grandeur de l'enjeu.
        assertThat(item.amount()).isEqualByComparingTo("95");
        // La date n'est pas encore passée : la prestation peut encore avoir lieu.
        assertThat(item.severity()).isEqualTo("warning");
    }

    @Test
    void whenDesiredDateHasPassed_thenTheServiceIsCritical() {
        when(serviceRequestRepository.findStuckUnassignedForOrg(eq(ORG), any()))
                .thenReturn(List.of(cleaning(42L, "Menage Airbnb", NOW_LOCAL.minusDays(1))));

        // Personne n'est venu et la date est dépassée : ça ne se rattrape plus.
        assertThat(serviceRequests().collect(CTX).get(0).severity()).isEqualTo("critical");
    }

    @Test
    void whenLookingForStuckServices_thenARecentlyCreatedOneIsLeftAlone() {
        serviceRequests().collect(CTX);

        // Le planificateur repasse toutes les 15 min : une demande créée à
        // l'instant a encore sa chance d'être assignée toute seule, et n'a rien
        // à faire dans une file d'actions humaines.
        final ArgumentCaptor<LocalDateTime> staleBefore =
                ArgumentCaptor.forClass(LocalDateTime.class);
        verify(serviceRequestRepository).findStuckUnassignedForOrg(eq(ORG), staleBefore.capture());
        assertThat(staleBefore.getValue()).isEqualTo(NOW_LOCAL.minusMinutes(15));
    }

    @Test
    void whenAStayArrivedWithoutADeclaration_thenItIsCritical() {
        // Obligation légale : la déclaration voyageur n'a pas été déposée, et
        // l'écran de conformité se masque justement dans ce cas.
        final Reservation stay = new Reservation();
        stay.setId(70L);
        stay.setGuestName("Sofia M.");
        stay.setProperty(property(300L, "Riad Zitoun"));
        stay.setCheckIn(NOW_LOCAL.toLocalDate().minusDays(2));
        when(reservationRepository.findWithoutGuestDeclaration(eq(ORG), any(), any()))
                .thenReturn(List.of(stay));

        assertThat(reservations().collect(CTX))
                .singleElement()
                .satisfies(item -> {
                    assertThat(item.kind()).isEqualTo(ActionItemKind.GUEST_DECLARATION_MISSING);
                    assertThat(item.severity()).isEqualTo("critical");
                });
    }

    @Test
    void whenAReservationStaysUnconfirmed_thenItsUrgencyFollowsTheArrival() {
        // « pending » exclut la réservation de tout le reste du produit : ni
        // ménage, ni message, ni solde réclamé.
        final Reservation soon = new Reservation();
        soon.setId(71L);
        soon.setProperty(property(300L, "Riad Zitoun"));
        soon.setCheckIn(NOW_LOCAL.toLocalDate().plusDays(2));
        final Reservation later = new Reservation();
        later.setId(72L);
        later.setProperty(property(300L, "Riad Zitoun"));
        later.setCheckIn(NOW_LOCAL.toLocalDate().plusDays(6));
        when(reservationRepository.findPendingWithUpcomingCheckIn(eq(ORG), any(), any()))
                .thenReturn(List.of(soon, later));

        final List<ActionItemDto> items = reservations().collect(CTX);

        assertThat(items).hasSize(2);
        // Sous trois jours le ménage ne se planifie plus : c'est critique.
        assertThat(items.get(0).severity()).isEqualTo("critical");
        assertThat(items.get(1).severity()).isEqualTo("warning");
    }

    @Test
    void whenAStayEndedWithAnUnpaidBalance_thenItIsStillClaimed() {
        // Le bloc « soldes à percevoir » ne regarde que les arrivées futures :
        // l'argent disparaissait de l'écran au moment où il devenait vraiment dû.
        final Reservation past = new Reservation();
        past.setId(80L);
        past.setGuestName("Marcus L.");
        past.setProperty(property(300L, "Riad Zitoun"));
        past.setCheckOut(NOW_LOCAL.toLocalDate().minusDays(5));
        past.setAmountDue(new BigDecimal("640"));
        when(reservationRepository.findWithBalanceAfterStay(eq(ORG), any(), any()))
                .thenReturn(List.of(past));

        assertThat(reservations().collect(CTX))
                .singleElement()
                .satisfies(item -> {
                    assertThat(item.kind()).isEqualTo(ActionItemKind.BALANCE_ABANDONED);
                    assertThat(item.amount()).isEqualByComparingTo("640");
                    // Un séjour consommé et non payé ne se rattrape pas tout seul.
                    assertThat(item.severity()).isEqualTo("critical");
                });
    }

    @Test
    void whenAnArrivalHasNoPublishedGuide_thenItSurfaces_butNotWhenOneExists() {
        final Reservation arriving = new Reservation();
        arriving.setId(81L);
        arriving.setGuestName("Inès K.");
        arriving.setProperty(property(300L, "Riad Zitoun"));
        arriving.setCheckIn(NOW_LOCAL.toLocalDate());
        when(reservationRepository.findConfirmedByCheckInRange(any(), any(), eq(ORG)))
                .thenReturn(List.of(arriving));
        // Un livret non publié rejette tous les accès publics : le voyageur
        // reçoit un lien mort.
        when(welcomeGuideRepository.existsPublishedForProperty(300L, ORG)).thenReturn(false);

        assertThat(reservations().collect(CTX))
                .anyMatch(item -> item.kind() == ActionItemKind.WELCOME_GUIDE_MISSING);

        when(welcomeGuideRepository.existsPublishedForProperty(300L, ORG)).thenReturn(true);

        assertThat(reservations().collect(CTX))
                .noneMatch(item -> item.kind() == ActionItemKind.WELCOME_GUIDE_MISSING);
    }

    @Test
    void whenAnInterventionIsPastDue_thenItSurfaces() {
        final Intervention late = new Intervention();
        late.setId(73L);
        late.setTitle("Ménage de départ");
        late.setProperty(property(300L, "Loft Gueliz"));
        when(interventionRepository.findOverdueForOrg(eq(ORG), any())).thenReturn(List.of(late));

        assertThat(new InterventionActionSource(interventionRepository).collect(CTX))
                .singleElement()
                .satisfies(item -> {
                    assertThat(item.kind()).isEqualTo(ActionItemKind.INTERVENTION_OVERDUE);
                    assertThat(item.title()).isEqualTo("Ménage de départ");
                });
    }

    @Test
    void whenLookingForSilentConversations_thenFourHoursOfSilenceCount() {
        new MessagingActionSource(conversationRepository, guestMessageLogRepository).collect(CTX);

        // Le seuil est un choix : au-delà de quatre heures, le silence pendant
        // un séjour se paie en avis.
        final ArgumentCaptor<LocalDateTime> staleBefore =
                ArgumentCaptor.forClass(LocalDateTime.class);
        verify(conversationRepository).findAwaitingHostReply(eq(ORG), staleBefore.capture());
        assertThat(staleBefore.getValue()).isEqualTo(NOW_LOCAL.minusHours(4));
    }

    @Test
    void whenTheViewerIsAHost_thenOnlyTheirPropertiesPassTheFilter() {
        // Le périmètre est porté par le contexte, une fois, plutôt que recopié
        // dans chaque source : une source qui l'oublierait exposerait les
        // logements de toute l'organisation.
        final ActionItemContext hostView =
                ActionItemContext.of(ORG, UserRole.HOST, "kc-owner", CLOCK);

        assertThat(hostView.covers(property(300L, "Sans propriétaire"))).isFalse();
        assertThat(hostView.covers(null)).isFalse();
        assertThat(CTX.covers(property(300L, "Vue gestionnaire"))).isTrue();
    }
}
