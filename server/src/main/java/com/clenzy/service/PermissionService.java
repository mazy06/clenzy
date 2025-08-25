package com.clenzy.service;

import com.clenzy.dto.RolePermissionsDto;
import org.springframework.stereotype.Service;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;

import java.util.*;

@Service
public class PermissionService {

    // Permissions par défaut par rôle (stockées en mémoire pour l'instant)
    private final Map<String, List<String>> defaultRolePermissions;
    
    // Permissions personnalisées par rôle (stockées en mémoire pour l'instant)
    // En production, cela devrait être stocké en base de données
    private final Map<String, List<String>> customRolePermissions;

    public PermissionService() {
        // Initialiser les permissions par défaut
        defaultRolePermissions = new HashMap<>();
        defaultRolePermissions.put("ADMIN", Arrays.asList(
            "dashboard:view",
            "properties:view", "properties:create", "properties:edit", "properties:delete",
            "service-requests:view", "service-requests:create", "service-requests:edit", "service-requests:delete",
            "interventions:view", "interventions:create", "interventions:edit", "interventions:delete",
            "teams:view", "teams:create", "teams:edit", "teams:delete",
            "settings:view", "settings:edit",
            "users:manage",
            "reports:view"
        ));
        
        defaultRolePermissions.put("MANAGER", Arrays.asList(
            "dashboard:view",
            "properties:view", "properties:create", "properties:edit",
            "service-requests:view", "service-requests:create", "service-requests:edit",
            "interventions:view", "interventions:create", "interventions:edit",
            "teams:view", "teams:create", "teams:edit",
            "settings:view",
            "users:view",
            "reports:view"
        ));
        
        defaultRolePermissions.put("HOST", Arrays.asList(
            "dashboard:view",
            "properties:view", "properties:create", "properties:edit",
            "service-requests:view", "service-requests:create",
            "interventions:view"
        ));
        
        defaultRolePermissions.put("TECHNICIAN", Arrays.asList(
            "dashboard:view",
            "interventions:view", "interventions:edit",
            "teams:view"
        ));
        
        defaultRolePermissions.put("HOUSEKEEPER", Arrays.asList(
            "dashboard:view",
            "interventions:view", "interventions:edit",
            "teams:view"
        ));
        
        defaultRolePermissions.put("SUPERVISOR", Arrays.asList(
            "dashboard:view",
            "interventions:view", "interventions:edit",
            "teams:view", "teams:edit"
        ));

        // Initialiser les permissions personnalisées vides
        customRolePermissions = new HashMap<>();
    }

    @Cacheable("roles")
    public List<String> getAllRoles() {
        return new ArrayList<>(defaultRolePermissions.keySet());
    }

    @Cacheable("rolePermissions")
    public RolePermissionsDto getRolePermissions(String role) {
        if (!defaultRolePermissions.containsKey(role)) {
            throw new IllegalArgumentException("Rôle non reconnu: " + role);
        }

        List<String> permissions = customRolePermissions.getOrDefault(role, defaultRolePermissions.get(role));
        boolean isDefault = !customRolePermissions.containsKey(role);

        return new RolePermissionsDto(role, permissions, isDefault);
    }

    @CacheEvict(value = {"rolePermissions", "userPermissions"}, allEntries = true)
    public RolePermissionsDto updateRolePermissions(String role, List<String> permissions) {
        if (!defaultRolePermissions.containsKey(role)) {
            throw new IllegalArgumentException("Rôle non reconnu: " + role);
        }

        // Valider que toutes les permissions existent
        List<String> allValidPermissions = getAllValidPermissions();
        for (String permission : permissions) {
            if (!allValidPermissions.contains(permission)) {
                throw new IllegalArgumentException("Permission non reconnue: " + permission);
            }
        }

        // Sauvegarder les permissions personnalisées
        customRolePermissions.put(role, new ArrayList<>(permissions));

        // TODO: En production, sauvegarder en base de données
        System.out.println("🔧 PermissionService - Permissions mises à jour pour le rôle " + role + ": " + permissions);

        return new RolePermissionsDto(role, permissions, false);
    }

    @CacheEvict(value = {"rolePermissions", "userPermissions"}, allEntries = true)
    public RolePermissionsDto resetRolePermissions(String role) {
        if (!defaultRolePermissions.containsKey(role)) {
            throw new IllegalArgumentException("Rôle non reconnu: " + role);
        }

        // Supprimer les permissions personnalisées
        customRolePermissions.remove(role);

        // TODO: En production, supprimer de la base de données
        System.out.println("🔄 PermissionService - Permissions réinitialisées pour le rôle " + role);

        List<String> defaultPermissions = defaultRolePermissions.get(role);
        return new RolePermissionsDto(role, defaultPermissions, true);
    }

