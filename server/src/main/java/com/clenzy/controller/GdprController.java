package com.clenzy.controller;

import com.clenzy.dto.GdprConsentUpdateDto;
import com.clenzy.dto.GdprExportDto;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.GdprService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller REST pour les endpoints RGPD.
 *
 * Endpoints :
 * - GET  /api/gdpr/export           : Export de toutes les donnees personnelles (Article 15+20)
 * - POST /api/gdpr/anonymize        : Demande d'anonymisation (Article 17 — droit a l'effacement)
 * - GET  /api/gdpr/consent          : Consultation des consentements
 * - PUT  /api/gdpr/consent          : Modification des consentements
 * - GET  /api/gdpr/data-categories  : Categories de donnees stockees (transparence)
 */
@RestController
@RequestMapping("/api/gdpr")
public class GdprController {

    private static final Logger log = LoggerFactory.getLogger(GdprController.class);

    private final GdprService gdprService;
    private final UserRepository userRepository;

    public GdprController(GdprService gdprService, UserRepository userRepository) {
        this.gdprService = gdprService;
        this.userRepository = userRepository;
    }

    /**
     * Export de toutes les donnees personnelles de l'utilisateur connecte.
     * Article 15 (droit d'acces) + Article 20 (droit a la portabilite) du RGPD.
     */
    @GetMapping("/export")
    public ResponseEntity<GdprExportDto> exportMyData(Authentication authentication) {
        Long userId = getCurrentUserId(authentication);
        GdprExportDto export = gdprService.exportUserData(userId);
        return ResponseEntity.ok(export);
    }

    /**
     * Anonymise toutes les donnees personnelles de l'utilisateur connecte.
     * Article 17 (droit a l'effacement) du RGPD.
     * ATTENTION : Cette action est IRREVERSIBLE.
     */
    @PostMapping("/anonymize")
    public ResponseEntity<Map<String, String>> anonymizeMyData(Authentication authentication) {
        Long userId = getCurrentUserId(authentication);
        gdprService.anonymizeUser(userId);
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Vos donnees personnelles ont ete anonymisees conformement au RGPD."
        ));
    }

    /**
     * Consultation des consentements de l'utilisateur connecte.
     */
    @GetMapping("/consent")
    public ResponseEntity<Map<String, Object>> getConsentStatus(Authentication authentication) {
        Long userId = getCurrentUserId(authentication);
        Map<String, Object> status = gdprService.getConsentStatus(userId);
        return ResponseEntity.ok(status);
    }

    /**
     * Modification des consentements de l'utilisateur connecte.
     */
    @PutMapping("/consent")
    public ResponseEntity<Map<String, String>> updateConsents(
            @RequestBody GdprConsentUpdateDto dto,
            Authentication authentication,
            HttpServletRequest request) {
        Long userId = getCurrentUserId(authentication);
        String ipAddress = request.getRemoteAddr();
        gdprService.updateConsents(userId, dto, ipAddress);
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Consentements mis a jour."
        ));
    }

    /**
     * Retourne les categories de donnees personnelles stockees par Clenzy.
     * Endpoint public (transparence RGPD).
     */
    @GetMapping("/data-categories")
    public ResponseEntity<List<Map<String, String>>> getDataCategories() {
        return ResponseEntity.ok(gdprService.getDataCategories());
    }

    /**
     * Extrait l'ID utilisateur Clenzy a partir du token JWT (Keycloak).
     */
    private Long getCurrentUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            throw new RuntimeException("Authentification requise pour les operations RGPD");
        }
        String keycloakId = jwt.getSubject();
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouve pour keycloakId: " + keycloakId));
        return user.getId();
    }
}
