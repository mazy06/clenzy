package com.clenzy.controller;

import com.clenzy.dto.smartlock.CreateSmartLockDeviceDto;
import com.clenzy.dto.smartlock.SmartLockDeviceDto;
import com.clenzy.service.SmartLockService;
import com.clenzy.service.smartlock.SmartLockAccessCodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SmartLockControllerTest {

    @Mock private SmartLockService smartLockService;
    @Mock private SmartLockAccessCodeService accessCodeService;

    private SmartLockController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new SmartLockController(smartLockService, accessCodeService);
        jwt = Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .claim("sub", "kc-user-1")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .build();
    }

    private SmartLockDeviceDto buildDto(Long id) {
        SmartLockDeviceDto d = new SmartLockDeviceDto();
        d.setId(id);
        d.setName("Lock A");
        d.setStatus("ACTIVE");
        return d;
    }

    private CreateSmartLockDeviceDto buildCreateDto() {
        CreateSmartLockDeviceDto dto = new CreateSmartLockDeviceDto();
        dto.setName("New Lock");
        dto.setPropertyId(10L);
        return dto;
    }

    @Nested
    @DisplayName("getUserDevices")
    class GetUserDevices {
        @Test
        void returnsList() {
            when(smartLockService.getUserDevices("kc-user-1"))
                .thenReturn(List.of(buildDto(1L), buildDto(2L)));

            ResponseEntity<List<SmartLockDeviceDto>> response = controller.getUserDevices(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(2);
        }
    }

    @Nested
    @DisplayName("createDevice")
    class CreateDevice {
        @Test
        void whenSuccess_returnsDevice() {
            CreateSmartLockDeviceDto dto = buildCreateDto();
            SmartLockDeviceDto result = buildDto(99L);
            when(smartLockService.createDevice(eq("kc-user-1"), eq(dto))).thenReturn(result);

            ResponseEntity<?> response = controller.createDevice(jwt, dto);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isInstanceOf(SmartLockDeviceDto.class);
        }

        @Test
        void whenValidationError_returnsBadRequest() {
            CreateSmartLockDeviceDto dto = buildCreateDto();
            when(smartLockService.createDevice(eq("kc-user-1"), eq(dto)))
                .thenThrow(new IllegalArgumentException("Property introuvable"));

            ResponseEntity<?> response = controller.createDevice(jwt, dto);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            assertThat(body.get("error")).isEqualTo("validation_error");
        }

        @Test
        void whenUnexpectedError_returns500() {
            CreateSmartLockDeviceDto dto = buildCreateDto();
            when(smartLockService.createDevice(eq("kc-user-1"), eq(dto)))
                .thenThrow(new RuntimeException("DB down"));

            ResponseEntity<?> response = controller.createDevice(jwt, dto);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            assertThat(body.get("error")).isEqualTo("server_error");
        }
    }

    @Nested
    @DisplayName("deleteDevice")
    class DeleteDevice {
        @Test
        void whenSuccess_returnsOk() {
            doNothing().when(smartLockService).deleteDevice("kc-user-1", 5L);

            ResponseEntity<?> response = controller.deleteDevice(jwt, 5L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            assertThat(body.get("status")).isEqualTo("deleted");
            verify(smartLockService).deleteDevice("kc-user-1", 5L);
        }

        @Test
        void whenNotFound_returnsBadRequest() {
            doThrow(new IllegalArgumentException("not found"))
                .when(smartLockService).deleteDevice(eq("kc-user-1"), eq(99L));

            ResponseEntity<?> response = controller.deleteDevice(jwt, 99L);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            assertThat(body.get("error")).isEqualTo("not_found");
        }

        @Test
        void whenServerError_returns500() {
            doThrow(new RuntimeException("DB down"))
                .when(smartLockService).deleteDevice(anyString(), anyLong());

            ResponseEntity<?> response = controller.deleteDevice(jwt, 5L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("getLockStatus")
    class GetLockStatus {
        @Test
        void whenSuccess_returnsStatus() {
            Map<String, Object> status = Map.of("locked", true, "battery", 85);
            when(smartLockService.getLockStatus("kc-user-1", 1L)).thenReturn(status);

            ResponseEntity<?> response = controller.getLockStatus(jwt, 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotFound_returnsBadRequest() {
            when(smartLockService.getLockStatus(eq("kc-user-1"), eq(99L)))
                .thenThrow(new IllegalArgumentException("not found"));

            ResponseEntity<?> response = controller.getLockStatus(jwt, 99L);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenApiError_returns500() {
            when(smartLockService.getLockStatus(anyString(), anyLong()))
                .thenThrow(new RuntimeException("API timeout"));

            ResponseEntity<?> response = controller.getLockStatus(jwt, 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("lockDevice")
    class LockDevice {
        @Test
        void whenSuccess_returnsLocked() {
            doNothing().when(smartLockService).sendLockCommand("kc-user-1", 1L, true);

            ResponseEntity<?> response = controller.lockDevice(jwt, 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            assertThat(body.get("status")).isEqualTo("locked");
            verify(smartLockService).sendLockCommand("kc-user-1", 1L, true);
        }

        @Test
        void whenCommandError_returnsBadRequest() {
            doThrow(new IllegalStateException("offline"))
                .when(smartLockService).sendLockCommand(eq("kc-user-1"), eq(1L), eq(true));

            ResponseEntity<?> response = controller.lockDevice(jwt, 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenServerError_returns500() {
            doThrow(new RuntimeException("API down"))
                .when(smartLockService).sendLockCommand(anyString(), anyLong(), anyBoolean());

            ResponseEntity<?> response = controller.lockDevice(jwt, 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("unlockDevice")
    class UnlockDevice {
        @Test
        void whenSuccess_returnsUnlocked() {
            doNothing().when(smartLockService).sendLockCommand("kc-user-1", 1L, false);

            ResponseEntity<?> response = controller.unlockDevice(jwt, 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            assertThat(body.get("status")).isEqualTo("unlocked");
            verify(smartLockService).sendLockCommand("kc-user-1", 1L, false);
        }

        @Test
        void whenCommandError_returnsBadRequest() {
            doThrow(new IllegalArgumentException("bad device"))
                .when(smartLockService).sendLockCommand(eq("kc-user-1"), eq(1L), eq(false));

            ResponseEntity<?> response = controller.unlockDevice(jwt, 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenServerError_returns500() {
            doThrow(new RuntimeException("API down"))
                .when(smartLockService).sendLockCommand(anyString(), anyLong(), anyBoolean());

            ResponseEntity<?> response = controller.unlockDevice(jwt, 1L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }
}
