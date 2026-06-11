package com.clenzy.controller;

import com.clenzy.dto.ReceivedFormDto;
import com.clenzy.service.ReceivedFormService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;

/**
 * Controleur admin pour consulter les formulaires recus (devis, maintenance, support).
 * Accessible uniquement aux roles plateforme (SUPER_ADMIN, SUPER_MANAGER).
 */
@RestController
@RequestMapping("/api/admin/received-forms")
@PreAuthorize("isAuthenticated()")
public class ReceivedFormController {

    private static final Logger log = LoggerFactory.getLogger(ReceivedFormController.class);

    private final ReceivedFormService receivedFormService;

    public ReceivedFormController(ReceivedFormService receivedFormService) {
        this.receivedFormService = receivedFormService;
    }

    /**
     * Liste paginee des formulaires recus, avec filtre optionnel par type.
     */
    @GetMapping
    public ResponseEntity<?> listForms(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status) {

        if (jwt == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!hasAnyRole(jwt, "SUPER_ADMIN", "SUPER_MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Page<ReceivedFormDto> result = receivedFormService.listForms(page, size, type, status);

        return ResponseEntity.ok(Map.of(
                "content", result.getContent(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                "number", result.getNumber(),
                "size", result.getSize()
        ));
    }

    /**
     * Detail d'un formulaire par ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getForm(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        if (jwt == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!hasAnyRole(jwt, "SUPER_ADMIN", "SUPER_MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return receivedFormService.getForm(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Mise a jour du statut d'un formulaire (NEW -> READ -> PROCESSED -> ARCHIVED).
     */
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @RequestParam String status) {

        if (jwt == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!hasAnyRole(jwt, "SUPER_ADMIN", "SUPER_MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        String normalizedStatus = status.toUpperCase();
        if (!List.of("NEW", "READ", "PROCESSED", "ARCHIVED").contains(normalizedStatus)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Statut invalide: " + status));
        }

        return receivedFormService.updateStatus(id, normalizedStatus)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Statistiques : compteurs par type et par statut (pour badges).
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!hasAnyRole(jwt, "SUPER_ADMIN", "SUPER_MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        ReceivedFormService.ReceivedFormStats stats = receivedFormService.getStats();

        return ResponseEntity.ok(Map.of(
                "totalNew", stats.totalNew(),
                "totalRead", stats.totalRead(),
                "totalProcessed", stats.totalProcessed(),
                "totalArchived", stats.totalArchived(),
                "devisCount", stats.devisCount(),
                "maintenanceCount", stats.maintenanceCount(),
                "supportCount", stats.supportCount()
        ));
    }

    // ─── Role check JWT (meme pattern que PricingConfigController) ───────────

    private boolean hasAnyRole(Jwt jwt, String... rolesToCheck) {
        try {
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess != null) {
                Object roles = realmAccess.get("roles");
                if (roles instanceof List<?>) {
                    List<?> roleList = (List<?>) roles;
                    for (String role : rolesToCheck) {
                        if (roleList.stream().anyMatch(r -> role.equals(r.toString()))) {
                            return true;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Erreur extraction role JWT: {}", e.getMessage());
        }
        return false;
    }
}
