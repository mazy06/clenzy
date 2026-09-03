package com.clenzy.controller;

import com.clenzy.dto.device.DeviceSummaryDto;
import com.clenzy.dto.device.ProviderStatusDto;
import com.clenzy.service.DeviceAggregationService;
import com.clenzy.service.device.DeviceSseRegistry;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/**
 * Read-model unifie des objets connectes pour le Hub /connected-objects.
 *
 * - GET /api/devices            : liste unifiee (serrures + capteurs + points de remise)
 * - GET /api/devices/providers  : statut de connexion par provider
 * - GET /api/devices/stream     : flux SSE des changements (push, org-scope)
 *
 * Les actions (lock/unlock, CRUD, configuration) restent sur les controllers par
 * type (/api/smart-locks, /api/noise-devices, /api/key-exchange).
 */
@RestController
@RequestMapping("/api/devices")
@Tag(name = "Devices", description = "Read-model unifie des objets connectes")
@PreAuthorize("isAuthenticated()")
public class DeviceController {

    /**
     * Un hub reste ouvert longtemps ; on aligne sur la supervision plutot que de
     * forcer une reconnexion frequente, chacune coutant une resynchronisation.
     */
    private static final long SSE_TIMEOUT_MS = 30L * 60L * 1000L;

    private final DeviceAggregationService deviceAggregationService;
    private final DeviceSseRegistry sseRegistry;
    private final TenantContext tenantContext;

    public DeviceController(DeviceAggregationService deviceAggregationService,
                            DeviceSseRegistry sseRegistry,
                            TenantContext tenantContext) {
        this.deviceAggregationService = deviceAggregationService;
        this.sseRegistry = sseRegistry;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Liste unifiee des objets connectes",
            description = "Agrege serrures, capteurs sonores et points de remise des cles")
    public ResponseEntity<List<DeviceSummaryDto>> getDevices(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(deviceAggregationService.getDevices(jwt.getSubject()));
    }

    @GetMapping("/providers")
    @Operation(summary = "Statut de connexion des providers IoT",
            description = "Minut / Tuya / Nuki (connexion reelle) + KeyNest / KeyVault (presence)")
    public ResponseEntity<List<ProviderStatusDto>> getProviders(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(deviceAggregationService.getProviderStatuses(jwt.getSubject()));
    }

    /**
     * Flux des changements d'objets connectes, borne a l'organisation du requester.
     *
     * <p>Remplace l'interrogation par carte : le hub charge la liste UNE fois, puis
     * chaque changement lui arrive ici et il ne remplace que l'appareil concerne.
     * Les evenements ne sont emis que sur changement reel (webhook fabricant, ou
     * transition detectee par le scheduler), jamais sur cadence.</p>
     *
     * <p>L'organisation est prise dans le token, jamais dans l'URL : un flux
     * adressable par identifiant serait un canal d'ecoute inter-organisations.</p>
     */
    @GetMapping(value = "/stream", produces = "text/event-stream")
    @Operation(summary = "Flux SSE des changements d'objets connectes",
            description = "Push des changements (webhooks fabricants + transitions detectees)")
    public SseEmitter stream() {
        Long organizationId = tenantContext.getRequiredOrganizationId();
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        sseRegistry.register(organizationId, emitter);
        try {
            emitter.send(SseEmitter.event().name("ready").data("{}")); // amorce la connexion
        } catch (Exception ignored) {
            // best-effort : les callbacks de l'emetteur nettoient le registre
        }
        return emitter;
    }
}
