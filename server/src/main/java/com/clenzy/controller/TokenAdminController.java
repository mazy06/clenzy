package com.clenzy.controller;

import com.clenzy.service.JwtTokenService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/tokens")
@Tag(name = "Token Administration", description = "Administration et monitoring des tokens JWT")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class TokenAdminController {

    @Autowired
    private JwtTokenService jwtTokenService;

    @GetMapping("/stats")
    @Operation(summary = "Statistiques des tokens")
    public ResponseEntity<Map<String, Object>> getTokenStats() {
        try {
            Map<String, Object> stats = jwtTokenService.getStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur lors de la récupération des statistiques: " + e.getMessage()));
        }
    }

    @GetMapping("/metrics")
    @Operation(summary = "Métriques de performance des tokens")
    public ResponseEntity<Map<String, Object>> getTokenMetrics() {
        try {
            JwtTokenService.TokenMetrics metrics = jwtTokenService.getMetrics();
            
            Map<String, Object> response = Map.of(
                "validTokens", metrics.getValidTokens(),
                "invalidTokens", metrics.getInvalidTokens(),
                "revokedTokens", metrics.getRevokedTokens(),
                "rejectedTokens", metrics.getRejectedTokens(),
                "cacheHits", metrics.getCacheHits(),
                "errors", metrics.getErrors(),
                "totalTokens", metrics.getTotalTokens(),
                "successRate", String.format("%.2f%%", metrics.getSuccessRate())
            );
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur lors de la récupération des métriques: " + e.getMessage()));
        }
    }

    @PostMapping("/cleanup")
    @Operation(summary = "Nettoyer les tokens expirés")
    public ResponseEntity<Map<String, Object>> cleanupExpiredTokens() {
        try {
            jwtTokenService.cleanupExpiredTokens();
            
            // Récupérer les nouvelles statistiques après nettoyage
            Map<String, Object> stats = jwtTokenService.getStats();
            
            return ResponseEntity.ok(Map.of(
                "message", "Nettoyage des tokens expirés terminé",
                "stats", stats
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur lors du nettoyage: " + e.getMessage()));
        }
    }

    @PostMapping("/revoke")
    @Operation(summary = "Révoquer un token spécifique")
    public ResponseEntity<Map<String, Object>> revokeToken(@RequestBody Map<String, String> request) {
        try {
            String token = request.get("token");
            if (token == null || token.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Token requis"));
            }
            
            jwtTokenService.revokeToken(token);
            
            return ResponseEntity.ok(Map.of(
                "message", "Token révoqué avec succès",
                "token", token.substring(0, 6) + "..." + token.substring(token.length() - 4)
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur lors de la révocation: " + e.getMessage()));
        }
    }

    @PostMapping("/validate")
    @Operation(summary = "Valider un token côté backend")
    public ResponseEntity<Map<String, Object>> validateToken(@RequestBody Map<String, String> request) {
        try {
            String token = request.get("token");
            if (token == null || token.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Token requis"));
            }
            
            boolean isValid = jwtTokenService.isTokenValid(token);
            
            return ResponseEntity.ok(Map.of(
                "valid", isValid,
                "token", token.substring(0, 6) + "..." + token.substring(token.length() - 4)
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur lors de la validation: " + e.getMessage()));
        }
    }

    @GetMapping("/blacklist")
    @Operation(summary = "Obtenir la liste des tokens révoqués")
    public ResponseEntity<Map<String, Object>> getBlacklistedTokens() {
        try {
            Map<String, Object> blacklist = jwtTokenService.getBlacklistedTokens();
            return ResponseEntity.ok(blacklist);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur lors de la récupération de la blacklist: " + e.getMessage()));
        }
    }

    @DeleteMapping("/blacklist/{tokenId}")
    @Operation(summary = "Supprimer un token de la blacklist")
    public ResponseEntity<Map<String, Object>> removeFromBlacklist(@PathVariable String tokenId) {
        try {
            boolean removed = jwtTokenService.removeFromBlacklist(tokenId);
            
            if (removed) {
                return ResponseEntity.ok(Map.of(
                    "message", "Token supprimé de la blacklist",
                    "tokenId", tokenId
                ));
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur lors de la suppression: " + e.getMessage()));
        }
    }

    @PostMapping("/cache/clear")
    @Operation(summary = "Vider le cache des tokens")
    public ResponseEntity<Map<String, Object>> clearCache() {
        try {
            jwtTokenService.clearCache();
            
            return ResponseEntity.ok(Map.of(
                "message", "Cache des tokens vidé avec succès"
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur lors du vidage du cache: " + e.getMessage()));
        }
    }

    @GetMapping("/health")
    @Operation(summary = "État de santé du service de tokens")
    public ResponseEntity<Map<String, Object>> getHealthStatus() {
        try {
            Map<String, Object> health = jwtTokenService.getHealthStatus();
            return ResponseEntity.ok(health);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Erreur lors de la vérification de santé: " + e.getMessage()));
        }
    }
}
