package com.clenzy.controller;

import com.clenzy.dto.RolePermissionsDto;
import com.clenzy.service.PermissionService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PermissionControllerTest {

    @Mock private PermissionService permissionService;

    private PermissionController controller;

    @BeforeEach
    void setUp() {
        controller = new PermissionController(permissionService);
    }

    @Nested
    @DisplayName("getAllRoles")
    class GetAllRoles {
        @Test
        void whenSuccess_thenReturnsList() {
            when(permissionService.getAllRoles()).thenReturn(List.of("SUPER_ADMIN", "HOST"));

            ResponseEntity<List<String>> response = controller.getAllRoles();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(2);
        }
    }

    @Nested
    @DisplayName("getRolePermissions")
    class GetRolePerms {
        @Test
        void whenSuccess_thenReturnsDto() {
            RolePermissionsDto dto = new RolePermissionsDto();
            dto.setPermissions(List.of("properties.read"));
            when(permissionService.getRolePermissions("HOST")).thenReturn(dto);

            ResponseEntity<RolePermissionsDto> response = controller.getRolePermissions("HOST");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("updateRolePermissions")
    class UpdateRolePerms {
        @Test
        void whenSuccess_thenReturnsUpdated() {
            RolePermissionsDto dto = new RolePermissionsDto();
            dto.setPermissions(List.of("p1", "p2"));
            when(permissionService.updateRolePermissions("HOST", List.of("p1", "p2"))).thenReturn(dto);

            ResponseEntity<RolePermissionsDto> response = controller.updateRolePermissions("HOST", List.of("p1", "p2"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("getDefaultPermissions")
    class DefaultPerms {
        @Test
        void whenSuccess_thenReturnsMap() {
            Map<String, List<String>> defaults = Map.of("HOST", List.of("p1"), "ADMIN", List.of("p1", "p2"));
            when(permissionService.getDefaultPermissions()).thenReturn(defaults);

            ResponseEntity<Map<String, List<String>>> response = controller.getDefaultPermissions();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsKey("HOST");
        }
    }

    @Nested
    @DisplayName("getAllAvailablePermissions")
    class AllPerms {
        @Test
        void whenSuccess_thenReturnsList() {
            when(permissionService.getAllAvailablePermissions()).thenReturn(List.of("p1", "p2", "p3"));

            ResponseEntity<List<String>> response = controller.getAllAvailablePermissions();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(3);
        }
    }

    @Nested
    @DisplayName("saveRolePermissions")
    class Save {
        @Test
        void whenSaved_thenReturnsOk() {
            when(permissionService.saveRolePermissions("HOST")).thenReturn(true);

            ResponseEntity<Map<String, Object>> response = controller.saveRolePermissions("HOST");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotSaved_thenStillOk() {
            when(permissionService.saveRolePermissions("HOST")).thenReturn(false);

            ResponseEntity<Map<String, Object>> response = controller.saveRolePermissions("HOST");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenException_thenReturns500() {
            when(permissionService.saveRolePermissions("HOST")).thenThrow(new RuntimeException("err"));

            ResponseEntity<Map<String, Object>> response = controller.saveRolePermissions("HOST");

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("resetToInitialPermissions")
    class ResetInitial {
        @Test
        void whenSuccess_thenReturnsOk() {
            RolePermissionsDto dto = new RolePermissionsDto();
            dto.setPermissions(List.of("p1"));
            when(permissionService.resetToInitialPermissions("HOST")).thenReturn(dto);

            ResponseEntity<Map<String, Object>> response = controller.resetToInitialPermissions("HOST");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("checkUserPermission")
    class Check {
        @Test
        void whenValidRequest_thenReturnsResult() {
            when(permissionService.checkUserPermission("user-1", "properties.read")).thenReturn(true);

            Map<String, String> request = new HashMap<>();
            request.put("permission", "properties.read");
            request.put("userId", "user-1");

            ResponseEntity<Map<String, Object>> response = controller.checkUserPermission(request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).containsEntry("hasPermission", true);
        }

        @Test
        void whenMissingParams_thenBadRequest() {
            ResponseEntity<Map<String, Object>> response = controller.checkUserPermission(Map.of());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("resetRolePermissions")
    class Reset {
        @Test
        void whenSuccess_thenReturnsOk() {
            RolePermissionsDto dto = new RolePermissionsDto();
            when(permissionService.resetToDefaultPermissions("HOST")).thenReturn(dto);

            ResponseEntity<RolePermissionsDto> response = controller.resetRolePermissions("HOST");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenException_thenBadRequest() {
            when(permissionService.resetToDefaultPermissions("HOST")).thenThrow(new RuntimeException("err"));

            ResponseEntity<RolePermissionsDto> response = controller.resetRolePermissions("HOST");

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("cacheInvalidation")
    class Cache {
        @Test
        void whenInvalidateRole_thenReturnsOk() {
            ResponseEntity<Map<String, String>> response = controller.invalidateRoleCache("HOST");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(permissionService).invalidateCache("HOST");
        }

        @Test
        void whenInvalidateAll_thenReturnsOk() {
            ResponseEntity<Map<String, String>> response = controller.invalidateAllCache();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(permissionService).invalidateAllCache();
        }
    }

    @Nested
    @DisplayName("syncAndRedis")
    class SyncRedis {
        @Test
        void whenSync_thenReturnsPermissions() {
            when(permissionService.getUserPermissionsForSync("user-1")).thenReturn(List.of("p1"));

            Map<String, String> request = new HashMap<>();
            request.put("userId", "user-1");
            ResponseEntity<Map<String, Object>> response = controller.syncUserPermissions(request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenSyncNoUserId_thenBadRequest() {
            ResponseEntity<Map<String, Object>> response = controller.syncUserPermissions(Map.of());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenGetRedis_thenReturnsPermissions() {
            when(permissionService.getUserPermissionsFromRedis("user-1")).thenReturn(List.of("p1"));

            ResponseEntity<Map<String, Object>> response = controller.getPermissionsFromRedis("user-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenUpdateRedis_thenReturnsOk() {
            when(permissionService.updateUserPermissionsInRedis("user-1", List.of("p1"))).thenReturn(true);

            Map<String, Object> request = new HashMap<>();
            request.put("permissions", List.of("p1"));
            ResponseEntity<Map<String, Object>> response = controller.updatePermissionsInRedis("user-1", request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenUpdateRedisNoPerms_thenBadRequest() {
            ResponseEntity<Map<String, Object>> response = controller.updatePermissionsInRedis("user-1", Map.of());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenInvalidateUserCache_thenReturnsOk() {
            ResponseEntity<Map<String, Object>> response = controller.invalidateUserCache("user-1");

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(permissionService).invalidateUserPermissionsCache("user-1");
        }
    }
}
