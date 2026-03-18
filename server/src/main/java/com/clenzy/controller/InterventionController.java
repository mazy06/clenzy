package com.clenzy.controller;

import com.clenzy.dto.CreateInterventionRequest;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.dto.UpdateInterventionRequest;
import com.clenzy.service.InterventionLifecycleService;
import com.clenzy.service.InterventionPlanningService;
import com.clenzy.service.InterventionProgressService;
import com.clenzy.service.InterventionService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.validation.annotation.Validated;
import org.springframework.security.access.prepost.PreAuthorize;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/interventions")
@Tag(name = "Interventions", description = "Gestion des interventions")
@PreAuthorize("isAuthenticated()")
public class InterventionController {

    private static final Logger log = LoggerFactory.getLogger(InterventionController.class);

    private final InterventionService interventionService;
    private final InterventionPlanningService planningService;
    private final InterventionLifecycleService lifecycleService;
    private final InterventionProgressService progressService;

    public InterventionController(InterventionService interventionService,
                                  InterventionPlanningService planningService,
                                  InterventionLifecycleService lifecycleService,
                                  InterventionProgressService progressService) {
        this.interventionService = interventionService;
        this.planningService = planningService;
        this.lifecycleService = lifecycleService;
        this.progressService = progressService;
    }

    @GetMapping("/planning")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','SUPER_ADMIN')")
    @Operation(summary = "Interventions pour le planning",
            description = "Retourne les interventions filtrees par proprietes et plage de dates pour le planning. " +
                    "Admin/Manager voient tout, Host voit ses proprietes uniquement.")
    public ResponseEntity<List<Map<String, Object>>> getPlanningInterventions(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) List<Long> propertyIds,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String type) {

        return ResponseEntity.ok(planningService.getPlanningInterventions(jwt, propertyIds, from, to, type));
    }

    @GetMapping("/team-availability")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','SUPER_ADMIN')")
    @Operation(summary = "Verifier la disponibilite des membres d'une equipe",
            description = "Retourne les membres de l'equipe avec leur statut de disponibilite " +
                    "pour un creneau donne. Peut utiliser interventionId (existant) ou date+durationHours (nouveau) " +
                    "pour definir le creneau a verifier.")
    public ResponseEntity<Map<String, Object>> checkTeamMemberAvailability(
            @RequestParam Long teamId,
            @RequestParam(required = false) Long interventionId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) Integer durationHours) {

        Map<String, Object> result = planningService.checkTeamMemberAvailability(teamId, interventionId, date, durationHours);
        if (result == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/user-availability")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','SUPER_ADMIN')")
    @Operation(summary = "Verifier la disponibilite d'un utilisateur individuel",
            description = "Retourne le statut de disponibilite d'un utilisateur pour un creneau donne (date + duree).")
    public ResponseEntity<Map<String, Object>> checkUserAvailability(
            @RequestParam Long userId,
            @RequestParam String date,
            @RequestParam(required = false) Integer durationHours) {

        return ResponseEntity.ok(planningService.checkUserAvailability(userId, date, durationHours));
    }

    @PostMapping
    @Operation(summary = "Creer une intervention")
    public ResponseEntity<InterventionResponse> create(@Validated @RequestBody CreateInterventionRequest request,
                                                 @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.status(HttpStatus.CREATED).body(interventionService.create(request, jwt));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Mettre a jour une intervention")
    public InterventionResponse update(@PathVariable Long id, @Validated @RequestBody UpdateInterventionRequest request,
                                 @AuthenticationPrincipal Jwt jwt) {
        return interventionService.update(id, request, jwt);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtenir une intervention par ID")
    public InterventionResponse get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        log.debug("get - ID demande: {}", id);

        if (jwt != null) {
            log.debug("get - JWT subject: {}", jwt.getSubject());
        } else {
            log.debug("get - No JWT received");
        }

        try {
            InterventionResponse result = interventionService.getById(id, jwt);
            log.debug("get - Intervention found: {}", result != null);
            return result;
        } catch (Exception e) {
            log.error("get - Error retrieving intervention id={}", id, e);
            throw e;
        }
    }

    @GetMapping
    @Operation(summary = "Lister les interventions avec controle d'acces base sur les roles")
    public Page<InterventionResponse> list(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
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

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer une intervention")
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        interventionService.delete(id, jwt);
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "Mettre a jour le statut d'une intervention")
    public InterventionResponse updateStatus(@PathVariable Long id, @RequestParam String status,
                                       @AuthenticationPrincipal Jwt jwt) {
        return lifecycleService.updateStatus(id, status, jwt);
    }

    @PutMapping("/{id}/assign")
    @Operation(summary = "Assigner une intervention a un utilisateur ou une equipe")
    public InterventionResponse assign(@PathVariable Long id, @RequestParam(required = false) Long userId,
                                  @RequestParam(required = false) Long teamId, @AuthenticationPrincipal Jwt jwt) {
        return interventionService.assign(id, userId, teamId, jwt);
    }

    @PostMapping("/{id}/validate")
    @Operation(summary = "Valider une intervention et definir le cout estime (Manager uniquement)")
    public InterventionResponse validate(@PathVariable Long id,
                                   @RequestBody com.clenzy.dto.InterventionValidationRequest request,
                                   @AuthenticationPrincipal Jwt jwt) {
        return lifecycleService.validateIntervention(id, request.getEstimatedCost(), jwt);
    }

    @PutMapping("/{id}/start")
    @Operation(summary = "Demarrer une intervention (TECHNICIAN, HOUSEKEEPER, SUPERVISOR)")
    public InterventionResponse startIntervention(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return lifecycleService.startIntervention(id, jwt);
    }

    @PutMapping("/{id}/reopen")
    @Operation(summary = "Rouvrir une intervention terminee pour permettre des modifications")
    public InterventionResponse reopenIntervention(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return lifecycleService.reopenIntervention(id, jwt);
    }

    @PutMapping("/{id}/complete")
    @Operation(summary = "Terminer explicitement une intervention")
    public InterventionResponse completeIntervention(@PathVariable Long id,
                                                @AuthenticationPrincipal Jwt jwt) {
        return lifecycleService.completeIntervention(id, jwt);
    }

    @PutMapping("/{id}/progress")
    @Operation(summary = "Mettre a jour la progression d'une intervention")
    public InterventionResponse updateProgress(@PathVariable Long id,
                                         @RequestParam Integer progressPercentage,
                                         @AuthenticationPrincipal Jwt jwt) {
        return progressService.updateProgress(id, progressPercentage, jwt);
    }

    @PostMapping(value = "/{id}/photos", consumes = "multipart/form-data")
    @Operation(summary = "Ajouter des photos a une intervention")
    public InterventionResponse addPhotos(@PathVariable Long id,
                                   @RequestParam("photos") java.util.List<org.springframework.web.multipart.MultipartFile> photos,
                                   @RequestParam(value = "photoType", defaultValue = "before") String photoType,
                                   @AuthenticationPrincipal Jwt jwt) {
        return interventionService.addPhotos(id, photos, photoType, jwt);
    }

    @DeleteMapping("/{id}/photos/{photoId}")
    @Operation(summary = "Supprimer une photo d'une intervention")
    public InterventionResponse deletePhoto(@PathVariable Long id,
                                       @PathVariable Long photoId,
                                       @AuthenticationPrincipal Jwt jwt) {
        return interventionService.deletePhoto(id, photoId, jwt);
    }

    @PutMapping("/{id}/notes")
    @Operation(summary = "Mettre a jour les notes d'une intervention")
    public InterventionResponse updateNotes(@PathVariable Long id,
                                       @RequestParam String notes,
                                       @AuthenticationPrincipal Jwt jwt) {
        return progressService.updateNotes(id, notes, jwt);
    }

    @PutMapping("/{id}/validated-rooms")
    @Operation(summary = "Mettre a jour les pieces validees d'une intervention")
    public InterventionResponse updateValidatedRooms(@PathVariable Long id,
                                               @RequestParam String validatedRooms,
                                               @AuthenticationPrincipal Jwt jwt) {
        return progressService.updateValidatedRooms(id, validatedRooms, jwt);
    }

    @PutMapping("/{id}/completed-steps")
    @Operation(summary = "Mettre a jour les etapes completees d'une intervention")
    public InterventionResponse updateCompletedSteps(@PathVariable Long id,
                                               @RequestParam String completedSteps,
                                               @AuthenticationPrincipal Jwt jwt) {
        return progressService.updateCompletedSteps(id, completedSteps, jwt);
    }
}