    public Map<String, List<String>> getDefaultPermissions() {
        return new HashMap<>(defaultRolePermissions);
    }

    public List<String> getAllValidPermissions() {
        Set<String> allPermissions = new HashSet<>();
        for (List<String> permissions : defaultRolePermissions.values()) {
            allPermissions.addAll(permissions);
        }
        return new ArrayList<>(allPermissions);
    }

    // Méthode pour obtenir les permissions d'un utilisateur selon son rôle
    public List<String> getUserPermissions(String role) {
        if (customRolePermissions.containsKey(role)) {
            return customRolePermissions.get(role);
        }
        return defaultRolePermissions.getOrDefault(role, new ArrayList<>());
    }

    // Méthode pour sauvegarder les permissions personnalisées d'un rôle
    public boolean saveRolePermissions(String role) {
        if (!defaultRolePermissions.containsKey(role)) {
            throw new IllegalArgumentException("Rôle non reconnu: " + role);
        }

        // Vérifier s'il y a des permissions personnalisées à sauvegarder
        if (!customRolePermissions.containsKey(role)) {
            System.out.println("🔧 PermissionService - Aucune permission personnalisée à sauvegarder pour le rôle " + role);
            return false;
        }

        // TODO: En production, sauvegarder en base de données
        // Pour l'instant, on simule la sauvegarde
        System.out.println("💾 PermissionService - Sauvegarde des permissions personnalisées pour le rôle " + role);
        System.out.println("💾 PermissionService - Permissions: " + customRolePermissions.get(role));
        
        // Simuler une sauvegarde réussie
        return true;
    }

    // Méthode pour réinitialiser aux permissions initiales depuis la base de données
    public RolePermissionsDto resetToInitialPermissions(String role) {
        if (!defaultRolePermissions.containsKey(role)) {
            throw new IllegalArgumentException("Rôle non reconnu: " + role);
        }

        System.out.println("🔄 PermissionService - Réinitialisation aux permissions initiales pour le rôle " + role);
        
        // TODO: En production, récupérer les permissions initiales depuis la base de données
        // Pour l'instant, on utilise les permissions par défaut
        List<String> initialPermissions = getInitialPermissionsFromDatabase(role);
        
        // Supprimer les permissions personnalisées
        customRolePermissions.remove(role);
        
        // Retourner les permissions initiales
        return new RolePermissionsDto(role, initialPermissions, true);
    }

    // Méthode pour récupérer les permissions initiales depuis la base de données
    private List<String> getInitialPermissionsFromDatabase(String role) {
        // TODO: En production, faire un appel à la base de données
        // Pour l'instant, on simule en retournant les permissions par défaut
        System.out.println("🗄️ PermissionService - Récupération des permissions initiales depuis la base pour le rôle " + role);
        
        // Simulation : en production, on ferait un appel à la base
        // SELECT permissions FROM role_permissions WHERE role = ? AND is_initial = true
        return defaultRolePermissions.getOrDefault(role, new ArrayList<>());
    }

    // Méthode pour vérifier si un utilisateur a une permission spécifique
    public boolean checkUserPermission(String userId, String permission) {
        try {
            // TODO: En production, récupérer le rôle de l'utilisateur depuis la base de données
            // Pour l'instant, on simule en utilisant un service utilisateur
            
            // Simuler la récupération du rôle de l'utilisateur
            // En production, on ferait : SELECT role FROM users WHERE id = ?
            String userRole = getUserRoleFromDatabase(userId);
            
            if (userRole == null) {
                System.out.println("🔍 PermissionService - Utilisateur non trouvé: " + userId);
                return false;
            }
            
            // Vérifier si le rôle a la permission
            List<String> userPermissions = getUserPermissions(userRole);
            boolean hasPermission = userPermissions.contains(permission);
            
            System.out.println("🔍 PermissionService - Vérification permission '" + permission + "' pour utilisateur " + userId + " (rôle: " + userRole + "): " + hasPermission);
            
            return hasPermission;
        } catch (Exception e) {
            System.err.println("❌ PermissionService - Erreur lors de la vérification de permission: " + e.getMessage());
            return false;
        }
    }

    // Méthode pour récupérer le rôle d'un utilisateur depuis la base de données
    private String getUserRoleFromDatabase(String userId) {
        // TODO: En production, faire un appel à la base de données
        // Pour l'instant, on simule en retournant un rôle par défaut
        
        // Simulation : en production, on ferait un appel à la base
        // SELECT role FROM users WHERE id = ?
        System.out.println("🗄️ PermissionService - Récupération du rôle pour l'utilisateur: " + userId);
        
        // Pour la démonstration, on retourne ADMIN pour tous les utilisateurs
        // En production, cela viendrait de la base de données
        return "ADMIN";
    }
}
