package com.clenzy.integration.keynest;

import com.clenzy.dto.keyexchange.KeyNestStoreDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KeyNestApiServiceTest {

    @Mock private RestTemplate restTemplate;
    @Mock private KeyNestConfig config;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private KeyNestApiService service;

    @BeforeEach
    void setUp() {
        service = new KeyNestApiService(config, restTemplate, objectMapper);
        lenient().when(config.isConfigured()).thenReturn(true);
        lenient().when(config.getApiUrl()).thenReturn("https://api.keynest.com/v3");
        lenient().when(config.getApiKey()).thenReturn("test-api-key");
    }

    @Nested
    @DisplayName("searchStores")
    class SearchStores {

        @Test
        @SuppressWarnings("unchecked")
        void whenStoresFound_thenReturnsList() {
            List<Map<String, Object>> body = List.of(
                    Map.of("id", "s1", "name", "Cafe Centro", "address", "1 rue",
                            "lat", 48.85, "lng", 2.35, "distance", 0.5, "opening_hours", "8-20", "type", "cafe")
            );
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(body));

            List<KeyNestStoreDto> result = service.searchStores(48.85, 2.35, 5.0);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getStoreId()).isEqualTo("s1");
            assertThat(result.get(0).getName()).isEqualTo("Cafe Centro");
            assertThat(result.get(0).getLat()).isEqualTo(48.85);
        }

        @Test
        void whenNotConfigured_thenReturnsEmpty() {
            when(config.isConfigured()).thenReturn(false);

            List<KeyNestStoreDto> result = service.searchStores(48.85, 2.35, 5.0);
            assertThat(result).isEmpty();
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenBodyNull_thenReturnsEmpty() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(null));

            assertThat(service.searchStores(0, 0, 0)).isEmpty();
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenExceptionThrown_thenPropagates() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class)))
                    .thenThrow(new RuntimeException("KeyNest API down"));

            assertThatThrownBy(() -> service.searchStores(48.85, 2.35, 5.0))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("createKeyWithCollectionCode")
    class CreateKey {

        @Test
        @SuppressWarnings("unchecked")
        void whenSucceeds_thenReturnsKeyAndCode() {
            Map<String, Object> body = Map.of("key_id", "k1", "collection_code", "ABC123");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(body));

            Map<String, String> result = service.createKeyWithCollectionCode("store-1", "Front Door");

            assertThat(result).containsEntry("keyId", "k1").containsEntry("collectionCode", "ABC123");
        }

        @Test
        void whenNotConfigured_thenThrows() {
            when(config.isConfigured()).thenReturn(false);
            assertThatThrownBy(() -> service.createKeyWithCollectionCode("s1", "k"))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenResponseBodyNull_thenThrows() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(null));

            assertThatThrownBy(() -> service.createKeyWithCollectionCode("s1", "k"))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("createCollectionCode")
    class CreateCode {

        @Test
        @SuppressWarnings("unchecked")
        void whenSucceeds_thenReturnsCode() {
            Map<String, Object> body = Map.of("code_id", "c1", "code", "XYZ");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(body));

            Map<String, String> result = service.createCollectionCode("k1");
            assertThat(result).containsEntry("codeId", "c1").containsEntry("code", "XYZ");
        }

        @Test
        void whenNotConfigured_thenThrows() {
            when(config.isConfigured()).thenReturn(false);
            assertThatThrownBy(() -> service.createCollectionCode("k1"))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("cancelCode")
    class CancelCode {

        @Test
        void whenSucceeds_thenInvokesDelete() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.DELETE), any(HttpEntity.class), eq(Void.class)))
                    .thenReturn(ResponseEntity.noContent().build());

            service.cancelCode("c1");
            // No exception = success
        }

        @Test
        void whenNotConfigured_thenThrows() {
            when(config.isConfigured()).thenReturn(false);
            assertThatThrownBy(() -> service.cancelCode("c1"))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void whenApiFails_thenPropagates() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.DELETE), any(HttpEntity.class), eq(Void.class)))
                    .thenThrow(new RuntimeException("Boom"));

            assertThatThrownBy(() -> service.cancelCode("c1"))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("getKeyStatus")
    class GetKeyStatus {

        @Test
        @SuppressWarnings("unchecked")
        void whenSucceeds_thenReturnsBody() {
            Map<String, Object> body = Map.of("status", "deposited");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(body));

            Map<String, Object> result = service.getKeyStatus("k1");
            assertThat(result).containsEntry("status", "deposited");
        }

        @Test
        void whenNotConfigured_thenReturnsUnknown() {
            when(config.isConfigured()).thenReturn(false);
            Map<String, Object> result = service.getKeyStatus("k1");
            assertThat(result).containsEntry("status", "UNKNOWN");
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenApiFails_thenReturnsErrorStatus() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class)))
                    .thenThrow(new RuntimeException("Down"));

            Map<String, Object> result = service.getKeyStatus("k1");
            assertThat(result).containsEntry("status", "ERROR");
        }
    }
}
