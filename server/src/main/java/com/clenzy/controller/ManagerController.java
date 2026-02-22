package com.clenzy.controller;

import com.clenzy.dto.AssignmentRequest;
import com.clenzy.dto.ManagerAssociationsDto;
import com.clenzy.dto.ReassignmentRequest;
import com.clenzy.dto.TeamUserAssignmentRequest;
import com.clenzy.dto.manager.AssignmentResultDto;
import com.clenzy.dto.manager.ManagerTeamSummaryDto;
import com.clenzy.dto.manager.ManagerUserSummaryDto;
import com.clenzy.dto.manager.PropertyAssignmentResultDto;
import com.clenzy.dto.manager.PropertyByClientDto;
import com.clenzy.dto.manager.ReassignmentResultDto;
import com.clenzy.dto.manager.TeamUserAssignmentResultDto;
import com.clenzy.dto.manager.UnassignmentResultDto;
import com.clenzy.service.ManagerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/managers")
@PreAuthorize("isAuthenticated()")
public class ManagerController {

    private static final Logger log = LoggerFactory.getLogger(ManagerController.class);

    private final ManagerService managerService;

    public ManagerController(ManagerService managerService) {
        this.managerService = managerService;
    }

    /**
     * Recuperer tous les managers et admins pour les formulaires d'association -- ADMIN uniquement
     */
    @GetMapping("/all")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<ManagerUserSummaryDto>> getAllManagersAndAdmins() {
        return ResponseEntity.ok(managerService.getAllManagersAndAdmins());
    }

    /**
     * Recuperer tous les utilisateurs HOST pour les formulaires d'association -- ADMIN/MANAGER uniquement
     */
    @GetMapping("/hosts")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<List<ManagerUserSummaryDto>> getAllHostUsers() {
        return ResponseEntity.ok(managerService.getAvailableHostSummaries());
    }

    /**
     * Recuperer les proprietes des clients selectionnes -- ADMIN/MANAGER uniquement
     */
    @PostMapping("/properties/by-clients")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<List<PropertyByClientDto>> getPropertiesByClients(@RequestBody List<Long> clientIds) {
        return ResponseEntity.ok(managerService.getPropertiesByClients(clientIds));
    }

    /**
     * Recuperer toutes les associations d'un manager (clients, proprietes, equipes, utilisateurs).
     * Accepte soit un ID numerique soit un UUID Keycloak.
     * Securite: le manager ne peut voir que ses propres associations, ADMIN voit tout.
     */
    @GetMapping("/{managerId}/associations")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<ManagerAssociationsDto> getManagerAssociations(
            @PathVariable String managerId,
            @AuthenticationPrincipal Jwt jwt) {

        final Optional<Long> userIdOpt = managerService.resolveManagerId(managerId);
        if (userIdOpt.isEmpty()) {
            log.warn("Utilisateur non trouve pour UUID: {} -- retour associations vides", managerId);
            return ResponseEntity.ok(new ManagerAssociationsDto(
                    Collections.emptyList(), Collections.emptyList(),
                    Collections.emptyList(), Collections.emptyList()));
        }

        final Long userId = userIdOpt.get();
        managerService.validateManagerOwnership(jwt, userId);
        return ResponseEntity.ok(managerService.getManagerAssociations(userId));
    }

    /**
     * Assigner des clients et proprietes a un manager
     */
    @PostMapping("/{managerId}/assign")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<AssignmentResultDto> assignClientsAndProperties(
            @PathVariable Long managerId,
            @RequestBody AssignmentRequest request) {
        return ResponseEntity.ok(managerService.assignClientsAndProperties(managerId, request));
    }

    /**
     * Recuperer les clients associes a un manager -- ownership: son propre ID ou ADMIN
     */
    @GetMapping("/{managerId}/clients")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<?> getManagerClients(@PathVariable Long managerId, @AuthenticationPrincipal Jwt jwt) {
        // TODO: Implementer la logique
        return ResponseEntity.ok().build();
    }

    /**
     * Recuperer les proprietes associees a un manager -- ownership: son propre ID ou ADMIN
     */
    @GetMapping("/{managerId}/properties")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<?> getManagerProperties(@PathVariable Long managerId, @AuthenticationPrincipal Jwt jwt) {
        // TODO: Implementer la logique
        return ResponseEntity.ok().build();
    }

    /**
     * Recuperer tous les utilisateurs operationnels (techniciens et housekeepers) -- ADMIN/MANAGER uniquement
     */
    @GetMapping("/operational-users")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<List<ManagerUserSummaryDto>> getOperationalUsers() {
        return ResponseEntity.ok(managerService.getOperationalUsers());
    }

