package com.clenzy.service;

import com.clenzy.dto.ExternalPriceRecommendation;
import com.clenzy.model.ExternalPricingConfig;
import com.clenzy.model.PricingProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PriceLabsServiceTest {

    @Mock private RestTemplate restTemplate;
    @Mock private ObjectMapper objectMapper;

    private PriceLabsService service;

    @BeforeEach
    void setUp() {
        service = new PriceLabsService(restTemplate, objectMapper);
    }

    private ExternalPricingConfig createConfig(Map<String, String> mappings) {
        ExternalPricingConfig config = new ExternalPricingConfig();
        config.setId(1L);
        config.setOrganizationId(1L);
        config.setProvider(PricingProvider.PRICELABS);
        config.setApiKey("test-api-key");
        config.setApiUrl("https://api.pricelabs.co");
        config.setPropertyMappings(mappings);
        config.setEnabled(true);
        return config;
    }

    @SuppressWarnings("unchecked")
    private void mockRestTemplateExchange() {
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
            .thenReturn(ResponseEntity.ok("[]"));
    }

    @Test
    void fetchRecommendations_withMapping_returnsEmptyMvp() {
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-listing-123"));
        mockRestTemplateExchange();

        List<ExternalPriceRecommendation> result = service.fetchRecommendations(
            config, 100L, LocalDate.now(), LocalDate.now().plusDays(30));

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void fetchRecommendations_withoutMapping_returnsEmpty() {
        ExternalPricingConfig config = createConfig(Map.of("200", "pl-listing-456"));

        List<ExternalPriceRecommendation> result = service.fetchRecommendations(
            config, 999L, LocalDate.now(), LocalDate.now().plusDays(30));

        assertTrue(result.isEmpty());
    }

    @Test
    void fetchRecommendations_nullMappings_returnsEmpty() {
        ExternalPricingConfig config = createConfig(null);
        config.setPropertyMappings(null);

        List<ExternalPriceRecommendation> result = service.fetchRecommendations(
            config, 100L, LocalDate.now(), LocalDate.now().plusDays(30));

        assertTrue(result.isEmpty());
    }

    @Test
    void pushListingData_withMapping_doesNotThrow() {
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-listing-123"));
        mockRestTemplateExchange();

        assertDoesNotThrow(() -> service.pushListingData(config, 100L));
    }

    @Test
    void pushListingData_withoutMapping_doesNotThrow() {
        ExternalPricingConfig config = createConfig(Map.of());

        assertDoesNotThrow(() -> service.pushListingData(config, 100L));
    }

    @Test
    void fetchRecommendations_emptyMappings_returnsEmpty() {
        ExternalPricingConfig config = createConfig(Map.of());

        List<ExternalPriceRecommendation> result = service.fetchRecommendations(
            config, 100L, LocalDate.now(), LocalDate.now().plusDays(30));

        assertTrue(result.isEmpty());
    }

    // ── Response parsing tests (use real ObjectMapper for accurate parsing) ──

    @SuppressWarnings("unchecked")
    @org.junit.jupiter.api.Test
    void fetchRecommendations_validResponseWithPrices_parsedCorrectly() throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper realMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-1"));
        PriceLabsService realParserService = new PriceLabsService(restTemplate, realMapper);

        String body = "{\"status\":\"success\",\"data\":{\"prices\":["
                + "{\"date\":\"2026-07-15\",\"price\":150.00,\"currency\":\"EUR\",\"confidence\":0.85},"
                + "{\"date\":\"2026-07-16\",\"price\":160.00}"
                + "]}}";
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(body));

        List<ExternalPriceRecommendation> result = realParserService.fetchRecommendations(
                config, 100L, LocalDate.of(2026, 7, 15), LocalDate.of(2026, 7, 31));

        assertEquals(2, result.size());
        assertEquals(LocalDate.of(2026, 7, 15), result.get(0).date());
        assertEquals(0, new java.math.BigDecimal("150.0").compareTo(result.get(0).recommendedPrice()));
        assertEquals("EUR", result.get(0).currency());
        assertEquals(0.85, result.get(0).confidence());
    }

    @org.junit.jupiter.api.Test
    void fetchRecommendations_responseWithMalformedDateEntry_skipped() throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper realMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-1"));
        PriceLabsService realParserService = new PriceLabsService(restTemplate, realMapper);

        String body = "{\"status\":\"success\",\"data\":{\"prices\":["
                + "{\"date\":\"not-a-date\",\"price\":100.00},"
                + "{\"date\":\"2026-08-01\",\"price\":120.00}"
                + "]}}";
        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(body));

        List<ExternalPriceRecommendation> result = realParserService.fetchRecommendations(
                config, 100L, LocalDate.now(), LocalDate.now().plusDays(10));

        // Bad date skipped, good one kept
        assertEquals(1, result.size());
    }

    @org.junit.jupiter.api.Test
    void fetchRecommendations_responseEmptyData_returnsEmpty() throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper realMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-1"));
        PriceLabsService realParserService = new PriceLabsService(restTemplate, realMapper);

        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"status\":\"success\"}"));

        List<ExternalPriceRecommendation> result = realParserService.fetchRecommendations(
                config, 100L, LocalDate.now(), LocalDate.now().plusDays(10));

        assertTrue(result.isEmpty());
    }

    @org.junit.jupiter.api.Test
    void fetchRecommendations_nonSuccessfulHttp_returnsEmpty() {
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-1"));

        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.status(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE).body("error"));

        List<ExternalPriceRecommendation> result = service.fetchRecommendations(
                config, 100L, LocalDate.now(), LocalDate.now().plusDays(10));

        assertTrue(result.isEmpty());
    }

    @org.junit.jupiter.api.Test
    void fetchRecommendations_restClientException_throwsForCircuitBreaker() {
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-1"));

        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new org.springframework.web.client.RestClientException("Connection refused"));

        org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.client.RestClientException.class,
                () -> service.fetchRecommendations(config, 100L,
                        LocalDate.now(), LocalDate.now().plusDays(10)));
    }

    @org.junit.jupiter.api.Test
    void pushListingData_restClientException_throwsForCircuitBreaker() {
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-1"));

        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new org.springframework.web.client.RestClientException("Connection refused"));

        org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.client.RestClientException.class,
                () -> service.pushListingData(config, 100L));
    }

    @org.junit.jupiter.api.Test
    void pushListingData_nonSuccessfulHttp_doesNotThrow() {
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-1"));

        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.status(org.springframework.http.HttpStatus.BAD_GATEWAY).body("err"));

        // Push should not throw — only logs
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(
                () -> service.pushListingData(config, 100L));
    }

    @org.junit.jupiter.api.Test
    void fetchRecommendations_customApiUrl_isUsed() {
        ExternalPricingConfig config = createConfig(Map.of("100", "pl-1"));
        config.setApiUrl("https://custom.pricelabs.example");

        when(restTemplate.exchange(anyString(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{}"));

        service.fetchRecommendations(config, 100L,
                LocalDate.now(), LocalDate.now().plusDays(7));

        org.mockito.ArgumentCaptor<String> urlCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(restTemplate)
                .exchange(urlCaptor.capture(), any(HttpMethod.class), any(HttpEntity.class), eq(String.class));
        org.assertj.core.api.Assertions.assertThat(urlCaptor.getValue())
                .startsWith("https://custom.pricelabs.example");
    }
}
