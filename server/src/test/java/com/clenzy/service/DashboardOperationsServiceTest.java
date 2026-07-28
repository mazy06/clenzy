package com.clenzy.service;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.dto.DashboardOperationsDto.ActionItemsDto;
import com.clenzy.model.Property;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.UserRole;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
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
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * File « à traiter » du Dashboard.
 *
 * <p>Les tests portent sur les prestations sans prestataire : ce filtre s'est
 * trompé deux fois de suite. D'abord en montrant des prestations que le serveur
 * refuse ensuite de facturer, puis en étant si restrictif qu'elles
 * disparaissaient de l'écran sans réapparaître ailleurs.</p>
 *
 * <p>Les cartes des agents ne sont plus une source de cette file : elles vivent
 * dans la constellation, et les reprendre ici affichait deux fois le même sujet.</p>
 */
@ExtendWith(MockitoExtension.class)
class DashboardOperationsServiceTest {

    private static final Long ORG = 7L;
    private static final Instant NOW = Instant.parse("2026-07-28T12:00:00Z");
    private static final LocalDateTime TODAY = LocalDateTime.ofInstant(NOW, ZoneOffset.UTC);

    @Mock private ReservationRepository reservationRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private SecurityDepositRepository securityDepositRepository;
    @Mock private GuestReviewRepository guestReviewRepository;
    @Mock private ICalFeedRepository iCalFeedRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;

    private DashboardOperationsService service;

    @BeforeEach
    void setUp() {
        service = new DashboardOperationsService(reservationRepository, interventionRepository,
                securityDepositRepository, guestReviewRepository, iCalFeedRepository,
                serviceRequestRepository, propertyRepository, userRepository,
                Clock.fixed(NOW, ZoneId.of("UTC")));

        // Les autres sources sont muettes : on n'observe que les prestations.
        lenient().when(reservationRepository.findConfirmedByCheckInRange(any(), any(), any()))
                .thenReturn(List.of());
        lenient().when(iCalFeedRepository.findStaleOrFailing(any(), any())).thenReturn(List.of());
        lenient().when(guestReviewRepository.findPublicWithoutHostResponse(any())).thenReturn(List.of());
        lenient().when(serviceRequestRepository.findUnpaidForOrg(any())).thenReturn(List.of());
        lenient().when(serviceRequestRepository.findStuckUnassignedForOrg(any(), any()))
                .thenReturn(List.of());
    }

    private static ServiceRequest cleaning(long id, String title, LocalDateTime desiredDate) {
        Property property = new Property();
        property.setId(300L);
        property.setName("Appartement Duplex Marrakech");

        ServiceRequest request = new ServiceRequest();
        request.setId(id);
        request.setTitle(title);
        request.setProperty(property);
        request.setStatus(RequestStatus.PENDING);
        request.setDesiredDate(desiredDate);
        request.setEstimatedCost(new BigDecimal("95"));
        return request;
    }

    @Test
    void whenServiceStaysUnassigned_thenItSurfacesWithItsCostAndProperty() {
        when(serviceRequestRepository.findStuckUnassignedForOrg(eq(ORG), any()))
                .thenReturn(List.of(cleaning(41L, "Menage Airbnb", TODAY.plusDays(2))));

        ActionItemsDto items = service.getActionItems(ORG, UserRole.SUPER_ADMIN, "kc-admin");

        assertThat(items.items()).hasSize(1);
        var item = items.items().get(0);
        assertThat(item.kind()).isEqualTo(ActionItemKind.SERVICE_UNASSIGNED);
        assertThat(item.id()).isEqualTo("unassigned:41");
        assertThat(item.title()).isEqualTo("Menage Airbnb");
        assertThat(item.propertyName()).isEqualTo("Appartement Duplex Marrakech");
        // Le montant reste affiché : c'est l'ordre de grandeur de l'enjeu.
        assertThat(item.amount()).isEqualByComparingTo("95");
        // La date n'est pas encore passée : la prestation peut encore avoir lieu.
        assertThat(item.severity()).isEqualTo("warning");
        assertThat(items.total()).isEqualTo(1);
    }

    @Test
    void whenDesiredDateHasPassed_thenTheServiceIsCritical() {
        when(serviceRequestRepository.findStuckUnassignedForOrg(eq(ORG), any()))
                .thenReturn(List.of(cleaning(42L, "Menage Airbnb", TODAY.minusDays(1))));

        ActionItemsDto items = service.getActionItems(ORG, UserRole.SUPER_ADMIN, "kc-admin");

        // Personne n'est venu et la date est dépassée : ça ne se rattrape plus.
        assertThat(items.items().get(0).severity()).isEqualTo("critical");
    }

    @Test
    void whenLookingForStuckServices_thenARecentlyCreatedOneIsLeftAlone() {
        service.getActionItems(ORG, UserRole.SUPER_ADMIN, "kc-admin");

        // Le planificateur repasse toutes les 15 min : une demande créée à
        // l'instant a encore sa chance d'être assignée toute seule, et n'a rien
        // à faire dans une file d'actions humaines.
        ArgumentCaptor<LocalDateTime> staleBefore = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(serviceRequestRepository).findStuckUnassignedForOrg(eq(ORG), staleBefore.capture());
        assertThat(staleBefore.getValue()).isEqualTo(TODAY.minusMinutes(15));
    }

    @Test
    void whenCallerIsFieldStaff_thenNoActionLeaksToThem() {
        // Soldes, prestations et avis relèvent de la gestion : un intervenant ne
        // doit pas recevoir le carnet de l'organisation.
        ActionItemsDto items = service.getActionItems(ORG, UserRole.HOUSEKEEPER, "kc-housekeeper");

        assertThat(items.items()).isEmpty();
        assertThat(items.total()).isZero();
        assertThat(items.totalsByKind()).isEmpty();
    }
}
