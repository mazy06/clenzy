package com.clenzy.controller;

import com.clenzy.dto.ChangeOrgMemberRoleRequest;
import com.clenzy.dto.OrganizationMemberDto;
import com.clenzy.model.OrgMemberRole;
import com.clenzy.model.OrganizationMember;
import com.clenzy.model.User;
import com.clenzy.service.OrganizationService;
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
import java.util.stream.Collectors;

/**
 * Controller pour la gestion des membres d'une organisation.
 *
 * Endpoints :
 *   GET    /api/organizations/{orgId}/members                  → Lister les membres
 *   PUT    /api/organizations/{orgId}/members/{memberId}/role  → Changer le role
 *   DELETE /api/organizations/{orgId}/members/{memberId}       → Retirer un membre
 */
@RestController
@RequestMapping("/api/organizations/{orgId}/members")
@PreAuthorize("isAuthenticated()")
@Tag(name = "Organization Members", description = "Gestion des membres d'une organisation")
public class OrganizationMemberController {

    private static final Logger log = LoggerFactory.getLogger(OrganizationMemberController.class);

    private final OrganizationService organizationService;

    public OrganizationMemberController(OrganizationService organizationService) {
        this.organizationService = organizationService;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GET — Lister les membres
    // ═══════════════════════════════════════════════════════════════════════════

    @GetMapping
    @Operation(summary = "Lister les membres d'une organisation")
    public ResponseEntity<List<OrganizationMemberDto>> listMembers(
            @PathVariable Long orgId,
            @AuthenticationPrincipal Jwt jwt) {

        String keycloakId = jwt.getSubject();
        organizationService.validateOrgManagement(keycloakId, orgId);

        List<OrganizationMember> members = organizationService.getMembersWithUser(orgId);
        List<OrganizationMemberDto> dtos = members.stream()
                .map(this::toDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUT — Changer le role d'un membre
    // ═══════════════════════════════════════════════════════════════════════════

    @PutMapping("/{memberId}/role")
    @Operation(summary = "Changer le role d'un membre dans l'organisation")
    public ResponseEntity<?> changeMemberRole(
            @PathVariable Long orgId,
            @PathVariable Long memberId,
            @Valid @RequestBody ChangeOrgMemberRoleRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        String keycloakId = jwt.getSubject();
        organizationService.validateOrgManagement(keycloakId, orgId);

        // Parser le role
        OrgMemberRole newRole;
        try {
            newRole = OrgMemberRole.valueOf(request.getRole().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Role invalide: " + request.getRole()));
        }

        try {
            OrganizationMember updated = organizationService.changeMemberRole(orgId, memberId, newRole);
            return ResponseEntity.ok(toDto(updated));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DELETE — Retirer un membre
    // ═══════════════════════════════════════════════════════════════════════════

    @DeleteMapping("/{memberId}")
    @Operation(summary = "Retirer un membre de l'organisation")
    public ResponseEntity<?> removeMember(
            @PathVariable Long orgId,
            @PathVariable Long memberId,
            @AuthenticationPrincipal Jwt jwt) {

        String keycloakId = jwt.getSubject();
        organizationService.validateOrgManagement(keycloakId, orgId);

        try {
            organizationService.removeMemberById(orgId, memberId);
            return ResponseEntity.noContent().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Mapping
    // ═══════════════════════════════════════════════════════════════════════════

    private OrganizationMemberDto toDto(OrganizationMember member) {
        OrganizationMemberDto dto = new OrganizationMemberDto();
        dto.setId(member.getId());
        dto.setUserId(member.getUserId());

        User user = member.getUser();
        if (user != null) {
            dto.setFirstName(user.getFirstName());
            dto.setLastName(user.getLastName());
            dto.setEmail(user.getEmail());
        }

        dto.setRoleInOrg(member.getRoleInOrg().name());
        dto.setJoinedAt(member.getJoinedAt());
        return dto;
    }
}
