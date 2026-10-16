package com.clenzy.controller;

import com.clenzy.dto.PlanningDataDto;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.InterventionPlanningService;
import com.clenzy.service.ReservationMapper;
import com.clenzy.service.ReservationService;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Lecture groupee du planning.
 *
 * <p>Le point sensible de cette fusion n'est pas la performance mais
 * l'AUTORISATION : les interventions etaient reservees a ADMIN / MANAGER /
 * SUPER_ADMIN, les trois autres jeux ouverts a tout utilisateur authentifie.
 * Un endpoint unique ne doit deplacer cette frontiere dans aucun sens.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("PlanningDataController")
class PlanningDataControllerTest {

    @Mock private ReservationService reservationService;
    @Mock private ReservationMapper reservationMapper;
    @Mock private InterventionPlanningService interventionPlanningService;
    @Mock private ServiceRequestService serviceRequestService;
    @Mock private CalendarEngine calendarEngine;
    @Mock private TenantContext tenantContext;
    @Mock private com.clenzy.service.BaitlyPlanningIndexService indexService;
    @Mock private com.clenzy.service.BaitlyPlanningPropertyService propertyService;
    @Mock private com.clenzy.service.BaitlyPlanningReservationService detailService;

    private PlanningDataController controller;
    private Jwt jwt;

    private static final LocalDate FROM = LocalDate.of(2026, 9, 1);
    private static final LocalDate TO = LocalDate.of(2026, 9, 30);
    private static final List<Long> IDS = List.of(1L, 2L);

    private static Authentication withRoles(String... roles) {
        return new UsernamePasswordAuthenticationToken("user-123", "n/a",
                java.util.Arrays.stream(roles).map(SimpleGrantedAuthority::new).toList());
    }

