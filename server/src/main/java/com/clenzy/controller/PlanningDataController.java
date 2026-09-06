package com.clenzy.controller;

import com.clenzy.dto.PlanningDataDto;
import com.clenzy.dto.ReservationDto;
import com.clenzy.service.ReservationMapper;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.InterventionPlanningService;
import com.clenzy.service.ReservationService;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Lecture groupee des donnees du planning.
 *
 * <p>Le planning peignait une fenetre en appelant QUATRE endpoints — sejours,
 * interventions, demandes en attente de paiement, jours bloques — avec les
 * memes logements et la meme plage, une fois par tranche de dates. Soit douze
 * allers-retours pour une fenetre, chacun repayant l'authentification, le
 * filtre de tenant et les intercepteurs. Cet endpoint les couvre en un appel.</p>
 *
 * <p><b>Les autorisations d'origine sont conservees telles quelles.</b> Les
 * trois premiers jeux etaient ouverts a tout utilisateur authentifie ; les
 * interventions, elles, sont reservees a ADMIN / MANAGER / SUPER_ADMIN. Fusionner
 * naivement aurait donc soit ouvert les interventions a tout le monde, soit
 * ferme tout le planning aux autres roles. Ici la section interventions revient
 * VIDE quand le porteur n'a pas le role — exactement ce qu'il voyait avant, sans
 * le 403 qui faisait remonter une erreur sur toute la grille.</p>
 */
@RestController
@RequestMapping("/api/planning")
@Tag(name = "Planning", description = "Lecture groupee des donnees de la grille de planning")
@PreAuthorize("isAuthenticated()")
public class PlanningDataController {

    /** Roles autorises a lire les interventions (cf. InterventionController#getPlanningInterventions). */
    private static final Set<String> INTERVENTION_ROLES =
            Set.of("ROLE_ADMIN", "ROLE_MANAGER", "ROLE_SUPER_ADMIN");

    private final ReservationService reservationService;
    private final ReservationMapper reservationMapper;
    private final InterventionPlanningService interventionPlanningService;
    private final ServiceRequestService serviceRequestService;
    private final CalendarEngine calendarEngine;
    private final TenantContext tenantContext;

    public PlanningDataController(ReservationService reservationService,
                                  ReservationMapper reservationMapper,
                                  InterventionPlanningService interventionPlanningService,
                                  ServiceRequestService serviceRequestService,
                                  CalendarEngine calendarEngine,
                                  TenantContext tenantContext) {
        this.reservationService = reservationService;
        this.reservationMapper = reservationMapper;
        this.interventionPlanningService = interventionPlanningService;
        this.serviceRequestService = serviceRequestService;
        this.calendarEngine = calendarEngine;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/data")
    @Operation(summary = "Donnees du planning pour une fenetre",
            description = "Sejours, interventions, demandes en attente de paiement et jours bloques "
                    + "pour un lot de logements sur une plage de dates, en un seul appel. "
                    + "La section interventions est vide si le porteur n'a pas le role requis.")
    public ResponseEntity<PlanningDataDto> getPlanningData(
            @AuthenticationPrincipal Jwt jwt,
            Authentication authentication,
            @RequestParam(required = false) List<Long> propertyIds,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        LocalDate effectiveFrom = from != null ? from : LocalDate.now().minusMonths(3);
        LocalDate effectiveTo = to != null ? to : LocalDate.now().plusMonths(6);
        LocalDateTime fromDateTime = effectiveFrom.atStartOfDay();
        LocalDateTime toDateTime = effectiveTo.atTime(LocalTime.MAX);

        List<ReservationDto> reservations = reservationService
                .getReservationsPage(jwt.getSubject(), propertyIds, effectiveFrom, effectiveTo,
                        null, null, null, Pageable.unpaged())
                .getContent().stream()
                .map(reservationMapper::toDto)
                .collect(Collectors.toList());

        List<Map<String, Object>> interventions = canReadInterventions(authentication)
                ? interventionPlanningService.getPlanningInterventions(
                        jwt, propertyIds, effectiveFrom, effectiveTo, null)
                : List.of();

        List<Map<String, Object>> awaitingPayment = serviceRequestService
                .getPlanningServiceRequests(propertyIds, fromDateTime, toDateTime);

        return ResponseEntity.ok(new PlanningDataDto(
                reservations, interventions, awaitingPayment,
                blockedDays(propertyIds, effectiveFrom, effectiveTo, jwt)));
    }

    private boolean canReadInterventions(Authentication authentication) {
        if (authentication == null) return false;
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(INTERVENTION_ROLES::contains);
    }

    /**
     * Jours BLOCKED / MAINTENANCE, avec la meme validation d'acces logement par
     * logement que {@code /api/calendar/blocked} (anti-IDOR, regle audit #3).
     */
    private List<Map<String, Object>> blockedDays(List<Long> propertyIds, LocalDate from,
                                                  LocalDate to, Jwt jwt) {
        if (propertyIds == null || propertyIds.isEmpty()) return List.of();

        Long orgId = tenantContext.getRequiredOrganizationId();
        for (Long propertyId : propertyIds) {
            reservationService.validatePropertyAccess(propertyId, jwt.getSubject());
        }

        return calendarEngine.getBlockedOrMaintenanceDays(propertyIds, from, to, orgId).stream()
                .map(day -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("propertyId", day.getProperty().getId());
                    map.put("date", day.getDate().toString());
                    map.put("status", day.getStatus().name());
                    map.put("source", day.getSource());
                    map.put("notes", day.getNotes());
                    return map;
                })
                .collect(Collectors.toList());
    }
}
