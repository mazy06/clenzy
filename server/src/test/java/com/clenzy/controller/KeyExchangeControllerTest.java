package com.clenzy.controller;

import com.clenzy.dto.keyexchange.CreateKeyExchangeCodeDto;
import com.clenzy.dto.keyexchange.CreateKeyExchangePointDto;
import com.clenzy.dto.keyexchange.KeyExchangeCodeDto;
import com.clenzy.dto.keyexchange.KeyExchangeEventDto;
import com.clenzy.dto.keyexchange.KeyExchangePointDto;
import com.clenzy.dto.keyexchange.KeyNestStoreDto;
import com.clenzy.integration.keynest.KeyNestApiService;
import com.clenzy.service.KeyExchangeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KeyExchangeControllerTest {

    @Mock private KeyExchangeService keyExchangeService;
    @Mock private KeyNestApiService keyNestApiService;

    private KeyExchangeController controller;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        controller = new KeyExchangeController(keyExchangeService, keyNestApiService);
        jwt = Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .claim("sub", "kc-user-1")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .build();
    }

    private KeyExchangePointDto buildPoint(Long id) {
        KeyExchangePointDto p = new KeyExchangePointDto();
        p.setId(id);
        p.setStoreName("Store");
        return p;
    }

    private KeyExchangeCodeDto buildCode(Long id) {
        KeyExchangeCodeDto c = new KeyExchangeCodeDto();
        c.setId(id);
        c.setCode("123456");
        return c;
    }

    // ─── Points ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getPoints")
    class GetPoints {
        @Test
        void returnsList() {
            when(keyExchangeService.getPoints("kc-user-1"))
                .thenReturn(List.of(buildPoint(1L)));

            ResponseEntity<List<KeyExchangePointDto>> response = controller.getPoints(jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("createPoint")
    class CreatePoint {
        @Test
        void whenSuccess_returnsPoint() {
            CreateKeyExchangePointDto dto = new CreateKeyExchangePointDto();
            dto.setPropertyId(10L);
            dto.setStoreName("Store A");
            when(keyExchangeService.createPoint("kc-user-1", dto)).thenReturn(buildPoint(1L));

            ResponseEntity<?> response = controller.createPoint(jwt, dto);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenValidationError_returnsBadRequest() {
            CreateKeyExchangePointDto dto = new CreateKeyExchangePointDto();
            when(keyExchangeService.createPoint(eq("kc-user-1"), any()))
                .thenThrow(new IllegalArgumentException("propriete introuvable"));

            ResponseEntity<?> response = controller.createPoint(jwt, dto);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            assertThat(body.get("error")).isEqualTo("validation_error");
        }

        @Test
        void whenServerError_returns500() {
            CreateKeyExchangePointDto dto = new CreateKeyExchangePointDto();
            when(keyExchangeService.createPoint(anyString(), any()))
                .thenThrow(new RuntimeException("KeyNest API timeout"));

            ResponseEntity<?> response = controller.createPoint(jwt, dto);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("deletePoint")
    class DeletePoint {
        @Test
        void whenSuccess_returnsOk() {
            doNothing().when(keyExchangeService).deletePoint("kc-user-1", 5L);

            ResponseEntity<?> response = controller.deletePoint(jwt, 5L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(keyExchangeService).deletePoint("kc-user-1", 5L);
        }

        @Test
        void whenNotFound_returnsBadRequest() {
            doThrow(new IllegalArgumentException("not found"))
                .when(keyExchangeService).deletePoint(eq("kc-user-1"), eq(99L));

            ResponseEntity<?> response = controller.deletePoint(jwt, 99L);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenServerError_returns500() {
            doThrow(new RuntimeException("DB"))
                .when(keyExchangeService).deletePoint(anyString(), anyLong());

            ResponseEntity<?> response = controller.deletePoint(jwt, 5L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    // ─── Codes ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getActiveCodesByPoint")
    class GetActiveCodes {
        @Test
        void returnsList() {
            when(keyExchangeService.getActiveCodesByPoint(1L))
                .thenReturn(List.of(buildCode(1L)));

            ResponseEntity<List<KeyExchangeCodeDto>> response = controller.getActiveCodesByPoint(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("generateCode")
    class GenerateCode {
        @Test
        void whenSuccess_returnsCode() {
            CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
            dto.setPointId(1L);
            when(keyExchangeService.generateCode("kc-user-1", dto)).thenReturn(buildCode(99L));

            ResponseEntity<?> response = controller.generateCode(jwt, dto);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenValidationError_returnsBadRequest() {
            CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
            when(keyExchangeService.generateCode(eq("kc-user-1"), any()))
                .thenThrow(new IllegalStateException("provider unavailable"));

            ResponseEntity<?> response = controller.generateCode(jwt, dto);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenServerError_returns500() {
            CreateKeyExchangeCodeDto dto = new CreateKeyExchangeCodeDto();
            when(keyExchangeService.generateCode(anyString(), any()))
                .thenThrow(new RuntimeException("API"));

            ResponseEntity<?> response = controller.generateCode(jwt, dto);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("cancelCode")
    class CancelCode {
        @Test
        void whenSuccess_returnsOk() {
            doNothing().when(keyExchangeService).cancelCode("kc-user-1", 5L);

            ResponseEntity<?> response = controller.cancelCode(jwt, 5L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(keyExchangeService).cancelCode("kc-user-1", 5L);
        }

        @Test
        void whenValidationError_returnsBadRequest() {
            doThrow(new IllegalStateException("already used"))
                .when(keyExchangeService).cancelCode(eq("kc-user-1"), eq(99L));

            ResponseEntity<?> response = controller.cancelCode(jwt, 99L);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenServerError_returns500() {
            doThrow(new RuntimeException("API"))
                .when(keyExchangeService).cancelCode(anyString(), anyLong());

            ResponseEntity<?> response = controller.cancelCode(jwt, 5L);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    // ─── Events ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getEvents")
    class GetEvents {
        @Test
        void returnsPage() {
            KeyExchangeEventDto e = new KeyExchangeEventDto();
            e.setId(1L);
            Page<KeyExchangeEventDto> page = new PageImpl<>(List.of(e));
            when(keyExchangeService.getEvents(eq(10L), eq(0), eq(20))).thenReturn(page);

            ResponseEntity<Page<KeyExchangeEventDto>> response = controller.getEvents(10L, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().getContent()).hasSize(1);
        }

        @Test
        void nullPropertyId_returnsPage() {
            when(keyExchangeService.getEvents(eq(null), anyInt(), anyInt()))
                .thenReturn(Page.empty());

            ResponseEntity<Page<KeyExchangeEventDto>> response = controller.getEvents(null, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    // ─── KeyNest stores ────────────────────────────────────────────────

    @Nested
    @DisplayName("searchKeyNestStores")
    class SearchKeyNestStores {
        @Test
        void whenSuccess_returnsList() {
            KeyNestStoreDto s = new KeyNestStoreDto();
            s.setStoreId("knid-1");
            when(keyNestApiService.searchStores(48.0, 2.0, 5.0))
                .thenReturn(List.of(s));

            ResponseEntity<?> response = controller.searchKeyNestStores(48.0, 2.0, 5.0);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNotConfigured_returnsBadRequest() {
            when(keyNestApiService.searchStores(anyDouble(), anyDouble(), anyDouble()))
                .thenThrow(new IllegalStateException("not configured"));

            ResponseEntity<?> response = controller.searchKeyNestStores(48.0, 2.0, 5.0);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            assertThat(body.get("error")).isEqualTo("not_configured");
        }

        @Test
        void whenServerError_returns500() {
            when(keyNestApiService.searchStores(anyDouble(), anyDouble(), anyDouble()))
                .thenThrow(new RuntimeException("network"));

            ResponseEntity<?> response = controller.searchKeyNestStores(48.0, 2.0, 5.0);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }
}