    @BeforeEach
    void setUp() {
        controller = new PlanningDataController(reservationService, reservationMapper,
                interventionPlanningService, serviceRequestService, calendarEngine, tenantContext, indexService, propertyService, detailService);
        jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .claim("sub", "user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();

        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(reservationService.getReservationsPage(anyString(), any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(Page.empty());
        when(serviceRequestService.getPlanningServiceRequests(any(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(calendarEngine.getBlockedOrMaintenanceDays(any(), any(), any(), anyLong()))
                .thenReturn(List.of());
        when(interventionPlanningService.getPlanningInterventions(any(), any(), any(), any(), any()))
                .thenReturn(List.of(Map.of("id", 7L)));
    }

    @Test
    void avecLeRoleRequis_lesInterventionsSontServies() {
        ResponseEntity<PlanningDataDto> response = controller.getPlanningData(
                jwt, withRoles("ROLE_MANAGER"), IDS, FROM, TO);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().interventions()).hasSize(1);
    }

    @Test
    void sansLeRole_lesInterventionsSontVidesEtNonChargees() {
        ResponseEntity<PlanningDataDto> response = controller.getPlanningData(
                jwt, withRoles("ROLE_HOST"), IDS, FROM, TO);

        // Exactement ce que ce porteur voyait avant la fusion : rien. Mais SANS
        // le 403 qui faisait remonter une erreur sur toute la grille.
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().interventions()).isEmpty();
        // Et le service n'est meme pas sollicite : pas de lecture inutile.
        verify(interventionPlanningService, never())
                .getPlanningInterventions(any(), any(), any(), any(), any());
    }

    @Test
    void lesTroisAutresJeuxRestentServisSansLeRole() {
        ResponseEntity<PlanningDataDto> response = controller.getPlanningData(
                jwt, withRoles("ROLE_HOST"), IDS, FROM, TO);

        assertThat(response.getBody().reservations()).isNotNull();
        assertThat(response.getBody().awaitingPayment()).isNotNull();
        assertThat(response.getBody().blocked()).isNotNull();
        verify(reservationService).getReservationsPage(anyString(), any(), any(), any(),
                any(), any(), any(), any(Pageable.class));
    }

    @Test
    void unLogementInterdit_faitEchouerLeLot() {
        // Anti-IDOR (regle audit #3) : l'acces est valide pour tout le lot avant les lectures,
        // comme le faisait /api/calendar/blocked avant la fusion.
        doThrow(new RuntimeException("Acces refuse"))
                .when(reservationService).validatePropertyAccessBatch(IDS, "user-123");

        assertThatThrownBy(() -> controller.getPlanningData(
                jwt, withRoles("ROLE_MANAGER"), IDS, FROM, TO))
                .isInstanceOf(RuntimeException.class);

        verify(calendarEngine, never()).getBlockedOrMaintenanceDays(any(), any(), any(), anyLong());
    }

    @Test
    void sansLogement_aucuneLectureDeJoursBloques() {
        ResponseEntity<PlanningDataDto> response = controller.getPlanningData(
                jwt, withRoles("ROLE_MANAGER"), List.of(), FROM, TO);

        assertThat(response.getBody().blocked()).isEmpty();
        verify(calendarEngine, never()).getBlockedOrMaintenanceDays(any(), any(), any(), anyLong());
    }

    @Test
    void indexSansRoleIntervention_neChargePasLesFichesVoyageurs() {
        when(indexService.reservations(IDS, FROM, TO)).thenReturn(List.of());
        var response = controller.index(jwt, withRoles("ROLE_HOST"), IDS, FROM, TO);
        assertThat(response.interventions()).isEmpty();
        verify(reservationService).validatePropertyAccessBatch(IDS, "user-123");
        verify(reservationService, never()).getReservationsPage(anyString(), any(), any(), any(), any(), any(), any(), any());
        verify(interventionPlanningService, never()).getPlanningInterventions(any(), any(), any(), any(), any());
    }

    @Test
    void indexInterdit_neLitAucuneDonneeMetier() {
        doThrow(new org.springframework.security.access.AccessDeniedException("refus"))
                .when(reservationService).validatePropertyAccessBatch(IDS, "user-123");
        assertThatThrownBy(() -> controller.index(jwt, withRoles("ROLE_HOST"), IDS, FROM, TO))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(indexService, never()).reservations(any(), any(), any());
        verify(serviceRequestService, never()).getPlanningServiceRequests(any(), any(), any());
    }

    @Test void detailsValidateOwnershipBeforeDedicatedRead() {
        when(detailService.details(IDS, FROM, TO)).thenReturn(
                new com.clenzy.service.BaitlyPlanningReservationService.Details(List.of(), 2_000_000, 5_000_000, 1_000_000, 4_000_000));
        var response = controller.reservationDetails(jwt, IDS, FROM, TO);
        assertThat(response.getBody()).isEmpty();
        assertThat(response.getHeaders().getFirst("Server-Timing"))
                .matches("authz;dur=[0-9]+\\.[0-9]{3}, details;dur=[0-9]+\\.[0-9]{3}, "
                        + "rows;dur=2.000, contacts;dur=5.000, decrypt;dur=4.000, mapping;dur=1.000");
        var order = org.mockito.Mockito.inOrder(reservationService, detailService);
        order.verify(reservationService).validatePropertyAccessBatch(IDS, "user-123");
        order.verify(detailService).details(IDS, FROM, TO);
        verify(reservationService, never()).getReservationsPage(anyString(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test void detailsForbiddenPropertyPreventsAnyRead() {
        doThrow(new org.springframework.security.access.AccessDeniedException("refus"))
                .when(reservationService).validatePropertyAccessBatch(IDS, "user-123");
        assertThatThrownBy(() -> controller.reservationDetails(jwt, IDS, FROM, TO))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(detailService, never()).details(any(), any(), any());
    }

    @Test void cardsValidateOwnershipBeforeReadingWithoutPhones() {
        when(detailService.details(IDS, FROM, TO, false)).thenReturn(
                com.clenzy.service.BaitlyPlanningReservationService.Details.empty());
        assertThat(controller.reservationCards(jwt, IDS, FROM, TO).getBody()).isEmpty();
        var order = org.mockito.Mockito.inOrder(reservationService, detailService);
        order.verify(reservationService).validatePropertyAccessBatch(IDS, "user-123");
        order.verify(detailService).details(IDS, FROM, TO, false);
    }

    @Test void cardsForbiddenPropertyPreventsAnyContactRead() {
        doThrow(new org.springframework.security.access.AccessDeniedException("refus"))
                .when(reservationService).validatePropertyAccessBatch(IDS, "user-123");
        assertThatThrownBy(() -> controller.reservationCards(jwt, IDS, FROM, TO))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(detailService, never()).details(any(), any(), any(), anyBoolean());
    }

    @Test
    void fenetreEtLotDeDetailsSontBornesAvantLesLectures() {
        assertThatThrownBy(() -> controller.index(jwt, withRoles("ROLE_HOST"), IDS, FROM, FROM.plusDays(63)))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        var ids = java.util.stream.LongStream.rangeClosed(1, 101).boxed().toList();
        assertThatThrownBy(() -> controller.reservationDetails(jwt, ids, FROM, TO))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        verify(reservationService, never()).validatePropertyAccessBatch(any(), any());
    }

    @Test
    void catalogueHostEstScopeAuProprietaireEtLaPaginationEstBornee() {
        Jwt host = Jwt.withTokenValue("token").header("alg", "RS256").claim("sub", "host")
                .claim("realm_access", Map.of("roles", List.of("HOST"))).build();
        controller.properties(host, 5, 200);
        verify(propertyService).page("host", 5, 200);
        assertThatThrownBy(() -> controller.properties(host, 0, 201))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }
}
