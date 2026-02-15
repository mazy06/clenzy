package com.clenzy.controller;

import com.clenzy.model.ReceivedForm;
import com.clenzy.repository.ReceivedFormRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Controleur admin pour consulter les formulaires recus (devis, maintenance, support).
 * Accessible uniquement aux roles ADMIN et MANAGER.
 * Pattern de verification JWT copie de PricingConfigController.
 */
@RestController
@RequestMapping("/api/admin/received-forms")
public class ReceivedFormController {

    private static final Logger log = LoggerFactory.getLogger(ReceivedFormController.class);

    private final ReceivedFormRepository receivedFormRepository;

    public ReceivedFormController(ReceivedFormRepository receivedFormRepository) {
        this.receivedFormRepository = receivedFormRepository;
    }

    /**
     * Liste paginee des formulaires recus, avec filtre optionnel par type.
     */
    @GetMapping
    public ResponseEntity<?> listForms(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String type) {

        if (jwt == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!hasRole(jwt, "ADMIN") && !hasRole(jwt, "MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        PageRequest pageable = PageRequest.of(page, size);
        Page<ReceivedForm> result;

        if (type != null && !type.isBlank()) {
            result = receivedFormRepository.findByFormTypeOrderByCreatedAtDesc(type.toUpperCase(), pageable);
        } else {
            result = receivedFormRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

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
        if (!hasRole(jwt, "ADMIN") && !hasRole(jwt, "MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return receivedFormRepository.findById(id)
                .map(ResponseEntity::ok)
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
        if (!hasRole(jwt, "ADMIN") && !hasRole(jwt, "MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        String normalizedStatus = status.toUpperCase();
        if (!List.of("NEW", "READ", "PROCESSED", "ARCHIVED").contains(normalizedStatus)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Statut invalide: " + status));
        }

        return receivedFormRepository.findById(id).map(form -> {
            form.setStatus(normalizedStatus);
            if ("READ".equals(normalizedStatus) && form.getReadAt() == null) {
                form.setReadAt(LocalDateTime.now());
            }
            if ("PROCESSED".equals(normalizedStatus) && form.getProcessedAt() == null) {
                form.setProcessedAt(LocalDateTime.now());
            }
            receivedFormRepository.save(form);
            log.info("Formulaire #{} mis a jour : status={}", id, normalizedStatus);
            return ResponseEntity.ok(form);
        }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * Statistiques : compteurs par type et par statut (pour badges).
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!hasRole(jwt, "ADMIN") && !hasRole(jwt, "MANAGER")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(Map.of(
                "totalNew", receivedFormRepository.countByStatus("NEW"),
                "totalRead", receivedFormRepository.countByStatus("READ"),
                "totalProcessed", receivedFormRepository.countByStatus("PROCESSED"),
                "totalArchived", receivedFormRepository.countByStatus("ARCHIVED"),
                "devisCount", receivedFormRepository.countByFormType("DEVIS"),
                "maintenanceCount", receivedFormRepository.countByFormType("MAINTENANCE"),
                "supportCount", receivedFormRepository.countByFormType("SUPPORT")
        ));
    }

    // ─── Role check JWT (meme pattern que PricingConfigController) ───────────

    private boolean hasRole(Jwt jwt, String role) {
        try {
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess != null) {
                Object roles = realmAccess.get("roles");
                if (roles instanceof List<?>) {
                    return ((List<?>) roles).stream()
                            .anyMatch(r -> role.equals(r.toString()));
                }
            }
        } catch (Exception e) {
            log.warn("Erreur extraction role JWT: {}", e.getMessage());
        }
        return false;
    }
}
