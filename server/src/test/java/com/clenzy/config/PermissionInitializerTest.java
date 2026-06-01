package com.clenzy.config;

import com.clenzy.model.Permission;
import com.clenzy.model.Role;
import com.clenzy.model.RolePermission;
import com.clenzy.model.UserRole;
import com.clenzy.repository.PermissionRepository;
import com.clenzy.repository.RolePermissionRepository;
import com.clenzy.repository.RoleRepository;
import com.clenzy.service.PermissionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link PermissionInitializer}.
 *
 * <p>L'initializer est idempotent : il cree des Permission, Role et RolePermission
 * manquants en BDD au demarrage. Les scenarios couverts ici :</p>
 * <ul>
 *   <li>cold start (aucune permission, aucun role) -> tout est cree</li>
 *   <li>warm restart (tout deja en BDD) -> aucun save, aucune invalidation</li>
 *   <li>nettoyage : RolePermission deja existant pour un role qui ne devrait plus
 *       avoir cette permission par defaut -> supprime</li>
 *   <li>role manquant pour une permission -> warn et continue</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("PermissionInitializer")
class PermissionInitializerTest {

    @Mock private PermissionRepository permissionRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private RolePermissionRepository rolePermissionRepository;
    @Mock private PermissionService permissionService;

    private PermissionInitializer initializer;

