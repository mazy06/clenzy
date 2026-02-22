package com.clenzy.config;

import com.clenzy.model.Permission;
import com.clenzy.model.Role;
import com.clenzy.model.RolePermission;
import com.clenzy.model.UserRole;
import com.clenzy.repository.PermissionRepository;
import com.clenzy.repository.RolePermissionRepository;
import com.clenzy.repository.RoleRepository;
import com.clenzy.service.PermissionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Initialise toutes les permissions requises au demarrage de l'application.
 * Cree les entrees Permission et RolePermission manquantes dans la base de donnees.
 * Idempotent : ne cree pas de doublon si les permissions existent deja.
 *
 * Les permissions definies ici correspondent exactement a celles attendues par le frontend
 * (useNavigationMenu, ProtectedRoute, useCustomPermissions, PermissionConfig).
 */
@Component
public class PermissionInitializer {

    private static final Logger log = LoggerFactory.getLogger(PermissionInitializer.class);

    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionService permissionService;

    public PermissionInitializer(PermissionRepository permissionRepository,
                                  RoleRepository roleRepository,
                                  RolePermissionRepository rolePermissionRepository,
                                  PermissionService permissionService) {
        this.permissionRepository = permissionRepository;
        this.roleRepository = roleRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.permissionService = permissionService;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void initPermissions() {
        log.info("Verification des permissions requises au demarrage...");

        // Toujours invalider le cache Redis au demarrage pour eviter les listes vides
        // persistees apres un crash ou un redemarrage force
        log.info("Invalidation du cache Redis des permissions au demarrage...");
        permissionService.invalidateAllCache();

        // ====================================================================
        // 1. Creer les roles manquants dans la table 'roles'
        //    La table est utilisee pour les jointures avec role_permissions
        //    mais n'est initialisee par aucune migration.
        // ====================================================================
        for (UserRole userRole : UserRole.values()) {
            Optional<Role> existing = roleRepository.findByName(userRole.name());
            if (existing.isEmpty()) {
                Role role = new Role(userRole.name(), userRole.getDisplayName(), userRole.getDescription());
                roleRepository.save(role);
                log.info("Role cree dans la table roles: {} ({})", userRole.name(), userRole.getDisplayName());
            }
        }

        // ====================================================================
        // 2. Toutes les permissions requises par le frontend
        // Source : useCustomPermissions.ts (defaultRolePermissions)
        //          useNavigationMenu.tsx (MENU_CONFIG_BASE)
        //          AuthenticatedApp.tsx (ProtectedRoute)
        //          PermissionConfig.tsx (ALL_PERMISSIONS)
        // ====================================================================
        boolean anyCreated = false;

        // --- Dashboard ---
        anyCreated |= ensurePermission("dashboard:view", "Voir le tableau de bord", "dashboard",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST", "TECHNICIAN", "HOUSEKEEPER", "SUPERVISOR", "LAUNDRY", "EXTERIOR_TECH"));

        // --- Properties ---
        anyCreated |= ensurePermission("properties:view", "Voir les proprietes", "properties",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST"));
        anyCreated |= ensurePermission("properties:create", "Creer des proprietes", "properties",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST"));
        anyCreated |= ensurePermission("properties:edit", "Modifier des proprietes", "properties",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST"));
        anyCreated |= ensurePermission("properties:delete", "Supprimer des proprietes", "properties",
                List.of("SUPER_ADMIN"));

        // --- Service Requests ---
        anyCreated |= ensurePermission("service-requests:view", "Voir les demandes de service", "service-requests",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST", "SUPERVISOR"));
        anyCreated |= ensurePermission("service-requests:create", "Creer des demandes de service", "service-requests",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST"));
        anyCreated |= ensurePermission("service-requests:edit", "Modifier des demandes de service", "service-requests",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST"));
        anyCreated |= ensurePermission("service-requests:delete", "Supprimer des demandes de service", "service-requests",
                List.of("SUPER_ADMIN"));

        // --- Interventions ---
        anyCreated |= ensurePermission("interventions:view", "Voir les interventions", "interventions",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "TECHNICIAN", "HOUSEKEEPER", "SUPERVISOR", "LAUNDRY", "EXTERIOR_TECH"));
        anyCreated |= ensurePermission("interventions:create", "Creer des interventions", "interventions",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));
        anyCreated |= ensurePermission("interventions:edit", "Modifier des interventions", "interventions",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "TECHNICIAN", "HOUSEKEEPER", "SUPERVISOR", "LAUNDRY", "EXTERIOR_TECH"));
        anyCreated |= ensurePermission("interventions:delete", "Supprimer des interventions", "interventions",
                List.of("SUPER_ADMIN"));

        // --- Teams ---
        anyCreated |= ensurePermission("teams:view", "Voir les equipes", "teams",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "TECHNICIAN", "HOUSEKEEPER", "SUPERVISOR", "LAUNDRY", "EXTERIOR_TECH"));
        anyCreated |= ensurePermission("teams:create", "Creer des equipes", "teams",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));
        anyCreated |= ensurePermission("teams:edit", "Modifier des equipes", "teams",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "SUPERVISOR"));
        anyCreated |= ensurePermission("teams:delete", "Supprimer des equipes", "teams",
                List.of("SUPER_ADMIN"));

        // --- Portfolios ---
        anyCreated |= ensurePermission("portfolios:view", "Voir les portefeuilles", "portfolios",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "SUPERVISOR"));
        anyCreated |= ensurePermission("portfolios:manage", "Gerer les portefeuilles", "portfolios",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));
        anyCreated |= ensurePermission("portfolios:manage_all", "Gerer tous les portefeuilles (admin)", "portfolios",
                List.of("SUPER_ADMIN"));

        // --- Reports ---
        anyCreated |= ensurePermission("reports:view", "Voir les rapports", "reports",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));
        anyCreated |= ensurePermission("reports:generate", "Generer des rapports", "reports",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));
        anyCreated |= ensurePermission("reports:download", "Telecharger des rapports", "reports",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));
        anyCreated |= ensurePermission("reports:manage", "Gerer les rapports (admin)", "reports",
                List.of("SUPER_ADMIN"));

        // --- Documents ---
        anyCreated |= ensurePermission("documents:view", "Voir les documents et templates", "documents",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));
        anyCreated |= ensurePermission("documents:create", "Creer des templates de documents", "documents",
                List.of("SUPER_ADMIN"));
        anyCreated |= ensurePermission("documents:edit", "Modifier les templates de documents", "documents",
                List.of("SUPER_ADMIN"));
        anyCreated |= ensurePermission("documents:delete", "Supprimer des templates de documents", "documents",
                List.of("SUPER_ADMIN"));
        anyCreated |= ensurePermission("documents:compliance", "Voir et gerer la conformite NF", "documents",
                List.of("SUPER_ADMIN"));

        // --- Contact ---
        anyCreated |= ensurePermission("contact:view", "Voir les messages de contact", "contact",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST", "TECHNICIAN", "HOUSEKEEPER", "SUPERVISOR", "LAUNDRY", "EXTERIOR_TECH"));
        anyCreated |= ensurePermission("contact:send", "Envoyer des messages de contact", "contact",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));
        anyCreated |= ensurePermission("contact:manage", "Gerer les messages de contact", "contact",
                List.of("SUPER_ADMIN"));

        // --- Users ---
        anyCreated |= ensurePermission("users:view", "Voir les utilisateurs", "users",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));
        anyCreated |= ensurePermission("users:manage", "Gerer les utilisateurs", "users",
                List.of("SUPER_ADMIN"));

        // --- Settings ---
        anyCreated |= ensurePermission("settings:view", "Voir les parametres", "settings",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));
        anyCreated |= ensurePermission("settings:edit", "Modifier les parametres", "settings",
                List.of("SUPER_ADMIN"));

        // --- Tarification ---
        anyCreated |= ensurePermission("tarification:view", "Voir la configuration tarifaire", "tarification",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));
        anyCreated |= ensurePermission("tarification:edit", "Modifier la configuration tarifaire", "tarification",
                List.of("SUPER_ADMIN", "SUPER_MANAGER"));

        // --- Payments ---
        anyCreated |= ensurePermission("payments:view", "Voir l'historique des paiements", "payments",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST"));

        // --- Reservations ---
        anyCreated |= ensurePermission("reservations:view", "Voir les reservations", "reservations",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST", "SUPERVISOR"));
        anyCreated |= ensurePermission("reservations:create", "Creer des reservations", "reservations",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST"));
        anyCreated |= ensurePermission("reservations:edit", "Modifier des reservations", "reservations",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST"));

        // --- Dynamic Pricing ---
        anyCreated |= ensurePermission("pricing:view", "Voir les prix dynamiques", "pricing",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST"));
        anyCreated |= ensurePermission("pricing:manage", "Gerer les prix dynamiques", "pricing",
                List.of("SUPER_ADMIN", "SUPER_MANAGER", "HOST"));

        if (anyCreated) {
            log.info("Nouvelles permissions creees. Invalidation du cache...");
            permissionService.invalidateAllCache();
        }

        log.info("Verification des permissions terminee ({} permissions verifiees).", 42);
    }

    private boolean ensurePermission(String name, String description, String module, List<String> roleNames) {
        boolean created = false;

        // 1. Creer la Permission si elle n'existe pas
        Optional<Permission> existingPerm = permissionRepository.findByName(name);
        Permission permission;
        if (existingPerm.isPresent()) {
            permission = existingPerm.get();
        } else {
            permission = new Permission(name, description, module);
            permission = permissionRepository.save(permission);
            log.info("Permission creee: {} (module: {})", name, module);
            created = true;
        }

        // 2. Associer aux roles si pas deja associe
        for (String roleName : roleNames) {
            Optional<Role> roleOpt = roleRepository.findByName(roleName);
            if (roleOpt.isEmpty()) {
                log.warn("Role {} non trouve, permission {} non associee", roleName, name);
                continue;
            }
            Role role = roleOpt.get();

            boolean alreadyAssigned = rolePermissionRepository.existsByRoleNameAndPermissionName(roleName, name);
            if (!alreadyAssigned) {
                RolePermission rp = new RolePermission(role, permission);
                rp.setIsActive(true);
                rp.setIsDefault(true);
                rolePermissionRepository.save(rp);
                log.info("Permission {} associee au role {}", name, roleName);
                created = true;
            }
        }

        return created;
    }
}
