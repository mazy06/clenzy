package com.clenzy.controller;

import com.clenzy.dto.InterventionDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.Reservation;
import com.clenzy.model.Team;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.InterventionService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import com.clenzy.tenant.TenantContext;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.validation.annotation.Validated;
import com.clenzy.dto.validation.Create;
import org.springframework.security.access.prepost.PreAuthorize;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/interventions")
@Tag(name = "Interventions", description = "Gestion des interventions")
@PreAuthorize("isAuthenticated()")
public class InterventionController {

    private static final Logger log = LoggerFactory.getLogger(InterventionController.class);

    private final InterventionService interventionService;
    private final InterventionRepository interventionRepository;
    private final ReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TenantContext tenantContext;

    public InterventionController(InterventionService interventionService,
                                  InterventionRepository interventionRepository,
                                  ReservationRepository reservationRepository,
                                  UserRepository userRepository,
                                  TeamRepository teamRepository,
                                  TenantContext tenantContext) {
        this.interventionService = interventionService;
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/planning")
    @Operation(summary = "Interventions pour le planning",
            description = "Retourne les interventions filtrees par proprietes et plage de dates pour le planning. " +
                    "Admin/Manager voient tout, Host voit ses proprietes uniquement.")
    public ResponseEntity<List<Map<String, Object>>> getPlanningInterventions(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) List<Long> propertyIds,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String type) {

        // Defaults : 3 mois avant/apres
        if (from == null) from = LocalDate.now().minusMonths(3);
        if (to == null) to = LocalDate.now().plusMonths(6);

        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        User user = userRepository.findByKeycloakId(jwt.getSubject())
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        boolean isAdminOrManager = user.getRole() != null && user.getRole().isPlatformStaff();

        List<Intervention> interventions;

        if (propertyIds != null && !propertyIds.isEmpty()) {
            interventions = interventionRepository.findByPropertyIdsAndDateRange(propertyIds, fromDateTime, toDateTime, tenantContext.getRequiredOrganizationId());
        } else if (isAdminOrManager) {
            interventions = interventionRepository.findAllByDateRange(fromDateTime, toDateTime, tenantContext.getRequiredOrganizationId());
        } else {
            // Host / operational : ses propres proprietes
            interventions = interventionRepository.findByOwnerKeycloakIdAndDateRange(jwt.getSubject(), fromDateTime, toDateTime, tenantContext.getRequiredOrganizationId());
        }

        // Filtre optionnel par type
        if (type != null && !type.isEmpty() && !"all".equals(type)) {
            interventions = interventions.stream()
                    .filter(i -> type.equalsIgnoreCase(i.getType()))
                    .collect(Collectors.toList());
        }

        // Construire la map interventionId → reservationId pour les interventions liees
        final Map<Long, Long> interventionToReservation;
        List<Long> interventionIds = interventions.stream().map(Intervention::getId).collect(Collectors.toList());
        if (!interventionIds.isEmpty()) {
            List<Reservation> linkedReservations = reservationRepository.findByInterventionIdIn(
                    interventionIds, tenantContext.getRequiredOrganizationId());
            interventionToReservation = linkedReservations.stream()
                    .filter(r -> r.getIntervention() != null)
                    .collect(Collectors.toMap(
                            r -> r.getIntervention().getId(),
                            Reservation::getId,
                            (a, b) -> a));
        } else {
            interventionToReservation = Map.of();
        }

        // Pre-load team names for interventions assigned to teams (avoid N+1)
        List<Long> teamIds = interventions.stream()
                .filter(i -> i.getTeamId() != null && i.getAssignedUser() == null)
                .map(Intervention::getTeamId)
                .distinct()
                .collect(Collectors.toList());
        final Map<Long, String> teamNameMap;
        if (!teamIds.isEmpty()) {
            teamNameMap = teamRepository.findAllById(teamIds).stream()
                    .collect(Collectors.toMap(Team::getId, Team::getName, (a, b) -> a));
        } else {
            teamNameMap = Map.of();
        }

        // Mapper vers la structure attendue par le frontend (PlanningIntervention)
        List<Map<String, Object>> result = interventions.stream().map(i -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", i.getId());
            map.put("propertyId", i.getProperty() != null ? i.getProperty().getId() : null);
            map.put("propertyName", i.getProperty() != null ? i.getProperty().getName() : "");
            map.put("type", i.getType() != null ? i.getType().toLowerCase() : "cleaning");
            // Mapper les statuts backend vers les valeurs attendues par le frontend
            String frontendStatus = "scheduled";
            if (i.getStatus() != null) {
                switch (i.getStatus()) {
                    case IN_PROGRESS: frontendStatus = "in_progress"; break;
                    case COMPLETED: frontendStatus = "completed"; break;
                    case CANCELLED: frontendStatus = "cancelled"; break;
                    default: frontendStatus = "scheduled"; break; // PENDING, AWAITING_VALIDATION, AWAITING_PAYMENT
                }
            }
            map.put("status", frontendStatus);
            map.put("priority", i.getPriority() != null ? i.getPriority().toLowerCase() : "medium");
            map.put("title", i.getTitle());
            map.put("description", i.getDescription());
            // startDate = scheduledDate, endDate = scheduledDate + duree estimee
            String startDate = i.getScheduledDate() != null ? i.getScheduledDate().toLocalDate().toString() : null;
            String endDate = startDate; // par defaut meme jour
            map.put("startDate", startDate);
            map.put("endDate", endDate);
            map.put("startTime", i.getScheduledDate() != null ? i.getScheduledDate().toLocalTime().toString() : "11:00");
            // Calculer endTime = startTime + estimatedDurationHours
            if (i.getScheduledDate() != null && i.getEstimatedDurationHours() != null) {
                java.time.LocalTime endTime = i.getScheduledDate().toLocalTime()
                        .plusHours(i.getEstimatedDurationHours());
                map.put("endTime", endTime.toString());
            } else {
                map.put("endTime", null);
            }
            map.put("estimatedDurationHours", i.getEstimatedDurationHours());
            map.put("notes", i.getNotes());
            // Resolve assignee name: user first, then team
            String assigneeName = null;
            if (i.getAssignedUser() != null) {
                assigneeName = (i.getAssignedUser().getFirstName() + " " + i.getAssignedUser().getLastName()).trim();
            } else if (i.getTeamId() != null) {
                assigneeName = teamNameMap.getOrDefault(i.getTeamId(), "Équipe #" + i.getTeamId());
            }
            map.put("assigneeName", assigneeName);
            map.put("linkedReservationId", interventionToReservation.getOrDefault(i.getId(), null));
            // Payment fields
            map.put("paymentStatus", i.getPaymentStatus() != null ? i.getPaymentStatus().name() : null);
            map.put("estimatedCost", i.getEstimatedCost());
            map.put("actualCost", i.getActualCost());
            map.put("paidAt", i.getPaidAt());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/team-availability")
    @Operation(summary = "Vérifier la disponibilité des membres d'une équipe",
            description = "Retourne les membres de l'équipe avec leur statut de disponibilité " +
                    "pour un créneau donné. Peut utiliser interventionId (existant) ou date+durationHours (nouveau) " +
                    "pour définir le créneau à vérifier.")
    public ResponseEntity<Map<String, Object>> checkTeamMemberAvailability(
            @RequestParam Long teamId,
            @RequestParam(required = false) Long interventionId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) Integer durationHours) {

        Long orgId = tenantContext.getRequiredOrganizationId();

        // Load team with members eagerly (open-in-view is disabled)
        Team team = teamRepository.findByIdWithMembers(teamId)
                .orElseThrow(() -> new RuntimeException("Équipe introuvable: " + teamId));

        // Calculate the time range for conflict checking
        LocalDateTime rangeStart;
        int duration;

        if (interventionId != null) {
            // Mode 1: Use intervention dates
            Intervention intervention = interventionRepository.findById(interventionId)
                    .orElseThrow(() -> new RuntimeException("Intervention introuvable: " + interventionId));
            rangeStart = intervention.getScheduledDate() != null
                    ? intervention.getScheduledDate()
                    : LocalDateTime.now();
            duration = intervention.getEstimatedDurationHours() != null
                    ? intervention.getEstimatedDurationHours()
                    : 4;
        } else if (date != null) {
            // Mode 2: Use explicit date + durationHours (for service request conflict detection)
            rangeStart = LocalDateTime.parse(date);
            duration = durationHours != null ? durationHours : 4;
        } else {
            return ResponseEntity.badRequest().build();
        }

        LocalDateTime rangeEnd = rangeStart.plusHours(duration);

        List<InterventionStatus> activeStatuses = List.of(
                InterventionStatus.PENDING,
                InterventionStatus.AWAITING_VALIDATION,
                InterventionStatus.AWAITING_PAYMENT,
                InterventionStatus.IN_PROGRESS
        );

        // Check availability of each team member
        List<Map<String, Object>> members = team.getMembers().stream().map(member -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", member.getUser().getId());
            m.put("firstName", member.getUser().getFirstName());
            m.put("lastName", member.getUser().getLastName());
            m.put("email", member.getUser().getEmail());
            m.put("role", member.getRole());

            long conflictCount = interventionRepository.countActiveByUserIdAndDateRange(
                    member.getUser().getId(), activeStatuses, rangeStart, rangeEnd, orgId);
            m.put("available", conflictCount == 0);
            m.put("conflictCount", conflictCount);
            return m;
        }).collect(Collectors.toList());

        // Also check team-level conflicts
        long teamConflicts = interventionRepository.countActiveByTeamIdAndDateRange(
                teamId, activeStatuses, rangeStart, rangeEnd, orgId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("teamId", team.getId());
        result.put("teamName", team.getName());
        result.put("interventionType", team.getInterventionType());
        result.put("memberCount", team.getMemberCount());
        result.put("members", members);
        result.put("teamConflictCount", teamConflicts);
        result.put("allAvailable", members.stream().allMatch(m -> (boolean) m.get("available")));
        result.put("rangeStart", rangeStart.toString());
        result.put("rangeEnd", rangeEnd.toString());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/user-availability")
    @Operation(summary = "Vérifier la disponibilité d'un utilisateur individuel",
            description = "Retourne le statut de disponibilité d'un utilisateur pour un créneau donné (date + durée).")
    public ResponseEntity<Map<String, Object>> checkUserAvailability(
            @RequestParam Long userId,
            @RequestParam String date,
            @RequestParam(required = false) Integer durationHours) {

        Long orgId = tenantContext.getRequiredOrganizationId();

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable: " + userId));

        LocalDateTime rangeStart = LocalDateTime.parse(date);
        int duration = durationHours != null ? durationHours : 4;
        LocalDateTime rangeEnd = rangeStart.plusHours(duration);

        List<InterventionStatus> activeStatuses = List.of(
                InterventionStatus.PENDING,
                InterventionStatus.AWAITING_VALIDATION,
                InterventionStatus.AWAITING_PAYMENT,
                InterventionStatus.IN_PROGRESS
        );

        long conflictCount = interventionRepository.countActiveByUserIdAndDateRange(
                userId, activeStatuses, rangeStart, rangeEnd, orgId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", targetUser.getId());
        result.put("firstName", targetUser.getFirstName());
        result.put("lastName", targetUser.getLastName());
        result.put("available", conflictCount == 0);
        result.put("conflictCount", conflictCount);
        result.put("rangeStart", rangeStart.toString());
        result.put("rangeEnd", rangeEnd.toString());

        return ResponseEntity.ok(result);
    }

    @PostMapping
    @Operation(summary = "Créer une intervention")
    public ResponseEntity<InterventionDto> create(@Validated(Create.class) @RequestBody InterventionDto dto,
                                                 @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.status(HttpStatus.CREATED).body(interventionService.create(dto, jwt));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Mettre à jour une intervention")
    public InterventionDto update(@PathVariable Long id, @RequestBody InterventionDto dto,
                                 @AuthenticationPrincipal Jwt jwt) {
        return interventionService.update(id, dto, jwt);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtenir une intervention par ID")
    public InterventionDto get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        log.debug("get - ID demande: {}", id);

        if (jwt != null) {
            log.debug("get - JWT subject: {}", jwt.getSubject());
        } else {
            log.debug("get - No JWT received");
        }

        try {
            InterventionDto result = interventionService.getById(id, jwt);
            log.debug("get - Intervention found: {}", result != null);
            return result;
        } catch (Exception e) {
            log.error("get - Error retrieving intervention id={}", id, e);
            throw e;
        }
    }

    @GetMapping
    @Operation(summary = "Lister les interventions avec contrôle d'accès basé sur les rôles")
    public Page<InterventionDto> list(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
                                      @RequestParam(required = false) Long propertyId,
                                      @RequestParam(required = false) String type,
                                      @RequestParam(required = false) String status,
                                      @RequestParam(required = false) String priority,
                                      @RequestParam(required = false) String startDate,
                                      @RequestParam(required = false) String endDate,
                                      @AuthenticationPrincipal Jwt jwt) {
        if (jwt != null) {
            log.debug("list - JWT subject: {}, startDate={}, endDate={}", jwt.getSubject(), startDate, endDate);
        } else {
            log.debug("list - No JWT received");
        }
        return interventionService.listWithRoleBasedAccess(pageable, propertyId, type, status, priority, startDate, endDate, jwt);
    }

    // Endpoint de test temporaire pour diagnostiquer
    @GetMapping("/test")
    @Operation(summary = "Test d'authentification")
    public ResponseEntity<String> testAuth(@AuthenticationPrincipal Jwt jwt) {
        if (jwt != null) {
            return ResponseEntity.ok("Authentifié: " + jwt.getSubject() + " - Claims: " + jwt.getClaims());
        } else {
            return ResponseEntity.status(401).body("Non authentifié");
        }
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer une intervention")
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        interventionService.delete(id, jwt);
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "Mettre à jour le statut d'une intervention")
    public InterventionDto updateStatus(@PathVariable Long id, @RequestParam String status,
                                       @AuthenticationPrincipal Jwt jwt) {
        return interventionService.updateStatus(id, status, jwt);
    }

    @PutMapping("/{id}/assign")
    @Operation(summary = "Assigner une intervention à un utilisateur ou une équipe")
    public InterventionDto assign(@PathVariable Long id, @RequestParam(required = false) Long userId,
                                  @RequestParam(required = false) Long teamId, @AuthenticationPrincipal Jwt jwt) {
        return interventionService.assign(id, userId, teamId, jwt);
    }

    @PostMapping("/{id}/validate")
    @Operation(summary = "Valider une intervention et définir le coût estimé (Manager uniquement)")
    public InterventionDto validate(@PathVariable Long id,
                                   @RequestBody com.clenzy.dto.InterventionValidationRequest request,
                                   @AuthenticationPrincipal Jwt jwt) {
        return interventionService.validateIntervention(id, request.getEstimatedCost(), jwt);
    }

    @PutMapping("/{id}/start")
    @Operation(summary = "Démarrer une intervention (TECHNICIAN, HOUSEKEEPER, SUPERVISOR)")
    public InterventionDto startIntervention(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return interventionService.startIntervention(id, jwt);
    }

    @PutMapping("/{id}/reopen")
    @Operation(summary = "Rouvrir une intervention terminée pour permettre des modifications")
    public InterventionDto reopenIntervention(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return interventionService.reopenIntervention(id, jwt);
    }

    @PutMapping("/{id}/progress")
    @Operation(summary = "Mettre à jour la progression d'une intervention")
    public InterventionDto updateProgress(@PathVariable Long id,
                                         @RequestParam Integer progressPercentage,
                                         @AuthenticationPrincipal Jwt jwt) {
        return interventionService.updateProgress(id, progressPercentage, jwt);
    }

    @PostMapping(value = "/{id}/photos", consumes = "multipart/form-data")
    @Operation(summary = "Ajouter des photos à une intervention")
    public InterventionDto addPhotos(@PathVariable Long id,
                                   @RequestParam("photos") java.util.List<org.springframework.web.multipart.MultipartFile> photos,
                                   @RequestParam(value = "photoType", defaultValue = "before") String photoType,
                                   @AuthenticationPrincipal Jwt jwt) {
        return interventionService.addPhotos(id, photos, photoType, jwt);
    }

    @PutMapping(value = "/{id}/notes", consumes = "application/x-www-form-urlencoded")
    @Operation(summary = "Mettre à jour les notes d'une intervention")
    public InterventionDto updateNotes(@PathVariable Long id,
                                       @RequestParam String notes,
                                       @AuthenticationPrincipal Jwt jwt) {
        return interventionService.updateNotes(id, notes, jwt);
    }

    @PutMapping(value = "/{id}/validated-rooms", consumes = "application/x-www-form-urlencoded")
    @Operation(summary = "Mettre à jour les pièces validées d'une intervention")
    public InterventionDto updateValidatedRooms(@PathVariable Long id,
                                               @RequestParam String validatedRooms,
                                               @AuthenticationPrincipal Jwt jwt) {
        return interventionService.updateValidatedRooms(id, validatedRooms, jwt);
    }

    @PutMapping(value = "/{id}/completed-steps", consumes = "application/x-www-form-urlencoded")
    @Operation(summary = "Mettre à jour les étapes complétées d'une intervention")
    public InterventionDto updateCompletedSteps(@PathVariable Long id,
                                               @RequestParam String completedSteps,
                                               @AuthenticationPrincipal Jwt jwt) {
        return interventionService.updateCompletedSteps(id, completedSteps, jwt);
    }
}
