package com.clenzy.service;

import com.clenzy.dto.RolePermissionsDto;
import com.clenzy.model.User;
import com.clenzy.model.RolePermission;
import com.clenzy.model.Role;
import com.clenzy.model.Permission;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.RolePermissionRepository;
import com.clenzy.repository.RoleRepository;
import com.clenzy.repository.PermissionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import com.clenzy.model.UserRole;

@Service
public class PermissionService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private RolePermissionRepository rolePermissionRepository;
    
    @Autowired
    private RoleRepository roleRepository;
    
    @Autowired
    private PermissionRepository permissionRepository;

    private static final String ROLE_PERMISSIONS_KEY = "role:permissions:";
    private static final String USER_PERMISSIONS_KEY = "user:permissions:";
    private static final String ROLES_KEY = "roles:all";
    private static final int CACHE_TTL_HOURS = 0; // 0 = Pas d'expiration (cache permanent)

    // Permissions par défaut (hardcodées pour l'instant)
    // Toutes les permissions viennent de la base de données

    public PermissionService() {
        System.out.println("🚀🚀🚀 NOUVEAU PermissionService Redis initialisé - Base de données = Source de vérité unique 🚀🚀🚀");
        System.out.println("🔧 Ce service utilise Redis pour le cache des permissions");
        System.out.println("📋 Toutes les permissions viennent de la base de données");
    }

    public List<String> getAllRoles() {
        String key = ROLES_KEY;
        List<String> roles = (List<String>) redisTemplate.opsForValue().get(key);

        if (roles == null) {
            // Récupérer les rôles depuis la base de données
            roles = getRolesFromDatabase();
            redisTemplate.opsForValue().set(key, roles);
            System.out.println("📋 PermissionService.getAllRoles() - Récupération depuis la base de données et mise en cache");
        } else {
            System.out.println("📋 PermissionService.getAllRoles() - Récupération depuis le cache Redis");
        }

        return roles;
    }

    public RolePermissionsDto getRolePermissions(String role) {
        String key = ROLE_PERMISSIONS_KEY + role;
        List<String> permissions = (List<String>) redisTemplate.opsForValue().get(key);

        if (permissions == null || permissions.isEmpty()) {
            // Première fois : récupération depuis la base de données
            permissions = getPermissionsFromDatabase(role);
            if (permissions != null && !permissions.isEmpty()) {
                // Cache permanent (pas d'expiration) - Forcer l'utilisation de set() simple
                redisTemplate.opsForValue().set(key, permissions);
                System.out.println("🔍 PermissionService.getRolePermissions() - Récupération pour le rôle: " + role + " depuis la base de données et mise en cache permanent");
            } else {
                System.out.println("⚠️ PermissionService.getRolePermissions() - Aucune permission trouvée en base pour le rôle: " + role);
            }
        } else {
            System.out.println("🚀 PermissionService.getRolePermissions() - Récupération pour le rôle: " + role + " depuis le cache Redis (ultra-rapide)");
        }

        boolean isDefault = !hasCustomPermissions(role);
        return new RolePermissionsDto(role, permissions, isDefault);
    }

    public RolePermissionsDto updateRolePermissions(String role, List<String> permissions) {
        validatePermissions(permissions);
        savePermissionsToDatabase(role, permissions);
        String key = ROLE_PERMISSIONS_KEY + role;
        
        // Cache permanent (pas d'expiration) - Forcer l'utilisation de set() simple
        redisTemplate.opsForValue().set(key, permissions);
        
        invalidateUserPermissionsCache(role);
        System.out.println("💾 PermissionService.updateRolePermissions() - Mise à jour des permissions pour le rôle: " + role);
        return new RolePermissionsDto(role, permissions, false);
    }

    public RolePermissionsDto resetToDefaultPermissions(String role) {
        // TODO: Implémenter la récupération des permissions par défaut depuis la base de données
        List<String> defaultPerms = new ArrayList<>();
        removeCustomPermissionsFromDatabase(role);
        
        // 🚀 INVALIDATION AUTOMATIQUE : Supprimer le cache Redis pour forcer la relecture
        String key = ROLE_PERMISSIONS_KEY + role;
        redisTemplate.delete(key);
        
        invalidateUserPermissionsCache(role);
        System.out.println("🔄 PermissionService.resetToDefaultPermissions() - Reset des permissions pour le rôle: " + role);
        System.out.println("🔄 Cache Redis invalidé automatiquement pour forcer la relecture depuis la base");
        return new RolePermissionsDto(role, defaultPerms, true);
    }

    public boolean checkUserPermission(String userId, String permission) {
        System.out.println("🚀🚀🚀 NOUVEAU PermissionService.checkUserPermission() appelé pour l'utilisateur: " + userId + ", permission: " + permission);

        try {
            // 1. Récupérer l'utilisateur pour obtenir son rôle
            Optional<User> userOpt = userRepository.findByKeycloakId(userId);
            
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                UserRole userRole = user.getRole();
                
                System.out.println("🔍 PermissionService.checkUserPermission() - Utilisateur trouvé: " + user.getEmail() + " avec rôle: " + userRole.name());
                
                // 2. Récupérer les permissions du rôle depuis Redis
                String roleKey = ROLE_PERMISSIONS_KEY + userRole.name();
                List<String> rolePermissions = (List<String>) redisTemplate.opsForValue().get(roleKey);
                
                if (rolePermissions != null && !rolePermissions.isEmpty()) {
                    System.out.println("✅ PermissionService.checkUserPermission() - Permissions trouvées dans Redis pour le rôle: " + userRole.name());
                    boolean hasPermission = rolePermissions.contains(permission);
                    System.out.println("✅ PermissionService.checkUserPermission() - Utilisateur " + userId + " " + (hasPermission ? "A" : "N'A PAS") + " la permission: " + permission);
                    return hasPermission;
                } else {
                    System.out.println("⚠️ PermissionService.checkUserPermission() - Aucune permission trouvée en Redis pour le rôle: " + userRole.name());
                    return false;
                }
            } else {
                System.out.println("⚠️ PermissionService.checkUserPermission() - Utilisateur non trouvé avec keycloakId: " + userId);
                return false;
            }
        } catch (Exception e) {
            System.out.println("❌ PermissionService.checkUserPermission() - Erreur lors de la vérification: " + e.getMessage());
            return false;
        }
    }

    public void invalidateCache(String role) {
        String key = ROLE_PERMISSIONS_KEY + role;
        redisTemplate.delete(key);
        invalidateUserPermissionsCache(role);
        System.out.println("🔄 PermissionService.invalidateCache() - Invalidation du cache pour le rôle: " + role);
    }

    public void invalidateAllCache() {
        Set<String> keys = redisTemplate.keys(ROLE_PERMISSIONS_KEY + "*");
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
        Set<String> userKeys = redisTemplate.keys(USER_PERMISSIONS_KEY + "*");
        if (userKeys != null && !userKeys.isEmpty()) {
            redisTemplate.delete(userKeys);
        }
        redisTemplate.delete(ROLES_KEY);
        System.out.println("🔄 PermissionService.invalidateAllCache() - Invalidation de tout le cache Redis");
    }

    // Méthodes pour récupérer les permissions depuis la base de données
    private List<String> getRolesFromDatabase() {
        try {
            System.out.println("💾 PermissionService.getRolesFromDatabase() - Récupération des rôles depuis la base de données");
            
            List<Role> roles = roleRepository.findAll();
            List<String> roleNames = roles.stream()
                .map(role -> role.getName())
                .collect(Collectors.toList());
            
            System.out.println("✅ PermissionService.getRolesFromDatabase() - " + roleNames.size() + " rôles trouvés: " + roleNames);
            return roleNames;
        } catch (Exception e) {
            System.out.println("❌ PermissionService.getRolesFromDatabase() - Erreur lors de la récupération: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private List<String> getPermissionsFromDatabase(String role) {
        try {
            System.out.println("💾 PermissionService.getPermissionsFromDatabase() - Récupération depuis la base pour le rôle: " + role);
            
            // Récupération des vraies permissions depuis la base de données
            List<String> permissions = rolePermissionRepository.findActivePermissionsByRoleName(role);
            
            if (permissions != null && !permissions.isEmpty()) {
                System.out.println("✅ PermissionService.getPermissionsFromDatabase() - " + permissions.size() + " permissions trouvées pour le rôle: " + role);
                return permissions;
            } else {
                System.out.println("⚠️ PermissionService.getPermissionsFromDatabase() - Aucune permission trouvée en base pour le rôle: " + role);
                System.out.println("💡 L'utilisateur doit configurer les permissions via le menu 'Roles & Permissions'");
                return new ArrayList<>();
            }
        } catch (Exception e) {
            System.out.println("❌ PermissionService.getPermissionsFromDatabase() - Erreur lors de la récupération: " + e.getMessage());
            return new ArrayList<>();
        }
    }
    


    private void savePermissionsToDatabase(String role, List<String> permissions) {
        try {
            System.out.println("💾 PermissionService.savePermissionsToDatabase() - Sauvegarde pour le rôle: " + role + ": " + permissions);
            
            // 1. Récupérer l'objet Role
            Optional<Role> roleOpt = roleRepository.findByName(role);
            if (!roleOpt.isPresent()) {
                System.out.println("❌ PermissionService.savePermissionsToDatabase() - Rôle non trouvé: " + role);
                return;
            }
            Role roleObj = roleOpt.get();
            
            // 2. Récupérer les objets Permission
            List<Permission> permissionObjs = permissionRepository.findByNameIn(permissions);
            System.out.println("🔍 PermissionService.savePermissionsToDatabase() - Permissions demandées: " + permissions);
            System.out.println("🔍 PermissionService.savePermissionsToDatabase() - Permissions trouvées en base: " + permissionObjs.size() + "/" + permissions.size());
            
            if (permissionObjs.size() != permissions.size()) {
                System.out.println("⚠️ PermissionService.savePermissionsToDatabase() - Certaines permissions non trouvées en base");
                System.out.println("🔍 Permissions manquantes: " + permissions.stream()
                    .filter(p -> permissionObjs.stream().noneMatch(po -> po.getName().equals(p)))
                    .collect(Collectors.toList()));
                return;
            }
            
            // 3. Supprimer les anciennes permissions du rôle
            rolePermissionRepository.deleteByRoleName(role);
            
            // 4. Sauvegarder les nouvelles permissions
            for (Permission permission : permissionObjs) {
                RolePermission rolePermission = new RolePermission(roleObj, permission);
                rolePermission.setIsActive(true);
                rolePermission.setIsDefault(false); // Permissions modifiées par l'utilisateur
                rolePermissionRepository.save(rolePermission);
            }
            
            // 🚀 INVALIDATION AUTOMATIQUE : Supprimer le cache Redis pour forcer la relecture
            String key = ROLE_PERMISSIONS_KEY + role;
            redisTemplate.delete(key);
            
            System.out.println("🔄 PermissionService.savePermissionsToDatabase() - Cache Redis invalidé automatiquement pour le rôle: " + role);
            System.out.println("✅ PermissionService.savePermissionsToDatabase() - " + permissions.size() + " permissions sauvegardées en base pour le rôle: " + role);
            System.out.println("💡 Le prochain appel récupérera automatiquement depuis la base et remettra en cache");
        } catch (Exception e) {
            System.out.println("❌ PermissionService.savePermissionsToDatabase() - Erreur lors de la sauvegarde: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void removeCustomPermissionsFromDatabase(String role) {
        // TODO: Implémenter la suppression des permissions personnalisées
        System.out.println("🗑️ TODO: Suppression des permissions personnalisées pour le rôle: " + role);
    }

    private List<String> getUserPermissionsFromDatabase(String userId) {
        try {
            // Récupérer l'utilisateur par son keycloakId
            Optional<User> userOpt = userRepository.findByKeycloakId(userId);
            
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                UserRole userRole = user.getRole();
                
                System.out.println("🔍 PermissionService.getUserPermissionsFromDatabase() - Utilisateur trouvé: " + user.getEmail() + " avec rôle: " + userRole.getDisplayName() + " (" + userRole.name() + ")");
                
                // Récupérer les permissions depuis la base de données uniquement
                List<String> rolePermissions = getPermissionsFromDatabase(userRole.name());
                
                if (rolePermissions != null && !rolePermissions.isEmpty()) {
                    System.out.println("✅ PermissionService.getUserPermissionsFromDatabase() - Permissions trouvées en base pour le rôle " + userRole.name() + ": " + rolePermissions.size() + " permissions");
                    return rolePermissions;
                } else {
                    System.out.println("⚠️ PermissionService.getUserPermissionsFromDatabase() - Aucune permission trouvée en base pour le rôle: " + userRole.name());
                    return new ArrayList<>();
                }
            } else {
                System.out.println("⚠️ PermissionService.getUserPermissionsFromDatabase() - Utilisateur non trouvé avec keycloakId: " + userId);
                return new ArrayList<>();
            }
        } catch (Exception e) {
            System.out.println("❌ PermissionService.getUserPermissionsFromDatabase() - Erreur lors de la récupération: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private boolean hasCustomPermissions(String role) {
        // TODO: Implémenter la vérification des permissions personnalisées
        System.out.println("🔍 TODO: Vérification des permissions personnalisées pour le rôle: " + role);
        return false;
    }

    private void validatePermissions(List<String> permissions) {
        // TODO: Implémenter la validation des permissions depuis la base de données
        // Pour l'instant, on accepte toutes les permissions
        System.out.println("🔍 PermissionService.validatePermissions() - Validation des permissions: " + permissions);
    }

    // Méthode supprimée car remplacée par la version publique

    // Méthodes supplémentaires pour la compatibilité avec les contrôleurs existants
    public List<String> getUserPermissions(String role) {
        System.out.println("🔍 PermissionService.getUserPermissions() - Récupération des permissions pour le rôle: " + role);
        return getRolePermissions(role).getPermissions();
    }

    public Map<String, List<String>> getDefaultPermissions() {
        System.out.println("📋 PermissionService.getDefaultPermissions() - Récupération des permissions depuis la base de données");
        // TODO: Implémenter la récupération depuis la base de données
        return new HashMap<>();
    }

    public boolean saveRolePermissions(String role) {
        System.out.println("💾 PermissionService.saveRolePermissions() - Sauvegarde des permissions pour le rôle: " + role);
        // TODO: Implémenter la sauvegarde en base de données
        return true;
    }

    public RolePermissionsDto resetToInitialPermissions(String role) {
        System.out.println("🔄 PermissionService.resetToInitialPermissions() - Reset des permissions pour le rôle: " + role);
        return resetToDefaultPermissions(role);
    }

    /**
     * Méthode publique pour récupérer les permissions d'un utilisateur pour la synchronisation
     */
    public List<String> getUserPermissionsForSync(String userId) {
        System.out.println("🔄 PermissionService.getUserPermissionsForSync() - Synchronisation des permissions pour l'utilisateur: " + userId);
        
        // 1. Essayer de récupérer les permissions spécifiques de l'utilisateur depuis Redis
        List<String> permissions = getUserPermissionsFromRedis(userId);
        
        // 2. Si pas trouvé, récupérer les permissions du rôle depuis Redis
        if (permissions == null || permissions.isEmpty()) {
            System.out.println("🔍 PermissionService.getUserPermissionsForSync() - Aucune permission spécifique trouvée, récupération du rôle");
            
            // Récupérer l'utilisateur pour connaître son rôle
            Optional<User> userOpt = userRepository.findByKeycloakId(userId);
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                UserRole userRole = user.getRole();
                
                // Récupérer les permissions du rôle depuis Redis
                permissions = getRolePermissionsFromRedis(userRole.name());
                
                if (permissions != null && !permissions.isEmpty()) {
                    System.out.println("✅ PermissionService.getUserPermissionsForSync() - Permissions du rôle " + userRole.name() + " récupérées depuis Redis: " + permissions.size() + " permissions");
                    
                    // Mettre les permissions du rôle dans Redis pour l'utilisateur
                    updateUserPermissionsInRedis(userId, permissions);
                } else {
                    System.out.println("⚠️ PermissionService.getUserPermissionsForSync() - Aucune permission trouvée pour le rôle " + userRole.name() + " dans Redis");
                }
            } else {
                System.out.println("⚠️ PermissionService.getUserPermissionsForSync() - Utilisateur non trouvé avec keycloakId: " + userId);
            }
        } else {
            System.out.println("✅ PermissionService.getUserPermissionsForSync() - Permissions spécifiques trouvées dans Redis pour l'utilisateur: " + userId);
        }
        
        return permissions != null ? permissions : new ArrayList<>();
    }

    /**
     * Récupère les permissions d'un utilisateur depuis Redis
     */
    public List<String> getUserPermissionsFromRedis(String userId) {
        try {
            String key = USER_PERMISSIONS_KEY + userId;
            List<String> permissions = (List<String>) redisTemplate.opsForValue().get(key);
            
            if (permissions != null) {
                System.out.println("✅ PermissionService.getUserPermissionsFromRedis() - Permissions trouvées dans Redis pour l'utilisateur: " + userId);
                return permissions;
            } else {
                System.out.println("⚠️ PermissionService.getUserPermissionsFromRedis() - Aucune permission trouvée dans Redis pour l'utilisateur: " + userId);
                return new ArrayList<>();
            }
        } catch (Exception e) {
            System.out.println("❌ PermissionService.getUserPermissionsFromRedis() - Erreur lors de la récupération depuis Redis: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * Récupère les permissions d'un rôle depuis Redis
     */
    public List<String> getRolePermissionsFromRedis(String role) {
        try {
            String key = ROLE_PERMISSIONS_KEY + role;
            List<String> permissions = (List<String>) redisTemplate.opsForValue().get(key);
            
            if (permissions != null) {
                System.out.println("✅ PermissionService.getRolePermissionsFromRedis() - Permissions trouvées dans Redis pour le rôle: " + role);
                return permissions;
            } else {
                System.out.println("⚠️ PermissionService.getRolePermissionsFromRedis() - Aucune permission trouvée dans Redis pour le rôle: " + role);
                return new ArrayList<>();
            }
        } catch (Exception e) {
            System.out.println("❌ PermissionService.getRolePermissionsFromRedis() - Erreur lors de la récupération depuis Redis: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * Met à jour les permissions d'un utilisateur dans Redis
     */
    public boolean updateUserPermissionsInRedis(String userId, List<String> permissions) {
        try {
            String key = USER_PERMISSIONS_KEY + userId;
            redisTemplate.opsForValue().set(key, permissions);
            
            System.out.println("✅ PermissionService.updateUserPermissionsInRedis() - Permissions mises à jour dans Redis pour l'utilisateur: " + userId);
            return true;
        } catch (Exception e) {
            System.out.println("❌ PermissionService.updateUserPermissionsInRedis() - Erreur lors de la mise à jour dans Redis: " + e.getMessage());
            return false;
        }
    }

    /**
     * Invalide le cache des permissions d'un utilisateur
     */
    public void invalidateUserPermissionsCache(String userId) {
        try {
            String key = USER_PERMISSIONS_KEY + userId;
            redisTemplate.delete(key);
            
            System.out.println("🔄 PermissionService.invalidateUserPermissionsCache() - Cache invalidé pour l'utilisateur: " + userId);
        } catch (Exception e) {
            System.out.println("❌ PermissionService.invalidateUserPermissionsCache() - Erreur lors de l'invalidation: " + e.getMessage());
        }
    }
}
