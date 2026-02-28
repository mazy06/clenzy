package com.clenzy.integration.channel.controller;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.integration.channel.dto.ChannelConnectRequest;
import com.clenzy.integration.channel.dto.ChannelConnectionDto;
import com.clenzy.integration.channel.dto.ChannelConnectionTestResult;
import com.clenzy.integration.channel.service.ChannelConnectionService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API unifiee pour la gestion des connexions channel (hors Airbnb).
 *
 * Permet de connecter/deconnecter des channels OTA (Booking.com, Expedia,
 * Hotels.com, Agoda, Vrbo/Abritel) via credentials API.
 *
 * GET: accessible aux HOST et au-dessus.
 * POST/DELETE (modifications): restreint aux SUPER_ADMIN et SUPER_MANAGER.
 */
@RestController
@RequestMapping("/api/channels/connections")
public class ChannelConnectionController {

    private static final Logger log = LoggerFactory.getLogger(ChannelConnectionController.class);

    private final ChannelConnectionService channelConnectionService;
    private final TenantContext tenantContext;

    public ChannelConnectionController(ChannelConnectionService channelConnectionService,
                                        TenantContext tenantContext) {
        this.channelConnectionService = channelConnectionService;
        this.tenantContext = tenantContext;
    }

    /**
     * Liste toutes les connexions channel de l'organisation.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<List<ChannelConnectionDto>> getAll() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(channelConnectionService.getConnectionsForOrganization(orgId));
    }

    /**
     * Statut de connexion pour un channel specifique.
     */
    @GetMapping("/{channel}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<ChannelConnectionDto> getStatus(@PathVariable String channel) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        ChannelName channelName = parseChannelName(channel);
        return channelConnectionService.getConnectionStatus(orgId, channelName)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Connecter un channel avec les credentials fournis.
     */
    @PostMapping("/{channel}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<ChannelConnectionDto> connect(
            @PathVariable String channel,
            @Valid @RequestBody ChannelConnectRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        ChannelName channelName = parseChannelName(channel);
        log.info("Demande de connexion channel {} pour org {}", channelName, orgId);
        ChannelConnectionDto dto = channelConnectionService.connect(orgId, channelName, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    /**
     * Deconnecter un channel.
     */
    @DeleteMapping("/{channel}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<Void> disconnect(@PathVariable String channel) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        ChannelName channelName = parseChannelName(channel);
        log.info("Demande de deconnexion channel {} pour org {}", channelName, orgId);
        channelConnectionService.disconnect(orgId, channelName);
        return ResponseEntity.noContent().build();
    }

    /**
     * Tester les credentials d'un channel sans sauvegarder.
     */
    @PostMapping("/{channel}/test")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<ChannelConnectionTestResult> test(
            @PathVariable String channel,
            @Valid @RequestBody ChannelConnectRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        ChannelName channelName = parseChannelName(channel);
        ChannelConnectionTestResult result = channelConnectionService.testConnection(orgId, channelName, request);
        return ResponseEntity.ok(result);
    }

    // ── Exception handler pour ce controller ──

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    private ChannelName parseChannelName(String channel) {
        try {
            return ChannelName.valueOf(channel.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Channel inconnu: " + channel);
        }
    }
}
