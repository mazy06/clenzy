package com.clenzy.integration.netatmo.service;

import com.clenzy.integration.netatmo.config.NetatmoConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class NetatmoApiServiceTest {

    @Mock NetatmoConfig config;
    @Mock NetatmoOAuthService oAuthService;
    @Mock RestTemplate restTemplate;

    NetatmoApiService service;

    @BeforeEach
    void setUp() {
        service = new NetatmoApiService(config, oAuthService, restTemplate);
        lenient().when(config.getApiBaseUrl()).thenReturn("https://api.netatmo.com");
        lenient().when(oAuthService.getValidAccessToken("u")).thenReturn("tok");
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void getStationsData_dedupeWithinTtl_singleNetatmoCall() {
        ResponseEntity<Map<String, Object>> resp =
                ResponseEntity.ok(Map.of("body", Map.of("devices", List.of())));
        doReturn(resp).when(restTemplate).exchange(
                anyString(), eq(HttpMethod.GET), any(), any(ParameterizedTypeReference.class));

        // Burst : 3 lectures du même compte dans la fenêtre TTL.
        service.getStationsData("u");
        service.getStationsData("u");
        service.getStationsData("u");

        // → un seul appel réseau Netatmo (les 2 suivants servis par le cache).
        verify(restTemplate, times(1)).exchange(
                anyString(), eq(HttpMethod.GET), any(), any(ParameterizedTypeReference.class));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void distinctUsers_notShared() {
        ResponseEntity<Map<String, Object>> resp =
                ResponseEntity.ok(Map.of("body", Map.of("devices", List.of())));
        lenient().when(oAuthService.getValidAccessToken("v")).thenReturn("tok2");
        doReturn(resp).when(restTemplate).exchange(
                anyString(), eq(HttpMethod.GET), any(), any(ParameterizedTypeReference.class));

        service.getStationsData("u");
        service.getStationsData("v"); // clé de cache différente → appel distinct

        verify(restTemplate, times(2)).exchange(
                anyString(), eq(HttpMethod.GET), any(), any(ParameterizedTypeReference.class));
    }
}
