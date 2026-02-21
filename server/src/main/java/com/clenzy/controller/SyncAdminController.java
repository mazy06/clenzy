package com.clenzy.controller;

import com.clenzy.dto.syncadmin.SyncAdminDtos.BulkRetryRequestDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.BulkRetryResultDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.CalendarCommandDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.CalendarConflictDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.ConnectionDetailDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.ConnectionSummaryDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.DiagnosticsSummaryDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.MappingSummaryDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.MetricsSnapshotDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.OutboxEventDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.OutboxStatsDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.ReconciliationRunDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.ReconciliationStatsDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.ReconciliationTriggerRequestDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.SyncEventStatsDto;
import com.clenzy.dto.syncadmin.SyncAdminDtos.SyncLogDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.service.SyncAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin/sync")
@Tag(name = "Sync Administration", description = "Outils de support et diagnostic pour la synchronisation channel")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SyncAdminController {

    @Autowired
    private SyncAdminService syncAdminService;

    // ── Connections ──────────────────────────────────────────────────────────

    @GetMapping("/connections")
    @Operation(summary = "Liste de toutes les connexions channel")
    public ResponseEntity<?> getConnections() {
        try {
            List<ConnectionSummaryDto> connections = syncAdminService.getConnections();
            return ResponseEntity.ok(connections);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des connexions: " + e.getMessage()));
        }
    }

    @GetMapping("/connections/{id}")
    @Operation(summary = "Detail d'une connexion channel")
    public ResponseEntity<?> getConnectionDetail(@PathVariable Long id) {
        try {
            Optional<ConnectionDetailDto> detail = syncAdminService.getConnectionDetail(id);
            if (detail.isPresent()) {
                return ResponseEntity.ok(detail.get());
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation du detail connexion: " + e.getMessage()));
        }
    }

    @PostMapping("/connections/{id}/health-check")
    @Operation(summary = "Forcer un health check sur une connexion")
    public ResponseEntity<?> forceHealthCheck(@PathVariable Long id) {
        try {
            String healthStatus = syncAdminService.forceHealthCheck(id);
            return ResponseEntity.ok(Map.of(
                    "connectionId", id,
                    "healthStatus", healthStatus
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors du health check: " + e.getMessage()));
        }
    }

    // ── Sync Events ──────────────────────────────────────────────────────────

    @GetMapping("/events")
    @Operation(summary = "Liste paginee des evenements de synchronisation")
    public ResponseEntity<?> getSyncEvents(
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String from,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            ChannelName channelName = channel != null ? ChannelName.valueOf(channel.toUpperCase()) : null;
            LocalDateTime fromDate = from != null ? LocalDateTime.parse(from) : null;
            Page<SyncLogDto> events = syncAdminService.getSyncEvents(channelName, status, fromDate,
                    PageRequest.of(page, size));
            return ResponseEntity.ok(events);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Parametre invalide: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des events: " + e.getMessage()));
        }
    }

    @GetMapping("/events/stats")
    @Operation(summary = "Statistiques des evenements de synchronisation")
    public ResponseEntity<?> getSyncEventStats() {
        try {
            SyncEventStatsDto stats = syncAdminService.getSyncEventStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des stats: " + e.getMessage()));
        }
    }

    // ── Outbox ───────────────────────────────────────────────────────────────

    @GetMapping("/outbox")
    @Operation(summary = "Liste paginee des evenements outbox")
    public ResponseEntity<?> getOutboxEvents(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String topic,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<OutboxEventDto> events = syncAdminService.getOutboxEvents(status, topic,
                    PageRequest.of(page, size));
            return ResponseEntity.ok(events);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des outbox events: " + e.getMessage()));
        }
    }

    @GetMapping("/outbox/stats")
    @Operation(summary = "Statistiques de la queue outbox")
    public ResponseEntity<?> getOutboxStats() {
        try {
            OutboxStatsDto stats = syncAdminService.getOutboxStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des outbox stats: " + e.getMessage()));
        }
    }

    @PostMapping("/outbox/retry")
    @Operation(summary = "Retry en masse des evenements outbox echoues")
    public ResponseEntity<?> bulkRetryOutbox(@RequestBody BulkRetryRequestDto request) {
        try {
            BulkRetryResultDto result = syncAdminService.bulkRetryOutbox(request.ids());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors du bulk retry: " + e.getMessage()));
        }
    }

    // ── Calendar ─────────────────────────────────────────────────────────────

    @GetMapping("/calendar/commands")
    @Operation(summary = "Liste paginee des commandes calendrier")
    public ResponseEntity<?> getCalendarCommands(
            @RequestParam(required = false) Long propertyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<CalendarCommandDto> commands = syncAdminService.getCalendarCommands(propertyId,
                    PageRequest.of(page, size));
            return ResponseEntity.ok(commands);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des commandes calendrier: " + e.getMessage()));
        }
    }

    @GetMapping("/calendar/conflicts")
    @Operation(summary = "Jours BOOKED orphelins (sans reservation liee)")
    public ResponseEntity<?> getCalendarConflicts() {
        try {
            List<CalendarConflictDto> conflicts = syncAdminService.getCalendarConflicts();
            return ResponseEntity.ok(conflicts);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des conflits: " + e.getMessage()));
        }
    }

    // ── Mappings ─────────────────────────────────────────────────────────────

    @GetMapping("/mappings")
    @Operation(summary = "Liste paginee des mappings channel")
    public ResponseEntity<?> getMappings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<MappingSummaryDto> mappings = syncAdminService.getMappings(PageRequest.of(page, size));
            return ResponseEntity.ok(mappings);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des mappings: " + e.getMessage()));
        }
    }

    @GetMapping("/mappings/{id}")
    @Operation(summary = "Detail d'un mapping channel")
    public ResponseEntity<?> getMappingDetail(@PathVariable Long id) {
        try {
            Optional<MappingSummaryDto> detail = syncAdminService.getMappingDetail(id);
            if (detail.isPresent()) {
                return ResponseEntity.ok(detail.get());
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation du mapping: " + e.getMessage()));
        }
    }

    // ── Diagnostics ──────────────────────────────────────────────────────────

    @GetMapping("/diagnostics")
    @Operation(summary = "Synthese diagnostique globale du systeme de synchronisation")
    public ResponseEntity<?> getDiagnostics() {
        try {
            DiagnosticsSummaryDto diagnostics = syncAdminService.getDiagnostics();
            return ResponseEntity.ok(diagnostics);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des diagnostics: " + e.getMessage()));
        }
    }

    @GetMapping("/diagnostics/metrics")
    @Operation(summary = "Snapshot des metriques Micrometer de synchronisation")
    public ResponseEntity<?> getMetrics() {
        try {
            MetricsSnapshotDto metrics = syncAdminService.getMetrics();
            return ResponseEntity.ok(metrics);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des metriques: " + e.getMessage()));
        }
    }

    // ── Reconciliation ────────────────────────────────────────────────────────

    @GetMapping("/reconciliation")
    @Operation(summary = "Liste paginee des runs de reconciliation")
    public ResponseEntity<?> getReconciliationRuns(
            @RequestParam(required = false) Long propertyId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<ReconciliationRunDto> runs = syncAdminService.getReconciliationRuns(propertyId, status,
                    PageRequest.of(page, size));
            return ResponseEntity.ok(runs);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des reconciliations: " + e.getMessage()));
        }
    }

    @GetMapping("/reconciliation/stats")
    @Operation(summary = "Statistiques des reconciliations")
    public ResponseEntity<?> getReconciliationStats() {
        try {
            ReconciliationStatsDto stats = syncAdminService.getReconciliationStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des stats reconciliation: " + e.getMessage()));
        }
    }

    @PostMapping("/reconciliation/trigger")
    @Operation(summary = "Declencher une reconciliation manuelle pour une propriete")
    public ResponseEntity<?> triggerReconciliation(@RequestBody ReconciliationTriggerRequestDto request) {
        try {
            if (request.propertyId() == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "propertyId est requis"));
            }
            syncAdminService.triggerReconciliation(request.propertyId());
            return ResponseEntity.ok(Map.of(
                    "message", "Reconciliation demarree pour property " + request.propertyId(),
                    "propertyId", request.propertyId()
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors du declenchement de la reconciliation: " + e.getMessage()));
        }
    }
}
