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
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.Arrays;
import com.clenzy.model.UserRole;
import com.clenzy.model.NotificationKey;

@Service
public class PermissionService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired(required = false)
    private NotificationService notificationService;
    
    @Autowired
    private RolePermissionRepository rolePermissionRepository;
    
    @Autowired
    private RoleRepository roleRepository;
    
    @Autowired
    private PermissionRepository permissionRepository;
    
    @PersistenceContext
    private EntityManager entityManager;

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

    @Cacheable(value = "roles", key = "'all'")
    public List<String> getAllRoles() {
        System.out.println("📋 PermissionService.getAllRoles() - Récupération depuis la base de données et mise en cache");
        return getRolesFromDatabase();
    }

    @Cacheable(value = "permissions", key = "#role")
    public RolePermissionsDto getRolePermissions(String role) {
        System.out.println("🔍 PermissionService.getRolePermissions() - Récupération pour le rôle: " + role + " depuis la base de données et mise en cache");
        List<String> permissions = getPermissionsFromDatabase(role);
        
        // Mettre aussi en cache dans Redis pour les autres méthodes
        if (permissions != null && !permissions.isEmpty()) {
            String key = ROLE_PERMISSIONS_KEY + role;
            redisTemplate.opsForValue().set(key, permissions);
            System.out.println("✅ PermissionService.getRolePermissions() - Permissions mises en cache Redis pour le rôle: " + role);
        } else {
            System.out.println("⚠️ PermissionService.getRolePermissions() - Aucune permission trouvée pour le rôle: " + role);
            System.out.println("💡 Les permissions doivent être configurées via le menu 'Roles & Permissions'");
        }
        
        boolean isDefault = !hasCustomPermissions(role);
        List<String> finalPermissions = permissions != null ? permissions : new ArrayList<>();
        RolePermissionsDto dto = new RolePermissionsDto(role, finalPermissions, isDefault);
        System.out.println("📊 PermissionService.getRolePermissions() - DTO créé avec " + finalPermissions.size() + " permissions pour le rôle: " + role);
        return dto;
    }
    
    /**
     * Méthode pour récupérer les permissions sans utiliser le cache Spring
     * Utilisée après la sauvegarde pour forcer la relecture depuis la base
     */
    public RolePermissionsDto getRolePermissionsWithoutCache(String role) {
        System.out.println("🔍 PermissionService.getRolePermissionsWithoutCache() - Récupération SANS CACHE pour le rôle: " + role);
        List<String> permissions = getPermissionsFromDatabase(role);
        boolean isDefault = !hasCustomPermissions(role);
        RolePermissionsDto dto = new RolePermissionsDto(role, permissions, isDefault);
        System.out.println("📊 PermissionService.getRolePermissionsWithoutCache() - DTO créé avec " + permissions.size() + " permissions pour le rôle: " + role);
        return dto;
    }

    @CacheEvict(value = "permissions", allEntries = true)
    @Transactional
    public RolePermissionsDto updateRolePermissions(String role, List<String> permissions) {
        validatePermissions(permissions);
        savePermissionsToDatabase(role, permissions);
        
        // Invalider le cache Redis pour forcer la relecture depuis la base
        invalidateCache(role);
        
        // Invalider le cache de tous les utilisateurs ayant ce rôle
        try {
            UserRole userRole = UserRole.valueOf(role);
            List<User> usersWithRole = userRepository.findByRoleIn(Arrays.asList(userRole));
            for (User user : usersWithRole) {
                if (user.getKeycloakId() != null) {
                    invalidateUserPermissionsCache(user.getKeycloakId());
                }
            }
            System.out.println("🔄 PermissionService.updateRolePermissions() - Cache invalidé pour " + usersWithRole.size() + " utilisateurs avec le rôle " + role);
        } catch (Exception e) {
            System.out.println("⚠️ PermissionService.updateRolePermissions() - Erreur lors de l'invalidation du cache utilisateur: " + e.getMessage());
        }
        
        // Recharger les permissions depuis la base de données pour retourner les vraies valeurs persistées
        // Utiliser getRolePermissionsWithoutCache pour éviter le cache Spring
        RolePermissionsDto savedRolePermissions = getRolePermissionsWithoutCache(role);
        
        System.out.println("💾 PermissionService.updateRolePermissions() - Mise à jour des permissions pour le rôle: " + role);
        System.out.println("✅ PermissionService.updateRolePermissions() - Permissions sauvegardées et rechargées: " + savedRolePermissions.getPermissions().size() + " permissions");
        System.out.println("📋 Permissions retournées: " + String.join(", ", savedRolePermissions.getPermissions()));

        try {
            if (notificationService != null) {
                notificationService.notifyAdminsAndManagers(
                    NotificationKey.PERMISSION_ROLE_UPDATED,
                    "Permissions modifiees",
                    "Les permissions du role " + role + " ont ete mises a jour (" + savedRolePermissions.getPermissions().size() + " permissions)",
                    "/permissions"
                );
            }
        } catch (Exception e) {
            System.err.println("Erreur notification PERMISSION_ROLE_UPDATED: " + e.getMessage());
        }

        return savedRolePermissions;
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
        System.out.println("🔄 PermissionService.invalidateCache() - Cache Redis invalidé pour le rôle: " + role);
        
        // Invalider le cache de tous les utilisateurs ayant ce rôle
        try {
            UserRole userRole = UserRole.valueOf(role);
            List<User> usersWithRole = userRepository.findByRoleIn(Arrays.asList(userRole));
            for (User user : usersWithRole) {
                if (user.getKeycloakId() != null) {
                    invalidateUserPermissionsCache(user.getKeycloakId());
                }
            }
            System.out.println("🔄 PermissionService.invalidateCache() - Cache invalidé pour " + usersWithRole.size() + " utilisateurs avec le rôle " + role);
        } catch (Exception e) {
            System.out.println("⚠️ PermissionService.invalidateCache() - Erreur lors de l'invalidation du cache utilisateur: " + e.getMessage());
        }
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
            // Note: On utilise une requête directe pour éviter le cache Hibernate
            List<String> permissions = rolePermissionRepository.findActivePermissionsByRoleName(role);
            
            System.out.println("🔍 PermissionService.getPermissionsFromDatabase() - Permissions récupérées: " + permissions);
            
            if (permissions != null && !permissions.isEmpty()) {
                System.out.println("✅ PermissionService.getPermissionsFromDatabase() - " + permissions.size() + " permissions trouvées pour le rôle: " + role);
                System.out.println("📋 Liste complète: " + String.join(", ", permissions));
                return permissions;
            } else {
                System.out.println("⚠️ PermissionService.getPermissionsFromDatabase() - Aucune permission trouvée en base pour le rôle: " + role);
                System.out.println("💡 L'utilisateur doit configurer les permissions via le menu 'Roles & Permissions'");
                return new ArrayList<>();
            }
        } catch (Exception e) {
            System.out.println("❌ PermissionService.getPermissionsFromDatabase() - Erreur lors de la récupération: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }
    


    @Transactional
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
            
            // 2. Récupérer les objets Permission et créer celles qui manquent
            List<Permission> permissionObjs = permissionRepository.findByNameIn(permissions);
            System.out.println("🔍 PermissionService.savePermissionsToDatabase() - Permissions demandées: " + permissions);
            System.out.println("🔍 PermissionService.savePermissionsToDatabase() - Permissions trouvées en base: " + permissionObjs.size() + "/" + permissions.size());
            
            // Créer les permissions manquantes automatiquement
            List<String> existingPermissionNames = permissionObjs.stream()
                .map(Permission::getName)
                .collect(Collectors.toList());
            
            List<String> missingPermissions = permissions.stream()
                .filter(p -> !existingPermissionNames.contains(p))
                .collect(Collectors.toList());
            
            if (!missingPermissions.isEmpty()) {
                System.out.println("⚠️ PermissionService.savePermissionsToDatabase() - Certaines permissions non trouvées en base, création automatique");
                System.out.println("🔍 Permissions manquantes: " + missingPermissions);
                
                for (String permissionName : missingPermissions) {
                    // Extraire le module depuis le nom de la permission (ex: "contact:view" -> "contact")
                    String module = permissionName.split(":")[0];
                    String description = "Permission " + permissionName + " (créée automatiquement)";
                    
                    Permission newPermission = new Permission(permissionName, description, module);
                    Permission savedPermission = permissionRepository.save(newPermission);
                    permissionObjs.add(savedPermission);
                    
                    System.out.println("✅ PermissionService.savePermissionsToDatabase() - Permission créée: " + permissionName + " (module: " + module + ")");
                }
            }
            
            // 3. Supprimer les anciennes permissions du rôle
            System.out.println("🗑️ PermissionService.savePermissionsToDatabase() - Suppression des anciennes permissions pour le rôle: " + role);
            rolePermissionRepository.deleteByRoleName(role);
            
            // Forcer le flush pour s'assurer que la suppression est bien effectuée
            entityManager.flush();
            entityManager.clear(); // Nettoyer le contexte de persistance pour forcer la relecture
            
            // 4. Sauvegarder les nouvelles permissions
            System.out.println("💾 PermissionService.savePermissionsToDatabase() - Sauvegarde de " + permissionObjs.size() + " permissions pour le rôle: " + role);
            List<String> savedPermissionNames = new ArrayList<>();
            for (Permission permission : permissionObjs) {
                RolePermission rolePermission = new RolePermission(roleObj, permission);
                rolePermission.setIsActive(true);
                rolePermission.setIsDefault(false); // Permissions modifiées par l'utilisateur
                RolePermission saved = rolePermissionRepository.save(rolePermission);
                savedPermissionNames.add(permission.getName());
                System.out.println("  ✅ Permission sauvegardée: " + permission.getName() + " (isActive=" + saved.getIsActive() + ")");
            }
            
            // Forcer le flush pour s'assurer que toutes les sauvegardes sont bien effectuées
            entityManager.flush();
            
            // 🚀 INVALIDATION AUTOMATIQUE : Supprimer le cache Redis pour forcer la relecture
            String key = ROLE_PERMISSIONS_KEY + role;
            redisTemplate.delete(key);
            
            System.out.println("🔄 PermissionService.savePermissionsToDatabase() - Cache Redis invalidé automatiquement pour le rôle: " + role);
            System.out.println("✅ PermissionService.savePermissionsToDatabase() - " + savedPermissionNames.size() + " permissions sauvegardées en base pour le rôle: " + role);
            System.out.println("📋 Permissions sauvegardées: " + String.join(", ", savedPermissionNames));
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
    
    /**
     * Récupère toutes les permissions disponibles depuis la base de données
     */
    public List<String> getAllAvailablePermissions() {
        try {
            System.out.println("📋 PermissionService.getAllAvailablePermissions() - Récupération de toutes les permissions depuis la base de données");
            List<Permission> permissions = permissionRepository.findAll();
            List<String> permissionNames = permissions.stream()
                .map(Permission::getName)
                .sorted()
                .collect(Collectors.toList());
            
            System.out.println("✅ PermissionService.getAllAvailablePermissions() - " + permissionNames.size() + " permissions trouvées");
            return permissionNames;
        } catch (Exception e) {
            System.out.println("❌ PermissionService.getAllAvailablePermissions() - Erreur lors de la récupération: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    public boolean saveRolePermissions(String role) {
        System.out.println("💾 PermissionService.saveRolePermissions() - Sauvegarde des permissions pour le rôle: " + role);
        
        // Invalider le cache du rôle pour forcer la relecture depuis la base de données
        invalidateCache(role);
        
        // Invalider le cache de tous les utilisateurs ayant ce rôle
        try {
            UserRole userRole = UserRole.valueOf(role);
            List<User> usersWithRole = userRepository.findByRoleIn(Arrays.asList(userRole));
            for (User user : usersWithRole) {
                if (user.getKeycloakId() != null) {
                    invalidateUserPermissionsCache(user.getKeycloakId());
                }
            }
            System.out.println("🔄 PermissionService.saveRolePermissions() - Cache invalidé pour " + usersWithRole.size() + " utilisateurs avec le rôle " + role);
        } catch (Exception e) {
            System.out.println("⚠️ PermissionService.saveRolePermissions() - Erreur lors de l'invalidation du cache utilisateur: " + e.getMessage());
        }
        
        // Recharger les permissions depuis la base pour s'assurer qu'elles sont à jour
        getRolePermissions(role);
        
        System.out.println("✅ PermissionService.saveRolePermissions() - Cache invalidé et permissions rechargées pour le rôle: " + role);
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
        
        // Toujours invalider le cache utilisateur pour forcer la relecture depuis le rôle
        invalidateUserPermissionsCache(userId);
        
        // Récupérer l'utilisateur pour connaître son rôle
        Optional<User> userOpt = userRepository.findByKeycloakId(userId);
        if (!userOpt.isPresent()) {
            System.out.println("⚠️ PermissionService.getUserPermissionsForSync() - Utilisateur non trouvé avec keycloakId: " + userId);
            return new ArrayList<>();
        }
        
        User user = userOpt.get();
        UserRole userRole = user.getRole();
        System.out.println("🔍 PermissionService.getUserPermissionsForSync() - Utilisateur trouvé avec rôle: " + userRole.name());
        
        // Toujours charger depuis la base de données pour avoir les dernières permissions
        // (ignorer le cache Redis pour être sûr d'avoir les données à jour)
        List<String> permissions = getPermissionsFromDatabase(userRole.name());
        
        if (permissions != null && !permissions.isEmpty()) {
            System.out.println("✅ PermissionService.getUserPermissionsForSync() - " + permissions.size() + " permissions récupérées pour le rôle " + userRole.name());
            System.out.println("📋 Permissions: " + String.join(", ", permissions));
            
            // Mettre en cache dans Redis pour l'utilisateur ET pour le rôle
            updateUserPermissionsInRedis(userId, permissions);
            String roleKey = ROLE_PERMISSIONS_KEY + userRole.name();
            redisTemplate.opsForValue().set(roleKey, permissions);
            System.out.println("✅ PermissionService.getUserPermissionsForSync() - Permissions mises en cache Redis pour l'utilisateur et le rôle");
            
            return permissions;
        } else {
            System.out.println("⚠️ PermissionService.getUserPermissionsForSync() - Aucune permission trouvée pour le rôle " + userRole.name());
            System.out.println("💡 Les permissions doivent être configurées via le menu 'Roles & Permissions'");
            return new ArrayList<>();
        }
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
     * Si Redis est vide, charge depuis la base de données et met en cache
     */
    public List<String> getRolePermissionsFromRedis(String role) {
        try {
            String key = ROLE_PERMISSIONS_KEY + role;
            List<String> permissions = (List<String>) redisTemplate.opsForValue().get(key);
            
            if (permissions != null && !permissions.isEmpty()) {
                System.out.println("✅ PermissionService.getRolePermissionsFromRedis() - Permissions trouvées dans Redis pour le rôle: " + role + " (" + permissions.size() + " permissions)");
                System.out.println("📋 Permissions Redis: " + String.join(", ", permissions));
                return permissions;
            } else {
                System.out.println("⚠️ PermissionService.getRolePermissionsFromRedis() - Aucune permission trouvée dans Redis pour le rôle: " + role);
                System.out.println("🔄 PermissionService.getRolePermissionsFromRedis() - Chargement depuis la base de données...");
                
                // Charger depuis la base de données (forcer la relecture)
                List<String> dbPermissions = getPermissionsFromDatabase(role);
                
                if (dbPermissions != null && !dbPermissions.isEmpty()) {
                    // Mettre en cache dans Redis
                    redisTemplate.opsForValue().set(key, dbPermissions);
                    System.out.println("✅ PermissionService.getRolePermissionsFromRedis() - " + dbPermissions.size() + " permissions chargées depuis la base et mises en cache pour le rôle: " + role);
                    System.out.println("📋 Permissions chargées: " + String.join(", ", dbPermissions));
                    return dbPermissions;
                } else {
                    System.out.println("⚠️ PermissionService.getRolePermissionsFromRedis() - Aucune permission trouvée en base pour le rôle: " + role);
                    System.out.println("💡 Vérifiez que les permissions sont bien sauvegardées dans la table role_permissions avec isActive=true");
                    return new ArrayList<>();
                }
            }
        } catch (Exception e) {
            System.out.println("❌ PermissionService.getRolePermissionsFromRedis() - Erreur lors de la récupération depuis Redis: " + e.getMessage());
            e.printStackTrace();
            // En cas d'erreur Redis, essayer de charger depuis la base
            try {
                System.out.println("🔄 PermissionService.getRolePermissionsFromRedis() - Tentative de chargement depuis la base de données...");
                List<String> dbPermissions = getPermissionsFromDatabase(role);
                System.out.println("📋 Permissions chargées depuis la base (après erreur Redis): " + (dbPermissions != null ? dbPermissions.size() : 0) + " permissions");
                return dbPermissions;
            } catch (Exception dbException) {
                System.out.println("❌ PermissionService.getRolePermissionsFromRedis() - Erreur lors du chargement depuis la base: " + dbException.getMessage());
                dbException.printStackTrace();
                return new ArrayList<>();
            }
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
