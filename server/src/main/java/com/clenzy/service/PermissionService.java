package com.clenzy.service;

import com.clenzy.dto.RolePermissionsDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class PermissionService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Cacheable("roles")
    public List<String> getAllRoles() {
        try {
            String sql = "SELECT DISTINCT name FROM roles ORDER BY name";
            return jdbcTemplate.queryForList(sql, String.class);
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la récupération des rôles: " + e.getMessage());
            // Fallback minimal en cas d'erreur
            return Arrays.asList("ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "HOUSEKEEPER", "HOST");
        }
    }

    @Cacheable("rolePermissions")
    public RolePermissionsDto getRolePermissions(String role) {
        try {
            List<String> permissions = getUserPermissions(role);
            boolean isDefault = !hasCustomPermissions(role);
            return new RolePermissionsDto(role, permissions, isDefault);
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la récupération des permissions du rôle " + role + ": " + e.getMessage());
            throw new IllegalArgumentException("Rôle non reconnu: " + role);
        }
    }

    @CacheEvict(value = {"rolePermissions", "userPermissions"}, allEntries = true)
    @Transactional
    public RolePermissionsDto updateRolePermissions(String role, List<String> permissions) {
        try {
            // Valider que toutes les permissions existent
            List<String> allValidPermissions = getAllValidPermissions();
            for (String permission : permissions) {
                if (!allValidPermissions.contains(permission)) {
                    throw new IllegalArgumentException("Permission non reconnue: " + permission);
                }
            }

            // Récupérer l'ID du rôle
            Long roleId = getRoleId(role);
            if (roleId == null) {
                throw new IllegalArgumentException("Rôle non trouvé: " + role);
            }

            // Désactiver toutes les permissions existantes pour ce rôle
            String deactivateSql = "UPDATE role_permissions SET is_active = false WHERE role_id = ?";
            jdbcTemplate.update(deactivateSql, roleId);

            // Activer les nouvelles permissions
            for (String permission : permissions) {
                Long permissionId = getPermissionId(permission);
                if (permissionId != null) {
                    activateRolePermission(roleId, permissionId);
                }
            }

            System.out.println("🔧 PermissionService - Permissions mises à jour pour le rôle " + role + ": " + permissions);

            return new RolePermissionsDto(role, permissions, false);
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la mise à jour des permissions: " + e.getMessage());
            throw new RuntimeException("Impossible de mettre à jour les permissions", e);
        }
    }

    @CacheEvict(value = {"rolePermissions", "userPermissions"}, allEntries = true)
    @Transactional
    public RolePermissionsDto resetRolePermissions(String role) {
        try {
            // Récupérer l'ID du rôle
            Long roleId = getRoleId(role);
            if (roleId == null) {
                throw new IllegalArgumentException("Rôle non trouvé: " + role);
            }

            // Désactiver toutes les permissions pour ce rôle
            String deactivateSql = "UPDATE role_permissions SET is_active = false WHERE role_id = ?";
            jdbcTemplate.update(deactivateSql, roleId);

            // Récupérer les permissions par défaut depuis la base de données
            List<String> defaultPermissions = getDefaultPermissionsFromDatabase(role);
            
            // Activer les permissions par défaut
            for (String permission : defaultPermissions) {
                Long permissionId = getPermissionId(permission);
                if (permissionId != null) {
                    activateRolePermission(roleId, permissionId);
                }
            }

            System.out.println("🔄 PermissionService - Permissions réinitialisées pour le rôle " + role);

            return new RolePermissionsDto(role, defaultPermissions, true);
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la réinitialisation des permissions: " + e.getMessage());
            throw new RuntimeException("Impossible de réinitialiser les permissions", e);
        }
    }

    public Map<String, List<String>> getDefaultPermissions() {
        Map<String, List<String>> result = new HashMap<>();
        List<String> roles = getAllRoles();

        for (String role : roles) {
            result.put(role, getDefaultPermissionsFromDatabase(role));
        }

        return result;
    }

    public List<String> getAllValidPermissions() {
        try {
            String sql = "SELECT DISTINCT name FROM permissions ORDER BY name";
            return jdbcTemplate.queryForList(sql, String.class);
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la récupération de toutes les permissions: " + e.getMessage());
            // Fallback minimal en cas d'erreur
            return Arrays.asList(
                "dashboard:view",
                "properties:view", "properties:create", "properties:edit", "properties:delete",
                "service-requests:view", "service-requests:create", "service-requests:edit", "service-requests:delete",
                "interventions:view", "interventions:create", "interventions:edit", "interventions:delete",
                "teams:view", "teams:create", "teams:edit", "teams:delete",
                "portfolios:view", "portfolios:create", "portfolios:edit", "portfolios:delete", "portfolios:manage_clients", "portfolios:manage_team",
                "contact:view", "contact:send", "contact:manage",
                "settings:view", "settings:edit",
                "users:manage",
                "reports:view"
            );
        }
    }

    // Méthode pour obtenir les permissions d'un utilisateur selon son rôle
    public List<String> getUserPermissions(String role) {
        try {
            String sql = "SELECT p.name FROM permissions p " +
                        "JOIN role_permissions rp ON p.id = rp.permission_id " +
                        "JOIN roles r ON r.id = rp.role_id " +
                        "WHERE r.name = ? AND rp.is_active = true " +
                        "ORDER BY p.name";

            List<String> permissions = jdbcTemplate.queryForList(sql, String.class, role);
            
            System.out.println("🔍 PermissionService - Récupération des permissions pour le rôle: " + role + " depuis la base de données");
            System.out.println("🔍 PermissionService - Permissions trouvées: " + permissions);
            
            return permissions;
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la récupération des permissions: " + e.getMessage());
            // Retourner une liste vide en cas d'erreur
            return new ArrayList<>();
        }
    }

    // Méthode pour réinitialiser aux permissions initiales
    @CacheEvict(value = {"rolePermissions", "userPermissions"}, allEntries = true)
    @Transactional
    public RolePermissionsDto resetToInitialPermissions(String role) {
        try {
            System.out.println("🔄 PermissionService - Réinitialisation aux permissions initiales pour le rôle " + role);

            // Récupérer l'ID du rôle
            Long roleId = getRoleId(role);
            if (roleId == null) {
                throw new IllegalArgumentException("Rôle non trouvé: " + role);
            }

            // Désactiver toutes les permissions pour ce rôle
            String deactivateSql = "UPDATE role_permissions SET is_active = false WHERE role_id = ?";
            jdbcTemplate.update(deactivateSql, roleId);

            // Récupérer les permissions initiales depuis la base de données
            List<String> initialPermissions = getDefaultPermissionsFromDatabase(role);
            
            // Activer les permissions initiales
            for (String permission : initialPermissions) {
                Long permissionId = getPermissionId(permission);
                if (permissionId != null) {
                    activateRolePermission(roleId, permissionId);
                }
            }

            return new RolePermissionsDto(role, initialPermissions, true);
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la réinitialisation aux permissions initiales: " + e.getMessage());
            throw new RuntimeException("Impossible de réinitialiser aux permissions initiales", e);
        }
    }

    // Méthode pour vérifier si un utilisateur a une permission spécifique
    public boolean checkUserPermission(String userId, String permission) {
        try {
            System.out.println("🔍 PermissionService.checkUserPermission() - Vérification de la permission '" + permission + "' pour userId: '" + userId + "'");
            
            // Récupérer le rôle de l'utilisateur via keycloak_id (UUID)
            String roleSql = "SELECT role FROM users WHERE keycloak_id = ?";
            
            String userRole = jdbcTemplate.queryForObject(roleSql, String.class, userId);
            
            if (userRole == null) {
                System.out.println("❌ PermissionService.checkUserPermission() - Utilisateur " + userId + " sans rôle");
                return false;
            }
            
            System.out.println("✅ PermissionService.checkUserPermission() - Utilisateur " + userId + " a le rôle: " + userRole);
            
            // Vérifier si le rôle a la permission
            return checkRolePermission(userRole, permission);
            
        } catch (Exception e) {
            System.err.println("❌ PermissionService.checkUserPermission() - Erreur lors de la vérification de la permission: " + e.getMessage());
            // En cas d'erreur, on retourne false pour la sécurité
            return false;
        }
    }

    // Méthode pour vérifier si un rôle a une permission spécifique
    public boolean checkRolePermission(String role, String permission) {
        try {
            String sql = "SELECT COUNT(*) > 0 FROM role_permissions rp " +
                        "JOIN permissions p ON rp.permission_id = p.id " +
                        "JOIN roles r ON rp.role_id = r.id " +
                        "WHERE r.name = ? AND p.name = ? AND rp.is_active = true";
            
            Boolean hasPermission = jdbcTemplate.queryForObject(sql, Boolean.class, role, permission);
            
            if (hasPermission != null && hasPermission) {
                System.out.println("✅ PermissionService.checkRolePermission() - Rôle " + role + " a la permission: " + permission);
                return true;
            }
            
            System.out.println("❌ PermissionService.checkRolePermission() - Rôle " + role + " n'a PAS la permission: " + permission);
            return false;
            
        } catch (Exception e) {
            System.err.println("❌ PermissionService.checkRolePermission() - Erreur lors de la vérification de la permission: " + e.getMessage());
            return false;
        }
    }

    // Méthode pour sauvegarder les permissions d'un rôle (maintenant gérée automatiquement par updateRolePermissions)
    public boolean saveRolePermissions(String role) {
        try {
            System.out.println("💾 PermissionService - Sauvegarde des permissions pour le rôle " + role + " (gérée automatiquement)");
            
            // Les permissions sont déjà sauvegardées lors de updateRolePermissions
            // Cette méthode est maintenue pour la compatibilité avec l'interface existante
            return true;
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la sauvegarde des permissions: " + e.getMessage());
            return false;
        }
    }

    // ===== MÉTHODES PRIVÉES POUR LA BASE DE DONNÉES =====

    private Long getRoleId(String roleName) {
        try {
            String sql = "SELECT id FROM roles WHERE name = ?";
            return jdbcTemplate.queryForObject(sql, Long.class, roleName);
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la récupération de l'ID du rôle " + roleName + ": " + e.getMessage());
            return null;
        }
    }

    private Long getPermissionId(String permissionName) {
        try {
            String sql = "SELECT id FROM permissions WHERE name = ?";
            return jdbcTemplate.queryForObject(sql, Long.class, permissionName);
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la récupération de l'ID de la permission " + permissionName + ": " + e.getMessage());
            return null;
        }
    }

    private void activateRolePermission(Long roleId, Long permissionId) {
        try {
            // Vérifier si la relation existe déjà
            String checkSql = "SELECT COUNT(*) FROM role_permissions WHERE role_id = ? AND permission_id = ?";
            int count = jdbcTemplate.queryForObject(checkSql, Integer.class, roleId, permissionId);
            
            if (count > 0) {
                // Mettre à jour la relation existante
                String updateSql = "UPDATE role_permissions SET is_active = true WHERE role_id = ? AND permission_id = ?";
                jdbcTemplate.update(updateSql, roleId, permissionId);
            } else {
                // Créer une nouvelle relation
                String insertSql = "INSERT INTO role_permissions (role_id, permission_id, is_active) VALUES (?, ?, true)";
                jdbcTemplate.update(insertSql, roleId, permissionId);
            }
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de l'activation de la permission: " + e.getMessage());
        }
    }

    private List<String> getDefaultPermissionsFromDatabase(String role) {
        try {
            // Récupérer les permissions par défaut depuis la base de données
            // Pour l'instant, on utilise une logique simple
            String sql = "SELECT p.name FROM permissions p " +
                        "JOIN role_permissions rp ON p.id = rp.permission_id " +
                        "JOIN roles r ON r.id = rp.role_id " +
                        "WHERE r.name = ? AND rp.is_active = true " +
                        "ORDER BY p.name";
            
            return jdbcTemplate.queryForList(sql, String.class, role);
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la récupération des permissions par défaut: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private boolean hasCustomPermissions(String role) {
        try {
            // Vérifier s'il y a des permissions personnalisées dans la base de données
            String sql = "SELECT COUNT(*) FROM role_permissions rp " +
                        "JOIN roles r ON r.id = rp.role_id " +
                        "WHERE r.name = ? AND rp.is_active = true";
            
            int count = jdbcTemplate.queryForObject(sql, Integer.class, role);
            return count > 0;
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la vérification des permissions personnalisées: " + e.getMessage());
            return false;
        }
    }
    
    // Méthode pour vérifier si un utilisateur a une permission spécifique par son email
    public boolean checkUserPermissionByEmail(String userEmail, String permission) {
        try {
            // Récupérer l'ID de l'utilisateur par son email
            String userIdSql = "SELECT id FROM users WHERE email = ?";
            Long userId = jdbcTemplate.queryForObject(userIdSql, Long.class, userEmail);
            
            if (userId == null) {
                System.out.println("❌ PermissionService.checkUserPermissionByEmail() - Utilisateur non trouvé: " + userEmail);
                return false;
            }
            
            // Utiliser la méthode existante avec l'ID
            return checkUserPermission(userId.toString(), permission);
            
        } catch (Exception e) {
            System.err.println("❌ PermissionService.checkUserPermissionByEmail() - Erreur lors de la vérification de la permission: " + e.getMessage());
            return false;
        }
    }
}
