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

    @PostMapping("/roles/{role}/reset")
    public ResponseEntity<RolePermissionsDto> resetRolePermissions(@PathVariable String role) {
        RolePermissionsDto resetRole = permissionService.resetRolePermissions(role);
        return ResponseEntity.ok(resetRole);
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
}
