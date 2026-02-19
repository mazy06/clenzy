package com.clenzy.controller;

import com.clenzy.dto.InterventionDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
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
public class InterventionController {
    
    private final InterventionService interventionService;
    private final InterventionRepository interventionRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public InterventionController(InterventionService interventionService,
                                  InterventionRepository interventionRepository,
                                  UserRepository userRepository,
                                  TenantContext tenantContext) {
        this.interventionService = interventionService;
        this.interventionRepository = interventionRepository;
        this.userRepository = userRepository;
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

        String role = user.getRole() != null ? user.getRole().name().toUpperCase() : "";
        boolean isAdminOrManager = role.contains("ADMIN") || role.contains("MANAGER");

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
            map.put("assigneeName", i.getAssignedUser() != null ?
                    (i.getAssignedUser().getFirstName() + " " + i.getAssignedUser().getLastName()).trim() : null);
            return map;
        }).collect(Collectors.toList());

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
        System.out.println("🔍 InterventionController.get - Début de la méthode");
        System.out.println("🔍 InterventionController.get - ID demandé: " + id);
        
        if (jwt != null) {
            System.out.println("🔍 InterventionController.get - JWT reçu: " + jwt.getSubject());
            System.out.println("🔍 InterventionController.get - JWT claims: " + jwt.getClaims());
        } else {
            System.out.println("🔍 InterventionController.get - Aucun JWT reçu");
        }
        
        try {
            System.out.println("🔍 InterventionController.get - Appel du service...");
            InterventionDto result = interventionService.getById(id, jwt);
            System.out.println("🔍 InterventionController.get - Intervention trouvée: " + (result != null ? "OUI" : "NON"));
            return result;
        } catch (Exception e) {
            System.err.println("🔍 InterventionController.get - Erreur lors de la récupération: " + e.getMessage());
            e.printStackTrace();
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
                                      @AuthenticationPrincipal Jwt jwt) {
        // Log pour diagnostiquer l'authentification
        if (jwt != null) {
            System.out.println("🔍 JWT reçu: " + jwt.getSubject());
            System.out.println("🔍 JWT claims: " + jwt.getClaims());
        } else {
            System.out.println("🔍 Aucun JWT reçu");
        }
        return interventionService.listWithRoleBasedAccess(pageable, propertyId, type, status, priority, jwt);
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
