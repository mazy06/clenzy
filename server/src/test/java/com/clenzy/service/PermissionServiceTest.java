package com.clenzy.service;

import com.clenzy.dto.RolePermissionsDto;
import com.clenzy.model.Permission;
import com.clenzy.model.Role;
import com.clenzy.model.RolePermission;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.PermissionRepository;
import com.clenzy.repository.RolePermissionRepository;
import com.clenzy.repository.RoleRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PermissionServiceTest {

    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private ValueOperations<String, Object> valueOperations;
    @Mock private CacheManager cacheManager;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;
    @Mock private RolePermissionRepository rolePermissionRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private NotificationService notificationService;
    @Mock private EntityManager entityManager;
    @Mock private Cache cache;

    private PermissionService service;

    @BeforeEach
    void setUp() {
        service = new PermissionService(
                redisTemplate,
                cacheManager,
                userRepository,
                tenantContext,
                rolePermissionRepository,
                roleRepository,
                permissionRepository
        );
        ReflectionTestUtils.setField(service, "notificationService", notificationService);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
    }

    // ── Helper methods ──────────────────────────────────────────────────────────

    private User createUser(String keycloakId, UserRole role, String email) {
        User user = new User("Test", "User", email, "password123");
        user.setKeycloakId(keycloakId);
        user.setRole(role);
        return user;
    }

    private Role createRole(String name) {
        Role role = new Role(name, name + " display", name + " description");
        role.setId(1L);
        return role;
    }

    private Permission createPermission(String name, String module) {
        Permission permission = new Permission(name, "Desc " + name, module);
        permission.setId((long) name.hashCode());
        return permission;
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 1. getAllRoles — returns role names from DB
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getAllRoles_whenRolesExistInDb_returnsRoleNames() {
        Role host = createRole("HOST");
        Role admin = createRole("SUPER_ADMIN");
        when(roleRepository.findAll()).thenReturn(List.of(host, admin));

        List<String> result = service.getAllRoles();

        assertEquals(2, result.size());
        assertTrue(result.contains("HOST"));
        assertTrue(result.contains("SUPER_ADMIN"));
        verify(roleRepository).findAll();
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 2. getAllRoles — DB error returns empty list
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getAllRoles_whenDbThrowsException_returnsEmptyList() {
        when(roleRepository.findAll()).thenThrow(new RuntimeException("DB connection failed"));

        List<String> result = service.getAllRoles();

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 3. getRolePermissions — returns DTO from DB
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getRolePermissions_whenPermissionsExist_returnsDtoWithPermissions() {
        List<String> permissions = List.of("contact:view", "contact:edit");
        when(rolePermissionRepository.findActivePermissionsByRoleName("HOST")).thenReturn(permissions);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        RolePermissionsDto result = service.getRolePermissions("HOST");

        assertNotNull(result);
        assertEquals("HOST", result.getRole());
        assertEquals(2, result.getPermissions().size());
        assertTrue(result.getPermissions().contains("contact:view"));
        assertTrue(result.getPermissions().contains("contact:edit"));
        assertTrue(result.isDefault()); // hasCustomPermissions always returns false (TODO)
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 4. getRolePermissionsWithoutCache — bypasses cache
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getRolePermissionsWithoutCache_returnsPermissionsDirectlyFromDb() {
        List<String> permissions = List.of("property:view", "property:edit");
        when(rolePermissionRepository.findActivePermissionsByRoleName("SUPERVISOR")).thenReturn(permissions);

        RolePermissionsDto result = service.getRolePermissionsWithoutCache("SUPERVISOR");

        assertNotNull(result);
        assertEquals("SUPERVISOR", result.getRole());
        assertEquals(2, result.getPermissions().size());
        assertTrue(result.getPermissions().contains("property:view"));
        assertTrue(result.isDefault());
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 5. checkUserPermission — user found, permission in Redis, returns true
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void checkUserPermission_whenUserFoundAndPermissionInRedis_returnsTrue() {
        User user = createUser("kc-123", UserRole.HOST, "host@test.com");
        when(userRepository.findByKeycloakId("kc-123")).thenReturn(Optional.of(user));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        List<String> rolePermissions = new ArrayList<>(List.of("contact:view", "contact:edit", "property:view"));
        when(valueOperations.get("role:permissions:HOST")).thenReturn(rolePermissions);

        boolean result = service.checkUserPermission("kc-123", "contact:view");

        assertTrue(result);
        verify(userRepository).findByKeycloakId("kc-123");
        verify(valueOperations).get("role:permissions:HOST");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 6. checkUserPermission — user found, permission NOT in Redis, returns false
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void checkUserPermission_whenUserFoundAndPermissionNotInRedis_returnsFalse() {
        User user = createUser("kc-123", UserRole.HOST, "host@test.com");
        when(userRepository.findByKeycloakId("kc-123")).thenReturn(Optional.of(user));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        List<String> rolePermissions = new ArrayList<>(List.of("contact:view"));
        when(valueOperations.get("role:permissions:HOST")).thenReturn(rolePermissions);

        boolean result = service.checkUserPermission("kc-123", "admin:manage");

        assertFalse(result);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 7. checkUserPermission — user not found, returns false
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void checkUserPermission_whenUserNotFound_returnsFalse() {
        when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

        boolean result = service.checkUserPermission("kc-unknown", "contact:view");

        assertFalse(result);
        verify(userRepository).findByKeycloakId("kc-unknown");
        verifyNoInteractions(redisTemplate);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 8. checkUserPermission — Redis empty for role, returns false
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void checkUserPermission_whenRedisEmptyForRole_returnsFalse() {
        User user = createUser("kc-123", UserRole.HOST, "host@test.com");
        when(userRepository.findByKeycloakId("kc-123")).thenReturn(Optional.of(user));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("role:permissions:HOST")).thenReturn(null);

        boolean result = service.checkUserPermission("kc-123", "contact:view");

        assertFalse(result);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 9. checkUserPermission — exception, returns false
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void checkUserPermission_whenExceptionThrown_returnsFalse() {
        when(userRepository.findByKeycloakId("kc-123")).thenThrow(new RuntimeException("Redis down"));

        boolean result = service.checkUserPermission("kc-123", "contact:view");

        assertFalse(result);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 10. invalidateCache — deletes Redis key + user caches
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void invalidateCache_deletesRedisKeyAndInvalidatesUserCaches() {
        User user1 = createUser("kc-1", UserRole.HOST, "user1@test.com");
        User user2 = createUser("kc-2", UserRole.HOST, "user2@test.com");
        when(redisTemplate.delete(anyString())).thenReturn(true);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(userRepository.findByRoleIn(eq(Arrays.asList(UserRole.HOST)), eq(1L)))
                .thenReturn(List.of(user1, user2));

        service.invalidateCache("HOST");

        verify(redisTemplate).delete("role:permissions:HOST");
        // Two user caches should be invalidated
        verify(redisTemplate).delete("user:permissions:kc-1");
        verify(redisTemplate).delete("user:permissions:kc-2");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 11. invalidateAllCache — clears Spring caches + Redis keys
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void invalidateAllCache_clearsSpringCachesAndAllRedisKeys() {
        when(cacheManager.getCache("permissions")).thenReturn(cache);
        when(cacheManager.getCache("roles")).thenReturn(cache);

        Set<String> roleKeys = new HashSet<>(Set.of("role:permissions:HOST", "role:permissions:TECHNICIAN"));
        Set<String> userKeys = new HashSet<>(Set.of("user:permissions:kc-1", "user:permissions:kc-2"));
        when(redisTemplate.keys("role:permissions:*")).thenReturn(roleKeys);
        when(redisTemplate.keys("user:permissions:*")).thenReturn(userKeys);

        service.invalidateAllCache();

        // Spring caches cleared
        verify(cache, times(2)).clear();
        // Redis role keys deleted
        verify(redisTemplate).delete(roleKeys);
        // Redis user keys deleted
        verify(redisTemplate).delete(userKeys);
        // roles:all key deleted
        verify(redisTemplate).delete("roles:all");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 12. getUserPermissionsForSync — normal flow, loads from DB, caches in Redis
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getUserPermissionsForSync_whenUserFound_loadsFromDbAndCachesInRedis() {
        User user = createUser("kc-123", UserRole.HOST, "host@test.com");
        when(userRepository.findByKeycloakId("kc-123")).thenReturn(Optional.of(user));
        when(redisTemplate.delete(anyString())).thenReturn(true);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        List<String> dbPermissions = List.of("contact:view", "property:view");
        when(rolePermissionRepository.findActivePermissionsByRoleName("HOST")).thenReturn(dbPermissions);

        List<String> result = service.getUserPermissionsForSync("kc-123");

        assertEquals(2, result.size());
        assertTrue(result.contains("contact:view"));
        assertTrue(result.contains("property:view"));

        // Verify user cache was invalidated first
        verify(redisTemplate).delete("user:permissions:kc-123");
        // Verify user permissions were cached in Redis
        verify(valueOperations).set(eq("user:permissions:kc-123"), eq(dbPermissions));
        // Verify role permissions were cached in Redis
        verify(valueOperations).set(eq("role:permissions:HOST"), eq(dbPermissions));
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 13. getUserPermissionsForSync — platform admin with no permissions, FALLBACK
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getUserPermissionsForSync_whenPlatformAdminWithNoPermissions_fallbackInjectsAll() {
        User admin = createUser("kc-admin", UserRole.SUPER_ADMIN, "admin@test.com");
        when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
        when(redisTemplate.delete(anyString())).thenReturn(true);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        // DB returns empty for this role
        when(rolePermissionRepository.findActivePermissionsByRoleName("SUPER_ADMIN"))
                .thenReturn(new ArrayList<>());

        // getAllAvailablePermissions returns all permissions
        List<Permission> allPermissions = List.of(
                createPermission("contact:view", "contact"),
                createPermission("contact:edit", "contact"),
                createPermission("admin:manage", "admin")
        );
        when(permissionRepository.findAll()).thenReturn(allPermissions);

        List<String> result = service.getUserPermissionsForSync("kc-admin");

        assertFalse(result.isEmpty());
        assertEquals(3, result.size());
        // Verify that all available permissions were injected
        verify(permissionRepository).findAll();
        // Verify caching happened
        verify(valueOperations).set(eq("user:permissions:kc-admin"), anyList());
        verify(valueOperations).set(eq("role:permissions:SUPER_ADMIN"), anyList());
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 14. getUserPermissionsForSync — user not found, returns empty list
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getUserPermissionsForSync_whenUserNotFound_returnsEmptyList() {
        when(userRepository.findByKeycloakId("kc-missing")).thenReturn(Optional.empty());
        when(redisTemplate.delete(anyString())).thenReturn(true);

        List<String> result = service.getUserPermissionsForSync("kc-missing");

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 15. getUserPermissionsFromRedis — found, returns list
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getUserPermissionsFromRedis_whenFound_returnsList() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        List<String> permissions = List.of("contact:view", "property:view");
        when(valueOperations.get("user:permissions:kc-123")).thenReturn(permissions);

        List<String> result = service.getUserPermissionsFromRedis("kc-123");

        assertEquals(2, result.size());
        assertTrue(result.contains("contact:view"));
        assertTrue(result.contains("property:view"));
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 16. getUserPermissionsFromRedis — not found, returns empty list
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getUserPermissionsFromRedis_whenNotFound_returnsEmptyList() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("user:permissions:kc-missing")).thenReturn(null);

        List<String> result = service.getUserPermissionsFromRedis("kc-missing");

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 17. getRolePermissionsFromRedis — found in Redis, returns directly
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getRolePermissionsFromRedis_whenFoundInRedis_returnsDirectly() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        List<String> cachedPermissions = List.of("contact:view", "contact:edit");
        when(valueOperations.get("role:permissions:HOST")).thenReturn(cachedPermissions);

        List<String> result = service.getRolePermissionsFromRedis("HOST");

        assertEquals(2, result.size());
        assertTrue(result.contains("contact:view"));
        // Should NOT have queried the database
        verifyNoInteractions(rolePermissionRepository);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 18. getRolePermissionsFromRedis — not in Redis, loads from DB and caches
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getRolePermissionsFromRedis_whenNotInRedis_loadsFromDbAndCaches() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("role:permissions:HOST")).thenReturn(null);

        List<String> dbPermissions = List.of("property:view", "property:edit");
        when(rolePermissionRepository.findActivePermissionsByRoleName("HOST")).thenReturn(dbPermissions);

        List<String> result = service.getRolePermissionsFromRedis("HOST");

        assertEquals(2, result.size());
        assertTrue(result.contains("property:view"));
        // Should have cached the result in Redis
        verify(valueOperations).set("role:permissions:HOST", dbPermissions);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 19. getRolePermissionsFromRedis — Redis error, falls back to DB
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getRolePermissionsFromRedis_whenRedisError_fallsBackToDb() {
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis connection refused"));

        List<String> dbPermissions = List.of("contact:view");
        when(rolePermissionRepository.findActivePermissionsByRoleName("HOST")).thenReturn(dbPermissions);

        List<String> result = service.getRolePermissionsFromRedis("HOST");

        assertEquals(1, result.size());
        assertTrue(result.contains("contact:view"));
        verify(rolePermissionRepository).findActivePermissionsByRoleName("HOST");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 20. updateUserPermissionsInRedis — success, returns true
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void updateUserPermissionsInRedis_whenSuccess_returnsTrue() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        List<String> permissions = List.of("contact:view", "property:view");

        boolean result = service.updateUserPermissionsInRedis("kc-123", permissions);

        assertTrue(result);
        verify(valueOperations).set("user:permissions:kc-123", permissions);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 21. updateUserPermissionsInRedis — error, returns false
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void updateUserPermissionsInRedis_whenRedisError_returnsFalse() {
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis write error"));

        boolean result = service.updateUserPermissionsInRedis("kc-123", List.of("contact:view"));

        assertFalse(result);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 22. invalidateUserPermissionsCache — deletes key
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void invalidateUserPermissionsCache_deletesRedisKey() {
        when(redisTemplate.delete(anyString())).thenReturn(true);

        service.invalidateUserPermissionsCache("kc-123");

        verify(redisTemplate).delete("user:permissions:kc-123");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 23. resetToDefaultPermissions — clears and returns empty DTO
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void resetToDefaultPermissions_clearsPermissionsAndReturnsEmptyDto() {
        when(redisTemplate.delete(anyString())).thenReturn(true);

        RolePermissionsDto result = service.resetToDefaultPermissions("HOST");

        assertNotNull(result);
        assertEquals("HOST", result.getRole());
        assertTrue(result.getPermissions().isEmpty());
        assertTrue(result.isDefault());
        // Verify Redis key was deleted
        verify(redisTemplate).delete("role:permissions:HOST");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 24. updateRolePermissions — full flow: validates, saves, invalidates, notifies
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void updateRolePermissions_fullFlow_savesThenInvalidatesAndNotifies() {
        String roleName = "HOST";
        List<String> newPermissions = List.of("contact:view", "property:view");

        // --- savePermissionsToDatabase setup ---
        Role roleObj = createRole(roleName);
        when(roleRepository.findByName(roleName)).thenReturn(Optional.of(roleObj));

        Permission contactView = createPermission("contact:view", "contact");
        Permission propertyView = createPermission("property:view", "property");
        when(permissionRepository.findByNameIn(newPermissions))
                .thenReturn(new ArrayList<>(List.of(contactView, propertyView)));
        when(rolePermissionRepository.save(any(RolePermission.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // --- invalidateCache setup (called twice: within savePermissionsToDatabase + explicit) ---
        when(redisTemplate.delete(anyString())).thenReturn(true);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

        User user1 = createUser("kc-host-1", UserRole.HOST, "host1@test.com");
        when(userRepository.findByRoleIn(eq(Arrays.asList(UserRole.HOST)), eq(1L)))
                .thenReturn(List.of(user1));

        // --- getRolePermissionsWithoutCache setup (reload after save) ---
        when(rolePermissionRepository.findActivePermissionsByRoleName(roleName))
                .thenReturn(newPermissions);

        RolePermissionsDto result = service.updateRolePermissions(roleName, newPermissions);

        // Verify result
        assertNotNull(result);
        assertEquals(roleName, result.getRole());
        assertEquals(2, result.getPermissions().size());

        // Verify old permissions were deleted
        verify(rolePermissionRepository).deleteByRoleName(roleName);

        // Verify entity manager flush/clear for transactional consistency
        verify(entityManager, atLeastOnce()).flush();
        verify(entityManager).clear();

        // Verify new permissions were saved
        verify(rolePermissionRepository, times(2)).save(any(RolePermission.class));

        // Verify notification was sent
        verify(notificationService).notifyAdminsAndManagers(
                any(), eq("Permissions modifiees"), contains("HOST"), eq("/permissions")
        );
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // Extra: invalidateAllCache with null caches from CacheManager
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void invalidateAllCache_whenCachesAreNull_doesNotThrow() {
        when(cacheManager.getCache("permissions")).thenReturn(null);
        when(cacheManager.getCache("roles")).thenReturn(null);
        when(redisTemplate.keys("role:permissions:*")).thenReturn(null);
        when(redisTemplate.keys("user:permissions:*")).thenReturn(null);

        assertDoesNotThrow(() -> service.invalidateAllCache());

        verify(redisTemplate).delete("roles:all");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // Extra: checkUserPermission with empty list in Redis returns false
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void checkUserPermission_whenRedisReturnsEmptyList_returnsFalse() {
        User user = createUser("kc-123", UserRole.HOST, "host@test.com");
        when(userRepository.findByKeycloakId("kc-123")).thenReturn(Optional.of(user));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("role:permissions:HOST")).thenReturn(new ArrayList<>());

        boolean result = service.checkUserPermission("kc-123", "contact:view");

        assertFalse(result);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // Extra: updateRolePermissions creates missing permissions automatically
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void updateRolePermissions_whenSomePermissionsMissing_createsThemAutomatically() {
        String roleName = "HOST";
        List<String> newPermissions = List.of("contact:view", "custom:new");

        Role roleObj = createRole(roleName);
        when(roleRepository.findByName(roleName)).thenReturn(Optional.of(roleObj));

        // Only contact:view exists, custom:new does not
        Permission contactView = createPermission("contact:view", "contact");
        when(permissionRepository.findByNameIn(newPermissions))
                .thenReturn(new ArrayList<>(List.of(contactView)));
        when(permissionRepository.save(any(Permission.class)))
                .thenAnswer(inv -> {
                    Permission p = inv.getArgument(0);
                    p.setId(999L);
                    return p;
                });
        when(rolePermissionRepository.save(any(RolePermission.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(redisTemplate.delete(anyString())).thenReturn(true);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(userRepository.findByRoleIn(eq(Arrays.asList(UserRole.HOST)), eq(1L)))
                .thenReturn(List.of());
        when(rolePermissionRepository.findActivePermissionsByRoleName(roleName))
                .thenReturn(newPermissions);

        RolePermissionsDto result = service.updateRolePermissions(roleName, newPermissions);

        assertNotNull(result);
        // Verify the missing permission was created in the DB
        verify(permissionRepository).save(argThat(p ->
                "custom:new".equals(p.getName()) && "custom".equals(p.getModule())
        ));
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // Extra: invalidateCache handles exception from findByRoleIn gracefully
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void invalidateCache_whenUserLookupFails_doesNotThrow() {
        when(redisTemplate.delete(anyString())).thenReturn(true);
        when(tenantContext.getRequiredOrganizationId()).thenThrow(new RuntimeException("No tenant"));

        assertDoesNotThrow(() -> service.invalidateCache("HOST"));

        // Redis key should still have been deleted
        verify(redisTemplate).delete("role:permissions:HOST");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // Extra: getUserPermissionsForSync with non-admin and no permissions returns empty
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getUserPermissionsForSync_whenNonAdminWithNoPermissions_returnsEmptyList() {
        User user = createUser("kc-host", UserRole.HOST, "host@test.com");
        when(userRepository.findByKeycloakId("kc-host")).thenReturn(Optional.of(user));
        when(redisTemplate.delete(anyString())).thenReturn(true);

        // DB returns empty — HOST is NOT a platform admin, so no fallback
        when(rolePermissionRepository.findActivePermissionsByRoleName("HOST"))
                .thenReturn(new ArrayList<>());

        List<String> result = service.getUserPermissionsForSync("kc-host");

        assertNotNull(result);
        assertTrue(result.isEmpty());
        // Should NOT have called getAllAvailablePermissions (no fallback for non-admin)
        verifyNoInteractions(permissionRepository);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // Extra: invalidateUserPermissionsCache handles Redis error gracefully
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void invalidateUserPermissionsCache_whenRedisError_doesNotThrow() {
        when(redisTemplate.delete(anyString())).thenThrow(new RuntimeException("Redis offline"));

        assertDoesNotThrow(() -> service.invalidateUserPermissionsCache("kc-123"));
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // Extra: updateRolePermissions when notification service is null, no exception
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void updateRolePermissions_whenNotificationServiceNull_doesNotThrow() {
        // Remove notification service
        ReflectionTestUtils.setField(service, "notificationService", null);

        String roleName = "HOST";
        List<String> newPermissions = List.of("contact:view");

        Role roleObj = createRole(roleName);
        when(roleRepository.findByName(roleName)).thenReturn(Optional.of(roleObj));
        Permission contactView = createPermission("contact:view", "contact");
        when(permissionRepository.findByNameIn(newPermissions))
                .thenReturn(new ArrayList<>(List.of(contactView)));
        when(rolePermissionRepository.save(any(RolePermission.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(redisTemplate.delete(anyString())).thenReturn(true);
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(userRepository.findByRoleIn(any(), eq(1L))).thenReturn(List.of());
        when(rolePermissionRepository.findActivePermissionsByRoleName(roleName))
                .thenReturn(newPermissions);

        assertDoesNotThrow(() -> service.updateRolePermissions(roleName, newPermissions));
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // Extra: getRolePermissionsFromRedis — empty list in Redis triggers DB load
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getRolePermissionsFromRedis_whenRedisReturnsEmptyList_loadsFromDb() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("role:permissions:HOST")).thenReturn(new ArrayList<>());

        List<String> dbPermissions = List.of("contact:view");
        when(rolePermissionRepository.findActivePermissionsByRoleName("HOST")).thenReturn(dbPermissions);

        List<String> result = service.getRolePermissionsFromRedis("HOST");

        assertEquals(1, result.size());
        assertTrue(result.contains("contact:view"));
        verify(valueOperations).set("role:permissions:HOST", dbPermissions);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // Extra: getUserPermissionsFromRedis — Redis error returns empty list
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    void getUserPermissionsFromRedis_whenRedisError_returnsEmptyList() {
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Connection refused"));

        List<String> result = service.getUserPermissionsFromRedis("kc-123");

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }
}
