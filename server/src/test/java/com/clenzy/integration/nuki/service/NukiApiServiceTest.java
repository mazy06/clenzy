package com.clenzy.integration.nuki.service;

import com.clenzy.integration.nuki.config.NukiConfig;
import com.clenzy.service.smartlock.AccessCodeParams;
import com.clenzy.service.smartlock.AccessCodeParams.AccessCodeType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link NukiApiService}.
 *
 * <p>Covers Nuki Web API REST calls : lock actions, smartlock GET / LIST,
 * access code create / delete, plus header building (Bearer + JSON).</p>
 */
@ExtendWith(MockitoExtension.class)
class NukiApiServiceTest {

    private static final String API_URL = "https://api.nuki.io";

    @Mock private NukiConfig config;
    @Mock private RestTemplate restTemplate;

    private NukiApiService service;

    @BeforeEach
    void setUp() {
        service = new NukiApiService(config, restTemplate);
    }

    // ===================================================================
    // lockAction
    // ===================================================================

    @Nested
    @DisplayName("lockAction")
    class LockAction {

        @Test
        @DisplayName("POSTs action body to /smartlock/{id}/action with bearer token")
        void whenCalled_thenPostsActionPayload() {
            // Arrange
            when(config.getApiUrl()).thenReturn(API_URL);
            when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(Void.class)))
                    .thenReturn(new ResponseEntity<>(HttpStatus.NO_CONTENT));

            // Act
            service.lockAction("lock-1", NukiApiService.ACTION_UNLOCK, "tok-abc");

