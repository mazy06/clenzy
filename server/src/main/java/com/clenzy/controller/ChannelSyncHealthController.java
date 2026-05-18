package com.clenzy.controller;

import com.clenzy.dto.ChannelSyncHealthDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.ChannelSyncHealthService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Endpoint d'agregation de la sante de synchronisation multi-canaux.
 * Utilise par le planning pour afficher "X/Y canaux sync" par propriete.
 */
@RestController
@RequestMapping("/api/channel-sync-health")
@Tag(name = "Channel Sync Health",
     description = "Etat agrege de la sync multi-canaux par propriete")
@PreAuthorize("isAuthenticated()")
public class ChannelSyncHealthController {

    private final ChannelSyncHealthService syncHealthService;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public ChannelSyncHealthController(ChannelSyncHealthService syncHealthService,
                                       PropertyRepository propertyRepository,
                                       UserRepository userRepository,
                                       TenantContext tenantContext) {
        this.syncHealthService = syncHealthService;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Sante de sync multi-canaux pour un batch de proprietes")
    public ResponseEntity<Map<Long, ChannelSyncHealthDto>> getHealth(
            @RequestParam List<Long> propertyIds,
            @AuthenticationPrincipal Jwt jwt) {

        if (propertyIds == null || propertyIds.isEmpty()) {
            return ResponseEntity.ok(Map.of());
        }

        // Valider l'acces a chacune des proprietes (anti-fuite cross-org)
        for (Long pid : propertyIds) {
            validatePropertyAccess(pid, jwt.getSubject());
        }

        return ResponseEntity.ok(syncHealthService.getHealthByPropertyIds(propertyIds));
    }

    private void validatePropertyAccess(Long propertyId, String keycloakId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Propriete introuvable: " + propertyId));

        if (property.getOrganizationId() != null && !property.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Acces refuse : propriete hors de votre organisation");
        }
        if (tenantContext.isSuperAdmin()) return;

        User user = userRepository.findByKeycloakId(keycloakId).orElse(null);
        if (user != null && user.getRole() != null && user.getRole().isPlatformStaff()) return;

        if (user != null && property.getOwner() != null
                && property.getOwner().getId().equals(user.getId())) return;

        throw new AccessDeniedException("Acces refuse : vous n'etes pas proprietaire de cette propriete");
    }
}
