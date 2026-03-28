package com.clenzy.controller;

import com.clenzy.dto.IncidentDto;
import com.clenzy.model.Incident;
import com.clenzy.model.Incident.IncidentStatus;
import com.clenzy.repository.IncidentRepository;
import com.clenzy.service.IncidentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Controller admin pour la consultation des incidents systeme.
 *
 * Endpoints :
 * - GET  /api/admin/incidents             → liste paginee avec filtres optionnels
 * - GET  /api/admin/incidents/open/count  → nombre d'incidents ouverts (badge)
 * - GET  /api/admin/incidents/{id}        → detail d'un incident
 */
@RestController
@RequestMapping("/api/admin/incidents")
@Tag(name = "Incidents", description = "Suivi des incidents systeme P1/P2/P3")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'SUPER_MANAGER')")
public class IncidentController {

    private final IncidentService incidentService;
    private final IncidentRepository incidentRepository;

    public IncidentController(IncidentService incidentService,
                              IncidentRepository incidentRepository) {
        this.incidentService = incidentService;
        this.incidentRepository = incidentRepository;
    }

    @GetMapping
    @Operation(summary = "Liste des incidents avec filtres optionnels")
    public ResponseEntity<?> listIncidents(
            @RequestParam(required = false) IncidentStatus status,
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            final int limitedDays = Math.min(days, 365);
            final int limitedSize = Math.min(Math.max(size, 1), 100);
            final int offset = Math.max(page, 0) * limitedSize;

            LocalDateTime since = LocalDateTime.now().minusDays(limitedDays);

            List<Incident> incidents;
            if (status != null) {
                incidents = incidentRepository
                        .findByStatusAndOpenedAtAfterOrderByOpenedAtDesc(status, since);
            } else {
                incidents = incidentRepository
                        .findByOpenedAtAfterOrderByOpenedAtDesc(since);
            }

            final int totalElements = incidents.size();
            final int totalPages = (int) Math.ceil((double) totalElements / limitedSize);

            List<IncidentDto> pageContent = incidents.stream()
                    .skip(offset)
                    .limit(limitedSize)
                    .map(IncidentDto::from)
                    .toList();

            return ResponseEntity.ok(Map.of(
                    "content", pageContent,
                    "page", page,
                    "size", limitedSize,
                    "totalElements", totalElements,
                    "totalPages", totalPages
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation des incidents: " + e.getMessage()));
        }
    }

    @GetMapping("/open/count")
    @Operation(summary = "Nombre d'incidents actuellement ouverts (pour badge)")
    public ResponseEntity<?> getOpenCount() {
        try {
            long count = incidentRepository.countByStatus(IncidentStatus.OPEN);
            return ResponseEntity.ok(Map.of("count", count));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors du comptage des incidents ouverts: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    @Operation(summary = "Detail d'un incident")
    public ResponseEntity<?> getIncident(@PathVariable Long id) {
        try {
            return incidentRepository.findById(id)
                    .map(incident -> ResponseEntity.ok((Object) IncidentDto.from(incident)))
                    .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Erreur lors de la recuperation de l'incident: " + e.getMessage()));
        }
    }
}
