package com.clenzy.config;

import com.clenzy.model.Permission;
import com.clenzy.model.Role;
import com.clenzy.model.RolePermission;
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
 * Initialise les nouvelles permissions au demarrage de l'application.
 * Cree les entrees Permission et RolePermission manquantes dans la base de donnees.
 * Idempotent : ne cree pas de doublon si les permissions existent deja.
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
        // persistees apres un crash ou un redemarrage force (TTL permanent = Duration.ZERO)
        log.info("Invalidation du cache Redis des permissions au demarrage...");
        permissionService.invalidateAllCache();

        // Permissions a creer automatiquement
        ensurePermission("tarification:view", "Voir la configuration tarifaire", "tarification",
                List.of("ADMIN", "MANAGER"));
        ensurePermission("tarification:edit", "Modifier la configuration tarifaire", "tarification",
                List.of("ADMIN", "MANAGER"));

        ensurePermission("payments:view", "Voir l'historique des paiements", "payments",
                List.of("ADMIN", "MANAGER", "HOST"));

        log.info("Verification des permissions terminee.");
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

            List<String> existingPerms = rolePermissionRepository.findActivePermissionsByRoleName(roleName);
            if (!existingPerms.contains(name)) {
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
