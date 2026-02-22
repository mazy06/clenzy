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
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
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
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class PermissionService {

    private static final Logger log = LoggerFactory.getLogger(PermissionService.class);

    private final RedisTemplate<String, Object> redisTemplate;
    private final CacheManager cacheManager;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;
    private final RolePermissionRepository rolePermissionRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    @Autowired(required = false)
    private NotificationService notificationService;

    @PersistenceContext
    private EntityManager entityManager;

    private static final String ROLE_PERMISSIONS_KEY = "role:permissions:";
    private static final String USER_PERMISSIONS_KEY = "user:permissions:";
    private static final String ROLES_KEY = "roles:all";
    private static final int CACHE_TTL_HOURS = 0; // 0 = Pas d'expiration (cache permanent)

    public PermissionService(RedisTemplate<String, Object> redisTemplate,
                             CacheManager cacheManager,
                             UserRepository userRepository,
                             TenantContext tenantContext,
                             RolePermissionRepository rolePermissionRepository,
                             RoleRepository roleRepository,
                             PermissionRepository permissionRepository) {
        this.redisTemplate = redisTemplate;
        this.cacheManager = cacheManager;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
        this.rolePermissionRepository = rolePermissionRepository;
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        log.debug("PermissionService Redis initialise - Base de donnees = Source de verite unique");
        log.debug("Ce service utilise Redis pour le cache des permissions");
        log.debug("Toutes les permissions viennent de la base de donnees");
    }

    @Cacheable(value = "roles", key = "'all'")
    public List<String> getAllRoles() {
        log.debug("PermissionService.getAllRoles() - Recuperation depuis la base de donnees et mise en cache");
        return getRolesFromDatabase();
    }

    @Cacheable(value = "permissions", key = "#role")
    public RolePermissionsDto getRolePermissions(String role) {
        return loadRolePermissionsFromDatabase(role);
    }

    /**
     * Charge les permissions d'un role depuis la base de donnees et met a jour le cache Redis.
     * Methode extraite pour etre reutilisable (fallback quand le cache Spring retourne une liste vide).
     */
    private RolePermissionsDto loadRolePermissionsFromDatabase(String role) {
        log.debug("PermissionService.loadRolePermissionsFromDatabase() - Recuperation pour le role: {} depuis la base de donnees", role);
        List<String> permissions = getPermissionsFromDatabase(role);

        // Mettre aussi en cache dans Redis pour les autres méthodes (checkUserPermission, etc.)
        if (permissions != null && !permissions.isEmpty()) {
            String key = ROLE_PERMISSIONS_KEY + role;
            redisTemplate.opsForValue().set(key, permissions);
            log.debug("Permissions mises en cache Redis pour le role: {} ({} permissions)", role, permissions.size());
        } else {
            log.warn("Aucune permission trouvee en base pour le role: {}", role);
        }

        boolean isDefault = !hasCustomPermissions(role);
        List<String> finalPermissions = permissions != null ? permissions : new ArrayList<>();
        return new RolePermissionsDto(role, finalPermissions, isDefault);
    }
    
    /**
     * Méthode pour récupérer les permissions sans utiliser le cache Spring
     * Utilisée après la sauvegarde pour forcer la relecture depuis la base
     */
    public RolePermissionsDto getRolePermissionsWithoutCache(String role) {
        log.debug("PermissionService.getRolePermissionsWithoutCache() - Recuperation SANS CACHE pour le role: {}", role);
        List<String> permissions = getPermissionsFromDatabase(role);
        boolean isDefault = !hasCustomPermissions(role);
        RolePermissionsDto dto = new RolePermissionsDto(role, permissions, isDefault);
        log.debug("PermissionService.getRolePermissionsWithoutCache() - DTO cree avec {} permissions pour le role: {}", permissions.size(), role);
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
            List<User> usersWithRole = userRepository.findByRoleIn(Arrays.asList(userRole), tenantContext.getRequiredOrganizationId());
            for (User user : usersWithRole) {
                if (user.getKeycloakId() != null) {
                    invalidateUserPermissionsCache(user.getKeycloakId());
                }
            }
            log.debug("PermissionService.updateRolePermissions() - Cache invalide pour {} utilisateurs avec le role {}", usersWithRole.size(), role);
        } catch (Exception e) {
            log.warn("PermissionService.updateRolePermissions() - Erreur lors de l'invalidation du cache utilisateur: {}", e.getMessage());
        }
        
        // Recharger les permissions depuis la base de données pour retourner les vraies valeurs persistées
        // Utiliser getRolePermissionsWithoutCache pour éviter le cache Spring
        RolePermissionsDto savedRolePermissions = getRolePermissionsWithoutCache(role);
        
        log.debug("PermissionService.updateRolePermissions() - Mise a jour des permissions pour le role: {}", role);
        log.debug("PermissionService.updateRolePermissions() - Permissions sauvegardees et rechargees: {} permissions", savedRolePermissions.getPermissions().size());
        log.debug("Permissions retournees: {}", String.join(", ", savedRolePermissions.getPermissions()));

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
            log.warn("Erreur notification PERMISSION_ROLE_UPDATED: {}", e.getMessage());
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
        log.debug("PermissionService.resetToDefaultPermissions() - Reset des permissions pour le role: {}", role);
        log.debug("Cache Redis invalide automatiquement pour forcer la relecture depuis la base");
        return new RolePermissionsDto(role, defaultPerms, true);
    }

    public boolean checkUserPermission(String userId, String permission) {
        log.debug("PermissionService.checkUserPermission() appele pour l'utilisateur: {}, permission: {}", userId, permission);

        try {
            // 1. Récupérer l'utilisateur pour obtenir son rôle
            Optional<User> userOpt = userRepository.findByKeycloakId(userId);
            
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                UserRole userRole = user.getRole();
                
                log.debug("PermissionService.checkUserPermission() - Utilisateur trouve: {} avec role: {}", user.getEmail(), userRole.name());
                
                // 2. Récupérer les permissions du rôle depuis Redis
                String roleKey = ROLE_PERMISSIONS_KEY + userRole.name();
                List<String> rolePermissions = (List<String>) redisTemplate.opsForValue().get(roleKey);
                
                if (rolePermissions != null && !rolePermissions.isEmpty()) {
                    log.debug("PermissionService.checkUserPermission() - Permissions trouvees dans Redis pour le role: {}", userRole.name());
                    boolean hasPermission = rolePermissions.contains(permission);
                    log.debug("PermissionService.checkUserPermission() - Utilisateur {} {} la permission: {}", userId, (hasPermission ? "A" : "N'A PAS"), permission);
                    return hasPermission;
                } else {
                    log.warn("PermissionService.checkUserPermission() - Aucune permission trouvee en Redis pour le role: {}", userRole.name());
                    return false;
                }
            } else {
                log.warn("PermissionService.checkUserPermission() - Utilisateur non trouve avec keycloakId: {}", userId);
                return false;
            }
        } catch (Exception e) {
            log.error("PermissionService.checkUserPermission() - Erreur lors de la verification: {}", e.getMessage());
            return false;
        }
    }

    public void invalidateCache(String role) {
        String key = ROLE_PERMISSIONS_KEY + role;
        redisTemplate.delete(key);
        log.debug("PermissionService.invalidateCache() - Cache Redis invalide pour le role: {}", role);
        
        // Invalider le cache de tous les utilisateurs ayant ce rôle
        try {
            UserRole userRole = UserRole.valueOf(role);
            List<User> usersWithRole = userRepository.findByRoleIn(Arrays.asList(userRole), tenantContext.getRequiredOrganizationId());
            for (User user : usersWithRole) {
                if (user.getKeycloakId() != null) {
                    invalidateUserPermissionsCache(user.getKeycloakId());
                }
            }
            log.debug("PermissionService.invalidateCache() - Cache invalide pour {} utilisateurs avec le role {}", usersWithRole.size(), role);
        } catch (Exception e) {
            log.warn("PermissionService.invalidateCache() - Erreur lors de l'invalidation du cache utilisateur: {}", e.getMessage());
        }
    }

    public void invalidateAllCache() {
        // 1. Invalider les caches Spring @Cacheable (prefixe clenzy:permissions::, clenzy:roles::)
        try {
            Cache permissionsCache = cacheManager.getCache("permissions");
            if (permissionsCache != null) {
                permissionsCache.clear();
            }
            Cache rolesCache = cacheManager.getCache("roles");
            if (rolesCache != null) {
                rolesCache.clear();
            }
        } catch (Exception e) {
            log.warn("invalidateAllCache() - Erreur vidage cache Spring: {}", e.getMessage());
        }
        // 2. Invalider les cles Redis manuelles (role:permissions:*, user:permissions:*, roles:all)
        Set<String> keys = redisTemplate.keys(ROLE_PERMISSIONS_KEY + "*");
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
        Set<String> userKeys = redisTemplate.keys(USER_PERMISSIONS_KEY + "*");
        if (userKeys != null && !userKeys.isEmpty()) {
            redisTemplate.delete(userKeys);
        }
        redisTemplate.delete(ROLES_KEY);
        log.debug("PermissionService.invalidateAllCache() - Invalidation complete (Spring + Redis manuel)");
    }

    // Méthodes pour récupérer les permissions depuis la base de données
    private List<String> getRolesFromDatabase() {
        try {
            log.debug("PermissionService.getRolesFromDatabase() - Recuperation des roles depuis la base de donnees");
            
            List<Role> roles = roleRepository.findAll();
            List<String> roleNames = roles.stream()
                .map(role -> role.getName())
                .collect(Collectors.toList());
            
            log.debug("PermissionService.getRolesFromDatabase() - {} roles trouves: {}", roleNames.size(), roleNames);
            return roleNames;
        } catch (Exception e) {
            log.error("PermissionService.getRolesFromDatabase() - Erreur lors de la recuperation: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private List<String> getPermissionsFromDatabase(String role) {
        try {
            log.debug("PermissionService.getPermissionsFromDatabase() - Recuperation depuis la base pour le role: {}", role);
            
            // Récupération des vraies permissions depuis la base de données
            // Note: On utilise une requête directe pour éviter le cache Hibernate
            List<String> permissions = rolePermissionRepository.findActivePermissionsByRoleName(role);
            
            log.debug("PermissionService.getPermissionsFromDatabase() - Permissions recuperees: {}", permissions);
            
            if (permissions != null && !permissions.isEmpty()) {
                log.debug("PermissionService.getPermissionsFromDatabase() - {} permissions trouvees pour le role: {}", permissions.size(), role);
                log.debug("Liste complete: {}", String.join(", ", permissions));
                return permissions;
            } else {
                log.warn("PermissionService.getPermissionsFromDatabase() - Aucune permission trouvee en base pour le role: {}", role);
                log.debug("L'utilisateur doit configurer les permissions via le menu 'Roles & Permissions'");
                return new ArrayList<>();
            }
        } catch (Exception e) {
            log.error("PermissionService.getPermissionsFromDatabase() - Erreur lors de la recuperation: {}", e.getMessage(), e);
            return new ArrayList<>();
        }
    }
    


    // Package-private would allow @Transactional, but this is called within the caller's transaction scope
    private void savePermissionsToDatabase(String role, List<String> permissions) {
        try {
            log.debug("PermissionService.savePermissionsToDatabase() - Sauvegarde pour le role: {}: {}", role, permissions);
            
            // 1. Récupérer l'objet Role
            Optional<Role> roleOpt = roleRepository.findByName(role);
            if (!roleOpt.isPresent()) {
                log.error("PermissionService.savePermissionsToDatabase() - Role non trouve: {}", role);
                return;
            }
            Role roleObj = roleOpt.get();
            
            // 2. Récupérer les objets Permission et créer celles qui manquent
            List<Permission> permissionObjs = permissionRepository.findByNameIn(permissions);
            log.debug("PermissionService.savePermissionsToDatabase() - Permissions demandees: {}", permissions);
            log.debug("PermissionService.savePermissionsToDatabase() - Permissions trouvees en base: {}/{}", permissionObjs.size(), permissions.size());
            
            // Créer les permissions manquantes automatiquement
            List<String> existingPermissionNames = permissionObjs.stream()
                .map(Permission::getName)
                .collect(Collectors.toList());
            
            List<String> missingPermissions = permissions.stream()
                .filter(p -> !existingPermissionNames.contains(p))
                .collect(Collectors.toList());
            
            if (!missingPermissions.isEmpty()) {
                log.warn("PermissionService.savePermissionsToDatabase() - Certaines permissions non trouvees en base, creation automatique");
                log.debug("Permissions manquantes: {}", missingPermissions);
                
                for (String permissionName : missingPermissions) {
                    // Extraire le module depuis le nom de la permission (ex: "contact:view" -> "contact")
                    String module = permissionName.split(":")[0];
                    String description = "Permission " + permissionName + " (créée automatiquement)";
                    
                    Permission newPermission = new Permission(permissionName, description, module);
                    Permission savedPermission = permissionRepository.save(newPermission);
                    permissionObjs.add(savedPermission);
                    
                    log.debug("PermissionService.savePermissionsToDatabase() - Permission creee: {} (module: {})", permissionName, module);
                }
            }
            
            // 3. Supprimer les anciennes permissions du rôle
            log.debug("PermissionService.savePermissionsToDatabase() - Suppression des anciennes permissions pour le role: {}", role);
            rolePermissionRepository.deleteByRoleName(role);
            
            // Forcer le flush pour s'assurer que la suppression est bien effectuée
            entityManager.flush();
            entityManager.clear(); // Nettoyer le contexte de persistance pour forcer la relecture
            
            // 4. Sauvegarder les nouvelles permissions
            log.debug("PermissionService.savePermissionsToDatabase() - Sauvegarde de {} permissions pour le role: {}", permissionObjs.size(), role);
            List<String> savedPermissionNames = new ArrayList<>();
            for (Permission permission : permissionObjs) {
                RolePermission rolePermission = new RolePermission(roleObj, permission);
                rolePermission.setIsActive(true);
                rolePermission.setIsDefault(false); // Permissions modifiées par l'utilisateur
                RolePermission saved = rolePermissionRepository.save(rolePermission);
                savedPermissionNames.add(permission.getName());
                log.debug("Permission sauvegardee: {} (isActive={})", permission.getName(), saved.getIsActive());
            }
            
            // Forcer le flush pour s'assurer que toutes les sauvegardes sont bien effectuées
            entityManager.flush();
            
            // 🚀 INVALIDATION AUTOMATIQUE : Supprimer le cache Redis pour forcer la relecture
            String key = ROLE_PERMISSIONS_KEY + role;
            redisTemplate.delete(key);
            
            log.debug("PermissionService.savePermissionsToDatabase() - Cache Redis invalide automatiquement pour le role: {}", role);
            log.debug("PermissionService.savePermissionsToDatabase() - {} permissions sauvegardees en base pour le role: {}", savedPermissionNames.size(), role);
            log.debug("Permissions sauvegardees: {}", String.join(", ", savedPermissionNames));
            log.debug("Le prochain appel recuperera automatiquement depuis la base et remettra en cache");
        } catch (Exception e) {
            log.error("PermissionService.savePermissionsToDatabase() - Erreur lors de la sauvegarde: {}", e.getMessage(), e);
        }
    }

    private void removeCustomPermissionsFromDatabase(String role) {
        // TODO: Implémenter la suppression des permissions personnalisées
        log.debug("TODO: Suppression des permissions personnalisees pour le role: {}", role);
    }

    private List<String> getUserPermissionsFromDatabase(String userId) {
        try {
            // Récupérer l'utilisateur par son keycloakId
            Optional<User> userOpt = userRepository.findByKeycloakId(userId);
            
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                UserRole userRole = user.getRole();
                
                log.debug("PermissionService.getUserPermissionsFromDatabase() - Utilisateur trouve: {} avec role: {} ({})", user.getEmail(), userRole.getDisplayName(), userRole.name());
                
                // Récupérer les permissions depuis la base de données uniquement
                List<String> rolePermissions = getPermissionsFromDatabase(userRole.name());
                
                if (rolePermissions != null && !rolePermissions.isEmpty()) {
                    log.debug("PermissionService.getUserPermissionsFromDatabase() - Permissions trouvees en base pour le role {}: {} permissions", userRole.name(), rolePermissions.size());
                    return rolePermissions;
                } else {
                    log.warn("PermissionService.getUserPermissionsFromDatabase() - Aucune permission trouvee en base pour le role: {}", userRole.name());
                    return new ArrayList<>();
                }
            } else {
                log.warn("PermissionService.getUserPermissionsFromDatabase() - Utilisateur non trouve avec keycloakId: {}", userId);
                return new ArrayList<>();
            }
        } catch (Exception e) {
            log.error("PermissionService.getUserPermissionsFromDatabase() - Erreur lors de la recuperation: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private boolean hasCustomPermissions(String role) {
        // TODO: Implémenter la vérification des permissions personnalisées
        log.debug("TODO: Verification des permissions personnalisees pour le role: {}", role);
        return false;
    }

    private void validatePermissions(List<String> permissions) {
        // TODO: Implémenter la validation des permissions depuis la base de données
        // Pour l'instant, on accepte toutes les permissions
        log.debug("PermissionService.validatePermissions() - Validation des permissions: {}", permissions);
    }

    // Méthode supprimée car remplacée par la version publique

    // Méthodes supplémentaires pour la compatibilité avec les contrôleurs existants
    public List<String> getUserPermissions(String role) {
        log.debug("PermissionService.getUserPermissions() - Recuperation des permissions pour le role: {}", role);
        return getRolePermissions(role).getPermissions();
    }

    public Map<String, List<String>> getDefaultPermissions() {
        log.debug("PermissionService.getDefaultPermissions() - Recuperation des permissions depuis la base de donnees");
        // TODO: Implémenter la récupération depuis la base de données
        return new HashMap<>();
    }
    
    /**
     * Récupère toutes les permissions disponibles depuis la base de données
     */
    public List<String> getAllAvailablePermissions() {
        try {
            log.debug("PermissionService.getAllAvailablePermissions() - Recuperation de toutes les permissions depuis la base de donnees");
            List<Permission> permissions = permissionRepository.findAll();
            List<String> permissionNames = permissions.stream()
                .map(Permission::getName)
                .sorted()
                .collect(Collectors.toList());
            
            log.debug("PermissionService.getAllAvailablePermissions() - {} permissions trouvees", permissionNames.size());
            return permissionNames;
        } catch (Exception e) {
            log.error("PermissionService.getAllAvailablePermissions() - Erreur lors de la recuperation: {}", e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    public boolean saveRolePermissions(String role) {
        log.debug("PermissionService.saveRolePermissions() - Sauvegarde des permissions pour le role: {}", role);
        
        // Invalider le cache du rôle pour forcer la relecture depuis la base de données
        invalidateCache(role);
        
        // Invalider le cache de tous les utilisateurs ayant ce rôle
        try {
            UserRole userRole = UserRole.valueOf(role);
            List<User> usersWithRole = userRepository.findByRoleIn(Arrays.asList(userRole), tenantContext.getRequiredOrganizationId());
            for (User user : usersWithRole) {
                if (user.getKeycloakId() != null) {
                    invalidateUserPermissionsCache(user.getKeycloakId());
                }
            }
            log.debug("PermissionService.saveRolePermissions() - Cache invalide pour {} utilisateurs avec le role {}", usersWithRole.size(), role);
        } catch (Exception e) {
            log.warn("PermissionService.saveRolePermissions() - Erreur lors de l'invalidation du cache utilisateur: {}", e.getMessage());
        }
        
        // Recharger les permissions depuis la base pour s'assurer qu'elles sont à jour
        getRolePermissions(role);
        
        log.debug("PermissionService.saveRolePermissions() - Cache invalide et permissions rechargees pour le role: {}", role);
        return true;
    }

    public RolePermissionsDto resetToInitialPermissions(String role) {
        log.debug("PermissionService.resetToInitialPermissions() - Reset des permissions pour le role: {}", role);
        return resetToDefaultPermissions(role);
    }

    /**
     * Méthode publique pour récupérer les permissions d'un utilisateur pour la synchronisation
     */
    public List<String> getUserPermissionsForSync(String userId) {
        log.debug("PermissionService.getUserPermissionsForSync() - Synchronisation des permissions pour l'utilisateur: {}", userId);
        
        // Toujours invalider le cache utilisateur pour forcer la relecture depuis le rôle
        invalidateUserPermissionsCache(userId);
        
        // Récupérer l'utilisateur pour connaître son rôle
        Optional<User> userOpt = userRepository.findByKeycloakId(userId);
        if (!userOpt.isPresent()) {
            log.warn("PermissionService.getUserPermissionsForSync() - Utilisateur non trouve avec keycloakId: {}", userId);
            return new ArrayList<>();
        }
        
        User user = userOpt.get();
        UserRole userRole = user.getRole();
        log.debug("PermissionService.getUserPermissionsForSync() - Utilisateur trouve avec role: {}", userRole.name());
        
        // Toujours charger depuis la base de données pour avoir les dernières permissions
        // (ignorer le cache Redis pour être sûr d'avoir les données à jour)
        List<String> permissions = getPermissionsFromDatabase(userRole.name());

        // Fallback staff plateforme : si aucune permission trouvée en base, injecter toutes les permissions
        if ((permissions == null || permissions.isEmpty()) && userRole.isPlatformAdmin()) {
            log.warn("PermissionService.getUserPermissionsForSync() - FALLBACK ADMIN : injection de toutes les permissions");
            permissions = getAllAvailablePermissions();
        }

        if (permissions != null && !permissions.isEmpty()) {
            log.debug("PermissionService.getUserPermissionsForSync() - {} permissions recuperees pour le role {}", permissions.size(), userRole.name());

            // Mettre en cache dans Redis pour l'utilisateur ET pour le rôle
            updateUserPermissionsInRedis(userId, permissions);
            String roleKey = ROLE_PERMISSIONS_KEY + userRole.name();
            redisTemplate.opsForValue().set(roleKey, permissions);

            return permissions;
        } else {
            log.warn("PermissionService.getUserPermissionsForSync() - Aucune permission trouvee pour le role {}", userRole.name());
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
                log.debug("PermissionService.getUserPermissionsFromRedis() - Permissions trouvees dans Redis pour l'utilisateur: {}", userId);
                return permissions;
            } else {
                log.debug("PermissionService.getUserPermissionsFromRedis() - Aucune permission trouvee dans Redis pour l'utilisateur: {}", userId);
                return new ArrayList<>();
            }
        } catch (Exception e) {
            log.error("PermissionService.getUserPermissionsFromRedis() - Erreur lors de la recuperation depuis Redis: {}", e.getMessage());
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
                log.debug("PermissionService.getRolePermissionsFromRedis() - Permissions trouvees dans Redis pour le role: {} ({} permissions)", role, permissions.size());
                log.debug("Permissions Redis: {}", String.join(", ", permissions));
                return permissions;
            } else {
                log.debug("PermissionService.getRolePermissionsFromRedis() - Aucune permission trouvee dans Redis pour le role: {}", role);
                log.debug("PermissionService.getRolePermissionsFromRedis() - Chargement depuis la base de donnees...");
                
                // Charger depuis la base de données (forcer la relecture)
                List<String> dbPermissions = getPermissionsFromDatabase(role);
                
                if (dbPermissions != null && !dbPermissions.isEmpty()) {
                    // Mettre en cache dans Redis
                    redisTemplate.opsForValue().set(key, dbPermissions);
                    log.debug("PermissionService.getRolePermissionsFromRedis() - {} permissions chargees depuis la base et mises en cache pour le role: {}", dbPermissions.size(), role);
                    log.debug("Permissions chargees: {}", String.join(", ", dbPermissions));
                    return dbPermissions;
                } else {
                    log.warn("PermissionService.getRolePermissionsFromRedis() - Aucune permission trouvee en base pour le role: {}", role);
                    log.debug("Verifiez que les permissions sont bien sauvegardees dans la table role_permissions avec isActive=true");
                    return new ArrayList<>();
                }
            }
        } catch (Exception e) {
            log.error("PermissionService.getRolePermissionsFromRedis() - Erreur lors de la recuperation depuis Redis: {}", e.getMessage(), e);
            // En cas d'erreur Redis, essayer de charger depuis la base
            try {
                log.debug("PermissionService.getRolePermissionsFromRedis() - Tentative de chargement depuis la base de donnees...");
                List<String> dbPermissions = getPermissionsFromDatabase(role);
                log.debug("Permissions chargees depuis la base (apres erreur Redis): {} permissions", (dbPermissions != null ? dbPermissions.size() : 0));
                return dbPermissions;
            } catch (Exception dbException) {
                log.error("PermissionService.getRolePermissionsFromRedis() - Erreur lors du chargement depuis la base: {}", dbException.getMessage(), dbException);
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
            
            log.debug("PermissionService.updateUserPermissionsInRedis() - Permissions mises a jour dans Redis pour l'utilisateur: {}", userId);
            return true;
        } catch (Exception e) {
            log.error("PermissionService.updateUserPermissionsInRedis() - Erreur lors de la mise a jour dans Redis: {}", e.getMessage());
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
            
            log.debug("PermissionService.invalidateUserPermissionsCache() - Cache invalide pour l'utilisateur: {}", userId);
        } catch (Exception e) {
            log.error("PermissionService.invalidateUserPermissionsCache() - Erreur lors de l'invalidation: {}", e.getMessage());
        }
    }
}
