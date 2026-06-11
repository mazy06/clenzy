package com.clenzy.controller;

import com.clenzy.dto.ChannelSyncHealthDto;
import com.clenzy.service.ChannelSyncHealthAccessService;
import com.clenzy.service.ChannelSyncHealthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
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
    private final ChannelSyncHealthAccessService accessService;

    public ChannelSyncHealthController(ChannelSyncHealthService syncHealthService,
                                       ChannelSyncHealthAccessService accessService) {
        this.syncHealthService = syncHealthService;
        this.accessService = accessService;
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
        accessService.requireAccessToProperties(propertyIds, jwt.getSubject());

        return ResponseEntity.ok(syncHealthService.getHealthByPropertyIds(propertyIds));
    }
}
