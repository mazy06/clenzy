package com.clenzy.controller;

import com.clenzy.dto.device.DeviceSummaryDto;
import com.clenzy.dto.device.ProviderStatusDto;
import com.clenzy.service.DeviceAggregationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-model unifie des objets connectes pour le Hub /connected-objects.
 *
 * - GET /api/devices            : liste unifiee (serrures + capteurs + points de remise)
 * - GET /api/devices/providers  : statut de connexion par provider
 *
 * Les actions (lock/unlock, CRUD, configuration) restent sur les controllers par
 * type (/api/smart-locks, /api/noise-devices, /api/key-exchange).
 */
@RestController
@RequestMapping("/api/devices")
@Tag(name = "Devices", description = "Read-model unifie des objets connectes")
@PreAuthorize("isAuthenticated()")
public class DeviceController {

    private final DeviceAggregationService deviceAggregationService;

    public DeviceController(DeviceAggregationService deviceAggregationService) {
        this.deviceAggregationService = deviceAggregationService;
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
}