            // Assert
            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor =
                    ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).postForEntity(
                    eq(API_URL + "/smartlock/lock-1/action"),
                    captor.capture(), eq(Void.class));

            Map<String, Object> body = captor.getValue().getBody();
            assertThat(body).containsEntry("action", NukiApiService.ACTION_UNLOCK);

            HttpHeaders headers = captor.getValue().getHeaders();
            assertThat(headers.getFirst("Authorization")).isEqualTo("Bearer tok-abc");
            assertThat(headers.getContentType()).isEqualTo(MediaType.APPLICATION_JSON);
            assertThat(headers.getAccept()).contains(MediaType.APPLICATION_JSON);
        }

        @Test
        @DisplayName("exposes documented action constants")
        void actionConstants_areCorrectlyDefined() {
            assertThat(NukiApiService.ACTION_UNLOCK).isEqualTo(1);
            assertThat(NukiApiService.ACTION_LOCK).isEqualTo(2);
            assertThat(NukiApiService.ACTION_UNLATCH).isEqualTo(3);
            assertThat(NukiApiService.ACTION_LOCK_N_GO).isEqualTo(4);
        }
    }

    // ===================================================================
    // getSmartlock
    // ===================================================================

    @Nested
    @DisplayName("getSmartlock")
    class GetSmartlock {

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("returns smartlock JSON body")
        void whenSmartlockExists_thenReturnsBody() {
            // Arrange
            when(config.getApiUrl()).thenReturn(API_URL);
            Map<String, Object> data = Map.of("smartlockId", 12345L, "name", "Front Door");
            ResponseEntity<Map<String, Object>> response =
                    new ResponseEntity<>(data, HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET),
                    any(HttpEntity.class), any(ParameterizedTypeReference.class)))
                    .thenReturn(response);

            // Act
            Map<String, Object> result = service.getSmartlock("lock-2", "tok");

            // Assert
            assertThat(result).containsEntry("name", "Front Door");
            verify(restTemplate).exchange(
                    eq(API_URL + "/smartlock/lock-2"),
                    eq(HttpMethod.GET), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class));
        }
    }

    // ===================================================================
    // listSmartlocks
    // ===================================================================

    @Nested
    @DisplayName("listSmartlocks")
    class ListSmartlocks {

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("returns list of smartlocks from /smartlock")
        void whenCalled_thenReturnsList() {
            // Arrange
            when(config.getApiUrl()).thenReturn(API_URL);
            List<Map<String, Object>> data = List.of(
                    Map.of("smartlockId", 1L, "name", "A"),
                    Map.of("smartlockId", 2L, "name", "B"));
            ResponseEntity<List<Map<String, Object>>> response =
                    new ResponseEntity<>(data, HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET),
                    any(HttpEntity.class), any(ParameterizedTypeReference.class)))
                    .thenReturn(response);

            // Act
            List<Map<String, Object>> result = service.listSmartlocks("tok-x");

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result).extracting(m -> m.get("name")).containsExactly("A", "B");
            verify(restTemplate).exchange(
                    eq(API_URL + "/smartlock"),
                    eq(HttpMethod.GET), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class));
        }
    }

    // ===================================================================
    // createWebApiCode
    // ===================================================================

    @Nested
    @DisplayName("createWebApiCode")
    class CreateWebApiCode {

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("PUTs full payload with name, type (3), code, validFrom, validUntil")
        void whenAllFieldsProvided_thenSendsFullPayload() {
            // Arrange
            when(config.getApiUrl()).thenReturn(API_URL);
            ResponseEntity<Map<String, Object>> response =
                    new ResponseEntity<>(Map.of("id", 9999L), HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT),
                    any(HttpEntity.class), any(ParameterizedTypeReference.class)))
                    .thenReturn(response);

            AccessCodeParams params = new AccessCodeParams(
                    "123456",
                    "Clenzy-Alice",
                    LocalDateTime.of(2026, 6, 1, 14, 0),
                    LocalDateTime.of(2026, 6, 5, 12, 0),
                    AccessCodeType.TEMPORARY);

            // Act
            Map<String, Object> result = service.createWebApiCode("lock-5", params, "tok");

            // Assert
            assertThat(result).containsEntry("id", 9999L);

            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor =
                    ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).exchange(
                    eq(API_URL + "/smartlock/lock-5/auth"),
                    eq(HttpMethod.PUT), captor.capture(),
                    any(ParameterizedTypeReference.class));

            Map<String, Object> body = captor.getValue().getBody();
            assertThat(body)
                    .containsEntry("name", "Clenzy-Alice")
                    .containsEntry("type", 3) // mapped to Keypad code
                    .containsEntry("code", 123456);
            // validFrom / validUntil parsed as UTC instant strings
            assertThat(body.get("allowedFromDate"))
                    .isEqualTo(LocalDateTime.of(2026, 6, 1, 14, 0)
                            .toInstant(java.time.ZoneOffset.UTC).toString());
            assertThat(body.get("allowedUntilDate"))
                    .isEqualTo(LocalDateTime.of(2026, 6, 5, 12, 0)
                            .toInstant(java.time.ZoneOffset.UTC).toString());
        }

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("omits code and dates when null")
        void whenCodeAndDatesNull_thenOmitsThem() {
            // Arrange
            when(config.getApiUrl()).thenReturn(API_URL);
            ResponseEntity<Map<String, Object>> response =
                    new ResponseEntity<>(Map.of("id", 1L), HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT),
                    any(HttpEntity.class), any(ParameterizedTypeReference.class)))
                    .thenReturn(response);

            AccessCodeParams params = new AccessCodeParams(
                    null, "n", null, null, AccessCodeType.PERMANENT);

            // Act
            service.createWebApiCode("lock-6", params, "tok");

            // Assert
            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor =
                    ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).exchange(anyString(), eq(HttpMethod.PUT),
                    captor.capture(), any(ParameterizedTypeReference.class));

            Map<String, Object> body = captor.getValue().getBody();
            assertThat(body)
                    .containsEntry("name", "n")
                    .containsEntry("type", 3)
                    .doesNotContainKeys("code", "allowedFromDate", "allowedUntilDate");
        }

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("always maps every Clenzy access code type to Nuki keypad type 3")
        void whenAnyType_thenAlwaysMapsToKeypadType3() {
            // Arrange
            when(config.getApiUrl()).thenReturn(API_URL);
            ResponseEntity<Map<String, Object>> response =
                    new ResponseEntity<>(Map.of(), HttpStatus.OK);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT),
                    any(HttpEntity.class), any(ParameterizedTypeReference.class)))
                    .thenReturn(response);

            for (AccessCodeType type : AccessCodeType.values()) {
                AccessCodeParams params = new AccessCodeParams(
                        null, "code-" + type, null, null, type);

                // Act
                service.createWebApiCode("lock-x", params, "tok");
            }

            // Assert
            ArgumentCaptor<HttpEntity<Map<String, Object>>> captor =
                    ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate, org.mockito.Mockito.times(AccessCodeType.values().length))
                    .exchange(anyString(), eq(HttpMethod.PUT),
                            captor.capture(), any(ParameterizedTypeReference.class));

            captor.getAllValues().forEach(entity ->
                    assertThat(entity.getBody()).containsEntry("type", 3));
        }
    }

    // ===================================================================
    // deleteWebApiCode
    // ===================================================================

    @Nested
    @DisplayName("deleteWebApiCode")
    class DeleteWebApiCode {

        @Test
        @DisplayName("sends DELETE to /smartlock/{id}/auth/{codeId}")
        void whenCalled_thenSendsDelete() {
            // Arrange
            when(config.getApiUrl()).thenReturn(API_URL);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.DELETE),
                    any(HttpEntity.class), eq(Void.class)))
                    .thenReturn(new ResponseEntity<>(HttpStatus.NO_CONTENT));

            // Act
            service.deleteWebApiCode("lock-7", "code-42", "tok");

            // Assert
            ArgumentCaptor<HttpEntity<Void>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).exchange(
                    eq(API_URL + "/smartlock/lock-7/auth/code-42"),
                    eq(HttpMethod.DELETE), captor.capture(), eq(Void.class));

            HttpHeaders headers = captor.getValue().getHeaders();
            assertThat(headers.getFirst("Authorization")).isEqualTo("Bearer tok");
        }
    }
}
