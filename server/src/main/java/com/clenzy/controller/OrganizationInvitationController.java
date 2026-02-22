package com.clenzy.controller;

import com.clenzy.dto.AcceptInvitationRequest;
import com.clenzy.dto.InvitationDto;
import com.clenzy.dto.SendInvitationRequest;
import com.clenzy.service.OrganizationInvitationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller pour la gestion des invitations a rejoindre une organisation.
 *
 * Endpoints authentifies (ADMIN/MANAGER) :
 *   POST   /api/organizations/{orgId}/invitations           → Envoyer
 *   GET    /api/organizations/{orgId}/invitations           → Lister
 *   DELETE /api/organizations/{orgId}/invitations/{id}      → Annuler
 *   POST   /api/organizations/{orgId}/invitations/{id}/resend → Renvoyer
 *
 * Endpoints publics / auth minimale :
 *   GET    /api/invitations/info?token=xxx   → Info publique (pas de JWT)
 *   POST   /api/invitations/accept           → Accepter (JWT requis)
 */
@RestController
@Tag(name = "Invitations", description = "Gestion des invitations d'organisation")
@PreAuthorize("isAuthenticated()")
public class OrganizationInvitationController {

    private static final Logger log = LoggerFactory.getLogger(OrganizationInvitationController.class);

    private final OrganizationInvitationService invitationService;

    public OrganizationInvitationController(OrganizationInvitationService invitationService) {
        this.invitationService = invitationService;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Endpoints authentifies — gestion des invitations d'une org
    // ═══════════════════════════════════════════════════════════════════════════

    @PostMapping("/api/organizations/{orgId}/invitations")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Envoyer une invitation a rejoindre l'organisation")
    public ResponseEntity<InvitationDto> sendInvitation(
            @PathVariable Long orgId,
            @Valid @RequestBody SendInvitationRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        log.debug("Envoi invitation: orgId={}, email={}", orgId, request.getEmail());
        InvitationDto result = invitationService.sendInvitation(orgId, request.getEmail(), request.getRole(), jwt);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/api/organizations/{orgId}/invitations")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Lister les invitations d'une organisation")
    public ResponseEntity<List<InvitationDto>> listInvitations(
            @PathVariable Long orgId,
            @AuthenticationPrincipal Jwt jwt) {
        List<InvitationDto> invitations = invitationService.listByOrganization(orgId, jwt);
        return ResponseEntity.ok(invitations);
    }

    @DeleteMapping("/api/organizations/{orgId}/invitations/{invitationId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Annuler une invitation")
    public ResponseEntity<Void> cancelInvitation(
            @PathVariable Long orgId,
            @PathVariable Long invitationId,
            @AuthenticationPrincipal Jwt jwt) {
        invitationService.cancelInvitation(orgId, invitationId, jwt);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/organizations/{orgId}/invitations/{invitationId}/resend")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @Operation(summary = "Renvoyer une invitation (annule l'ancienne et cree une nouvelle)")
    public ResponseEntity<InvitationDto> resendInvitation(
            @PathVariable Long orgId,
            @PathVariable Long invitationId,
            @AuthenticationPrincipal Jwt jwt) {
        InvitationDto result = invitationService.resendInvitation(orgId, invitationId, jwt);
        return ResponseEntity.ok(result);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Endpoints publics / auth minimale — acceptation d'invitation
    // ═══════════════════════════════════════════════════════════════════════════

    @GetMapping("/api/invitations/info")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Obtenir les infos d'une invitation (public, pas de JWT)")
    public ResponseEntity<?> getInvitationInfo(@RequestParam String token) {
        try {
            InvitationDto info = invitationService.getInvitationInfo(token);
            return ResponseEntity.ok(info);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/api/invitations/accept")
    @Operation(summary = "Accepter une invitation (JWT Keycloak requis)")
    public ResponseEntity<?> acceptInvitation(
            @Valid @RequestBody AcceptInvitationRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Authentification requise"));
        }
        try {
            InvitationDto result = invitationService.acceptInvitation(request.getToken(), jwt);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