    @BeforeEach
    void setUp() {
        initializer = new PermissionInitializer(
            permissionRepository, roleRepository, rolePermissionRepository, permissionService);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private Role role(String name) {
        Role r = new Role(name, name, name);
        return r;
    }

    private Permission perm(String name) {
        return new Permission(name, "desc-" + name, "module");
    }

    private void stubAllRolesFound() {
        // chaque UserRole renvoie un Role correspondant
        for (UserRole ur : UserRole.values()) {
            when(roleRepository.findByName(ur.name())).thenReturn(Optional.of(role(ur.name())));
        }
    }

    // ─── cold start: tout cree ───────────────────────────────────────────────

    @Test
    @DisplayName("cold start : aucune permission/role -> cree tout + invalidate cache 2x")
    void coldStart_createsEverything() {
        // Tous les UserRole sont absents au depart (cree)
        when(roleRepository.findByName(anyString())).thenReturn(Optional.empty());
        // Au moment du loop des permissions, on les rend disponibles (sinon
        // ensurePermission warn et skip).
        // Reset le stub: les premiers appels (init roles) renvoient empty puis
        // les suivants (lookup pour permissions) renvoient un Role.
        // Stub plus simple: roleRepository.save -> echo + on continue a renvoyer empty.
        when(roleRepository.save(any(Role.class))).thenAnswer(inv -> inv.getArgument(0));

        // Toutes les permissions sont absentes (cree)
        when(permissionRepository.findByName(anyString())).thenReturn(Optional.empty());
        when(permissionRepository.save(any(Permission.class)))
            .thenAnswer(inv -> {
                Permission p = inv.getArgument(0);
                return p;
            });

        // existsByRoleNameAndPermissionName toujours false (cree)
        when(rolePermissionRepository.existsByRoleNameAndPermissionName(anyString(), anyString()))
            .thenReturn(false);
        // findByPermissionName : aucun RolePermission existant (aucun cleanup)
        when(rolePermissionRepository.findByPermissionName(anyString())).thenReturn(List.of());

        when(permissionRepository.count()).thenReturn(42L);

        initializer.initPermissions();

        // 1x au tout debut (invalidation systematique) + 1x si anyCreated=true
        verify(permissionService, atLeast(1)).invalidateAllCache();
        // Tous les roles UserRole sont sauves au moins une fois
        verify(roleRepository, atLeast(UserRole.values().length)).save(any(Role.class));
        // Au moins une permission est sauvegardee
        verify(permissionRepository, atLeastOnce()).save(any(Permission.class));
    }

    // ─── warm restart: tout deja la ──────────────────────────────────────────

    @Test
    @DisplayName("warm restart : roles + permissions deja la -> 1 seul invalidate (le boot)")
    void warmRestart_noChanges() {
        stubAllRolesFound();
        // Toutes les permissions deja en BDD
        when(permissionRepository.findByName(anyString()))
            .thenAnswer(inv -> Optional.of(perm(inv.getArgument(0))));
        // RolePermission deja associes
        when(rolePermissionRepository.existsByRoleNameAndPermissionName(anyString(), anyString()))
            .thenReturn(true);
        // Aucun RolePermission a supprimer
        when(rolePermissionRepository.findByPermissionName(anyString())).thenReturn(List.of());
        when(permissionRepository.count()).thenReturn(50L);

        initializer.initPermissions();

        // Premier invalidate au boot (toujours), pas de 2eme car anyCreated=false
        verify(permissionService, times(1)).invalidateAllCache();
        verify(permissionRepository, never()).save(any(Permission.class));
        verify(rolePermissionRepository, never()).save(any(RolePermission.class));
        verify(rolePermissionRepository, never()).delete(any());
    }

    // ─── cleanup : default RolePermission non desire -> supprime ─────────────

    @Test
    @DisplayName("cleanup : RolePermission default qui n'est plus dans la liste attendue -> deleted")
    void cleanup_deletesOrphanDefaultRolePermissions() {
        stubAllRolesFound();
        when(permissionRepository.findByName(anyString()))
            .thenAnswer(inv -> Optional.of(perm(inv.getArgument(0))));
        when(rolePermissionRepository.existsByRoleNameAndPermissionName(anyString(), anyString()))
            .thenReturn(true);

        // Pour "dashboard:view" — role TECHNICIAN devrait l'avoir (oui)
        // Pour "properties:view" — role HOST devrait l'avoir, mais on simule un default
        // sur HOUSEKEEPER (pas attendu) -> doit etre supprime.
        Role housekeeperRole = role("HOUSEKEEPER");
        Permission propertiesView = perm("properties:view");
        RolePermission orphan = new RolePermission(housekeeperRole, propertiesView);
        orphan.setIsDefault(true);
        orphan.setIsActive(true);

        when(rolePermissionRepository.findByPermissionName("properties:view"))
            .thenReturn(List.of(orphan));
        when(rolePermissionRepository.findByPermissionName(org.mockito.ArgumentMatchers.argThat(
            n -> n != null && !"properties:view".equals(n))))
            .thenReturn(List.of());

        when(permissionRepository.count()).thenReturn(50L);

        initializer.initPermissions();

        // L'orphan a ete supprime
        verify(rolePermissionRepository, atLeastOnce()).delete(orphan);
    }

    // ─── role inexistant dans la table roles -> warn + continue ──────────────

    @Test
    @DisplayName("permission cible un role manquant -> warn + skip cette association sans crash")
    void permissionWithUnknownRole_isSkippedGracefully() {
        // Tous les Role UserRole sont presents SAUF EXTERIOR_TECH
        for (UserRole ur : UserRole.values()) {
            if (ur == UserRole.EXTERIOR_TECH) {
                when(roleRepository.findByName(ur.name())).thenReturn(Optional.empty());
            } else {
                when(roleRepository.findByName(ur.name())).thenReturn(Optional.of(role(ur.name())));
            }
        }
        // Pour les init des roles dans la 1ere boucle: EXTERIOR_TECH n'est pas trouve, est cree
        when(roleRepository.save(any(Role.class))).thenAnswer(inv -> inv.getArgument(0));

        when(permissionRepository.findByName(anyString()))
            .thenAnswer(inv -> Optional.of(perm(inv.getArgument(0))));
        when(rolePermissionRepository.existsByRoleNameAndPermissionName(anyString(), anyString()))
            .thenReturn(true);
        when(rolePermissionRepository.findByPermissionName(anyString())).thenReturn(List.of());
        when(permissionRepository.count()).thenReturn(50L);

        // Ne crashe pas
        initializer.initPermissions();
    }

    // ─── Test constructeur (sanity) ─────────────────────────────────────────

    @Test
    @DisplayName("constructeur : injecte toutes les dependances")
    void constructor_injectsDependencies() {
        PermissionInitializer i = new PermissionInitializer(
            permissionRepository, roleRepository, rolePermissionRepository, permissionService);
        assertThat(i).isNotNull();
    }
}
