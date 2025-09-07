package com.clenzy.controller;

import com.clenzy.service.PermissionService;
import com.clenzy.dto.RolePermissionsDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;

@RestController
@RequestMapping("/api/permissions")
@PreAuthorize("hasRole('ADMIN')")
public class PermissionController {

    @Autowired
    private PermissionService permissionService;

    @GetMapping("/roles")
    public ResponseEntity<List<String>> getAllRoles() {
        List<String> roles = permissionService.getAllRoles();
        return ResponseEntity.ok(roles);
    }

    @GetMapping("/roles/{role}")
    public ResponseEntity<RolePermissionsDto> getRolePermissions(@PathVariable String role) {
        RolePermissionsDto rolePermissions = permissionService.getRolePermissions(role);
        return ResponseEntity.ok(rolePermissions);
    }

    @PutMapping("/roles/{role}")
    public ResponseEntity<RolePermissionsDto> updateRolePermissions(
            @PathVariable String role,
            @RequestBody List<String> permissions) {
        RolePermissionsDto updatedRole = permissionService.updateRolePermissions(role, permissions);
        return ResponseEntity.ok(updatedRole);
    }



    @GetMapping("/default")
    public ResponseEntity<Map<String, List<String>>> getDefaultPermissions() {
        Map<String, List<String>> defaultPermissions = permissionService.getDefaultPermissions();
        return ResponseEntity.ok(defaultPermissions);
    }

    @GetMapping("/user/{role}")
    public ResponseEntity<List<String>> getUserPermissions(@PathVariable String role) {
        List<String> permissions = permissionService.getUserPermissions(role);
        return ResponseEntity.ok(permissions);
    }

    @PostMapping("/roles/{role}/save")
    public ResponseEntity<Map<String, Object>> saveRolePermissions(@PathVariable String role) {
        try {
            // Sauvegarder les permissions personnalisées du rôle
            boolean saved = permissionService.saveRolePermissions(role);
            
            Map<String, Object> response = new HashMap<>();
            if (saved) {
                response.put("success", true);
                response.put("message", "Permissions sauvegardées avec succès pour le rôle " + role);
                response.put("role", role);
                return ResponseEntity.ok(response);
            } else {
                response.put("success", false);
                response.put("message", "Aucune modification à sauvegarder pour le rôle " + role);
                return ResponseEntity.ok(response);
            }
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Erreur lors de la sauvegarde: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    @PostMapping("/roles/{role}/reset-to-initial")
    public ResponseEntity<Map<String, Object>> resetToInitialPermissions(@PathVariable String role) {
        try {
            // Réinitialiser aux permissions initiales depuis la base de données
            RolePermissionsDto resetRole = permissionService.resetToInitialPermissions(role);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Permissions réinitialisées aux valeurs initiales pour le rôle " + role);
            response.put("role", role);
            response.put("permissions", resetRole.getPermissions());
            response.put("isDefault", resetRole.isDefault());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Erreur lors de la réinitialisation: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    // Endpoint public pour vérifier les permissions d'un utilisateur
    @PostMapping("/check")
    @PreAuthorize("permitAll()") // Permettre l'accès à tous les utilisateurs authentifiés
    public ResponseEntity<Map<String, Object>> checkUserPermission(@RequestBody Map<String, String> request) {
        try {
            String permission = request.get("permission");
            String userId = request.get("userId");
            
            if (permission == null || userId == null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Permission et userId sont requis");
                return ResponseEntity.badRequest().body(response);
            }
            
            // Vérifier la permission de l'utilisateur
            boolean hasPermission = permissionService.checkUserPermission(userId, permission);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("hasPermission", hasPermission);
            response.put("permission", permission);
            response.put("userId", userId);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Erreur lors de la vérification: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    // Endpoint pour réinitialiser les permissions d'un rôle aux valeurs par défaut
    @PostMapping("/roles/{role}/reset")
    public ResponseEntity<RolePermissionsDto> resetRolePermissions(@PathVariable String role) {
        try {
            RolePermissionsDto resetRole = permissionService.resetToDefaultPermissions(role);
            return ResponseEntity.ok(resetRole);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // Endpoint pour invalider le cache d'un rôle spécifique
    @PostMapping("/cache/{role}/invalidate")
    public ResponseEntity<Map<String, String>> invalidateRoleCache(@PathVariable String role) {
        try {
            permissionService.invalidateCache(role);
            Map<String, String> response = new HashMap<>();
            response.put("message", "Cache invalidé pour le rôle: " + role);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> response = new HashMap<>();
            response.put("error", "Erreur lors de l'invalidation: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    // Endpoint pour invalider tout le cache
    @PostMapping("/cache/invalidate-all")
    public ResponseEntity<Map<String, String>> invalidateAllCache() {
        try {
            permissionService.invalidateAllCache();
            Map<String, String> response = new HashMap<>();
            response.put("message", "Tout le cache a été invalidé");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> response = new HashMap<>();
            response.put("error", "Erreur lors de l'invalidation: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    // Endpoint pour synchroniser les permissions d'un utilisateur
    @PostMapping("/sync")
    @PreAuthorize("permitAll()") // Permettre l'accès à tous les utilisateurs authentifiés
    public ResponseEntity<Map<String, Object>> syncUserPermissions(@RequestBody Map<String, String> request) {
        try {
            String userId = request.get("userId");
            if (userId == null || userId.trim().isEmpty()) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "userId est requis");
                return ResponseEntity.badRequest().body(response);
            }

            // Récupérer directement les permissions de l'utilisateur depuis la base de données
            // Utiliser la méthode privée getUserPermissionsFromDatabase via une méthode publique
            List<String> userPermissions = permissionService.getUserPermissionsForSync(userId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("permissions", userPermissions);
            response.put("lastUpdate", System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Erreur lors de la synchronisation: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    // Endpoints pour le cache Redis partagé avec le frontend
    @GetMapping("/redis/{userId}")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Map<String, Object>> getPermissionsFromRedis(@PathVariable String userId) {
        try {
            List<String> permissions = permissionService.getUserPermissionsFromRedis(userId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("permissions", permissions);
            response.put("source", "redis");
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Erreur lors de la récupération depuis Redis: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    @PutMapping("/redis/{userId}")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Map<String, Object>> updatePermissionsInRedis(
            @PathVariable String userId,
            @RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<String> permissions = (List<String>) request.get("permissions");
            
            if (permissions == null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Permissions requises");
                return ResponseEntity.badRequest().body(response);
            }

            boolean updated = permissionService.updateUserPermissionsInRedis(userId, permissions);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", updated);
            response.put("message", updated ? "Permissions mises à jour dans Redis" : "Erreur lors de la mise à jour");
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Erreur lors de la mise à jour dans Redis: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    @PostMapping("/redis/{userId}/invalidate")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Map<String, Object>> invalidateUserCache(@PathVariable String userId) {
        try {
            permissionService.invalidateUserPermissionsCache(userId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Cache invalidé pour l'utilisateur: " + userId);
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Erreur lors de l'invalidation: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }
}
