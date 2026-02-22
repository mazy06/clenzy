package com.clenzy.controller;

import com.clenzy.dto.kpi.KpiDtos.KpiHistoryDto;
import com.clenzy.dto.kpi.KpiDtos.KpiSnapshotDto;
import com.clenzy.service.KpiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controller admin pour le dashboard KPI Readiness (Niveau 14 certification).
 *
 * Endpoints :
 * - GET  /api/admin/kpi/current   → snapshot temps reel des 12 KPIs
 * - GET  /api/admin/kpi/history   → historique des snapshots
 * - POST /api/admin/kpi/refresh   → capture manuelle
 */
@RestController
@RequestMapping("/api/admin/kpi")
@Tag(name = "KPI Readiness", description = "Dashboard KPI de certification Airbnb Partner")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class KpiController {

    private final KpiService kpiService;

    public KpiController(KpiService kpiService) {
        this.kpiService = kpiService;
    }

    @GetMapping("/current")
    @Operation(summary = "Snapshot KPI actuel (calcul en temps reel)")
    public ResponseEntity<?> getCurrentSnapshot() {
        try {
            KpiSnapshotDto snapshot = kpiService.computeCurrentSnapshot();
            return ResponseEntity.ok(snapshot);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors du calcul des KPIs: " + e.getMessage()));
        }
    }

    @GetMapping("/history")
    @Operation(summary = "Historique des snapshots KPI")
    public ResponseEntity<?> getHistory(
            @RequestParam(defaultValue = "24") int hours) {
        try {
            int limitedHours = Math.min(hours, 720); // max 30 jours
            KpiHistoryDto history = kpiService.getHistory(limitedHours);
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation de l'historique KPI: " + e.getMessage()));
        }
    }

    @PostMapping("/refresh")
    @Operation(summary = "Forcer un refresh et persister un nouveau snapshot")
    public ResponseEntity<?> refreshSnapshot() {
        try {
            KpiSnapshotDto snapshot = kpiService.captureAndPersistSnapshot("MANUAL");
            return ResponseEntity.ok(snapshot);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors du refresh KPI: " + e.getMessage()));
        }
    }
}
