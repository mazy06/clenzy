package com.clenzy.controller;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.dto.InterventionDto;
import com.clenzy.dto.ServiceRequestValidationRequest;
import com.clenzy.service.ServiceRequestService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.validation.annotation.Validated;
import com.clenzy.dto.validation.Create;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/service-requests")
@Tag(name = "Service Requests", description = "Gestion des demandes de service")
@PreAuthorize("isAuthenticated()")
public class ServiceRequestController {
    private final ServiceRequestService service;

    public ServiceRequestController(ServiceRequestService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "Créer une demande de service")
    public ResponseEntity<ServiceRequestDto> create(@Validated(Create.class) @RequestBody ServiceRequestDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @Operation(summary = "Mettre à jour une demande de service")
    public ServiceRequestDto update(@PathVariable Long id, @RequestBody ServiceRequestDto dto) {
        return service.update(id, dto);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','HOST')")
    @Operation(summary = "Obtenir une demande de service par ID")
    public ServiceRequestDto get(@PathVariable Long id) {
        return service.getById(id);
    }

    @GetMapping
    @Operation(summary = "Lister les demandes de service")
    public Page<ServiceRequestDto> list(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
                                        @RequestParam(required = false) Long userId,
                                        @RequestParam(required = false) Long propertyId,
                                        @RequestParam(required = false) com.clenzy.model.RequestStatus status,
                                        @RequestParam(required = false) com.clenzy.model.ServiceType serviceType,
                                        @AuthenticationPrincipal Jwt jwt) {
        return service.searchWithRoleBasedAccess(pageable, userId, propertyId, status, serviceType, jwt);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @Operation(summary = "Supprimer une demande de service")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @PostMapping("/{id}/validate")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @Operation(summary = "Valider une demande de service et créer une intervention",
               description = "Seuls les managers et admins peuvent valider les demandes de service. " +
                           "Cette action change le statut de la demande à APPROVED et crée automatiquement " +
                           "une intervention correspondante. Permet d'assigner une équipe ou un utilisateur lors de la création.")
    public ResponseEntity<InterventionDto> validateAndCreateIntervention(
            @PathVariable Long id,
            @RequestBody(required = false) ServiceRequestValidationRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        Long teamId = request != null ? request.getTeamId() : null;
        Long userId = request != null ? request.getUserId() : null;
        boolean autoAssign = request != null && Boolean.TRUE.equals(request.getAutoAssign());
        InterventionDto intervention = service.validateAndCreateIntervention(id, teamId, userId, autoAssign, jwt);
        return ResponseEntity.status(HttpStatus.CREATED).body(intervention);
    }

    @PostMapping("/{id}/accept-devis")
    @Operation(summary = "Accepter le devis d'une demande de service",
               description = "Le Host (propriétaire) accepte le devis généré. " +
                           "Change le statut de APPROVED à DEVIS_ACCEPTED et " +
                           "déclenche la génération de l'AUTORISATION_TRAVAUX.")
    public ResponseEntity<ServiceRequestDto> acceptDevis(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        ServiceRequestDto result = service.acceptDevis(id, jwt);
        return ResponseEntity.ok(result);
    }
}