    /**
     * Recuperer toutes les equipes disponibles -- ADMIN/MANAGER uniquement
     */
    @GetMapping("/teams")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<List<ManagerTeamSummaryDto>> getAllTeams() {
        return ResponseEntity.ok(managerService.getAllTeamSummaries());
    }

    /**
     * Assigner des equipes et utilisateurs a un manager
     */
    @PostMapping("/{managerId}/assign-teams-users")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<TeamUserAssignmentResultDto> assignTeamsAndUsers(
            @PathVariable Long managerId,
            @RequestBody TeamUserAssignmentRequest request) {
        return ResponseEntity.ok(managerService.assignTeamsAndUsers(managerId, request));
    }

    /**
     * Recuperer les equipes associees a un manager -- ownership: son propre ID ou ADMIN
     */
    @GetMapping("/{managerId}/teams")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<?> getManagerTeams(@PathVariable Long managerId, @AuthenticationPrincipal Jwt jwt) {
        // TODO: Implementer la logique
        return ResponseEntity.ok().build();
    }

    /**
     * Recuperer les utilisateurs associes a un manager -- ownership: son propre ID ou ADMIN
     */
    @GetMapping("/{managerId}/users")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<?> getManagerUsers(@PathVariable Long managerId, @AuthenticationPrincipal Jwt jwt) {
        // TODO: Implementer la logique
        return ResponseEntity.ok().build();
    }

    /**
     * Modifier l'assignation d'un client vers un autre manager
     */
    @PutMapping("/{clientId}/reassign")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ReassignmentResultDto> reassignClient(
            @PathVariable Long clientId,
            @RequestBody ReassignmentRequest request) {
        // Stub: simple test response
        return ResponseEntity.ok(new ReassignmentResultDto(
                "Reassignation test reussie", clientId, null, request.getNewManagerId()));
    }

    // ===== ENDPOINTS DE DESASSIGNATION =====

    @DeleteMapping("/{managerId}/clients/{clientId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<UnassignmentResultDto> unassignClient(
            @PathVariable String managerId,
            @PathVariable Long clientId) {

        final Optional<Long> userIdOpt = managerService.resolveManagerId(managerId);
        if (userIdOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(managerService.unassignClient(userIdOpt.get(), clientId));
    }

    @DeleteMapping("/{managerId}/teams/{teamId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<UnassignmentResultDto> unassignTeam(
            @PathVariable String managerId,
            @PathVariable Long teamId) {

        final Optional<Long> userIdOpt = managerService.resolveManagerId(managerId);
        if (userIdOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(managerService.unassignTeam(userIdOpt.get(), teamId));
    }

    @DeleteMapping("/{managerId}/users/{userId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<UnassignmentResultDto> unassignUser(
            @PathVariable String managerId,
            @PathVariable Long userId) {

        final Optional<Long> userIdOpt = managerService.resolveManagerId(managerId);
        if (userIdOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(managerService.unassignUser(userIdOpt.get(), userId));
    }

    // ===== ENDPOINTS POUR LA GESTION DES PROPRIETES INDIVIDUELLES =====

    @PostMapping("/{managerId}/properties/{propertyId}/assign")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<PropertyAssignmentResultDto> assignPropertyToManager(
            @PathVariable String managerId,
            @PathVariable Long propertyId) {

        final Optional<Long> userIdOpt = managerService.resolveManagerId(managerId);
        if (userIdOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(managerService.assignPropertyToManager(userIdOpt.get(), propertyId));
    }

    @DeleteMapping("/{managerId}/properties/{propertyId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<PropertyAssignmentResultDto> unassignPropertyFromManager(
            @PathVariable String managerId,
            @PathVariable Long propertyId) {

        final Optional<Long> userIdOpt = managerService.resolveManagerId(managerId);
        if (userIdOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(managerService.unassignPropertyFromManager(userIdOpt.get(), propertyId));
    }

    @PutMapping("/{managerId}/properties/{propertyId}/reassign")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ReassignmentResultDto> reassignPropertyToManager(
            @PathVariable String managerId,
            @PathVariable Long propertyId,
            @RequestBody ReassignmentRequest request) {
        // Stub: simple test response
        return ResponseEntity.ok(new ReassignmentResultDto(
                "Reassignation de propriete test reussie", null, propertyId, request.getNewManagerId()));
    }
}
